import type { Asset } from './types';

/**
 * ─── Asset Registry ───────────────────────────────────────────────────────────
 * Every asset (crypto, forex, commodities, indices, agro, livestock, metals...)
 * is registered here as data. Adding an asset = adding one entry. No component
 * needs to change. This registry is consumed by the ticker bar (Fase 3) and by
 * the category panels (Fase 2). For Fase 0 it is structural only.
 */
export const ASSETS: Asset[] = [
  // ── Crypto ─────────────────────────────────────────────────────────────────
  { id: 'BTC',  symbol: 'BTC',    name: 'Bitcoin',     category: 'crypto', source: 'coingecko', sourceSymbol: 'BTC',  decimals: 2, refreshMs: 30000, display: { ticker: true, panel: true } },
  { id: 'ETH',  symbol: 'ETH',    name: 'Ethereum',    category: 'crypto', source: 'coingecko', sourceSymbol: 'ETH',  decimals: 2, refreshMs: 30000, display: { ticker: true, panel: true } },
  { id: 'SOL',  symbol: 'SOL',    name: 'Solana',      category: 'crypto', source: 'coingecko', sourceSymbol: 'SOL',  decimals: 2, refreshMs: 30000, display: { ticker: true, panel: true } },
  { id: 'BNB',  symbol: 'BNB',    name: 'BNB',         category: 'crypto', source: 'coingecko', sourceSymbol: 'BNB',  decimals: 2, refreshMs: 30000, display: { ticker: false, panel: true } },
  { id: 'XRP',  symbol: 'XRP',    name: 'XRP',         category: 'crypto', source: 'coingecko', sourceSymbol: 'XRP',  decimals: 4, refreshMs: 30000, display: { ticker: false, panel: true } },
  { id: 'USDC', symbol: 'USDC',   name: 'USD Coin',    category: 'crypto', source: 'coingecko', sourceSymbol: 'USDC', decimals: 4, refreshMs: 30000, display: { ticker: false, panel: true } },
  { id: 'EURC', symbol: 'EURC',   name: 'EURC',        category: 'crypto', source: 'coingecko', sourceSymbol: 'EURC', decimals: 4, refreshMs: 30000, display: { ticker: false, panel: true } },

  // ── Indices ────────────────────────────────────────────────────────────────
  { id: 'SPX',  symbol: 'SPX',    name: 'S&P 500',     category: 'indices', region: 'AMERICAS', source: 'yahoo', sourceSymbol: '^GSPC', decimals: 2, refreshMs: 60000, display: { ticker: true, panel: true } },
  { id: 'NDX',  symbol: 'NDX',    name: 'Nasdaq',      category: 'indices', region: 'AMERICAS', source: 'yahoo', sourceSymbol: '^IXIC', decimals: 2, refreshMs: 60000, display: { ticker: true, panel: true } },
  { id: 'DJI',  symbol: 'DJI',    name: 'Dow Jones',   category: 'indices', region: 'AMERICAS', source: 'yahoo', sourceSymbol: '^DJI',  decimals: 2, refreshMs: 60000, display: { ticker: true, panel: true } },

  // ── Commodities / Metals / Energy ─────────────────────────────────────────
  { id: 'XAU', symbol: 'XAU', name: 'Ouro',   category: 'metals', source: 'yahoo', sourceSymbol: 'GC=F', decimals: 2, refreshMs: 60000, display: { ticker: true, panel: true } },
  { id: 'XAG', symbol: 'XAG', name: 'Prata',  category: 'metals', source: 'yahoo', sourceSymbol: 'SI=F', decimals: 2, refreshMs: 60000, display: { ticker: true, panel: true } },
  { id: 'CL',  symbol: 'CL',  name: 'WTI',    category: 'energy', source: 'yahoo', sourceSymbol: 'CL=F', decimals: 2, refreshMs: 60000, display: { ticker: true, panel: true } },
  { id: 'BZ',  symbol: 'BZ',  name: 'Brent',  category: 'energy', source: 'yahoo', sourceSymbol: 'BZ=F', decimals: 2, refreshMs: 60000, display: { ticker: true, panel: true } },
  { id: 'NG',  symbol: 'NG',  name: 'Gás Natural', category: 'energy', source: 'yahoo', sourceSymbol: 'NG=F', decimals: 2, refreshMs: 60000, display: { ticker: true, panel: true } },

  // ── Forex (Frankfurter) ───────────────────────────────────────────────────
  { id: 'USD-BRL', symbol: 'USD/BRL', name: 'Dólar',      category: 'forex', region: 'AMERICAS', source: 'frankfurter', sourceSymbol: 'USD/BRL', decimals: 4, refreshMs: 60000, display: { ticker: true, panel: true } },
  { id: 'EUR-USD', symbol: 'EUR/USD', name: 'Euro',       category: 'forex', region: 'EUROPE',   source: 'frankfurter', sourceSymbol: 'EUR/USD', decimals: 4, refreshMs: 60000, display: { ticker: true, panel: true } },

  // ── Agro (yahoo commodities futures) ──────────────────────────────────────
  { id: 'SOY', symbol: 'SOY', name: 'Soja',  category: 'agro', source: 'yahoo', sourceSymbol: 'ZS=F', decimals: 2, refreshMs: 60000, display: { ticker: true, panel: true } },
  { id: 'CORN', symbol: 'CORN', name: 'Milho', category: 'agro', source: 'yahoo', sourceSymbol: 'ZC=F', decimals: 2, refreshMs: 60000, display: { ticker: true, panel: true } },
  { id: 'WHEAT', symbol: 'WHEAT', name: 'Trigo', category: 'agro', source: 'yahoo', sourceSymbol: 'ZW=F', decimals: 2, refreshMs: 60000, display: { ticker: true, panel: true } },
  { id: 'COFFEE', symbol: 'COFFEE', name: 'Café', category: 'agro', source: 'yahoo', sourceSymbol: 'KC=F', decimals: 2, refreshMs: 60000, display: { ticker: true, panel: true } },
  { id: 'SUGAR', symbol: 'SUGAR', name: 'Açúcar', category: 'agro', source: 'yahoo', sourceSymbol: 'SB=F', decimals: 2, refreshMs: 60000, display: { ticker: true, panel: true } },

  // ── Livestock ─────────────────────────────────────────────────────────────
  { id: 'BOVI', symbol: 'BOVI', name: 'Boi Gordo', category: 'livestock', source: 'yahoo', sourceSymbol: 'GF=F', decimals: 2, refreshMs: 60000, display: { ticker: true, panel: true } },

  // ── Brazil (Brapi) ─────────────────────────────────────────────────────────
  { id: 'IBOV', symbol: 'IBOV', name: 'Ibovespa', category: 'indices', region: 'AMERICAS', source: 'brapi', sourceSymbol: '^BVSP', decimals: 2, refreshMs: 60000, display: { ticker: true, panel: true } },
];

export const assetRegistry = {
  getAll: (): Asset[] => ASSETS,
  get: (id: string): Asset | undefined => ASSETS.find(a => a.id === id),
  byCategory: (categoryId: string): Asset[] => ASSETS.filter(a => a.category === categoryId),
  bySource: (sourceId: string): Asset[] => ASSETS.filter(a => a.source === sourceId),
  tickerAssets: (): Asset[] => ASSETS.filter(a => a.display.ticker),
};

