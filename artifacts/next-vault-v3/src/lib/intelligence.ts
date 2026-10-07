// ─── NV Intelligence — Global News & Market Intelligence ─────────────────────
//
// REAL DATA ONLY. No fabricated articles, sources, or timestamps.
//
// Architecture:
//   - NewsProvider: single feed unit (RSS via rss2json proxy, no key required)
//   - MarketRegion: geographic grouping (Global / Americas / Europe / Asia / Middle East)
//   - CountryMarket: named source cluster (USA, UK, Brazil, Europe, China, Japan, Korea, India, Middle East)
//   - fetchAllNews(): merges, deduplicates, sorts
//   - answerFromNews(): locale-aware Q&A from loaded items only
//   - NV News infrastructure: ready for voice integration (no audio implemented yet)
//
// Keyless public RSS feeds only — all via rss2json.com free tier.
//
// PENDING INTEGRATIONS (require API keys):
//   NewsAPI.org        VITE_NEWSAPI_KEY          — broad global coverage
//   Polygon.io         VITE_POLYGON_KEY           — equities, dividends, REITs
//   CryptoPanic (auth) VITE_CRYPTOPANIC_KEY       — crypto + tokenization filters
//   Alpha Vantage      VITE_ALPHAVANTAGE_KEY      — economic indicators
//   TheNewsAPI.com     VITE_THENEWSAPI_KEY        — geopolitics, M&A
//   GDELT              VITE_GDELT_KEY             — geopolitics (also has free tier)

import type { Locale } from '../i18n/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type NewsCategory =
  | 'Crypto/Web3'
  | 'Tokenization'
  | 'Equities'
  | 'M&A'
  | 'Politics'
  | 'Geopolitics'
  | 'Small Caps'
  | 'Dividends'
  | 'Economy'
  | 'REITs'
  | 'FIIs'
  | 'Central Banks'
  | 'Regulation'
  | 'Global Markets';

export type NewsPriority = 'breaking' | 'high' | 'medium' | 'low';

export type MarketRegion = 'global' | 'americas' | 'europe' | 'asia' | 'middle-east';

export type CountryMarket =
  | 'USA'
  | 'UK'
  | 'Brazil'
  | 'Europe'
  | 'China'
  | 'Japan'
  | 'South Korea'
  | 'India'
  | 'Middle East'
  | 'Latin America'
  | 'Global';

export interface NewsItem {
  /** Stable dedup key */
  id: string;
  title: string;
  summary: string;
  category: NewsCategory;
  priority: NewsPriority;
  /** ISO-8601 */
  publishedAt: string;
  publishedMs: number;
  /** Fetch timestamp (ms) */
  collectedAt: number;
  source: string;
  sourceUrl: string;
  url: string;
  tags: string[];
  provider: string;
  /** Geographic region */
  region: MarketRegion;
  /** Named market */
  country: CountryMarket;
  /** BCP-47 of original article */
  originalLanguage: string;
}

export interface NewsProvider {
  id: string;
  name: string;
  url: string;
  categories: NewsCategory[];
  region: MarketRegion;
  country: CountryMarket;
  /** BCP-47 language of this feed's content */
  language: string;
  fetch(): Promise<NewsItem[]>;
}

export interface AgentMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: { title: string; url: string; source: string; publishedAt: string }[];
  timestamp: number;
}

export interface AgentResponse {
  answer: string;
  sources: { title: string; url: string; source: string; publishedAt: string }[];
}

// NV News infrastructure — ready for voice layer
export interface NVNewsItem {
  headline: string;
  summary: string;
  source: string;
  country: CountryMarket;
  region: MarketRegion;
  category: NewsCategory;
  priority: NewsPriority;
  publishedAt: string;
  url: string;
  /** Script text ready for TTS in the user's selected language */
  voiceScript: string;
  /**
   * Editorial relevance to the current locale:
   *   2 = primary country match (local)
   *   1 = primary region match
   *   0 = global / systemic (always preserved)
   */
  editorialTier?: 0 | 1 | 2;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const FEED_REFRESH_MS = 30_000;
export const MAX_ITEMS = 400;

export const ALL_CATEGORIES: NewsCategory[] = [
  'Crypto/Web3',
  'Tokenization',
  'Equities',
  'M&A',
  'Politics',
  'Geopolitics',
  'Small Caps',
  'Dividends',
  'Economy',
  'REITs',
  'FIIs',
  'Central Banks',
  'Regulation',
  'Global Markets',
];

export const ALL_REGIONS: { id: MarketRegion; labelKey: string }[] = [
  { id: 'global',      labelKey: 'intel.global' },
  { id: 'americas',    labelKey: 'intel.americas' },
  { id: 'europe',      labelKey: 'intel.europe' },
  { id: 'asia',        labelKey: 'intel.asia' },
  { id: 'middle-east', labelKey: 'intel.middleEast' },
];

export const ALL_COUNTRY_MARKETS: CountryMarket[] = [
  'USA', 'UK', 'Brazil', 'Europe', 'China', 'Japan', 'South Korea', 'India', 'Middle East', 'Latin America', 'Global',
];

const PRIORITY_ORDER: Record<NewsPriority, number> = {
  breaking: 0, high: 1, medium: 2, low: 3,
};

// ─── Language labels (BCP-47 → human-readable) ────────────────────────────────

export const LANGUAGE_LABELS: Record<string, string> = {
  'en': 'English',
  'pt': 'Português',
  'pt-BR': 'Português',
  'es': 'Español',
  'fr': 'Français',
  'de': 'Deutsch',
  'zh': '中文',
  'ja': '日本語',
  'ko': '한국어',
  'hi': 'हिन्दी',
  'ar': 'العربية',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeDate(str: string | undefined): number {
  if (!str) return Date.now();
  const ms = Date.parse(str);
  return isNaN(ms) ? Date.now() : ms;
}

function classifyPriority(title: string, tags: string[]): NewsPriority {
  const text = (title + ' ' + tags.join(' ')).toLowerCase();
  if (/breaking|urgent|crash|collapse|ban|war|sanction|fed|hike|cut|default|halt|emergency|crisis|attack|invasion/.test(text))
    return 'breaking';
  if (/surge|soar|rally|plunge|drop|acquisition|merger|ipo|launch|approval|regulation|election|rate|inflation/.test(text))
    return 'high';
  if (/rise|fall|gain|loss|report|announce|update|partner|integration|forecast|outlook|earnings/.test(text))
    return 'medium';
  return 'low';
}

function guessCategory(title: string, tags: string[]): NewsCategory {
  const text = (title + ' ' + tags.join(' ')).toLowerCase();
  if (/bitcoin|ethereum|crypto|defi|nft|web3|blockchain|token|usdc|stablecoin|wallet|layer.?2|dao|solana|polygon|arbitrum|optimism|binance|coinbase/.test(text)) {
    if (/tokeniz|rwa|real.world.asset/.test(text)) return 'Tokenization';
    return 'Crypto/Web3';
  }
  if (/tokeniz|rwa|real.world.asset|asset.backed|digital.asset/.test(text)) return 'Tokenization';
  if (/central.bank|ecb|fed|boj|pboc|rbi|boe|monetary.policy|interest.rate.decision|rate.hike|rate.cut|quantitative/.test(text)) return 'Central Banks';
  if (/regulat|sec|cftc|esma|fca|fsb|compliance|law|legislation|bill|ban/.test(text)) return 'Regulation';
  if (/merger|acquisition|m&a|takeover|buyout|deal|acquire/.test(text)) return 'M&A';
  if (/dividend|yield|payout|distribution/.test(text)) return 'Dividends';
  if (/reit|real.estate.investment.trust/.test(text)) return 'REITs';
  if (/fii|fundo.imobiliário|fundo imobiliário/.test(text)) return 'FIIs';
  if (/small.?cap|micro.?cap|penny.?stock/.test(text)) return 'Small Caps';
  if (/election|president|congress|senate|government|political|policy|legislation|vote|minister|parliament/.test(text)) return 'Politics';
  if (/war|conflict|sanction|nato|russia|china|middle.east|geopolit|territory|military|troops|missile|drone/.test(text)) return 'Geopolitics';
  if (/gdp|inflation|cpi|ppi|interest.rate|economy|recession|growth|unemployment|jobs|payroll|trade|tariff/.test(text)) return 'Economy';
  if (/stock|equity|nasdaq|nyse|nikkei|hang.seng|dax|ftse|kospi|sensex|s&p|dow|share|ipo|earnings|quarter/.test(text)) return 'Equities';
  if (/market|index|global|world|international|cross.border/.test(text)) return 'Global Markets';
  return 'Global Markets';
}

// ─── Deduplication ────────────────────────────────────────────────────────────

/** Extract a normalised slug from a URL for cross-domain dedup (e.g. syndicated content). */
function urlSlug(url: string): string {
  try {
    const u = new URL(url);
    // Take the last 2 path segments, strip query/hash
    const parts = u.pathname.split('/').filter(Boolean);
    return parts.slice(-2).join('/').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 50);
  } catch {
    return url.slice(0, 60);
  }
}

export function deduplicateNews(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  const result: NewsItem[] = [];
  for (const item of items) {
    if (seen.has(item.url)) continue;
    seen.add(item.url);

    // Normalised title key (catches same article under slightly different URLs)
    const titleKey = 't:' + item.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60);
    if (seen.has(titleKey)) continue;
    seen.add(titleKey);

    // URL slug key (catches syndicated/cross-posted articles)
    const slug = 's:' + urlSlug(item.url);
    if (slug.length > 4 && seen.has(slug)) continue;
    seen.add(slug);

    result.push(item);
  }
  return result;
}

export function sortNews(items: NewsItem[]): NewsItem[] {
  return [...items].sort((a, b) => {
    const pd = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (pd !== 0) return pd;
    return b.publishedMs - a.publishedMs;
  });
}

// ─── RSS fetcher ──────────────────────────────────────────────────────────────

const RSS2JSON_BASE = 'https://api.rss2json.com/v1/api.json?rss_url=';
const RSS_TTL = 60_000;

interface Rss2JsonItem {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  author?: string;
  categories?: string[];
  guid?: string;
}

interface Rss2JsonResponse {
  status: string;
  items?: Rss2JsonItem[];
}

const rssCache = new Map<string, { data: NewsItem[]; ts: number }>();

async function fetchRss(
  feedUrl: string,
  provider: string,
  sourceName: string,
  sourceUrl: string,
  region: MarketRegion,
  country: CountryMarket,
  language: string,
  defaultCategory?: NewsCategory,
): Promise<NewsItem[]> {
  const cached = rssCache.get(feedUrl);
  if (cached && Date.now() - cached.ts < RSS_TTL) return cached.data;

  try {
    const url = RSS2JSON_BASE + encodeURIComponent(feedUrl);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as Rss2JsonResponse;
    if (json.status !== 'ok' || !json.items?.length) return cached?.data ?? [];

    const now = Date.now();
    const items: NewsItem[] = json.items.slice(0, 30).map(item => {
      const tags = item.categories ?? [];
      const cat = defaultCategory ?? guessCategory(item.title, tags);
      const ms = safeDate(item.pubDate);
      return {
        id: item.link || (provider + ':' + (item.guid ?? item.title.slice(0, 40))),
        title: item.title.trim(),
        summary: item.description
          ? item.description.replace(/<[^>]*>/g, '').slice(0, 240).trim()
          : '',
        category: cat,
        priority: classifyPriority(item.title, tags),
        publishedAt: item.pubDate,
        publishedMs: ms,
        collectedAt: now,
        source: sourceName,
        sourceUrl,
        url: item.link,
        tags,
        provider,
        region,
        country,
        originalLanguage: language,
      };
    });

    rssCache.set(feedUrl, { data: items, ts: now });
    return items;
  } catch (err) {
    console.warn('[NV Intelligence] RSS fetch failed:', feedUrl, err);
    return cached?.data ?? [];
  }
}

// ─── Provider registry ────────────────────────────────────────────────────────
// ~9 real sources per major market. All public, keyless RSS feeds.
// Sources chosen for editorial credibility and international recognition.

export const PROVIDERS: NewsProvider[] = [

  // ════════════════════════════════════════════════════════════════════════════
  // USA — ~9 sources
  // ════════════════════════════════════════════════════════════════════════════

  {
    id: 'reuters-business',
    name: 'Reuters Business',
    url: 'https://reuters.com',
    categories: ['Equities', 'M&A', 'Economy', 'Geopolitics', 'Politics'],
    region: 'americas',
    country: 'USA',
    language: 'en',
    async fetch() {
      return fetchRss('https://feeds.reuters.com/reuters/businessNews', this.id, 'Reuters', 'https://reuters.com', this.region, this.country, this.language);
    },
  },
  {
    id: 'reuters-world',
    name: 'Reuters World',
    url: 'https://reuters.com',
    categories: ['Geopolitics', 'Politics', 'Economy'],
    region: 'global',
    country: 'Global',
    language: 'en',
    async fetch() {
      return fetchRss('https://feeds.reuters.com/Reuters/worldNews', this.id, 'Reuters', 'https://reuters.com', this.region, this.country, this.language, 'Geopolitics');
    },
  },
  {
    id: 'bloomberg-markets',
    name: 'Bloomberg Markets',
    url: 'https://bloomberg.com',
    categories: ['Equities', 'Economy', 'Dividends', 'REITs', 'Global Markets'],
    region: 'americas',
    country: 'USA',
    language: 'en',
    async fetch() {
      return fetchRss('https://feeds.bloomberg.com/markets/news.rss', this.id, 'Bloomberg', 'https://bloomberg.com/markets', this.region, this.country, this.language);
    },
  },
  {
    id: 'wsj-markets',
    name: 'WSJ Markets',
    url: 'https://wsj.com',
    categories: ['Equities', 'Economy', 'M&A', 'Central Banks'],
    region: 'americas',
    country: 'USA',
    language: 'en',
    async fetch() {
      return fetchRss('https://feeds.a.dj.com/rss/RSSMarketsMain.xml', this.id, 'Wall Street Journal', 'https://www.wsj.com/news/markets', this.region, this.country, this.language);
    },
  },
  {
    id: 'wsj-world',
    name: 'WSJ World News',
    url: 'https://wsj.com',
    categories: ['Geopolitics', 'Politics', 'Economy'],
    region: 'global',
    country: 'Global',
    language: 'en',
    async fetch() {
      return fetchRss('https://feeds.a.dj.com/rss/RSSWorldNews.xml', this.id, 'Wall Street Journal', 'https://www.wsj.com/news/world', this.region, this.country, this.language, 'Geopolitics');
    },
  },
  {
    id: 'coindesk',
    name: 'CoinDesk',
    url: 'https://coindesk.com',
    categories: ['Crypto/Web3', 'Tokenization', 'Regulation'],
    region: 'americas',
    country: 'USA',
    language: 'en',
    async fetch() {
      return fetchRss('https://www.coindesk.com/arc/outboundfeeds/rss/', this.id, 'CoinDesk', 'https://www.coindesk.com', this.region, this.country, this.language);
    },
  },
  {
    id: 'cointelegraph',
    name: 'Cointelegraph',
    url: 'https://cointelegraph.com',
    categories: ['Crypto/Web3', 'Tokenization', 'Regulation'],
    region: 'americas',
    country: 'USA',
    language: 'en',
    async fetch() {
      return fetchRss('https://cointelegraph.com/rss', this.id, 'Cointelegraph', 'https://cointelegraph.com', this.region, this.country, this.language);
    },
  },
  {
    id: 'theblock',
    name: 'The Block',
    url: 'https://theblock.co',
    categories: ['Crypto/Web3', 'M&A', 'Regulation', 'Tokenization'],
    region: 'americas',
    country: 'USA',
    language: 'en',
    async fetch() {
      return fetchRss('https://www.theblock.co/rss.xml', this.id, 'The Block', 'https://www.theblock.co', this.region, this.country, this.language);
    },
  },
  {
    id: 'decrypt',
    name: 'Decrypt',
    url: 'https://decrypt.co',
    categories: ['Crypto/Web3', 'Tokenization'],
    region: 'americas',
    country: 'USA',
    language: 'en',
    async fetch() {
      return fetchRss('https://decrypt.co/feed', this.id, 'Decrypt', 'https://decrypt.co', this.region, this.country, this.language);
    },
  },

  // ════════════════════════════════════════════════════════════════════════════
  // UK — ~6 sources
  // ════════════════════════════════════════════════════════════════════════════

  {
    id: 'bbc-business',
    name: 'BBC Business',
    url: 'https://bbc.com',
    categories: ['Economy', 'Equities', 'Global Markets', 'Politics'],
    region: 'europe',
    country: 'UK',
    language: 'en',
    async fetch() {
      return fetchRss('https://feeds.bbci.co.uk/news/business/rss.xml', this.id, 'BBC Business', 'https://www.bbc.com/news/business', this.region, this.country, this.language);
    },
  },
  {
    id: 'bbc-world',
    name: 'BBC World',
    url: 'https://bbc.com',
    categories: ['Geopolitics', 'Politics', 'Economy'],
    region: 'global',
    country: 'UK',
    language: 'en',
    async fetch() {
      return fetchRss('https://feeds.bbci.co.uk/news/world/rss.xml', this.id, 'BBC World', 'https://www.bbc.com/news/world', this.region, this.country, this.language, 'Geopolitics');
    },
  },
  {
    id: 'ft-markets',
    name: 'Financial Times',
    url: 'https://ft.com',
    categories: ['Equities', 'Economy', 'M&A', 'Central Banks', 'Global Markets'],
    region: 'europe',
    country: 'UK',
    language: 'en',
    async fetch() {
      return fetchRss('https://www.ft.com/rss/home/uk', this.id, 'Financial Times', 'https://www.ft.com', this.region, this.country, this.language);
    },
  },
  {
    id: 'guardian-business',
    name: 'The Guardian Business',
    url: 'https://theguardian.com',
    categories: ['Economy', 'Politics', 'Regulation', 'M&A'],
    region: 'europe',
    country: 'UK',
    language: 'en',
    async fetch() {
      return fetchRss('https://www.theguardian.com/uk/business/rss', this.id, 'The Guardian', 'https://www.theguardian.com/uk/business', this.region, this.country, this.language);
    },
  },
  {
    id: 'sky-business',
    name: 'Sky News Business',
    url: 'https://news.sky.com',
    categories: ['Economy', 'Equities', 'Politics'],
    region: 'europe',
    country: 'UK',
    language: 'en',
    async fetch() {
      return fetchRss('https://feeds.skynews.com/feeds/rss/business.xml', this.id, 'Sky News', 'https://news.sky.com/business', this.region, this.country, this.language);
    },
  },

  // ════════════════════════════════════════════════════════════════════════════
  // Brazil — ~6 sources (feeds in Portuguese — flag originalLanguage: 'pt')
  // ════════════════════════════════════════════════════════════════════════════

  {
    id: 'valor-economico',
    name: 'Valor Econômico',
    url: 'https://valor.globo.com',
    categories: ['Economy', 'Equities', 'FIIs', 'Central Banks', 'M&A'],
    region: 'americas',
    country: 'Brazil',
    language: 'pt',
    async fetch() {
      return fetchRss('https://pox.globo.com/rss/valor/', this.id, 'Valor Econômico', 'https://valor.globo.com', this.region, this.country, this.language);
    },
  },
  {
    id: 'infomoney',
    name: 'InfoMoney',
    url: 'https://infomoney.com.br',
    categories: ['Equities', 'Small Caps', 'Dividends', 'FIIs', 'Economy'],
    region: 'americas',
    country: 'Brazil',
    language: 'pt',
    async fetch() {
      return fetchRss('https://www.infomoney.com.br/feed/', this.id, 'InfoMoney', 'https://www.infomoney.com.br', this.region, this.country, this.language);
    },
  },
  {
    id: 'investing-br',
    name: 'Investing.com BR',
    url: 'https://br.investing.com',
    categories: ['Equities', 'Economy', 'Crypto/Web3', 'Global Markets'],
    region: 'americas',
    country: 'Brazil',
    language: 'pt',
    async fetch() {
      return fetchRss('https://br.investing.com/rss/news_25.rss', this.id, 'Investing.com', 'https://br.investing.com', this.region, this.country, this.language);
    },
  },
  {
    id: 'exame',
    name: 'Exame',
    url: 'https://exame.com',
    categories: ['Economy', 'Equities', 'M&A', 'Politics', 'Small Caps'],
    region: 'americas',
    country: 'Brazil',
    language: 'pt',
    async fetch() {
      return fetchRss('https://exame.com/feed/', this.id, 'Exame', 'https://exame.com', this.region, this.country, this.language);
    },
  },
  {
    id: 'money-times',
    name: 'Money Times',
    url: 'https://moneytimes.com.br',
    categories: ['Crypto/Web3', 'Equities', 'Small Caps', 'FIIs'],
    region: 'americas',
    country: 'Brazil',
    language: 'pt',
    async fetch() {
      return fetchRss('https://www.moneytimes.com.br/feed/', this.id, 'Money Times', 'https://www.moneytimes.com.br', this.region, this.country, this.language);
    },
  },

  // ════════════════════════════════════════════════════════════════════════════
  // Europe (continental) — ~6 sources
  // ════════════════════════════════════════════════════════════════════════════

  {
    id: 'euronews-business',
    name: 'Euronews Business',
    url: 'https://euronews.com',
    categories: ['Economy', 'Politics', 'Geopolitics', 'Regulation', 'Global Markets'],
    region: 'europe',
    country: 'Europe',
    language: 'en',
    async fetch() {
      return fetchRss('https://www.euronews.com/rss?level=theme&name=business', this.id, 'Euronews', 'https://www.euronews.com/business', this.region, this.country, this.language);
    },
  },
  {
    id: 'dw-economy',
    name: 'DW Business',
    url: 'https://dw.com',
    categories: ['Economy', 'Politics', 'Geopolitics', 'Central Banks', 'M&A'],
    region: 'europe',
    country: 'Europe',
    language: 'en',
    async fetch() {
      return fetchRss('https://rss.dw.com/rdf/rss-en-bus', this.id, 'DW', 'https://www.dw.com/en/business/s-1431', this.region, this.country, this.language);
    },
  },
  {
    id: 'politico-europe',
    name: 'Politico Europe',
    url: 'https://politico.eu',
    categories: ['Politics', 'Geopolitics', 'Regulation', 'Economy'],
    region: 'europe',
    country: 'Europe',
    language: 'en',
    async fetch() {
      return fetchRss('https://www.politico.eu/feed/', this.id, 'Politico Europe', 'https://www.politico.eu', this.region, this.country, this.language, 'Politics');
    },
  },
  {
    id: 'euractiv',
    name: 'Euractiv',
    url: 'https://euractiv.com',
    categories: ['Politics', 'Regulation', 'Economy'],
    region: 'europe',
    country: 'Europe',
    language: 'en',
    async fetch() {
      return fetchRss('https://www.euractiv.com/feed/', this.id, 'Euractiv', 'https://www.euractiv.com', this.region, this.country, this.language, 'Regulation');
    },
  },
  {
    id: 'investing-eu',
    name: 'Investing.com Europe',
    url: 'https://investing.com',
    categories: ['Equities', 'Economy', 'Global Markets'],
    region: 'europe',
    country: 'Europe',
    language: 'en',
    async fetch() {
      return fetchRss('https://www.investing.com/rss/news_14.rss', this.id, 'Investing.com', 'https://www.investing.com', this.region, this.country, this.language);
    },
  },

  // ════════════════════════════════════════════════════════════════════════════
  // China — ~5 sources (English-language feeds from Chinese official media)
  // ════════════════════════════════════════════════════════════════════════════

  {
    id: 'xinhua-economy',
    name: 'Xinhua Economy',
    url: 'https://xinhuanet.com',
    categories: ['Economy', 'Politics', 'Global Markets', 'Geopolitics'],
    region: 'asia',
    country: 'China',
    language: 'en',
    async fetch() {
      return fetchRss('https://english.news.cn/rss/business.xml', this.id, 'Xinhua', 'https://english.news.cn/business', this.region, this.country, this.language);
    },
  },
  {
    id: 'scmp-business',
    name: 'South China Morning Post',
    url: 'https://scmp.com',
    categories: ['Equities', 'Economy', 'Politics', 'Geopolitics', 'M&A'],
    region: 'asia',
    country: 'China',
    language: 'en',
    async fetch() {
      return fetchRss('https://www.scmp.com/rss/5/feed', this.id, 'South China Morning Post', 'https://www.scmp.com', this.region, this.country, this.language);
    },
  },
  {
    id: 'caixin-global',
    name: 'Caixin Global',
    url: 'https://caixinglobal.com',
    categories: ['Economy', 'Equities', 'Regulation', 'M&A'],
    region: 'asia',
    country: 'China',
    language: 'en',
    async fetch() {
      return fetchRss('https://www.caixinglobal.com/rss/rss.xml', this.id, 'Caixin Global', 'https://www.caixinglobal.com', this.region, this.country, this.language);
    },
  },
  {
    id: 'china-daily',
    name: 'China Daily Business',
    url: 'https://chinadaily.com.cn',
    categories: ['Economy', 'Politics', 'Global Markets'],
    region: 'asia',
    country: 'China',
    language: 'en',
    async fetch() {
      return fetchRss('https://www.chinadaily.com.cn/rss/business_rss.xml', this.id, 'China Daily', 'https://www.chinadaily.com.cn/business', this.region, this.country, this.language);
    },
  },

  // ════════════════════════════════════════════════════════════════════════════
  // Japan — ~5 sources
  // ════════════════════════════════════════════════════════════════════════════

  {
    id: 'nikkei-asia',
    name: 'Nikkei Asia',
    url: 'https://asia.nikkei.com',
    categories: ['Equities', 'Economy', 'M&A', 'Geopolitics', 'Central Banks'],
    region: 'asia',
    country: 'Japan',
    language: 'en',
    async fetch() {
      return fetchRss('https://asia.nikkei.com/rss/feed/nar', this.id, 'Nikkei Asia', 'https://asia.nikkei.com', this.region, this.country, this.language);
    },
  },
  {
    id: 'japan-times-biz',
    name: 'Japan Times Business',
    url: 'https://japantimes.co.jp',
    categories: ['Economy', 'Equities', 'Central Banks', 'Politics'],
    region: 'asia',
    country: 'Japan',
    language: 'en',
    async fetch() {
      return fetchRss('https://www.japantimes.co.jp/feed/topstories/', this.id, 'Japan Times', 'https://www.japantimes.co.jp/business', this.region, this.country, this.language);
    },
  },
  {
    id: 'nhk-world-economy',
    name: 'NHK World Economy',
    url: 'https://nhk.or.jp/nhkworld',
    categories: ['Economy', 'Equities', 'Politics', 'Geopolitics'],
    region: 'asia',
    country: 'Japan',
    language: 'en',
    async fetch() {
      return fetchRss('https://www3.nhk.or.jp/nhkworld/upld/rss/en/nhkworld-news-en.xml', this.id, 'NHK World', 'https://www3.nhk.or.jp/nhkworld/en/news', this.region, this.country, this.language);
    },
  },

  // ════════════════════════════════════════════════════════════════════════════
  // South Korea — ~4 sources
  // ════════════════════════════════════════════════════════════════════════════

  {
    id: 'korea-herald-biz',
    name: 'Korea Herald Business',
    url: 'https://koreaherald.com',
    categories: ['Equities', 'Economy', 'M&A', 'Crypto/Web3'],
    region: 'asia',
    country: 'South Korea',
    language: 'en',
    async fetch() {
      return fetchRss('https://www.koreaherald.com/common/rss_xml.php?cat=biz', this.id, 'Korea Herald', 'https://www.koreaherald.com/list.php?ud=biz', this.region, this.country, this.language);
    },
  },
  {
    id: 'korea-times-biz',
    name: 'Korea Times Business',
    url: 'https://koreatimes.co.kr',
    categories: ['Economy', 'Equities', 'Politics', 'Regulation'],
    region: 'asia',
    country: 'South Korea',
    language: 'en',
    async fetch() {
      return fetchRss('https://www.koreatimes.co.kr/www2/rss/economy.xml', this.id, 'Korea Times', 'https://www.koreatimes.co.kr/www2/economy', this.region, this.country, this.language);
    },
  },
  {
    id: 'yonhap-economy',
    name: 'Yonhap Economy',
    url: 'https://yna.co.kr',
    categories: ['Economy', 'Geopolitics', 'Equities'],
    region: 'asia',
    country: 'South Korea',
    language: 'en',
    async fetch() {
      return fetchRss('https://en.yna.co.kr/RSS/economy.xml', this.id, 'Yonhap News', 'https://en.yna.co.kr/economy', this.region, this.country, this.language);
    },
  },

  // ════════════════════════════════════════════════════════════════════════════
  // India — ~5 sources
  // ════════════════════════════════════════════════════════════════════════════

  {
    id: 'economic-times',
    name: 'Economic Times',
    url: 'https://economictimes.indiatimes.com',
    categories: ['Equities', 'Economy', 'M&A', 'Small Caps', 'Central Banks'],
    region: 'asia',
    country: 'India',
    language: 'en',
    async fetch() {
      return fetchRss('https://economictimes.indiatimes.com/rssfeedsdefault.cms', this.id, 'Economic Times', 'https://economictimes.indiatimes.com', this.region, this.country, this.language);
    },
  },
  {
    id: 'livemint',
    name: 'Livemint',
    url: 'https://livemint.com',
    categories: ['Equities', 'Economy', 'M&A', 'Dividends', 'Central Banks'],
    region: 'asia',
    country: 'India',
    language: 'en',
    async fetch() {
      return fetchRss('https://www.livemint.com/rss/money', this.id, 'Livemint', 'https://www.livemint.com/money', this.region, this.country, this.language);
    },
  },
  {
    id: 'business-standard',
    name: 'Business Standard',
    url: 'https://business-standard.com',
    categories: ['Equities', 'Economy', 'Regulation', 'Central Banks', 'M&A'],
    region: 'asia',
    country: 'India',
    language: 'en',
    async fetch() {
      return fetchRss('https://www.business-standard.com/rss/markets-102.rss', this.id, 'Business Standard', 'https://www.business-standard.com/markets', this.region, this.country, this.language);
    },
  },
  {
    id: 'financial-express',
    name: 'Financial Express',
    url: 'https://financialexpress.com',
    categories: ['Economy', 'Equities', 'Politics', 'Small Caps'],
    region: 'asia',
    country: 'India',
    language: 'en',
    async fetch() {
      return fetchRss('https://www.financialexpress.com/feed/', this.id, 'Financial Express', 'https://www.financialexpress.com', this.region, this.country, this.language);
    },
  },

  // ════════════════════════════════════════════════════════════════════════════
  // Middle East — ~5 sources
  // ════════════════════════════════════════════════════════════════════════════

  {
    id: 'al-jazeera-economy',
    name: 'Al Jazeera Economy',
    url: 'https://aljazeera.com',
    categories: ['Economy', 'Geopolitics', 'Politics', 'Global Markets'],
    region: 'middle-east',
    country: 'Middle East',
    language: 'en',
    async fetch() {
      return fetchRss('https://www.aljazeera.com/xml/rss/all.xml', this.id, 'Al Jazeera', 'https://www.aljazeera.com/economy', this.region, this.country, this.language);
    },
  },
  {
    id: 'arab-news-biz',
    name: 'Arab News Business',
    url: 'https://arabnews.com',
    categories: ['Economy', 'Equities', 'Geopolitics', 'M&A'],
    region: 'middle-east',
    country: 'Middle East',
    language: 'en',
    async fetch() {
      return fetchRss('https://www.arabnews.com/rss.xml', this.id, 'Arab News', 'https://www.arabnews.com/economy', this.region, this.country, this.language);
    },
  },
  {
    id: 'the-national-uae',
    name: 'The National (UAE)',
    url: 'https://thenationalnews.com',
    categories: ['Economy', 'Equities', 'Politics', 'Geopolitics', 'Global Markets'],
    region: 'middle-east',
    country: 'Middle East',
    language: 'en',
    async fetch() {
      return fetchRss('https://www.thenationalnews.com/rss.xml', this.id, 'The National', 'https://www.thenationalnews.com/business', this.region, this.country, this.language);
    },
  },
  {
    id: 'zawya',
    name: 'Zawya Finance',
    url: 'https://zawya.com',
    categories: ['Equities', 'Economy', 'M&A', 'REITs'],
    region: 'middle-east',
    country: 'Middle East',
    language: 'en',
    async fetch() {
      return fetchRss('https://www.zawya.com/rss/rss_feed_newsrooom.xml', this.id, 'Zawya', 'https://www.zawya.com/en/markets', this.region, this.country, this.language);
    },
  },
  {
    id: 'middle-east-eye',
    name: 'Middle East Eye',
    url: 'https://middleeasteye.net',
    categories: ['Geopolitics', 'Politics', 'Economy'],
    region: 'middle-east',
    country: 'Middle East',
    language: 'en',
    async fetch() {
      return fetchRss('https://www.middleeasteye.net/rss', this.id, 'Middle East Eye', 'https://www.middleeasteye.net', this.region, this.country, this.language, 'Geopolitics');
    },
  },

  // ════════════════════════════════════════════════════════════════════════════
  // Global / Cross-market
  // ════════════════════════════════════════════════════════════════════════════

  {
    id: 'cryptopanic-rss',
    name: 'CryptoPanic',
    url: 'https://cryptopanic.com',
    categories: ['Crypto/Web3', 'Tokenization'],
    region: 'global',
    country: 'Global',
    language: 'en',
    async fetch() {
      return fetchRss('https://cryptopanic.com/news/rss/', this.id, 'CryptoPanic', 'https://cryptopanic.com', this.region, this.country, this.language, 'Crypto/Web3');
    },
  },
  {
    id: 'dlnews',
    name: 'DL News',
    url: 'https://dlnews.com',
    categories: ['Crypto/Web3', 'Tokenization', 'Regulation'],
    region: 'global',
    country: 'Global',
    language: 'en',
    async fetch() {
      return fetchRss('https://dlnews.com/arc/outboundfeeds/rss/', this.id, 'DL News', 'https://www.dlnews.com', this.region, this.country, this.language);
    },
  },
  {
    id: 'investing-global',
    name: 'Investing.com Global',
    url: 'https://investing.com',
    categories: ['Global Markets', 'Economy', 'Equities'],
    region: 'global',
    country: 'Global',
    language: 'en',
    async fetch() {
      return fetchRss('https://www.investing.com/rss/news_25.rss', this.id, 'Investing.com', 'https://www.investing.com', this.region, this.country, this.language);
    },
  },

  // ════════════════════════════════════════════════════════════════════════════
  // Latin America (beyond Brazil) — ~5 sources
  // ════════════════════════════════════════════════════════════════════════════

  {
    id: 'reuters-latam',
    name: 'Reuters América Latina',
    url: 'https://reuters.com',
    categories: ['Economy', 'Politics', 'Geopolitics', 'Equities'],
    region: 'americas',
    country: 'Latin America' as CountryMarket,
    language: 'es',
    async fetch() {
      return fetchRss('https://feeds.reuters.com/reuters/latamTopNews', this.id, 'Reuters LatAm', 'https://www.reuters.com/world/americas', this.region, this.country as CountryMarket, this.language);
    },
  },
  {
    id: 'mercopress',
    name: 'MercoPress',
    url: 'https://en.mercopress.com',
    categories: ['Economy', 'Politics', 'Geopolitics'],
    region: 'americas',
    country: 'Latin America' as CountryMarket,
    language: 'en',
    async fetch() {
      return fetchRss('https://en.mercopress.com/rss', this.id, 'MercoPress', 'https://en.mercopress.com', this.region, this.country as CountryMarket, this.language, 'Economy');
    },
  },
  {
    id: 'el-pais-economia',
    name: 'El País Economía',
    url: 'https://elpais.com',
    categories: ['Economy', 'Politics', 'Geopolitics', 'Equities'],
    region: 'americas',
    country: 'Latin America' as CountryMarket,
    language: 'es',
    async fetch() {
      return fetchRss('https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/economia/portada', this.id, 'El País', 'https://elpais.com/economia', this.region, this.country as CountryMarket, this.language, 'Economy');
    },
  },
  {
    id: 'bloomberg-latam',
    name: 'Bloomberg Línea',
    url: 'https://www.bloomberglinea.com',
    categories: ['Equities', 'Economy', 'M&A', 'Central Banks', 'Crypto/Web3'],
    region: 'americas',
    country: 'Latin America' as CountryMarket,
    language: 'es',
    async fetch() {
      return fetchRss('https://www.bloomberglinea.com/arc/outboundfeeds/rss/category/mercados/', this.id, 'Bloomberg Línea', 'https://www.bloomberglinea.com', this.region, this.country as CountryMarket, this.language);
    },
  },

  // ════════════════════════════════════════════════════════════════════════════
  // Additional Global / Crypto
  // ════════════════════════════════════════════════════════════════════════════

  {
    id: 'blockworks',
    name: 'Blockworks',
    url: 'https://blockworks.co',
    categories: ['Crypto/Web3', 'Tokenization', 'Regulation', 'Central Banks'],
    region: 'global',
    country: 'Global',
    language: 'en',
    async fetch() {
      return fetchRss('https://blockworks.co/feed', this.id, 'Blockworks', 'https://blockworks.co', this.region, this.country, this.language);
    },
  },
  {
    id: 'ft-global',
    name: 'FT Global Economy',
    url: 'https://ft.com',
    categories: ['Global Markets', 'Economy', 'Central Banks', 'Geopolitics'],
    region: 'global',
    country: 'Global',
    language: 'en',
    async fetch() {
      return fetchRss('https://www.ft.com/rss/home', this.id, 'Financial Times', 'https://www.ft.com', this.region, this.country, this.language);
    },
  },

  // ════════════════════════════════════════════════════════════════════════════
  // Latin America — additional sources
  // ════════════════════════════════════════════════════════════════════════════

  {
    id: 'el-economista-mx',
    name: 'El Economista (México)',
    url: 'https://www.eleconomista.com.mx',
    categories: ['Economy', 'Equities', 'Central Banks', 'M&A'],
    region: 'americas',
    country: 'Latin America',
    language: 'es',
    async fetch() {
      return fetchRss('https://www.eleconomista.com.mx/rss/portada.xml', this.id, 'El Economista MX', 'https://www.eleconomista.com.mx', this.region, this.country, this.language, 'Economy');
    },
  },
  {
    id: 'folha-sp',
    name: 'Folha de S.Paulo',
    url: 'https://www.folha.uol.com.br',
    categories: ['Economy', 'Politics', 'Equities', 'M&A'],
    region: 'americas',
    country: 'Brazil',
    language: 'pt',
    async fetch() {
      return fetchRss('https://feeds.folha.uol.com.br/mercado/rss091.xml', this.id, 'Folha de S.Paulo', 'https://www.folha.uol.com.br/mercado', this.region, this.country, this.language, 'Economy');
    },
  },

  // ════════════════════════════════════════════════════════════════════════════
  // Asia — additional sources
  // ════════════════════════════════════════════════════════════════════════════

  {
    id: 'the-hindu-biz',
    name: 'The Hindu Business',
    url: 'https://www.thehindu.com',
    categories: ['Economy', 'Equities', 'Politics', 'Regulation'],
    region: 'asia',
    country: 'India',
    language: 'en',
    async fetch() {
      return fetchRss('https://www.thehindu.com/business/Economy/feeder/default.rss', this.id, 'The Hindu', 'https://www.thehindu.com/business', this.region, this.country, this.language, 'Economy');
    },
  },
  {
    id: 'dawn-pakistan',
    name: 'Dawn Business',
    url: 'https://www.dawn.com',
    categories: ['Economy', 'Geopolitics', 'Politics'],
    region: 'asia',
    country: 'India',   // closest CountryMarket — represents South Asia
    language: 'en',
    async fetch() {
      return fetchRss('https://www.dawn.com/feeds/business', this.id, 'Dawn', 'https://www.dawn.com/business', this.region, this.country, this.language, 'Economy');
    },
  },

  // ════════════════════════════════════════════════════════════════════════════
  // Global — additional quality sources
  // ════════════════════════════════════════════════════════════════════════════

  {
    id: 'politico-us',
    name: 'Politico (US)',
    url: 'https://www.politico.com',
    categories: ['Politics', 'Economy', 'Regulation'],
    region: 'americas',
    country: 'USA',
    language: 'en',
    async fetch() {
      return fetchRss('https://www.politico.com/rss/politicopicks.xml', this.id, 'Politico', 'https://www.politico.com', this.region, this.country, this.language, 'Politics');
    },
  },
  {
    id: 'asia-times',
    name: 'Asia Times',
    url: 'https://asiatimes.com',
    categories: ['Geopolitics', 'Economy', 'Politics'],
    region: 'asia',
    country: 'Global',
    language: 'en',
    async fetch() {
      return fetchRss('https://asiatimes.com/feed/', this.id, 'Asia Times', 'https://asiatimes.com', this.region, this.country, this.language, 'Geopolitics');
    },
  },
];

// ─── Pending providers (require API keys) ─────────────────────────────────────

export const PENDING_PROVIDERS = [
  {
    id: 'newsapi',
    name: 'NewsAPI.org',
    envKey: 'VITE_NEWSAPI_KEY',
    categories: ['Equities', 'M&A', 'Politics', 'Geopolitics', 'Economy', 'Dividends', 'Small Caps', 'REITs', 'FIIs'],
    notes: 'newsapi.org — free tier 100 req/day. Enables broad global news including local-language sources.',
    countries: ['USA', 'UK', 'Brazil', 'Europe', 'China', 'Japan', 'South Korea', 'India', 'Middle East'],
  },
  {
    id: 'polygon',
    name: 'Polygon.io News',
    envKey: 'VITE_POLYGON_KEY',
    categories: ['Equities', 'Dividends', 'REITs', 'FIIs', 'Small Caps'],
    notes: 'polygon.io — free tier available. Real-time equity news with ticker metadata.',
    countries: ['USA', 'Global'],
  },
  {
    id: 'cryptopanic-auth',
    name: 'CryptoPanic (authenticated)',
    envKey: 'VITE_CRYPTOPANIC_KEY',
    categories: ['Crypto/Web3', 'Tokenization'],
    notes: 'cryptopanic.com — free key unlocks sentiment, filters, and volume metrics.',
    countries: ['Global'],
  },
  {
    id: 'alphavantage',
    name: 'Alpha Vantage',
    envKey: 'VITE_ALPHAVANTAGE_KEY',
    categories: ['Economy', 'Equities', 'Central Banks'],
    notes: 'alphavantage.co — free tier 25 req/day. Economic indicators and earnings.',
    countries: ['USA', 'Global'],
  },
  {
    id: 'thenewsapi',
    name: 'TheNewsAPI.com',
    envKey: 'VITE_THENEWSAPI_KEY',
    categories: ['Geopolitics', 'M&A', 'Regulation', 'Politics'],
    notes: 'thenewsapi.com — free tier. Strong geopolitics and M&A coverage.',
    countries: ['USA', 'UK', 'Europe', 'Global'],
  },
  {
    id: 'gdelt',
    name: 'GDELT Project',
    envKey: 'VITE_GDELT_KEY',
    categories: ['Geopolitics', 'Politics'],
    notes: 'gdeltproject.org — free tier available. Deep geopolitical event tracking across 100+ languages.',
    countries: ['Global'],
  },
];

// ─── Main feed fetcher ────────────────────────────────────────────────────────

export async function fetchAllNews(): Promise<NewsItem[]> {
  const results = await Promise.allSettled(PROVIDERS.map(p => p.fetch()));
  const all: NewsItem[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value);
  }
  const deduped = deduplicateNews(all);
  const sorted = sortNews(deduped);
  return sorted.slice(0, MAX_ITEMS);
}

/** Returns the flat feed AND event clusters from one fetch. */
export async function fetchAllNewsWithClusters(): Promise<{
  items: NewsItem[];
  clusters: EventCluster[];
}> {
  const items = await fetchAllNews();
  const clusters = clusterNews(items);
  return { items, clusters };
}

// ─── NV Agent — locale-aware Q&A ─────────────────────────────────────────────
// Answers ONLY from loaded news. No fabricated content. No investment advice.

// Country/region keyword map for agent routing
const AGENT_GEO_MAP: Array<{ keywords: string[]; country?: CountryMarket; region?: MarketRegion }> = [
  { keywords: ['usa', 'united states', 'america', 'federal reserve', 'fed', 'wall street', 'nasdaq', 'nyse', 's&p'], country: 'USA' },
  { keywords: ['brazil', 'brasil', 'bovespa', 'b3', 'real', 'selic', 'bacen', 'banco central', 'fii', 'fiis'], country: 'Brazil' },
  { keywords: ['uk', 'united kingdom', 'britain', 'boe', 'bank of england', 'ftse', 'london', 'sterling'], country: 'UK' },
  { keywords: ['europe', 'ecb', 'european central bank', 'euro', 'eurozone', 'eu', 'germany', 'france', 'dax', 'cac'], country: 'Europe' },
  { keywords: ['china', 'pboc', 'yuan', 'renminbi', 'hong kong', 'shanghai', 'beijing', 'hang seng', 'csi'], country: 'China' },
  { keywords: ['japan', 'boj', 'bank of japan', 'yen', 'nikkei', 'tokyo'], country: 'Japan' },
  { keywords: ['korea', 'south korea', 'kospi', 'seoul', 'won', 'korean'], country: 'South Korea' },
  { keywords: ['india', 'rbi', 'sensex', 'nifty', 'rupee', 'mumbai', 'indian', 'sebi'], country: 'India' },
  { keywords: ['middle east', 'saudi', 'uae', 'dubai', 'qatar', 'iran', 'israel', 'oil', 'opec'], country: 'Middle East' },
  { keywords: ['latin america', 'latam', 'argentina', 'colombia', 'mexico', 'chile', 'peru'], country: 'Latin America' },
  { keywords: ['asia', 'asian', 'pacific'], region: 'asia' },
  { keywords: ['americas', 'american'], region: 'americas' },
  { keywords: ['europe', 'european'], region: 'europe' },
];

const AGENT_CAT_MAP: Array<{ keywords: string[]; category: NewsCategory }> = [
  { keywords: ['crypto', 'bitcoin', 'ethereum', 'web3', 'defi', 'nft', 'blockchain', 'usdc', 'stablecoin'], category: 'Crypto/Web3' },
  { keywords: ['tokeniz', 'rwa', 'real world asset', 'tokenization'], category: 'Tokenization' },
  { keywords: ['central bank', 'rate hike', 'rate cut', 'monetary policy', 'fed', 'ecb', 'boj', 'boe', 'pboc', 'rbi', 'selic'], category: 'Central Banks' },
  { keywords: ['regulation', 'sec', 'cftc', 'esma', 'fca', 'compliance', 'ban', 'law', 'bill'], category: 'Regulation' },
  { keywords: ['merger', 'acquisition', 'm&a', 'takeover', 'buyout', 'deal', 'acquire'], category: 'M&A' },
  { keywords: ['dividend', 'yield', 'payout', 'distribution'], category: 'Dividends' },
  { keywords: ['reit', 'real estate investment'], category: 'REITs' },
  { keywords: ['fii', 'fundo imobiliário', 'fundo imobiliario'], category: 'FIIs' },
  { keywords: ['small cap', 'smallcap', 'micro cap'], category: 'Small Caps' },
  { keywords: ['geopolit', 'war', 'conflict', 'sanction', 'nato', 'military', 'invasion', 'troops'], category: 'Geopolitics' },
  { keywords: ['election', 'president', 'government', 'political', 'minister', 'parliament', 'senate', 'vote'], category: 'Politics' },
  { keywords: ['gdp', 'inflation', 'cpi', 'recession', 'growth', 'unemployment', 'jobs', 'tariff', 'trade'], category: 'Economy' },
  { keywords: ['stock', 'equity', 'share', 'ipo', 'earnings', 'quarter'], category: 'Equities' },
];

export function answerFromNews(
  question: string,
  items: NewsItem[],
  locale: Locale = 'en',
  t?: (key: string, vars?: Record<string, string | number>) => string,
): AgentResponse {
  const translate = t ?? ((k: string) => k);

  if (!items.length) {
    return { answer: translate('intel.agentNoNews'), sources: [] };
  }

  const q = question.toLowerCase().replace(/[?!.,;:]/g, ' ');
  const words = q.split(/\s+/).filter(w => w.length > 2);

  // Detect geo/category intent from the question
  const geoFilter = AGENT_GEO_MAP.find(g => g.keywords.some(kw => q.includes(kw)));
  const catFilter = AGENT_CAT_MAP.find(c => c.keywords.some(kw => q.includes(kw)));

  // Score each item: +3 per keyword match in title, +1 in summary/tags, +2 for geo match, +2 for category match
  const scored = items.map(item => {
    const titleL = item.title.toLowerCase();
    const bodyL = (item.summary + ' ' + item.tags.join(' ') + ' ' + item.country + ' ' + item.region).toLowerCase();
    let score = 0;
    for (const w of words) {
      if (titleL.includes(w)) score += 3;
      else if (bodyL.includes(w)) score += 1;
    }
    if (geoFilter) {
      if (geoFilter.country && item.country === geoFilter.country) score += 2;
      if (geoFilter.region && item.region === geoFilter.region) score += 2;
    }
    if (catFilter && item.category === catFilter.category) score += 2;
    return { item, score };
  });

  const relevant = scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score || PRIORITY_RANK[a.item.priority] - PRIORITY_RANK[b.item.priority])
    .slice(0, 7)
    .map(s => s.item);

  if (!relevant.length) {
    const recent = items.slice(0, 5).map(i => `• ${i.source} (${i.country}): "${i.title}"`).join('\n');
    return {
      answer: translate('intel.agentNotFound', { q: question, recent }),
      sources: [],
    };
  }

  // Build context-aware preamble
  const contextParts: string[] = [];
  if (geoFilter?.country) contextParts.push(`${COUNTRY_FLAG[geoFilter.country]} ${geoFilter.country}`);
  else if (geoFilter?.region) contextParts.push(geoFilter.region);
  if (catFilter) contextParts.push(catFilter.category);

  const factItems = relevant.filter(i => i.priority === 'breaking' || i.priority === 'high');
  const otherItems = relevant.filter(i => i.priority !== 'breaking' && i.priority !== 'high');
  const orderedItems = [...factItems, ...otherItems];

  const summary = orderedItems
    .map((item, i) => {
      const time = formatRelativeTime(item.publishedMs, locale);
      const multiSrc = relevant.filter(r => r.title.toLowerCase().slice(0, 30) === item.title.toLowerCase().slice(0, 30)).length > 1;
      return `${i + 1}. [${item.source} — ${item.country} — ${time}]${multiSrc ? ' ✓' : ''}\n   ${item.title}${item.summary ? '\n   ' + item.summary.slice(0, 150) : ''}`;
    })
    .join('\n\n');

  const preamble = contextParts.length > 0
    ? translate('intel.agentAnswerContext', { ctx: contextParts.join(' · '), summary })
    : translate('intel.agentAnswer', { summary });

  return {
    answer: preamble,
    sources: orderedItems.map(item => ({
      title: item.title,
      url: item.url,
      source: item.source,
      publishedAt: item.publishedAt,
    })),
  };
}

// ─── Editorial Priority System ───────────────────────────────────────────────
//
// Each NV locale maps to a geographic / market focus that controls NV News
// editorial ranking.  Rules:
//   • Primary countries → strongest boost (+4)
//   • Primary regions   → secondary boost (+2)
//   • Global categories → always preserved regardless of locale (no penalty)
//   • Breaking events from ANY region are preserved when globally significant
//   • Medium/low items from unrelated regions receive a mild demotion (-1)

/** Categories that are always globally relevant and never demoted */
const GLOBAL_CATEGORIES = new Set<NewsCategory>([
  'Central Banks',
  'Geopolitics',
  'Global Markets',
  'Regulation',
  'Crypto/Web3',
  'Tokenization',
]);

/** Categories considered of primary systemic importance (never demoted for breaking) */
const SYSTEMIC_CATEGORIES = new Set<NewsCategory>([
  'Central Banks',
  'Geopolitics',
  'Global Markets',
]);

export interface EditorialFocus {
  /** Display label key (i18n) */
  labelKey: string;
  /** Primary CountryMarkets — strongest editorial preference */
  primaryCountries: CountryMarket[];
  /** Primary MarketRegions — secondary preference */
  primaryRegions: MarketRegion[];
  /** BCP-47 of preferred source language for this locale */
  preferredSourceLang: string;
  /** Flag emoji for the UI badge */
  flag: string;
}

export const LOCALE_EDITORIAL_FOCUS: Record<string, EditorialFocus> = {
  'pt-BR': {
    labelKey: 'focus.ptBR',
    primaryCountries: ['Brazil', 'Latin America'],
    primaryRegions: ['americas'],
    preferredSourceLang: 'pt',
    flag: '🇧🇷',
  },
  'en': {
    labelKey: 'focus.en',
    primaryCountries: ['USA', 'UK'],
    primaryRegions: ['americas', 'europe'],
    preferredSourceLang: 'en',
    flag: '🇺🇸',
  },
  'es': {
    labelKey: 'focus.es',
    primaryCountries: ['Latin America', 'Europe'],
    primaryRegions: ['americas', 'europe'],
    preferredSourceLang: 'es',
    flag: '🌎',
  },
  'fr': {
    labelKey: 'focus.fr',
    primaryCountries: ['Europe'],
    primaryRegions: ['europe'],
    preferredSourceLang: 'fr',
    flag: '🇫🇷',
  },
  'zh': {
    labelKey: 'focus.zh',
    primaryCountries: ['China'],
    primaryRegions: ['asia'],
    preferredSourceLang: 'zh',
    flag: '🇨🇳',
  },
  'ja': {
    labelKey: 'focus.ja',
    primaryCountries: ['Japan'],
    primaryRegions: ['asia'],
    preferredSourceLang: 'ja',
    flag: '🇯🇵',
  },
  'ko': {
    labelKey: 'focus.ko',
    primaryCountries: ['South Korea'],
    primaryRegions: ['asia'],
    preferredSourceLang: 'ko',
    flag: '🇰🇷',
  },
  'hi': {
    labelKey: 'focus.hi',
    primaryCountries: ['India'],
    primaryRegions: ['asia'],
    preferredSourceLang: 'hi',
    flag: '🇮🇳',
  },
  'ar': {
    labelKey: 'focus.ar',
    primaryCountries: ['Middle East'],
    primaryRegions: ['middle-east'],
    preferredSourceLang: 'ar',
    flag: '🕌',
  },
};

/** Return the editorial focus for a locale, defaulting to 'en' */
export function getEditorialFocus(locale: string): EditorialFocus {
  return LOCALE_EDITORIAL_FOCUS[locale] ?? LOCALE_EDITORIAL_FOCUS['en']!;
}

/**
 * Compute an editorial score for a single NewsItem under the given locale.
 *
 * Score ranges from -1 to +5:
 *   +4  primary country match (strongest editorial preference)
 *   +2  primary region match only (no country match)
 *   +1  source language matches locale's preferred language
 *   0   global / systemic category (always neutral, never demoted)
 *   -1  non-primary region AND non-global category AND priority < breaking
 *
 * Priority itself is handled separately in PRIORITY_RANK — this score is
 * ADDED on top of priority to produce the final sort key.
 */
export function editorialScore(item: NewsItem, locale: string): number {
  const focus = getEditorialFocus(locale);

  const countryMatch = (focus.primaryCountries as string[]).includes(item.country);
  const regionMatch = focus.primaryRegions.includes(item.region);
  const langMatch = item.originalLanguage.startsWith(focus.preferredSourceLang);
  const isGlobal = GLOBAL_CATEGORIES.has(item.category) || item.country === 'Global';
  const isSystemic = SYSTEMIC_CATEGORIES.has(item.category);

  if (countryMatch) {
    return 4 + (langMatch ? 1 : 0);
  }
  if (regionMatch) {
    return 2 + (langMatch ? 1 : 0);
  }
  // Globally important / systemic — neutral (0), always preserved
  if (isGlobal || isSystemic) {
    return 0;
  }
  // Unrelated region + non-global: mild demotion for medium/low only
  if (item.priority === 'medium' || item.priority === 'low') {
    return -1;
  }
  // Breaking from any region: 0 (preserved, not boosted)
  return 0;
}

// ─── NV News — voice broadcast infrastructure ─────────────────────────────────
// Selects top-priority items and builds voice scripts.
// Voice layer (TTS / SpeechSynthesis) not implemented yet — infrastructure ready.

/**
 * Builds the NV News broadcast queue with locale-aware editorial prioritization.
 *
 * Sorting key = PRIORITY_RANK * 10 - editorialScore - recencyTie
 *
 * This means:
 *   • Breaking events from the primary locale region always lead
 *   • Breaking from other regions follow (editorial score 0 for non-regional breaking)
 *   • High-priority local events rank above High from unrelated regions
 *   • Medium/low items from unrelated regions are demoted and appear last
 *   • Globally systemic categories (Central Banks, Geopolitics, Global Markets,
 *     Regulation, Crypto/Web3, Tokenization) are NEVER demoted
 *
 * Content is NEVER hidden — only reordered. All real items are eligible;
 * only the top maxItems appear in the final NV News queue.
 */
export function buildNVNewsQueue(
  items: NewsItem[],
  maxItems = 10,
  locale: Locale = 'en',
): NVNewsItem[] {
  const openingPhrases: Partial<Record<Locale, { breaking: string; high: string }>> = {
    'pt-BR': { breaking: 'Urgente.', high: '' },
    'en':    { breaking: 'Breaking news.', high: '' },
    'es':    { breaking: 'Urgente.', high: '' },
    'fr':    { breaking: 'Alerte.', high: '' },
    'zh':    { breaking: '突发新闻。', high: '' },
    'ja':    { breaking: '速報。', high: '' },
    'ko':    { breaking: '속보.', high: '' },
    'hi':    { breaking: 'ब्रेकिंग न्यूज़।', high: '' },
    'ar':    { breaking: 'خبر عاجل.', high: '' },
  };
  const phrases = openingPhrases[locale] ?? openingPhrases['en']!;

  // Include breaking + high; include medium only when it matches the primary focus
  const focus = getEditorialFocus(locale);
  const eligible = items.filter(i => {
    if (i.priority === 'breaking' || i.priority === 'high') return true;
    if (i.priority === 'medium') {
      // Keep medium items from primary country or global categories
      const isLocal = (focus.primaryCountries as string[]).includes(i.country);
      const isGlobalCat = GLOBAL_CATEGORIES.has(i.category);
      return isLocal || isGlobalCat;
    }
    return false;
  });

  // Composite sort: lower value = higher rank
  // = (PRIORITY_RANK * 10) - editorialScore * 2 - recencyTie
  const sorted = eligible.slice().sort((a, b) => {
    const aScore = PRIORITY_RANK[a.priority] * 10 - editorialScore(a, locale) * 2;
    const bScore = PRIORITY_RANK[b.priority] * 10 - editorialScore(b, locale) * 2;
    if (aScore !== bScore) return aScore - bScore;
    // Tiebreak: more recent first
    return b.publishedMs - a.publishedMs;
  });

  return sorted
    .slice(0, maxItems)
    .map(item => {
      const edScore = editorialScore(item, locale);
      const isLocal = edScore >= 4;
      const isPrimaryRegion = edScore >= 2 && edScore < 4;
      // Enrich the voice script with locale context marker
      const contextNote = isLocal
        ? `${COUNTRY_FLAG[item.country]} `
        : isPrimaryRegion
        ? `${REGION_CONFIG[item.region]?.flag ?? '🌐'} `
        : '🌐 ';
      return {
        headline: item.title,
        summary: item.summary || '',
        source: item.source,
        country: item.country,
        region: item.region,
        category: item.category,
        priority: item.priority,
        publishedAt: item.publishedAt,
        url: item.url,
        /** editorial relevance to current locale: 0=global, 1=region, 2=local */
        editorialTier: isLocal ? 2 : isPrimaryRegion ? 1 : 0,
        voiceScript:
          `${item.priority === 'breaking' ? phrases.breaking + ' ' : phrases.high}` +
          `${contextNote}${item.source}: ${item.title}. ` +
          `${item.summary ? item.summary.slice(0, 200) + '. ' : ''}`,
      };
    });
}

// ─── Display helpers ──────────────────────────────────────────────────────────

export const PRIORITY_CONFIG: Record<
  NewsPriority,
  { labelKey: string; textClass: string; bgClass: string; borderClass: string; dotClass: string }
> = {
  breaking: {
    labelKey: 'intel.breaking',
    textClass: 'text-red-400',
    bgClass: 'bg-red-500/10',
    borderClass: 'border-red-500/30',
    dotClass: 'bg-red-400',
  },
  high: {
    labelKey: 'intel.high',
    textClass: 'text-orange-400',
    bgClass: 'bg-orange-500/10',
    borderClass: 'border-orange-500/30',
    dotClass: 'bg-orange-400',
  },
  medium: {
    labelKey: 'intel.medium',
    textClass: 'text-cyan-400',
    bgClass: 'bg-cyan-500/10',
    borderClass: 'border-cyan-500/20',
    dotClass: 'bg-cyan-400',
  },
  low: {
    labelKey: 'intel.low',
    textClass: 'text-muted-foreground/50',
    bgClass: 'bg-secondary/20',
    borderClass: 'border-border/20',
    dotClass: 'bg-muted-foreground/30',
  },
};

export const CATEGORY_CONFIG: Record<NewsCategory, { color: string; bg: string }> = {
  'Crypto/Web3':    { color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  'Tokenization':   { color: 'text-cyan-400',    bg: 'bg-cyan-500/10' },
  'Equities':       { color: 'text-blue-400',    bg: 'bg-blue-500/10' },
  'M&A':            { color: 'text-violet-400',  bg: 'bg-violet-500/10' },
  'Politics':       { color: 'text-amber-400',   bg: 'bg-amber-500/10' },
  'Geopolitics':    { color: 'text-rose-400',    bg: 'bg-rose-500/10' },
  'Small Caps':     { color: 'text-lime-400',    bg: 'bg-lime-500/10' },
  'Dividends':      { color: 'text-yellow-400',  bg: 'bg-yellow-500/10' },
  'Economy':        { color: 'text-sky-400',     bg: 'bg-sky-500/10' },
  'REITs':          { color: 'text-pink-400',    bg: 'bg-pink-500/10' },
  'FIIs':           { color: 'text-indigo-400',  bg: 'bg-indigo-500/10' },
  'Central Banks':  { color: 'text-orange-300',  bg: 'bg-orange-500/10' },
  'Regulation':     { color: 'text-red-300',     bg: 'bg-red-500/10' },
  'Global Markets': { color: 'text-teal-400',    bg: 'bg-teal-500/10' },
};

export const REGION_CONFIG: Record<MarketRegion, { label: string; color: string; flag: string }> = {
  global:        { label: 'Global',       color: 'text-teal-400',   flag: '🌐' },
  americas:      { label: 'Americas',     color: 'text-blue-400',   flag: '🌎' },
  europe:        { label: 'Europe',       color: 'text-indigo-400', flag: '🌍' },
  asia:          { label: 'Asia',         color: 'text-amber-400',  flag: '🌏' },
  'middle-east': { label: 'Middle East',  color: 'text-rose-400',   flag: '🕌' },
};

export const COUNTRY_FLAG: Record<CountryMarket, string> = {
  'USA':          '🇺🇸',
  'UK':           '🇬🇧',
  'Brazil':       '🇧🇷',
  'Europe':       '🇪🇺',
  'China':        '🇨🇳',
  'Japan':        '🇯🇵',
  'South Korea':  '🇰🇷',
  'India':        '🇮🇳',
  'Middle East':  '🕌',
  'Latin America':'🌎',
  'Global':       '🌐',
};

export function formatRelativeTime(ms: number, locale: Locale = 'en'): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (diff < 60_000) {
    const labels: Record<Locale, string> = {
      'pt-BR': 'agora', en: 'just now', es: 'ahora', fr: 'maintenant',
      zh: '刚刚', ja: 'たった今', ko: '방금', hi: 'अभी', ar: 'الآن',
    };
    return labels[locale] ?? 'just now';
  }
  if (diff < 3_600_000) {
    const labels: Record<Locale, string> = {
      'pt-BR': `${mins}min atrás`, en: `${mins}m ago`, es: `hace ${mins}min`, fr: `il y a ${mins}min`,
      zh: `${mins}分钟前`, ja: `${mins}分前`, ko: `${mins}분 전`, hi: `${mins}मिनट पहले`, ar: `منذ ${mins}د`,
    };
    return labels[locale] ?? `${mins}m ago`;
  }
  if (diff < 86_400_000) {
    const labels: Record<Locale, string> = {
      'pt-BR': `${hours}h atrás`, en: `${hours}h ago`, es: `hace ${hours}h`, fr: `il y a ${hours}h`,
      zh: `${hours}小时前`, ja: `${hours}時間前`, ko: `${hours}시간 전`, hi: `${hours}घंटे पहले`, ar: `منذ ${hours}س`,
    };
    return labels[locale] ?? `${hours}h ago`;
  }
  const labels: Record<Locale, string> = {
    'pt-BR': `${days}d atrás`, en: `${days}d ago`, es: `hace ${days}d`, fr: `il y a ${days}j`,
    zh: `${days}天前`, ja: `${days}日前`, ko: `${days}일 전`, hi: `${days}दिन पहले`, ar: `منذ ${days}أيام`,
  };
  return labels[locale] ?? `${days}d ago`;
}

// ─── Intelligence Core — Event Clustering ─────────────────────────────────────
// Groups NewsItems that describe the same real-world event:
//   - same category + high title similarity (Jaccard on trigrams)
//   - published within 6 hours of each other
// Preserves all original items; never fabricates content.

export interface EventCluster {
  /** Stable id — taken from the highest-priority representative item */
  id: string;
  /** Best headline to represent the cluster */
  headline: string;
  /** Representative item (highest priority, most recent) */
  representative: NewsItem;
  /** All items in the cluster, sorted by priority then recency */
  items: NewsItem[];
  /** Unique sources confirming this event */
  sources: string[];
  /** Cluster-level priority (best of all items) */
  priority: NewsPriority;
  category: NewsCategory;
  /** All distinct categories present in the cluster (for cross-topic events) */
  relatedCategories: NewsCategory[];
  region: MarketRegion;
  country: CountryMarket;
  publishedMs: number;
  /** True when 2+ independent sources cover this event */
  multiSourceConfirmed: boolean;
  /**
   * Short context sentence built from the cluster members.
   * Combines country + category span and source count.
   * Never fabricated — only derived from real item metadata.
   */
  contextSummary: string;
}

/** Trigram set for a string (used for Jaccard similarity). */
function trigrams(s: string): Set<string> {
  const norm = s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const out = new Set<string>();
  for (let i = 0; i < norm.length - 2; i++) out.add(norm.slice(i, i + 3));
  return out;
}

function jaccardSim(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) { if (b.has(t)) inter++; }
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

const CLUSTER_TIME_WINDOW_MS         = 6 * 3_600_000;  // 6 hours standard
const CLUSTER_TIME_WINDOW_BREAKING_MS = 12 * 3_600_000; // 12 hours for breaking
const CLUSTER_SIM_THRESHOLD           = 0.18;           // Jaccard ≥ 0.18 → same event

// Categories that can bridge into the same cluster (geo-political overlap)
const BRIDGEABLE_CATEGORIES = new Set<string>([
  'Geopolitics', 'Politics', 'Economy', 'Central Banks', 'Global Markets',
]);

const PRIORITY_RANK: Record<NewsPriority, number> = {
  breaking: 0, high: 1, medium: 2, low: 3,
};

/**
 * Groups `items` into EventClusters.
 * Items from the same source with near-identical titles are deduplicated
 * before clustering so one prolific publisher can't dominate a cluster.
 */
export function clusterNews(items: NewsItem[]): EventCluster[] {
  // Pre-compute trigrams once per item
  const tgrams = items.map(it => trigrams(it.title));

  // Union-Find for cluster membership
  const parent = items.map((_, i) => i);
  function find(x: number): number {
    while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
    return x;
  }
  function union(a: number, b: number) { parent[find(a)] = find(b); }

  for (let i = 0; i < items.length - 1; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const catMatch = items[i].category === items[j].category;
      const bridgeable = BRIDGEABLE_CATEGORIES.has(items[i].category) &&
                         BRIDGEABLE_CATEGORIES.has(items[j].category);
      if (!catMatch && !bridgeable) continue;

      // Use extended window when either item is breaking
      const isBreaking = items[i].priority === 'breaking' || items[j].priority === 'breaking';
      const timeLimit = isBreaking ? CLUSTER_TIME_WINDOW_BREAKING_MS : CLUSTER_TIME_WINDOW_MS;
      const timeDiff = Math.abs(items[i].publishedMs - items[j].publishedMs);
      if (timeDiff > timeLimit) continue;

      // Raise threshold slightly for cross-category bridges to avoid false positives
      const threshold = catMatch ? CLUSTER_SIM_THRESHOLD : CLUSTER_SIM_THRESHOLD + 0.08;
      if (jaccardSim(tgrams[i], tgrams[j]) >= threshold) {
        union(i, j);
      }
    }
  }

  // Group by root
  const groups = new Map<number, number[]>();
  for (let i = 0; i < items.length; i++) {
    const root = find(i);
    const grp = groups.get(root) ?? [];
    grp.push(i);
    groups.set(root, grp);
  }

  const clusters: EventCluster[] = [];
  for (const indices of groups.values()) {
    const members = indices
      .map(i => items[i])
      .sort((a, b) => {
        const pd = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
        return pd !== 0 ? pd : b.publishedMs - a.publishedMs;
      });

    const rep = members[0];
    const uniqueSources = [...new Set(members.map(m => m.source))];
    const uniqueCategories = [...new Set(members.map(m => m.category))] as NewsCategory[];
    const uniqueCountries  = [...new Set(members.map(m => m.country))];

    // contextSummary: purely derived from metadata, no fabrication
    const coverageStr = uniqueCountries.length > 1
      ? uniqueCountries.slice(0, 3).join(', ')
      : uniqueCountries[0];
    const confirmStr = uniqueSources.length >= 2
      ? ` · ${uniqueSources.length} sources`
      : '';
    const contextSummary = `${coverageStr}${confirmStr}`;

    clusters.push({
      id: rep.id,
      headline: rep.title,
      representative: rep,
      items: members,
      sources: uniqueSources,
      priority: rep.priority,
      category: rep.category,
      relatedCategories: uniqueCategories.filter(c => c !== rep.category),
      region: rep.region,
      country: rep.country,
      publishedMs: rep.publishedMs,
      multiSourceConfirmed: uniqueSources.length >= 2,
      contextSummary,
    });
  }

  // Sort clusters: priority first, then recency
  return clusters.sort((a, b) => {
    const pd = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    return pd !== 0 ? pd : b.publishedMs - a.publishedMs;
  });
}

/**
 * Returns a flat deduplicated feed from clusters, keeping the representative
 * item for each cluster. Safe to use anywhere the old `NewsItem[]` was used.
 */
export function clusterFeedToItems(clusters: EventCluster[]): NewsItem[] {
  return clusters.map(c => c.representative);
}
