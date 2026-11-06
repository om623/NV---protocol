// GDELT DOC 2.0 (https://api.gdeltproject.org). Open global news index.
// Limit: one request every 5 seconds. Browsers call NV's /api/radar-news function (CDN-cached,
// no CORS dependence) and all calls go through a spaced queue.

import type { NewsItem } from '../types';
import { cacheGet, cacheSet, createSpacedQueue, dedupe, fetchJson, SourceError } from './http';

const enqueue = createSpacedQueue(5500);
const TTL = 30 * 60_000;

interface GdeltResponse {
  articles?: { url: string; title: string; seendate?: string; domain?: string; language?: string }[];
}

function parseSeen(s?: string): string | null {
  // 20261105T120000Z
  const m = s?.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z` : null;
}

export const GDELT_SOURCE = 'GDELT Project';
export const GDELT_URL = 'https://www.gdeltproject.org/';

/**
 * Search recent news. `query` uses GDELT syntax (quote exact names).
 * Results are cached for 30 minutes; a 429 surfaces as SourceError('rate_limited').
 */
export function fetchNews(query: string, max = 8, timespan = '3months'): Promise<NewsItem[]> {
  const key = `gdelt.${timespan}.${max}.${query}`;
  const cached = cacheGet<NewsItem[]>(key, TTL);
  if (cached) return Promise.resolve(cached);
  return dedupe(key, () =>
    enqueue(async () => {
      const url = `/api/radar-news?q=${encodeURIComponent(query)}&timespan=${timespan}&max=${Math.min(max, 25)}`;
      let json: GdeltResponse;
      try {
        json = await fetchJson<GdeltResponse>(url, { timeoutMs: 25000, retries: 0 });
      } catch (err) {
        // GDELT answers non-JSON text on rate limiting / empty results
        if (err instanceof SourceError && err.code === 'parse') return [];
        throw err;
      }
      const seen = new Set<string>();
      const items: NewsItem[] = [];
      for (const a of json.articles ?? []) {
        const norm = a.title.trim().toLowerCase();
        if (!a.title || seen.has(norm)) continue;
        seen.add(norm);
        items.push({ title: a.title.trim(), url: a.url, domain: a.domain ?? new URL(a.url).hostname, date: parseSeen(a.seendate), language: a.language });
        if (items.length >= max) break;
      }
      cacheSet(key, items);
      return items;
    }),
  );
}
