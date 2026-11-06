// Global Radar logic tests. Run: bun run scripts/radar-tests.ts
import { readFileSync } from 'node:fs';
import { buildWorld, clusterPoints, toXYZ, fromXYZ, type MarkerPoint } from '../src/radar/geo';
import { COMPANIES } from '../src/radar/data/companies';
import { SECTORS } from '../src/radar/data/sectors';
import { KNOWN_A2, continentOf } from '../src/radar/data/countries';
import { filterCompanies, defaultFilters } from '../src/radar/filters';
import { computeStatus } from '../src/radar/format';
import { buildRadarDicts, RADAR_KEYS } from '../src/i18n/radar';
import { getDict } from '../src/i18n/translations';
import { LOCALES } from '../src/i18n/types';

let pass = 0;
const failures: string[] = [];
function ok(cond: boolean, name: string, detail = '') {
  if (cond) pass++;
  else failures.push(`${name}${detail ? ' :: ' + detail : ''}`);
}

// ── Geometry ────────────────────────────────────────────────────────────────
const topo = JSON.parse(readFileSync(new URL('../node_modules/world-atlas/countries-50m.json', import.meta.url), 'utf8'));
const world = buildWorld(topo);
ok(world.countries.length > 200, 'world has >200 features', String(world.countries.length));
ok(world.borders.length > 100 && world.coasts.length > 100, 'borders and coasts built');
const unmapped = world.countries.filter((c) => !c.a2).map((c) => c.name);
console.log('features without ISO id (not selectable):', unmapped.join(', ') || 'none');

const probes: [string, number, number, string][] = [
  ['Brasilia', -15.79, -47.88, 'BR'], ['Tokyo', 35.68, 139.69, 'JP'], ['Paris', 48.86, 2.35, 'FR'],
  ['Sydney', -33.87, 151.21, 'AU'], ['Nairobi', -1.29, 36.82, 'KE'], ['Washington', 38.9, -77.04, 'US'],
  ['Riyadh', 24.71, 46.68, 'SA'], ['Delhi', 28.61, 77.21, 'IN'], ['Moscow', 55.75, 37.62, 'RU'],
];
for (const [n, lat, lon, a2] of probes) ok(world.pointCountry(lat, lon) === a2, `pointCountry ${n}`, String(world.pointCountry(lat, lon)));
ok(world.pointCountry(0, -30) === null, 'mid-Atlantic is ocean');

const rt = fromXYZ(...toXYZ(37.77, -122.42));
ok(Math.abs(rt.lat - 37.77) < 1e-6 && Math.abs(rt.lon + 122.42) < 1e-6, 'lat/lon round trip');
ok(Math.abs(toXYZ(0, 0)[0] - 1) < 1e-9 && Math.abs(toXYZ(90, 0)[1] - 1) < 1e-9, 'axes: lon0 on +x, north on +y');

// ── Company data integrity ──────────────────────────────────────────────────
ok(COMPANIES.length >= 250, 'directory size', String(COMPANIES.length));
ok(new Set(COMPANIES.map((c) => c.id)).size === COMPANIES.length, 'unique company ids');
ok(COMPANIES.every((c) => KNOWN_A2.has(c.country)), 'all countries known',
  COMPANIES.filter((c) => !KNOWN_A2.has(c.country)).map((c) => c.id).join(','));
ok(COMPANIES.every((c) => SECTORS.includes(c.sector)), 'all sectors valid');
ok(SECTORS.length === 30, '30 sectors');
const emptySectors = SECTORS.filter((s) => !COMPANIES.some((c) => c.sector === s));
ok(emptySectors.length === 0, 'every sector has companies', emptySectors.join(','));
const continents = new Set(COMPANIES.map((c) => continentOf(c.country)));
for (const k of ['NA', 'SA', 'EU', 'AS', 'AF', 'OC', 'ME']) ok(continents.has(k as never), `continent ${k} populated`);

// HQ coordinates must fall inside the seed country (microstates excluded: geometry too small at 50m)
const bad: string[] = [];
for (const c of COMPANIES) {
  // 50m coastlines can put a harbour city a few km offshore: accept the country within ~0.5 deg (~55 km)
  let found = false;
  for (let dy = -0.5; dy <= 0.5 && !found; dy = Math.round((dy + 0.1) * 100) / 100)
    for (let dx = -0.5; dx <= 0.5 && !found; dx = Math.round((dx + 0.1) * 100) / 100) found = world.pointCountry(c.lat + dy, c.lon + dx) === c.country;
  if (!found) bad.push(`${c.id}:${c.country}->${world.pointCountry(c.lat, c.lon)}`);
}
console.log(`HQ point-in-country mismatches (${bad.length}/${COMPANIES.length}):`, bad.join(' ') || 'none');
ok(bad.length === 0, 'HQ coordinates agree with country polygons (within ~55 km)', bad.join(' '));

// ── Filters ─────────────────────────────────────────────────────────────────
const ctx = {
  countryName: (a2: string) => a2, sectorName: (s: string) => s, continentName: (c: string) => c,
  industries: new Map(), loaded: new Map(),
};
const f = (p: Partial<typeof defaultFilters>) => filterCompanies(COMPANIES, { ...defaultFilters, ...p }, ctx);
ok(f({}).length === COMPANIES.length, 'no filters returns all');
ok(f({ query: 'apple' }).some((c) => c.id === 'apple'), 'search by name');
ok(f({ query: 'nvda' }).some((c) => c.id === 'nvidia'), 'search by ticker');
ok(f({ query: 'zzzzzz' }).length === 0, 'search no match');
ok(f({ sector: 'ai' }).every((c) => c.sector === 'ai') && f({ sector: 'ai' }).length > 3, 'sector filter');
ok(f({ continent: 'AF' }).every((c) => continentOf(c.country) === 'AF'), 'continent filter');
ok(f({ listing: 'private' }).every((c) => !c.ticker) && f({ listing: 'listed' }).every((c) => !!c.ticker), 'listing filter');
ok(f({ country: 'BR' }).every((c) => c.country === 'BR') && f({ country: 'BR' }).length > 5, 'country filter');
ok(f({ query: 'brazil', sector: 'mining' }).length <= f({ sector: 'mining' }).length, 'filters combine (AND)');

// ── Clustering ──────────────────────────────────────────────────────────────
const pts: MarkerPoint[] = COMPANIES.map((c) => ({ id: c.id, lat: c.lat, lon: c.lon, country: c.country, weight: 1 }));
const far = clusterPoints(pts, 0.2), near = clusterPoints(pts, 0.02);
ok(far.length < near.length && far.length > 5, 'zoom splits clusters', `${far.length} vs ${near.length}`);
ok(far.reduce((n, c) => n + c.ids.length, 0) === pts.length, 'clustering keeps every company exactly once');

// ── Data-state rules ────────────────────────────────────────────────────────
const old = new Date(Date.now() - 900 * 864e5).toISOString().slice(0, 10);
ok(computeStatus(new Date().toISOString().slice(0, 10)) === 'available', 'fresh data is available');
ok(computeStatus(old) === 'stale', 'old data is stale');
ok(computeStatus(undefined) === 'available', 'undated value stays available (shown as "date not provided")');

// ── i18n completeness ───────────────────────────────────────────────────────
const dicts = buildRadarDicts();
const ph = (s: string) => (s.match(/\{[a-z]+\}/gi) ?? []).sort().join();
for (const l of LOCALES) {
  const d = dicts[l.code];
  const missing = RADAR_KEYS.filter((k) => !d[k] || !d[k].trim());
  ok(missing.length === 0, `i18n ${l.code} complete`, missing.slice(0, 5).join(','));
  const mism = RADAR_KEYS.filter((k) => ph(d[k]) !== ph(dicts.en[k]));
  ok(mism.length === 0, `i18n ${l.code} placeholders match en`, mism.slice(0, 5).join(','));
  const merged = getDict(l.code);
  ok(merged['radar.tagline'] === d['radar.tagline'] && !!merged['nav.radar'], `i18n ${l.code} merged into app dictionary`);
}
const scriptOk = (code: string, re: RegExp) => ok(re.test(dicts[code as 'zh']['radar.tab.directory']), `${code} uses its own script`);
scriptOk('zh', /[\u4e00-\u9fff]/); scriptOk('ja', /[\u3040-\u30ff\u4e00-\u9fff]/); scriptOk('ko', /[\uac00-\ud7af]/);
scriptOk('hi', /[\u0900-\u097f]/); scriptOk('ar', /[\u0600-\u06ff]/);

// keys referenced by the code must exist
import { readdirSync, readFileSync as rf, statSync } from 'node:fs';
const used = new Set<string>();
const walk = (dir: string) => { for (const n of readdirSync(dir)) { const p = `${dir}/${n}`; if (statSync(p).isDirectory()) walk(p); else if (/\.tsx?$/.test(n)) for (const m of rf(p, 'utf8').matchAll(/t\('(radar\.[A-Za-z0-9_.]+)'/g)) used.add(m[1]); } };
walk(new URL('../src/radar', import.meta.url).pathname);
const unknown = [...used].filter((k) => !(k in dicts.en));
ok(unknown.length === 0, 'every static t("radar.*") key exists', unknown.join(','));

// dynamic key families
const fam: [string, string[]][] = [
  ['radar.sector.', [...SECTORS]], ['radar.continent.', ['NA', 'SA', 'EU', 'AS', 'ME', 'AF', 'OC']],
  ['radar.metric.', ['revenue', 'netIncome', 'equity', 'assets', 'liabilities', 'debt', 'marketCap', 'employees']],
  ['radar.ind.', ['gdp', 'gdpGrowth', 'gdpPerCapita', 'population', 'inflation', 'unemployment', 'fdi', 'manufacturing', 'policyRate', 'inflation12m']],
  ['radar.size.', ['mega', 'large', 'growth']], ['radar.tab.', ['directory', 'trends', 'compare', 'saved', 'sources']],
  ['radar.trends.theme.', ['ma', 'expansion', 'regulation']], ['radar.saved.kind.', ['search', 'company', 'country']],
  ['radar.sources.status.', ['live', 'needs-config', 'planned']],
  ['radar.sources.scope.', ['worldbank', 'bcb', 'wikidata', 'wikipedia', 'yahoo', 'gdelt', 'sec', 'companieshouse', 'cvm', 'b3', 'centralbanks', 'registries']],
  ['radar.compare.row.', ['country', 'sector', 'listing', 'price', 'ret1m', 'ret3m', 'revenue', 'netIncome', 'equity', 'assets', 'liabilities', 'debt', 'marketCap', 'employees']],
  ['radar.error.', ['generic', 'network', 'rate', 'notConfigured']],
];
for (const [p, ids] of fam) {
  const miss = ids.filter((i) => !(p + i in dicts.en));
  ok(miss.length === 0, `dynamic keys ${p}*`, miss.join(','));
}

console.log(`\n${pass} assertions passed, ${failures.length} failed`);
for (const f2 of failures) console.log('  FAIL', f2);
process.exit(failures.length ? 1 : 0);
