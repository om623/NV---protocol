// Orchestrates the source adapters for one company. Each section loads, fails and
// retries independently, so one slow or rate-limited source never blocks the rest.

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { CompanyProfile, CompanySeed, LoadState, Metrics, MetricKey, NewsItem, Quote, Sourced } from './types';
import { METRIC_KEYS } from './types';
import { fetchSecMetrics } from './adapters/sec';
import { fetchSitelinks, fetchWikidataMetrics, fetchWikidataProfile } from './adapters/wikidata';
import { fetchWikiSummary } from './adapters/wikipedia';
import { fetchQuote } from './adapters/quote';
import { fetchNews } from './adapters/gdelt';
import { SourceError } from './adapters/http';

// ── Loaded-metrics registry (lets the directory filter by figures already loaded) ──

const loaded = new Map<string, Metrics>();
const subs = new Set<() => void>();
let version = 0;
export function registerMetrics(id: string, m: Metrics) {
  loaded.set(id, m);
  version++;
  subs.forEach((s) => s());
}
export function useLoadedMetrics(): { map: Map<string, Metrics>; version: number } {
  const v = useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => version);
  return { map: loaded, version: v };
}

// ── Metrics ──────────────────────────────────────────────────────────────────

export type MetricNote = 'sec_not_configured' | 'sec_failed' | 'wikidata_failed';

export interface MetricsResult {
  metrics: Record<MetricKey, Sourced<number>>;
  notes: MetricNote[];
}

function complete(company: CompanySeed, sec: Metrics, wd: Metrics): Record<MetricKey, Sourced<number>> {
  const out = {} as Record<MetricKey, Sourced<number>>;
  for (const k of METRIC_KEYS) {
    const found = sec[k] ?? wd[k];
    // A listed company with no figure is "unavailable"; a private one is "not disclosed".
    out[k] = found ?? { status: company.listed || k === 'employees' ? 'unavailable' : 'not_disclosed' };
  }
  return out;
}

export function useCompanyMetrics(company: CompanySeed | undefined): LoadState<MetricsResult> & { reload: () => void } {
  const [state, setState] = useState<LoadState<MetricsResult>>({ state: 'idle' });
  const [tick, setTick] = useState(0);
  const id = company?.id;

  useEffect(() => {
    if (!company) { setState({ state: 'idle' }); return; }
    let cancelled = false;
    setState({ state: 'loading' });
    const notes: MetricNote[] = [];
    const secP = company.sec
      ? fetchSecMetrics(company.sec).then((r) => r.metrics).catch((e: unknown) => {
          notes.push(e instanceof SourceError && e.code === 'not_configured' ? 'sec_not_configured' : e instanceof SourceError && e.code === 'not_found' ? 'sec_failed' : 'sec_failed');
          if (e instanceof SourceError && e.code === 'not_found') notes.pop();
          return {} as Metrics;
        })
      : Promise.resolve({} as Metrics);
    const wdP = company.qid
      ? fetchWikidataMetrics(company.qid).catch(() => { notes.push('wikidata_failed'); return {} as Metrics; })
      : Promise.resolve({} as Metrics);
    Promise.all([secP, wdP]).then(([sec, wd]) => {
      if (cancelled) return;
      const metrics = complete(company, sec, wd);
      registerMetrics(company.id, metrics);
      setState({ state: 'ready', data: { metrics, notes: [...new Set(notes)] } });
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, tick]);

  return { ...state, reload: useCallback(() => setTick((n) => n + 1), []) };
}

// ── Profile (Wikidata + Wikipedia) ───────────────────────────────────────────

const LANG_OF: Record<string, string> = { 'pt-BR': 'pt', en: 'en', es: 'es', fr: 'fr', zh: 'zh', ja: 'ja', ko: 'ko', hi: 'hi', ar: 'ar' };
export const wikiLang = (locale: string) => LANG_OF[locale] ?? 'en';

export function useCompanyProfile(company: CompanySeed | undefined, locale: string): LoadState<CompanyProfile> & { reload: () => void } {
  const [state, setState] = useState<LoadState<CompanyProfile>>({ state: 'idle' });
  const [tick, setTick] = useState(0);
  const lang = wikiLang(locale);
  const id = company?.id;

  useEffect(() => {
    if (!company?.qid) { setState({ state: 'idle' }); return; }
    const qid = company.qid;
    let cancelled = false;
    setState({ state: 'loading' });
    Promise.all([fetchWikidataProfile(qid, lang), fetchSitelinks(qid).catch(() => ({} as Record<string, string>))])
      .then(async ([wd, links]) => {
        if (cancelled) return;
        const pick = links[lang] ? { lang, title: links[lang] } : links.en ? { lang: 'en', title: links.en } : undefined;
        const base: CompanyProfile = { ...wd, articleTitle: pick };
        setState({ state: 'ready', data: base });
        if (!pick) return;
        const tryOrder = pick.lang === 'en' ? [pick] : [pick, ...(links.en ? [{ lang: 'en', title: links.en }] : [])];
        for (const p of tryOrder) {
          try {
            const s = await fetchWikiSummary(p.lang, p.title);
            if (cancelled) return;
            setState({ state: 'ready', data: { ...base, summary: { text: s.text, lang: s.lang, url: s.url } } });
            return;
          } catch {
            // try the next language
          }
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setState({ state: 'error', message: (e as Error).message, code: e instanceof SourceError ? e.code : undefined });
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, lang, tick]);

  return { ...state, reload: useCallback(() => setTick((n) => n + 1), []) };
}

// ── Quote ────────────────────────────────────────────────────────────────────

export function useCompanyQuote(company: CompanySeed | undefined): LoadState<Quote> & { reload: () => void } {
  const [state, setState] = useState<LoadState<Quote>>({ state: 'idle' });
  const [tick, setTick] = useState(0);
  const id = company?.id;
  useEffect(() => {
    if (!company?.yahoo) { setState({ state: 'idle' }); return; }
    let cancelled = false;
    setState({ state: 'loading' });
    fetchQuote(company.yahoo)
      .then((q) => { if (!cancelled) setState({ state: 'ready', data: q }); })
      .catch((e: unknown) => { if (!cancelled) setState({ state: 'error', message: (e as Error).message, code: e instanceof SourceError ? e.code : undefined }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, tick]);
  return { ...state, reload: useCallback(() => setTick((n) => n + 1), []) };
}

// ── News ─────────────────────────────────────────────────────────────────────

export function newsQueryFor(company: CompanySeed): string {
  const clean = company.name.replace(/,?\s+(Inc\.?|plc|N\.V\.|S\.A\.|SE|AG|Ltd\.?|Limited|Corporation|Corp\.?|Company)$/i, '').replace(/\s*\(.*\)$/, '');
  return `"${clean}"`;
}

export function useCompanyNews(company: CompanySeed | undefined): LoadState<NewsItem[]> & { reload: () => void } {
  const [state, setState] = useState<LoadState<NewsItem[]>>({ state: 'idle' });
  const [tick, setTick] = useState(0);
  const id = company?.id;
  useEffect(() => {
    if (!company) { setState({ state: 'idle' }); return; }
    let cancelled = false;
    setState({ state: 'loading' });
    fetchNews(newsQueryFor(company), 8)
      .then((items) => { if (!cancelled) setState({ state: 'ready', data: items }); })
      .catch((e: unknown) => { if (!cancelled) setState({ state: 'error', message: (e as Error).message, code: e instanceof SourceError ? e.code : undefined }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, tick]);
  return { ...state, reload: useCallback(() => setTick((n) => n + 1), []) };
}
