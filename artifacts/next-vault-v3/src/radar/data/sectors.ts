import type { SectorId } from '../types';

export const SECTORS: SectorId[] = [
  'ai', 'tech', 'semis', 'energy', 'oilgas', 'mining', 'agri', 'auto', 'aerospace', 'defense',
  'health', 'biotech', 'pharma', 'construction', 'infra', 'telecom', 'finance', 'insurance',
  'realestate', 'logistics', 'retail', 'food', 'tourism', 'sanitation', 'renewables', 'heavy',
  'education', 'transport', 'bizservices', 'other',
];

/**
 * English search phrases used ONLY to query news sources for a sector.
 * They are query terms, not UI text.
 */
export const SECTOR_NEWS_QUERY: Record<SectorId, string> = {
  ai: '"artificial intelligence"',
  tech: '"technology company" software cloud',
  semis: 'semiconductor chip foundry',
  energy: 'electricity utility power grid',
  oilgas: '"oil and gas" refinery crude',
  mining: 'mining copper lithium "iron ore"',
  agri: 'agribusiness crops fertilizer',
  auto: 'automaker "electric vehicle"',
  aerospace: 'aerospace aircraft satellite',
  defense: '"defense contractor" defence procurement',
  health: 'healthcare hospital "medical devices"',
  biotech: 'biotechnology "gene therapy"',
  pharma: 'pharmaceutical drugmaker',
  construction: 'construction engineering contractor',
  infra: 'infrastructure investment ports railways',
  telecom: 'telecom 5G operator',
  finance: 'bank banking fintech',
  insurance: 'insurer reinsurance',
  realestate: '"real estate" property developer',
  logistics: 'logistics shipping freight',
  retail: 'retailer consumer brands',
  food: '"food and beverage" packaged food',
  tourism: 'tourism hotels airlines travel',
  sanitation: 'water utility sanitation waste',
  renewables: 'solar wind "renewable energy"',
  heavy: 'steel chemicals manufacturing',
  education: 'education edtech university',
  transport: 'railway airline transport',
  bizservices: 'consulting "business services" outsourcing',
  other: 'conglomerate holding company',
};
