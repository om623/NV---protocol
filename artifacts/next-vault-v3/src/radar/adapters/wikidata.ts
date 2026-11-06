// Wikidata (https://www.wikidata.org). Public, CORS enabled, CC0 data.
// Used for: industries, founders, parent/subsidiaries, inception, website,
// and dated financial statements that carry their own reference URLs.
//
// Property ids (verified against the live API):
//   P2139 total revenue, P2295 net profit, P2403 total assets, P2137 total equity,
//   P2138 total liabilities, P2226 market capitalization, P1128 employees,
//   P355 child organization, P749 parent organization, P112 founder, P452 industry,
//   P571 inception, P856 official website, P17 country, P297 ISO alpha-2.

import type { CompanyProfile, Metrics, MetricKey, NamedItem, Subsidiary } from '../types';
import { computeStatus } from '../format';
import { cacheGet, cacheSet, dedupe, fetchJson, DAY } from './http';

const ENDPOINT = 'https://query.wikidata.org/sparql';
export const WIKIDATA_SOURCE = 'Wikidata';
export const wikidataUrl = (qid: string) => `https://www.wikidata.org/wiki/${qid}`;

interface Binding { [k: string]: { value: string } | undefined }

async function sparql(query: string): Promise<Binding[]> {
  const url = `${ENDPOINT}?format=json&query=${encodeURIComponent(query)}`;
  const json = await fetchJson<{ results: { bindings: Binding[] } }>(url, { timeoutMs: 35000 });
  return json.results.bindings;
}

const v = (b: Binding, k: string): string | undefined => b[k]?.value;
const qidOf = (uri?: string): string | undefined => uri?.split('/').pop();
const langList = (lang: string) => (lang === 'en' ? 'en' : `${lang},en`);

// ── Basics for the whole directory (industries / inception / website) ────────

export interface WikidataBasics {
  industries: NamedItem[];
  inception?: string;
  website?: string;
}

export async function fetchBasics(qids: string[], lang: string): Promise<Record<string, WikidataBasics>> {
  const key = `wd.basics.${lang}.${qids.length}.v1`;
  const cached = cacheGet<Record<string, WikidataBasics>>(key, 7 * DAY);
  if (cached) return cached;
  return dedupe(key, async () => {
    const out: Record<string, WikidataBasics> = {};
    for (let i = 0; i < qids.length; i += 70) {
      const chunk = qids.slice(i, i + 70);
      const rows = await sparql(`
        SELECT ?c (SAMPLE(?inc) AS ?inception) (SAMPLE(?site) AS ?website)
               (GROUP_CONCAT(DISTINCT CONCAT(STRAFTER(STR(?ind), "entity/"), "~", ?indL); separator="|") AS ?inds)
        WHERE {
          VALUES ?c { ${chunk.map((q) => `wd:${q}`).join(' ')} }
          OPTIONAL { ?c wdt:P571 ?inc }
          OPTIONAL { ?c wdt:P856 ?site }
          OPTIONAL { ?c wdt:P452 ?ind }
          SERVICE wikibase:label { bd:serviceParam wikibase:language "${langList(lang)}". ?ind rdfs:label ?indL . }
        } GROUP BY ?c`);
      for (const r of rows) {
        const q = qidOf(v(r, 'c'));
        if (!q) continue;
        const industries: NamedItem[] = (v(r, 'inds') ?? '')
          .split('|')
          .filter(Boolean)
          .map((s) => {
            const [id, ...rest] = s.split('~');
            return { id, label: rest.join('~') };
          })
          .filter((n) => n.id && n.label && !/^Q\d+$/.test(n.label));
        out[q] = { industries, inception: v(r, 'inception')?.slice(0, 10), website: v(r, 'website') };
      }
    }
    cacheSet(key, out);
    return out;
  });
}

// ── Financial statements ─────────────────────────────────────────────────────

const METRIC_PROPS: [MetricKey, string][] = [
  ['revenue', 'P2139'], ['netIncome', 'P2295'], ['assets', 'P2403'], ['equity', 'P2137'],
  ['liabilities', 'P2138'], ['marketCap', 'P2226'], ['employees', 'P1128'],
];

export async function fetchWikidataMetrics(qid: string): Promise<Metrics> {
  const key = `wd.metrics.${qid}.v1`;
  const cached = cacheGet<Metrics>(key, DAY);
  if (cached) return cached;
  return dedupe(key, async () => {
    const values = METRIC_PROPS.map(([k, p]) => `("${k}" p:${p} ps:${p} psv:${p})`).join(' ');
    const rows = await sparql(`
      SELECT ?m ?val ?t ?cur ?ref WHERE {
        VALUES (?m ?p ?ps ?psv) { ${values} }
        wd:${qid} ?p ?s . ?s ?psv ?node . ?node wikibase:quantityAmount ?val .
        OPTIONAL { ?s pq:P585 ?t }
        OPTIONAL { ?node wikibase:quantityUnit ?u . ?u wdt:P498 ?cur }
        OPTIONAL { ?s prov:wasDerivedFrom/pr:P854 ?ref }
      } LIMIT 600`);
    const best = new Map<string, { n: number; t: string; cur?: string; ref?: string }>();
    for (const r of rows) {
      const m = v(r, 'm');
      const raw = v(r, 'val');
      if (!m || raw === undefined) continue;
      const n = Number(raw);
      if (!Number.isFinite(n)) continue;
      const t = v(r, 't') ?? '';
      const prev = best.get(m);
      if (!prev || t > prev.t) best.set(m, { n, t, cur: v(r, 'cur'), ref: v(r, 'ref') });
    }
    const metrics: Metrics = {};
    for (const [k] of METRIC_PROPS) {
      const b = best.get(k);
      if (!b) continue;
      const asOf = b.t ? b.t.slice(0, 10) : undefined;
      metrics[k] = {
        status: asOf ? computeStatus(asOf) : 'available',
        value: b.n,
        asOf,
        currency: k === 'employees' ? undefined : b.cur,
        source: WIKIDATA_SOURCE,
        sourceUrl: b.ref ?? wikidataUrl(qid),
        retrievedAt: new Date().toISOString(),
      };
    }
    cacheSet(key, metrics);
    return metrics;
  });
}

// ── Profile: founders, parent, subsidiaries, industries ─────────────────────

export type WikidataProfile = Omit<CompanyProfile, 'summary' | 'articleTitle'>;

export async function fetchWikidataProfile(qid: string, lang: string): Promise<WikidataProfile> {
  const key = `wd.profile.${qid}.${lang}.v1`;
  const cached = cacheGet<WikidataProfile>(key, 3 * DAY);
  if (cached) return cached;
  return dedupe(key, async () => {
    const rows = await sparql(`
      SELECT ?kind ?item ?itemLabel ?cc WHERE {
        { BIND("founder" AS ?kind) wd:${qid} wdt:P112 ?item }
        UNION { BIND("parent" AS ?kind) wd:${qid} wdt:P749 ?item }
        UNION { BIND("industry" AS ?kind) wd:${qid} wdt:P452 ?item }
        UNION { BIND("sub" AS ?kind) wd:${qid} wdt:P355 ?item . OPTIONAL { ?item wdt:P17 ?co . ?co wdt:P297 ?cc } }
        UNION { BIND("website" AS ?kind) wd:${qid} wdt:P856 ?item }
        UNION { BIND("inception" AS ?kind) wd:${qid} wdt:P571 ?item }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "${langList(lang)}". }
      } LIMIT 700`);

    const profile: WikidataProfile = { industries: [], founders: [], subsidiaries: [], subsidiaryCountries: [] };
    const subSeen = new Set<string>();
    const countries = new Set<string>();
    for (const r of rows) {
      const kind = v(r, 'kind');
      const uri = v(r, 'item');
      const label = v(r, 'itemLabel') ?? '';
      const id = qidOf(uri) ?? '';
      if (kind === 'website') { profile.website ??= uri; continue; }
      if (kind === 'inception') {
        const iso = uri?.slice(0, 10);
        if (iso && !profile.inception) {
          profile.inception = { status: 'available', value: iso, asOf: iso, source: WIKIDATA_SOURCE, sourceUrl: wikidataUrl(qid) };
        }
        continue;
      }
      if (!id || !label || /^Q\d+$/.test(label)) continue;
      const item: NamedItem = { id, label };
      if (kind === 'founder' && !profile.founders.some((f) => f.id === id)) profile.founders.push(item);
      else if (kind === 'parent') profile.parent ??= item;
      else if (kind === 'industry' && !profile.industries.some((f) => f.id === id)) profile.industries.push(item);
      else if (kind === 'sub') {
        const cc = v(r, 'cc');
        if (cc) countries.add(cc);
        if (!subSeen.has(id)) {
          subSeen.add(id);
          const sub: Subsidiary = { ...item, country: cc };
          profile.subsidiaries.push(sub);
        }
      }
    }
    profile.subsidiaryCountries = [...countries].sort();
    cacheSet(key, profile);
    return profile;
  });
}

// ── Wikipedia article titles (via Wikidata sitelinks) ────────────────────────

const WIKI_SITES = ['en', 'pt', 'es', 'fr', 'zh', 'ja', 'ko', 'hi', 'ar'];

export async function fetchSitelinks(qid: string): Promise<Record<string, string>> {
  const key = `wd.sitelinks.${qid}.v1`;
  const cached = cacheGet<Record<string, string>>(key, 7 * DAY);
  if (cached) return cached;
  return dedupe(key, async () => {
    const sites = WIKI_SITES.map((l) => `${l}wiki`).join('|');
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=sitelinks&sitefilter=${sites}&format=json&origin=*`;
    const json = await fetchJson<{ entities?: Record<string, { sitelinks?: Record<string, { title: string }> }> }>(url);
    const links = json.entities?.[qid]?.sitelinks ?? {};
    const out: Record<string, string> = {};
    for (const l of WIKI_SITES) {
      const t = links[`${l}wiki`]?.title;
      if (t) out[l] = t;
    }
    cacheSet(key, out);
    return out;
  });
}
