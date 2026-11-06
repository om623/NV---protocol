// Resolves each seed company to a verified Wikidata item and checks its Yahoo symbol.
// Run: bun run scripts/radar-verify.ts   (writes src/radar/data/verified.ts)
//
// A QID is accepted only when label, description, country AND prominence (number of
// Wikipedia sitelinks) agree. Anything ambiguous is printed for manual review and is
// either fixed through MANUAL below or left without a QID (the app then shows
// "unavailable" instead of guessing).

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
// Reset the generated file first so previous results never influence this run
// (companies.ts reads it to drop symbols that had no price).
writeFileSync(
  new URL('../src/radar/data/verified.ts', import.meta.url),
  'export const VERIFIED: Record<string, { qid?: string; px?: boolean; y?: string }> = {};\n',
);
const { COMPANIES } = await import('../src/radar/data/companies');

const UA = 'NVProtocolRadar/1.0 (https://github.com/om623/NV---protocol)';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const CACHE = '/tmp/radar-cands.json';

async function getJson(url: string, tries = 5): Promise<any> {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (res.status === 429 || res.status >= 500) { await sleep(2000 * (i + 1)); continue; }
    if (!res.ok) throw new Error(`${res.status} ${url.slice(0, 120)}`);
    return res.json();
  }
  throw new Error(`gave up ${url.slice(0, 120)}`);
}

const STOP = /\b(inc|corp|corporation|plc|sa|ag|se|nv|ltd|limited|group|holdings?|company|co|spa|asa|ab|oyj|the|n v)\b/g;
const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[.,&'’()\-–]/g, ' ').replace(STOP, ' ').replace(/\s+/g, ' ').trim();

const GOOD = /(compan|corporation|conglomerate|manufactur|bank|multinational|enterprise|firm|retailer|airline|start-?up|laborator|operator|utility|insurer|insurance|holding|producer|miner|mining|developer|brand|business|carmaker|automaker|maker|provider|supplier|lender|brewer|cooperative|platform|institution|corporation|group|concern|fund|exchange|network|studio)/i;
const BAD = /(film|album|song|band|surname|family name|given name|disambiguation|fictional|village|municipality|commune|comune|footballer|politician|novel|episode|asteroid|species|stereoisomer|archive|collection item)/i;

// Final decisions after reviewing the log (id -> QID). Empty string = deliberately unresolved.
const MANUAL: Record<string, string> = JSON.parse(existsSync('/tmp/radar-manual.json') ? readFileSync('/tmp/radar-manual.json', 'utf8') : '{}');

// Alternative Yahoo symbols to try when the derived one has no price.
const ALT_YAHOO: Record<string, string[]> = {
  embraer: ['EMBJ3.SA'], eletrobras: ['AXIA3.SA'], jbs: ['JBSS32.SA', 'JBS'], roche: ['RO.SW'],
  tatamotors: ['TMPV.NS', 'TMCV.NS'],
};

type Cand = { id: string; label: string; desc: string; matchAlias?: string };
const cands: Record<string, Cand[]> = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};

async function search() {
  for (const c of COMPANIES) {
    if (cands[c.id]) continue;
    const data = await getJson(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(c.name)}&language=en&type=item&limit=8&format=json`);
    cands[c.id] = (data.search ?? []).map((r: any) => ({
      id: r.id, label: r.label ?? '', desc: r.description ?? '',
      matchAlias: r.match?.type === 'alias' ? r.match.text : undefined,
    }));
    await sleep(250);
  }
  writeFileSync(CACHE, JSON.stringify(cands));
}

async function details(ids: string[]) {
  const sl = new Map<string, number>();
  const cc = new Map<string, Set<string>>();
  for (let i = 0; i < ids.length; i += 70) {
    const chunk = ids.slice(i, i + 70);
    const res = await getJson(
      'https://query.wikidata.org/sparql?format=json&query=' +
        encodeURIComponent(`SELECT ?c ?n ?cc WHERE { VALUES ?c { ${chunk.map((q) => 'wd:' + q).join(' ')} } OPTIONAL { ?c wikibase:sitelinks ?n } OPTIONAL { { ?c wdt:P17 ?co } UNION { ?c wdt:P159 ?h . ?h wdt:P17 ?co } ?co wdt:P297 ?cc } }`),
    );
    for (const b of res.results.bindings) {
      const q = b.c.value.split('/').pop() as string;
      if (b.n) sl.set(q, Number(b.n.value));
      if (b.cc) { if (!cc.has(q)) cc.set(q, new Set()); cc.get(q)!.add(b.cc.value); }
    }
    await sleep(1500);
  }
  return { sl, cc };
}

async function checkYahoo(sym: string): Promise<boolean> {
  try {
    const r = await getJson(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=5d`, 2);
    return typeof r?.chart?.result?.[0]?.meta?.regularMarketPrice === 'number';
  } catch { return false; }
}

async function main() {
  await search();
  const allIds = [...new Set(Object.values(cands).flat().filter((c) => !BAD.test(c.desc)).map((c) => c.id))];
  const { sl, cc } = await details(allIds);

  const out: Record<string, { qid?: string; px?: boolean; y?: string }> = {};
  const review: string[] = [];

  for (const c of COMPANIES) {
    if (c.id in MANUAL) { if (MANUAL[c.id]) out[c.id] = { qid: MANUAL[c.id] }; continue; }
    const b = norm(c.name);
    let best: { cand: Cand; score: number; n: number; ctry: string } | null = null;
    for (const cand of cands[c.id] ?? []) {
      if (BAD.test(cand.desc)) continue;
      const a = norm(cand.label);
      let score = 0;
      if (a === b) score += 3;
      else if (cand.matchAlias && norm(cand.matchAlias) === b) score += 2;
      else if (a && b && (a.startsWith(b) || b.startsWith(a))) score += 1;
      if (GOOD.test(cand.desc)) score += 2;
      const set = cc.get(cand.id);
      let ctry = set ? [...set].join('/') : 'n/a';
      if (set) score += set.has(c.country) ? 3 : -3;
      const n = sl.get(cand.id) ?? 0;
      score += Math.min(3, Math.log10(n + 1));
      if (!best || score > best.score) best = { cand, score, n, ctry };
    }
    if (best && best.score >= 7) {
      out[c.id] = { qid: best.cand.id };
      if (best.n < 12 || best.ctry === 'n/a' || !best.ctry.split('/').includes(c.country)) {
        review.push(`CHECK ${c.id}: ${best.cand.id} "${best.cand.label}" (${best.cand.desc}) sitelinks=${best.n} country=${best.ctry} seed=${c.country} score=${best.score.toFixed(1)}`);
      }
    } else {
      const top = (cands[c.id] ?? []).slice(0, 4).map((x) => `${x.id}:"${x.label}"[${x.desc.slice(0, 50)}]`).join(' | ');
      review.push(`LOW   ${c.id}: score=${best ? best.score.toFixed(1) : '-'} cands=${top}`);
    }
  }

  for (const c of COMPANIES) {
    if (!c.yahoo) continue;
    let ok = await checkYahoo(c.yahoo);
    let used: string | undefined;
    if (!ok) {
      for (const alt of ALT_YAHOO[c.id] ?? []) {
        await sleep(200);
        if (await checkYahoo(alt)) { ok = true; used = alt; break; }
      }
    }
    out[c.id] = { ...(out[c.id] ?? {}), px: ok, ...(used ? { y: used } : {}) };
    if (!ok) review.push(`PX    ${c.id}: no price for ${c.yahoo}`);
    await sleep(200);
  }

  const lines = Object.entries(out).map(([k, v]) => ` ${JSON.stringify(k)}: ${JSON.stringify(v)},`);
  const body =
    '// Generated by scripts/radar-verify.ts. Do not edit by hand.\n' +
    'export const VERIFIED: Record<string, { qid?: string; px?: boolean; y?: string }> = {\n' + lines.join('\n') + '\n};\n';
  writeFileSync(new URL('../src/radar/data/verified.ts', import.meta.url), body);
  console.log(`companies=${COMPANIES.length} qids=${Object.values(out).filter((v) => v.qid).length} pxOk=${Object.values(out).filter((v) => v.px).length}`);
  console.log(review.join('\n'));
}
main();
