// Wikipedia REST summary (https://www.mediawiki.org/wiki/API:REST_API). CORS enabled, CC BY-SA text.

import { cacheGet, cacheSet, dedupe, fetchJson, DAY } from './http';

export interface WikiSummary {
  text: string;
  lang: string;
  url: string;
  title: string;
}

export function fetchWikiSummary(lang: string, title: string): Promise<WikiSummary> {
  const key = `wp.${lang}.${title}.v1`;
  const cached = cacheGet<WikiSummary>(key, 7 * DAY);
  if (cached) return Promise.resolve(cached);
  return dedupe(key, async () => {
    const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`;
    const j = await fetchJson<{ extract?: string; title?: string; content_urls?: { desktop?: { page?: string } } }>(url);
    if (!j.extract) throw new Error('empty summary');
    const out: WikiSummary = {
      text: j.extract,
      lang,
      title: j.title ?? title,
      url: j.content_urls?.desktop?.page ?? `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title)}`,
    };
    cacheSet(key, out);
    return out;
  });
}
