// ─── Global Radar: shared types ──────────────────────────────────────────────

export type Continent = 'NA' | 'SA' | 'EU' | 'AS' | 'AF' | 'OC' | 'ME' | 'AN';

export const CONTINENTS: Continent[] = ['NA', 'SA', 'EU', 'AS', 'ME', 'AF', 'OC'];

export type SectorId =
  | 'ai' | 'tech' | 'semis' | 'energy' | 'oilgas' | 'mining' | 'agri' | 'auto' | 'aerospace' | 'defense'
  | 'health' | 'biotech' | 'pharma' | 'construction' | 'infra' | 'telecom' | 'finance' | 'insurance'
  | 'realestate' | 'logistics' | 'retail' | 'food' | 'tourism' | 'sanitation' | 'renewables' | 'heavy'
  | 'education' | 'transport' | 'bizservices' | 'other';

/** Editorial size class (not a measured figure). */
export type SizeClass = 'mega' | 'large' | 'growth';

export interface City {
  lat: number;
  lon: number;
}

/** Static, stable facts only. Every number shown to the user is fetched live. */
export interface CompanySeed {
  id: string;
  name: string;
  /** ISO 3166-1 alpha-2 of the headquarters country */
  country: string;
  city: string;
  lat: number;
  lon: number;
  sector: SectorId;
  size: SizeClass;
  listed: boolean;
  ticker?: string;
  exchange?: string;
  /** Yahoo Finance symbol, derived from ticker + exchange */
  yahoo?: string;
  /** US-listed ticker (ADR or primary) used to look up SEC filings */
  sec?: string;
  /** Wikidata item id, verified by script (see src/radar/data/verified.ts) */
  qid?: string;
}

// ── Sourced values ───────────────────────────────────────────────────────────

/**
 * available      : value fetched from a source
 * stale          : value fetched, but its reference date is old
 * unavailable    : the source was queried and returned nothing / failed
 * not_disclosed  : private company with no public figure
 */
export type FieldStatus = 'available' | 'stale' | 'unavailable' | 'not_disclosed';

export interface Sourced<T> {
  status: FieldStatus;
  value?: T;
  /** Reference date of the figure (ISO date or year) */
  asOf?: string;
  currency?: string;
  source?: string;
  sourceUrl?: string;
  /** When NV fetched it (ISO timestamp) */
  retrievedAt?: string;
}

export type MetricKey =
  | 'revenue' | 'netIncome' | 'assets' | 'liabilities' | 'equity' | 'debt'
  | 'marketCap' | 'employees';

export const METRIC_KEYS: MetricKey[] = [
  'revenue', 'netIncome', 'equity', 'assets', 'liabilities', 'debt', 'marketCap', 'employees',
];

export type Metrics = Partial<Record<MetricKey, Sourced<number>>>;

export interface Quote {
  price: number;
  currency: string;
  changePct: number | null;
  high52: number | null;
  low52: number | null;
  exchange: string | null;
  marketTime: number | null;
  /** daily closes, oldest first */
  spark: number[];
  ret1m: number | null;
  ret3m: number | null;
  source: string;
  retrievedAt: string;
}

export interface NamedItem {
  id: string;
  label: string;
}

export interface Subsidiary extends NamedItem {
  country?: string;
}

export interface CompanyProfile {
  inception?: Sourced<string>;
  website?: string;
  industries: NamedItem[];
  founders: NamedItem[];
  parent?: NamedItem;
  subsidiaries: Subsidiary[];
  subsidiaryCountries: string[];
  articleTitle?: { lang: string; title: string };
  summary?: { text: string; lang: string; url: string };
}

export interface NewsItem {
  title: string;
  url: string;
  domain: string;
  date: string | null;
  language?: string;
}

export type LoadState<T> =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'ready'; data: T }
  | { state: 'error'; message: string; code?: string };

export interface CountryIndicator {
  id: string;
  value: number | null;
  year: string | null;
}

export type CountryIndicators = Partial<Record<IndicatorKey, CountryIndicator>>;

export type IndicatorKey =
  | 'gdp' | 'gdpGrowth' | 'gdpPerCapita' | 'population' | 'inflation' | 'unemployment' | 'fdi' | 'manufacturing';

export interface SourceInfo {
  id: string;
  name: string;
  scope: string;
  url: string;
  status: 'live' | 'needs-config' | 'planned';
  /** What the user must provide, if anything */
  requires?: string;
}
