import type { CompanySeed, Continent, Metrics, NamedItem, SectorId, SizeClass } from './types';
import { continentOf } from './data/countries';
import { normalizeText } from './format';

export interface Filters {
  query: string;
  continent: Continent | 'all';
  country: string | 'all';
  sector: SectorId | 'all';
  size: SizeClass | 'all';
  listing: 'all' | 'listed' | 'private';
  /** Wikidata industry id */
  industry: string | 'all';
  /** USD revenue floor; applies only to companies whose USD revenue has been loaded */
  minRevenueUsd: number;
}

export const defaultFilters: Filters = {
  query: '', continent: 'all', country: 'all', sector: 'all', size: 'all', listing: 'all', industry: 'all', minRevenueUsd: 0,
};

export interface FilterContext {
  countryName: (a2: string) => string;
  sectorName: (s: SectorId) => string;
  continentName: (c: Continent) => string;
  /** company id -> industries (localised labels from Wikidata) */
  industries: Map<string, NamedItem[]>;
  loaded: Map<string, Metrics>;
}

const SIZE_RANK: Record<SizeClass, number> = { mega: 0, large: 1, growth: 2 };

export function activeFilterCount(f: Filters): number {
  return (
    Number(f.continent !== 'all') + Number(f.country !== 'all') + Number(f.sector !== 'all') + Number(f.size !== 'all') +
    Number(f.listing !== 'all') + Number(f.industry !== 'all') + Number(f.minRevenueUsd > 0)
  );
}

export function filterCompanies(all: CompanySeed[], f: Filters, ctx: FilterContext): CompanySeed[] {
  const tokens = normalizeText(f.query).split(/\s+/).filter(Boolean);
  const out: { c: CompanySeed; rank: number }[] = [];

  for (const c of all) {
    if (f.continent !== 'all' && continentOf(c.country) !== f.continent) continue;
    if (f.country !== 'all' && c.country !== f.country) continue;
    if (f.sector !== 'all' && c.sector !== f.sector) continue;
    if (f.size !== 'all' && c.size !== f.size) continue;
    if (f.listing === 'listed' && !c.listed) continue;
    if (f.listing === 'private' && c.listed) continue;
    const inds = ctx.industries.get(c.id) ?? [];
    if (f.industry !== 'all' && !inds.some((i) => i.id === f.industry)) continue;
    if (f.minRevenueUsd > 0) {
      const rev = ctx.loaded.get(c.id)?.revenue;
      if (!rev || rev.currency !== 'USD' || (rev.value ?? 0) < f.minRevenueUsd) continue;
    }

    let rank = 0;
    if (tokens.length) {
      const name = normalizeText(c.name);
      const hay = normalizeText(
        [c.name, c.id, c.ticker ?? '', c.city, c.country, ctx.countryName(c.country), ctx.sectorName(c.sector), ctx.continentName(continentOf(c.country)), ...inds.map((i) => i.label)].join(' '),
      );
      if (!tokens.every((tk) => hay.includes(tk))) continue;
      rank = name.startsWith(tokens[0]) ? 0 : name.includes(tokens[0]) ? 1 : 2;
    }
    out.push({ c, rank });
  }

  out.sort((a, b) => a.rank - b.rank || SIZE_RANK[a.c.size] - SIZE_RANK[b.c.size] || a.c.name.localeCompare(b.c.name));
  return out.map((x) => x.c);
}

/** Industry facet: [id,label,count] sorted by count, built from the loaded Wikidata basics. */
export function industryFacet(companies: CompanySeed[], industries: Map<string, NamedItem[]>): { id: string; label: string; count: number }[] {
  const m = new Map<string, { id: string; label: string; count: number }>();
  for (const c of companies) {
    for (const i of industries.get(c.id) ?? []) {
      const e = m.get(i.id);
      if (e) e.count++;
      else m.set(i.id, { id: i.id, label: i.label, count: 1 });
    }
  }
  return [...m.values()].filter((x) => x.count >= 2).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)).slice(0, 80);
}
