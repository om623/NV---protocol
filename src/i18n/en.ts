/**
 * ─── NV Protocol — EN catalog (structural stub) ──────────────────────────────
 * i18n infrastructure is ready from day one. English is a structural placeholder;
 * it will be completed in a later phase.
 */
export const en = {
  app: {
    name: 'NV Protocol',
    tagline: 'Protocol V3',
    splash: {
      verse: '"And you shall know the truth, and the truth shall set you free."',
      verseRef: '— John 8:32',
      enter: 'Enter',
      subtitle: 'Protocol V3',
    },
  },
  nav: {
    menu: 'Menu',
    dashboard: 'Dashboard',
    swap: 'Swap',
    bridge: 'Bridge',
    wallet: 'Wallet',
    pools: 'Pools',
    history: 'History',
    simulation: 'Simulation',
    gamification: 'Gamification',
    settings: 'Settings',
    markets: 'Markets',
    comingSoon: 'Coming soon',
    operations: 'Operations',
    intelligence: 'Intelligence',
    system: 'System',
  },
  comingSoon: {
    title: 'Coming soon',
    description:
      'This feature is under development and will be available in a future NV Protocol update.',
    ok: 'Got it',
  },
  intelligence: {
    title: 'Global Intelligence',
    indicators: 'Indicators',
    categories: 'Categories',
    fearGreed: 'Fear & Greed',
    btcDominance: 'BTC Dominance',
    marketCap: 'Global Market Cap',
    volume: 'Global Volume',
    lastUpdate: 'Last update',
    marketRadar: 'Market Radar',
  },
  categories: {
    global: 'Global',
    crypto: 'Crypto',
    forex: 'Forex',
    indices: 'Indices',
    energy: 'Energy',
    agro: 'Agro',
    livestock: 'Livestock',
    metals: 'Metals',
    smallCaps: 'Small Caps',
    americas: 'Americas',
    europe: 'Europe',
    asia: 'Asia',
    africa: 'Africa',
    oceania: 'Oceania',
  },
  markets: {
    title: 'Markets',
    empty: 'No assets available for this category.',
  },
  indicators: {
    vix: 'VIX',
    dxy: 'DXY',
    fedFunds: 'Fed Funds',
    cpi: 'CPI',
    treasury2y: 'Treasury 2Y',
    treasury10y: 'Treasury 10Y',
    treasury30y: 'Treasury 30Y',
    ppi: 'PPI',
    pmi: 'PMI',
    unemployment: 'Unemployment',
  },
  module: {
    notFound: 'Module not found.',
    placeholder: 'Module under development.',
  },
} as const;

