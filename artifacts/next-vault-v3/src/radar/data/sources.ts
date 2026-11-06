import type { SourceInfo } from '../types';

/**
 * Honest registry of data sources.
 *  live          : implemented and queried by the Radar
 *  needs-config  : implemented, but needs a credential / setting that only the operator can provide
 *  planned       : NOT implemented yet (shown so users know the gap)
 */
export const SOURCES: SourceInfo[] = [
  { id: 'worldbank', name: 'World Bank Open Data', scope: 'Country indicators', url: 'https://data.worldbank.org', status: 'live' },
  { id: 'bcb', name: 'Banco Central do Brasil (SGS)', scope: 'Brazil policy rate and inflation', url: 'https://dadosabertos.bcb.gov.br', status: 'live' },
  { id: 'wikidata', name: 'Wikidata', scope: 'Company facts, dated financial statements', url: 'https://www.wikidata.org', status: 'live' },
  { id: 'wikipedia', name: 'Wikipedia', scope: 'Company summaries', url: 'https://www.wikipedia.org', status: 'live' },
  { id: 'yahoo', name: 'Yahoo Finance', scope: 'Market quotes for listed companies', url: 'https://finance.yahoo.com', status: 'live' },
  { id: 'gdelt', name: 'GDELT Project', scope: 'Global news index', url: 'https://www.gdeltproject.org', status: 'live' },
  { id: 'sec', name: 'SEC EDGAR', scope: 'US and ADR annual filings (XBRL)', url: 'https://www.sec.gov/edgar', status: 'needs-config', requires: 'SEC_USER_AGENT' },
  { id: 'companieshouse', name: 'Companies House (UK)', scope: 'UK company registry', url: 'https://developer.company-information.service.gov.uk', status: 'planned', requires: 'COMPANIES_HOUSE_API_KEY' },
  { id: 'cvm', name: 'CVM (Brazil)', scope: 'Brazilian listed-company filings', url: 'https://dados.cvm.gov.br', status: 'planned' },
  { id: 'b3', name: 'B3', scope: 'Brazilian exchange data', url: 'https://www.b3.com.br', status: 'planned' },
  { id: 'centralbanks', name: 'Other central banks', scope: 'Policy rates and inflation outside Brazil', url: 'https://www.bis.org/statistics', status: 'planned' },
  { id: 'registries', name: 'National business registries', scope: 'Private-company records', url: 'https://opencorporates.com', status: 'planned' },
];
