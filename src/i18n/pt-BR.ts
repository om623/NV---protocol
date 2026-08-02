/**
 * ─── NV Protocol — PT-BR catalog ─────────────────────────────────────────────
 * All new shell/nav/smart texts live here. Legacy deep texts are migrated
 * progressively as modules are modularized (Fase 1+).
 */
export const ptBR = {
  app: {
    name: 'NV Protocol',
    tagline: 'Protocol V3',
    splash: {
      verse: '"And you shall know the truth, and the truth shall set you free."',
      verseRef: '— John 8:32',
      enter: 'Entrar',
      subtitle: 'Protocol V3',
    },
  },
  nav: {
    menu: 'Menu',
    dashboard: 'Dashboard',
    swap: 'Swap',
    bridge: 'Bridge',
    wallet: 'Carteira',
    pools: 'Pools',
    history: 'Histórico',
    simulation: 'Simulação',
    gamification: 'Gamificação',
    settings: 'Configurações',
    markets: 'Mercados',
    comingSoon: 'Em breve',
    operations: 'Operações',
    intelligence: 'Inteligência',
    system: 'Sistema',
  },
  comingSoon: {
    title: 'Em breve',
    description:
      'Esta funcionalidade está em desenvolvimento e estará disponível em uma futura atualização do NV Protocol.',
    ok: 'Entendi',
  },
  intelligence: {
    title: 'Global Intelligence',
    indicators: 'Indicadores',
    categories: 'Categorias',
    fearGreed: 'Fear & Greed',
    btcDominance: 'BTC Dominance',
    marketCap: 'Global Market Cap',
    volume: 'Global Volume',
    lastUpdate: 'Última atualização',
    marketRadar: 'Radar do Mercado',
  },
  categories: {
    global: 'Global',
    crypto: 'Crypto',
    forex: 'Forex',
    indices: 'Índices',
    energy: 'Energia',
    agro: 'Agro',
    livestock: 'Pecuária',
    metals: 'Metais',
    smallCaps: 'Small Caps',
    americas: 'América',
    europe: 'Europa',
    asia: 'Ásia',
    africa: 'África',
    oceania: 'Oceania',
  },
  markets: {
    title: 'Mercados',
    empty: 'Nenhum ativo disponível para esta categoria.',
  },
  module: {
    notFound: 'Módulo não encontrado.',
    placeholder: 'Módulo em desenvolvimento.',
  },
} as const;

export type PtBR = typeof ptBR;

