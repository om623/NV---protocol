import type { Asset } from './types';

/**
 * ─── Asset Registry ───────────────────────────────────────────────────────────
 * Every asset (crypto, forex, commodities, indices, agro, livestock, metals...)
 * is registered here as data. Adding an asset = adding one entry. No component
 * needs to change. This registry is consumed by the ticker bar (Fase 3), by the
 * category panels (Fase 2) and by the GlobalMarketsProvider (Fase 2).
 *
 * Fase 2 — Global Intelligence:
 *  - 15 world indices, full commodities (energy/metals/agro/livestock),
 *    10 forex pairs, crypto ready for expansion (ADA/AVAX/LINK added).
 *  - Scalability: adding a new asset is just another entry here — no
 *    structural change anywhere else.
 */
export const ASSETS: Asset[] = [
  // ── Crypto (CoinGecko) ─────────────────────────────────────────────────────
  { id: 'BTC',  symbol: 'BTC',  name: 'Bitcoin',    category: 'crypto', source: 'coingecko', sourceSymbol: 'BTC',  decimals: 2, refreshMs: 30000, display: { ticker: true, panel: true } },
  { id: 'ETH',  symbol: 'ETH',  name: 'Ethereum',   category: 'crypto', source: 'coingecko', sourceSymbol: 'ETH',  decimals: 2, refreshMs: 30000, display: { ticker: true, panel: true } },
  { id: 'SOL',  symbol: 'SOL',  name: 'Solana',     category: 'crypto', source: 'coingecko', sourceSymbol: 'SOL',  decimals: 2, refreshMs: 30000, display: { ticker: true, panel: true } },
  { id: 'BNB',  symbol: 'BNB',  name: 'BNB',        category: 'crypto', source: 'coingecko', sourceSymbol: 'BNB',  decimals: 2, refreshMs: 30000, display: { ticker: false, panel: true } },
  { id: 'XRP',  symbol: 'XRP',  name: 'XRP',        category: 'crypto', source: 'coingecko', sourceSymbol: 'XRP',  decimals: 4, refreshMs: 30000, display: { ticker: false, panel: true } },
  { id: 'ADA',  symbol: 'ADA',  name: 'Cardano',    category: 'crypto', source: 'coingecko', sourceSymbol: 'ADA',  decimals: 4, refreshMs: 30000, display: { ticker: false, panel: true } },
  { id: 'AVAX', symbol: 'AVAX', name: 'Avalanche',  category: 'crypto', source: 'coingecko', sourceSymbol: 'AVAX', decimals: 2, refreshMs: 30000, display: { ticker: false, panel: true } },
  { id: 'LINK', symbol: 'LINK', name: 'Chainlink',  category: 'crypto', source: 'coingecko', sourceSymbol: 'LINK', decimals: 2, refreshMs: 30000, display: { ticker: false, panel: true } },
  { id: 'USDC', symbol: 'USDC', name: 'USD Coin',   category: 'crypto', source: 'coingecko', sourceSymbol: 'USDC', decimals: 4, refreshMs: 30000, display: { ticker: false, panel: true } },
  { id: 'EURC', symbol: 'EURC', name: 'EURC',       category: 'crypto', source: 'coingecko', sourceSymbol: 'EURC', decimals: 4, refreshMs: 30000, display: { ticker: false, panel: true } },

  // ── Índices Mundiais ──────────────────────────────────────────────────────
  // Americas
  { id: 'IBOV',  symbol: 'IBOV',  name: 'Ibovespa',      category: 'indices', region: 'AMERICAS', source: 'brapi',   sourceSymbol: '^BVSP',    decimals: 2, refreshMs: 60000, display: { ticker: true, panel: true } },
  { id: 'SPX',   symbol: 'SPX',   name: 'S&P 500',       category: 'indices', region: 'AMERICAS', source: 'yahoo',   sourceSymbol: '^GSPC',    decimals: 2, refreshMs: 60000, display: { ticker: true, panel: true } },
  { id: 'NDX',   symbol: 'NDX',   name: 'Nasdaq',        category: 'indices', region: 'AMERICAS', source: 'yahoo',   sourceSymbol: '^IXIC',    decimals: 2, refreshMs: 60000, display: { ticker: true, panel: true } },
  { id: 'DJI',   symbol: 'DJI',   name: 'Dow Jones',     category: 'indices', region: 'AMERICAS', source: 'yahoo',   sourceSymbol: '^DJI',     decimals: 2, refreshMs: 60000, display: { ticker: true, panel: true } },
  { id: 'RUT',   symbol: 'RUT',   name: 'Russell 2000',  category: 'indices', region: 'AMERICAS', source: 'yahoo',   sourceSymbol: '^RUT',     decimals: 2, refreshMs: 60000, display: { ticker: true, panel: true } },
  // Europe
  { id: 'DAX',   symbol: 'DAX',   name: 'DAX',           category: 'indices', region: 'EUROPE',   source: 'yahoo',   sourceSymbol: '^GDAXI',   decimals: 2, refreshMs: 60000, display: { ticker: true, panel: true } },
  { id: 'CAC',   symbol: 'CAC',   name: 'CAC 40',        category: 'indices', region: 'EUROPE',   source: 'yahoo',   sourceSymbol: '^FCHI',    decimals: 2, refreshMs: 60000, display: { ticker: true, panel: true } },
  { id: 'FTSE',  symbol: 'FTSE',  name: 'FTSE 100',      category: 'indices', region: 'EUROPE',   source: 'yahoo',   sourceSymbol: '^FTSE',    decimals: 2, refreshMs: 60000, display: { ticker: true, panel: true } },
  { id: 'STOXX', symbol: 'STOXX', name: 'Euro Stoxx 50', category: 'indices', region: 'EUROPE',   source: 'yahoo',   sourceSymbol: '^STOXX50E', decimals: 2, refreshMs: 60000, display: { ticker: true, panel: true } },
  // Asia
  { id: 'NIKKEI', symbol: 'NIKKEI', name: 'Nikkei 225',      category: 'indices', region: 'ASIA', source: 'yahoo', sourceSymbol: '^N225',    decimals: 2, refreshMs: 60000, display: { ticker: true, panel: true } },
  { id: 'HSI',    symbol: 'HSI',    name: 'Hang Seng',        category: 'indices', region: 'ASIA', source: 'yahoo', sourceSymbol: '^HSI',     decimals: 2, refreshMs: 60000, display: { ticker: true, panel: true } },
  { id: 'SHCOMP', symbol: 'SHCOMP', name: 'Shanghai Comp.',   category: 'indices', region: 'ASIA', source: 'yahoo', sourceSymbol: '000001.SS', decimals: 2, refreshMs: 60000, display: { ticker: true, panel: true } },
  { id: 'KS11',   symbol: 'KS11',   name: 'KOSPI',            category: 'indices', region: 'ASIA', source: 'yahoo', sourceSymbol: '^KS11',    decimals: 2, refreshMs: 60000, display: { ticker: true, panel: true } },
  { id: 'SENSEX', symbol: 'SENSEX', name: 'SENSEX',           category: 'indices', region: 'ASIA', source: 'yahoo', sourceSymbol: '^BSESN',   decimals: 2, refreshMs: 60000, display: { ticker: true, panel: true } },
  // Oceania
  { id: 'ASX', symbol: 'ASX', name: 'ASX 200', category: 'indices', region: 'OCEANIA', source: 'yahoo', sourceSymbol: '^AXJO', decimals: 2, refreshMs: 60000, display: { ticker: true, panel: true } },

  // ── Energy ────────────────────────────────────────────────────────────────
  { id: 'BZ', symbol: 'BZ', name: 'Petróleo Brent', category: 'energy', source: 'yahoo', sourceSymbol: 'BZ=F', decimals: 2, refreshMs: 60000, display: { ticker: true, panel: true } },
  { id: 'CL', symbol: 'CL', name: 'WTI',            category: 'energy', source: 'yahoo', sourceSymbol: 'CL=F', decimals: 2, refreshMs: 60000, display: { ticker: true, panel: true } },
  { id: 'NG', symbol: 'NG', name: 'Gás Natural',    category: 'energy', source: 'yahoo', sourceSymbol: 'NG=F', decimals: 2, refreshMs: 60000, display: { ticker: true, panel: true } },

  // ── Metals ────────────────────────────────────────────────────────────────
  { id: 'XAU', symbol: 'XAU', name: 'Ouro',    category: 'metals', source: 'yahoo', sourceSymbol: 'GC=F', decimals: 2, refreshMs: 60000, display: { ticker: true, panel: true } },
  { id: 'XAG', symbol: 'XAG', name: 'Prata',   category: 'metals', source: 'yahoo', sourceSymbol: 'SI=F', decimals: 2, refreshMs: 60000, display: { ticker: true, panel: true } },
  { id: 'PL',  symbol: 'PL',  name: 'Platina', category: 'metals', source: 'yahoo', sourceSymbol: 'PL=F', decimals: 2, refreshMs: 60000, display: { ticker: true, panel: true } },
  { id: 'PA',  symbol: 'PA',  name: 'Paládio', category: 'metals', source: 'yahoo', sourceSymbol: 'PA=F', decimals: 2, refreshMs: 60000, display: { ticker: true, panel: true } },
  { id: 'HG',  symbol: 'HG',  name: 'Cobre',   category: 'metals', source: 'yahoo', sourceSymbol: 'HG=F', decimals: 2, refreshMs: 60000, display: { ticker: true, panel: true } },

  // ── Agro ──────────────────────────────────────────────────────────────────
  { id: 'SOY',    symbol: 'SOY',    name: 'Soja',    category: 'agro', source: 'yahoo', sourceSymbol: 'ZS=F', decimals: 2, refreshMs: 60000, display: { ticker: true, panel: true } },
  { id: 'CORN',   symbol: 'CORN',   name: 'Milho',   category: 'agro', source: 'yahoo', sourceSymbol: 'ZC=F', decimals: 2, refreshMs: 60000, display: { ticker: true, panel: true } },
  { id: 'WHEAT',  symbol: 'WHEAT',  name: 'Trigo',   category: 'agro', source: 'yahoo', sourceSymbol: 'ZW=F', decimals: 2, refreshMs: 60000, display: { ticker: true, panel: true } },
  { id: 'COFFEE', symbol: 'COFFEE', name: 'Café',    category: 'agro', source: 'yahoo', sourceSymbol: 'KC=F', decimals: 2, refreshMs: 60000, display: { ticker: true, panel: true } },
  { id: 'SUGAR',  symbol: 'SUGAR',  name: 'Açúcar',  category: 'agro', source: 'yahoo', sourceSymbol: 'SB=F', decimals: 2, refreshMs: 60000, display: { ticker: true, panel: true } },
  { id: 'COTTON', symbol: 'COTTON', name: 'Algodão', category: 'agro', source: 'yahoo', sourceSymbol: 'CT=F', decimals: 2, refreshMs: 60000, display: { ticker: true, panel: true } },

  // ── Livestock ─────────────────────────────────────────────────────────────
  { id: 'BOVI',   symbol: 'BOVI',   name: 'Boi Gordo',      category: 'livestock', source: 'yahoo', sourceSymbol: 'GF=F', decimals: 2, refreshMs: 60000, display: { ticker: true, panel: true } },
  { id: 'LIVE',   symbol: 'LIVE',   name: 'Gado de Corte',  category: 'livestock', source: 'yahoo', sourceSymbol: 'LE=F', decimals: 2, refreshMs: 60000, display: { ticker: true, panel: true } },
  { id: 'REPO',   symbol: 'REPO',   name: 'Gado Reposição', category: 'livestock', source: 'yahoo', sourceSymbol: 'GF=F', decimals: 2, refreshMs: 60000, display: { ticker: true, panel: true } },
  { id: 'HOGS',   symbol: 'HOGS',   name: 'Suínos',         category: 'livestock', source: 'yahoo', sourceSymbol: 'HE=F', decimals: 2, refreshMs: 60000, display: { ticker: true, panel: true } },
  { id: 'CHICKEN',symbol: 'CHICKEN',name: 'Frango',         category: 'livestock', source: 'yahoo', sourceSymbol: 'CHICKEN', decimals: 2, refreshMs: 60000, display: { ticker: true, panel: true } },

  // ── Forex (Frankfurter) ───────────────────────────────────────────────────
  { id: 'EUR-USD', symbol: 'EUR/USD', name: 'Euro / Dólar',   category: 'forex', region: 'EUROPE',   source: 'frankfurter', sourceSymbol: 'EUR/USD', decimals: 4, refreshMs: 60000, display: { ticker: true, panel: true } },
  { id: 'USD-BRL', symbol: 'USD/BRL', name: 'Dólar / Real',   category: 'forex', region: 'AMERICAS', source: 'frankfurter', sourceSymbol: 'USD/BRL', decimals: 4, refreshMs: 60000, display: { ticker: true, panel: true } },
  { id: 'GBP-USD', symbol: 'GBP/USD', name: 'Libra / Dólar',  category: 'forex', region: 'EUROPE',   source: 'frankfurter', sourceSymbol: 'GBP/USD', decimals: 4, refreshMs: 60000, display: { ticker: true, panel: true } },
  { id: 'USD-JPY', symbol: 'USD/JPY', name: 'Dólar / Iene',   category: 'forex', region: 'ASIA',     source: 'frankfurter', sourceSymbol: 'USD/JPY', decimals: 2, refreshMs: 60000, display: { ticker: true, panel: true } },
  { id: 'USD-CHF', symbol: 'USD/CHF', name: 'Dólar / Franco', category: 'forex', region: 'EUROPE',   source: 'frankfurter', sourceSymbol: 'USD/CHF', decimals: 4, refreshMs: 60000, display: { ticker: true, panel: true } },
  { id: 'USD-CAD', symbol: 'USD/CAD', name: 'Dólar Canadense',category: 'forex', region: 'AMERICAS', source: 'frankfurter', sourceSymbol: 'USD/CAD', decimals: 4, refreshMs: 60000, display: { ticker: true, panel: true } },
  { id: 'AUD-USD', symbol: 'AUD/USD', name: 'Dólar Australiano', category: 'forex', region: 'OCEANIA', source: 'frankfurter', sourceSymbol: 'AUD/USD', decimals: 4, refreshMs: 60000, display: { ticker: true, panel: true } },
  { id: 'NZD-USD', symbol: 'NZD/USD', name: 'Dólar Neozelandês', category: 'forex', region: 'OCEANIA', source: 'frankfurter', sourceSymbol: 'NZD/USD', decimals: 4, refreshMs: 60000, display: { ticker: true, panel: true } },
  { id: 'EUR-GBP', symbol: 'EUR/GBP', name: 'Euro / Libra',   category: 'forex', region: 'EUROPE',   source: 'frankfurter', sourceSymbol: 'EUR/GBP', decimals: 4, refreshMs: 60000, display: { ticker: true, panel: true } },
  { id: 'USD-CNY', symbol: 'USD/CNY', name: 'Dólar / Yuan',   category: 'forex', region: 'ASIA',     source: 'frankfurter', sourceSymbol: 'USD/CNY', decimals: 4, refreshMs: 60000, display: { ticker: true, panel: true } },
];

export const assetRegistry = {
  getAll: (): Asset[] => ASSETS,
  get: (id: string): Asset | undefined => ASSETS.find(a => a.id === id),
  byCategory: (categoryId: string): Asset[] => ASSETS.filter(a => a.category === categoryId),
  bySource: (sourceId: string): Asset[] => ASSETS.filter(a => a.source === sourceId),
  tickerAssets: (): Asset[] => ASSETS.filter(a => a.display.ticker),
};

