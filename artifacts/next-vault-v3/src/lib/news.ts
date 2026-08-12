// ─── Editorial Event Engine ──────────────────────────────────────────────────
// Converts existing dashboard data into prioritized editorial events.
// No fake data — only real data already present in the app is used.

import type { Locale } from '../i18n/types';

export interface DashboardContext {
  fearGreedIndex: number;
  fearGreedLabel: string;
  dominantTrend: string;
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  totalVolume: number;
  totalTvl: number;
  btcDominance: number;
  activeNetworkName: string;
  topMovers: { symbol: string; change: number }[];
  isLiveData: boolean;
  // Extended fields for editorial engine
  isWalletConnected: boolean;
  networkOnline: boolean;
  recentSwapActivity: boolean;
  simulationRunning: boolean;
}

export type EventPriority =
  | 'recent_change'
  | 'recent_activity'
  | 'network_status'
  | 'market_movement'
  | 'sentiment'
  | 'general';

export type EventColor = 'emerald' | 'cyan' | 'violet' | 'orange' | 'red' | 'neutral';

export interface EditorialEvent {
  id: string;
  category: string;
  title: string;
  description: string;
  priority: EventPriority;
  color: EventColor;
  timestamp: number;
}

type EventDict = Record<string, string>;

const ptBR: EventDict = {
  'cat.market': 'Mercado',
  'cat.network': 'Rede',
  'cat.wallet': 'Carteira',
  'cat.activity': 'Atividade',
  'cat.sentiment': 'Sentimento',
  'cat.simulation': 'Simulação',
  'cat.general': 'Geral',
  'title.fear': 'Sentimento em Medo',
  'title.greed': 'Sentimento em Ganância',
  'title.neutral_sentiment': 'Sentimento Neutro',
  'desc.fear': 'O sentimento do mercado permanece em Fear ({value}), indicando cautela entre os participantes.',
  'desc.greed': 'O sentimento do mercado está em Greed ({value}), refletindo otimismo entre os investidores.',
  'desc.neutral_sentiment': 'O sentimento do mercado está em {label} ({value}), sinalizando equilíbrio entre otimismo e cautela.',
  'title.gainer': '{symbol} em Alta',
  'desc.gainer': '{symbol} apresenta movimento positivo de +{change}% no período observado.',
  'title.loser': '{symbol} em Queda',
  'desc.loser': '{symbol} registra queda de {change}% segundo os dados de mercado.',
  'title.network_online': 'Rede {network} Online',
  'desc.network_online': 'A rede {network} permanece online e operacional no NV Protocol.',
  'title.network_offline': 'Rede {network} Indisponível',
  'desc.network_offline': 'A rede {network} não está respondendo. Verifique sua conexão.',
  'title.wallet_connected': 'Carteira Conectada',
  'desc.wallet_connected': 'Carteira conectada à {network}. Dados em tempo real disponíveis.',
  'title.wallet_disconnected': 'Modo Simulação',
  'desc.wallet_disconnected': 'Nenhuma carteira conectada — operando com dados simulados.',
  'title.swap_activity': 'Atividade de Swap Registrada',
  'desc.swap_activity': 'Uma nova atividade de swap foi registrada recentemente.',
  'title.sim_running': 'Simulação em Andamento',
  'desc.sim_running': 'Pipeline de simulação em execução. Aguardando resultados.',
  'title.tvl': 'TVL DeFi em {value}B',
  'desc.tvl': 'O TVL total em DeFi está em ${value} bilhões, segundo dados da DefiLlama.',
  'title.btc_dom': 'Dominância do BTC em {value}%',
  'desc.btc_dom': 'A dominância do Bitcoin está em {value}% do mercado de criptomoedas.',
  'title.no_changes': 'Sem Novidades',
  'desc.no_changes': 'Não há alterações relevantes desde a última atualização.',
};

const en: EventDict = {
  'cat.market': 'Market',
  'cat.network': 'Network',
  'cat.wallet': 'Wallet',
  'cat.activity': 'Activity',
  'cat.sentiment': 'Sentiment',
  'cat.simulation': 'Simulation',
  'cat.general': 'General',
  'title.fear': 'Sentiment at Fear',
  'title.greed': 'Sentiment at Greed',
  'title.neutral_sentiment': 'Neutral Sentiment',
  'desc.fear': 'Market sentiment remains at Fear ({value}), indicating caution among participants.',
  'desc.greed': 'Market sentiment is at Greed ({value}), reflecting optimism among investors.',
  'desc.neutral_sentiment': 'Market sentiment is at {label} ({value}), signaling balance between optimism and caution.',
  'title.gainer': '{symbol} on the Rise',
  'desc.gainer': '{symbol} shows a positive movement of +{change}% in the observed period.',
  'title.loser': '{symbol} Declining',
  'desc.loser': '{symbol} records a decline of {change}% according to market data.',
  'title.network_online': 'Network {network} Online',
  'desc.network_online': 'The {network} network remains online and operational on NV Protocol.',
  'title.network_offline': 'Network {network} Unavailable',
  'desc.network_offline': 'The {network} network is not responding. Check your connection.',
  'title.wallet_connected': 'Wallet Connected',
  'desc.wallet_connected': 'Wallet connected to {network}. Real-time data available.',
  'title.wallet_disconnected': 'Simulation Mode',
  'desc.wallet_disconnected': 'No wallet connected — operating with simulated data.',
  'title.swap_activity': 'Swap Activity Registered',
  'desc.swap_activity': 'A new swap activity has been registered recently.',
  'title.sim_running': 'Simulation in Progress',
  'desc.sim_running': 'Simulation pipeline running. Awaiting results.',
  'title.tvl': 'DeFi TVL at {value}B',
  'desc.tvl': 'Total DeFi TVL stands at ${value} billion, according to DefiLlama data.',
  'title.btc_dom': 'BTC Dominance at {value}%',
  'desc.btc_dom': 'Bitcoin dominance is at {value}% of the cryptocurrency market.',
  'title.no_changes': 'No Updates',
  'desc.no_changes': 'No relevant changes since the last update.',
};

const es: EventDict = {
  'cat.market': 'Mercado',
  'cat.network': 'Red',
  'cat.wallet': 'Cartera',
  'cat.activity': 'Actividad',
  'cat.sentiment': 'Sentimiento',
  'cat.simulation': 'Simulación',
  'cat.general': 'General',
  'title.fear': 'Sentimiento en Miedo',
  'title.greed': 'Sentimiento en Codicia',
  'title.neutral_sentiment': 'Sentimiento Neutral',
  'desc.fear': 'El sentimiento del mercado permanece en Fear ({value}), indicando cautela entre los participantes.',
  'desc.greed': 'El sentimiento del mercado está en Greed ({value}), reflejando optimismo entre los inversores.',
  'desc.neutral_sentiment': 'El sentimiento del mercado está en {label} ({value}), señalando equilibrio entre optimismo y cautela.',
  'title.gainer': '{symbol} en Alza',
  'desc.gainer': '{symbol} muestra un movimiento positivo de +{change}% en el período observado.',
  'title.loser': '{symbol} en Caída',
  'desc.loser': '{symbol} registra una caída de {change}% según los datos de mercado.',
  'title.network_online': 'Red {network} en Línea',
  'desc.network_online': 'La red {network} permanece en línea y operativa en NV Protocol.',
  'title.network_offline': 'Red {network} No Disponible',
  'desc.network_offline': 'La red {network} no responde. Verifique su conexión.',
  'title.wallet_connected': 'Cartera Conectada',
  'desc.wallet_connected': 'Cartera conectada a {network}. Datos en tiempo real disponibles.',
  'title.wallet_disconnected': 'Modo Simulación',
  'desc.wallet_disconnected': 'Ninguna cartera conectada — operando con datos simulados.',
  'title.swap_activity': 'Actividad de Swap Registrada',
  'desc.swap_activity': 'Una nueva actividad de swap ha sido registrada recientemente.',
  'title.sim_running': 'Simulación en Curso',
  'desc.sim_running': 'Pipeline de simulación en ejecución. Esperando resultados.',
  'title.tvl': 'TVL DeFi en {value}B',
  'desc.tvl': 'El TVL total en DeFi está en ${value} mil millones, según datos de DefiLlama.',
  'title.btc_dom': 'Dominancia del BTC en {value}%',
  'desc.btc_dom': 'La dominancia de Bitcoin está en {value}% del mercado de criptomonedas.',
  'title.no_changes': 'Sin Novedades',
  'desc.no_changes': 'No hay cambios relevantes desde la última actualización.',
};

const fr: EventDict = {
  'cat.market': 'Marché',
  'cat.network': 'Réseau',
  'cat.wallet': 'Portefeuille',
  'cat.activity': 'Activité',
  'cat.sentiment': 'Sentiment',
  'cat.simulation': 'Simulation',
  'cat.general': 'Général',
  'title.fear': 'Sentiment en Peur',
  'title.greed': 'Sentiment en Cupidité',
  'title.neutral_sentiment': 'Sentiment Neutre',
  'desc.fear': 'Le sentiment du marché reste en Fear ({value}), indiquant la prudence des participants.',
  'desc.greed': 'Le sentiment du marché est en Greed ({value}), reflétant l\'optimisme des investisseurs.',
  'desc.neutral_sentiment': 'Le sentiment du marché est en {label} ({value}), signalant un équilibre entre optimisme et prudence.',
  'title.gainer': '{symbol} en Hausse',
  'desc.gainer': '{symbol} montre un mouvement positif de +{change}% sur la période observée.',
  'title.loser': '{symbol} en Baisse',
  'desc.loser': '{symbol} enregistre une baisse de {change}% selon les données du marché.',
  'title.network_online': 'Réseau {network} en Ligne',
  'desc.network_online': 'Le réseau {network} reste en ligne et opérationnel sur NV Protocol.',
  'title.network_offline': 'Réseau {network} Indisponible',
  'desc.network_offline': 'Le réseau {network} ne répond pas. Vérifiez votre connexion.',
  'title.wallet_connected': 'Portefeuille Connecté',
  'desc.wallet_connected': 'Portefeuille connecté à {network}. Données en temps réel disponibles.',
  'title.wallet_disconnected': 'Mode Simulation',
  'desc.wallet_disconnected': 'Aucun portefeuille connecté — fonctionnement avec données simulées.',
  'title.swap_activity': 'Activité de Swap Enregistrée',
  'desc.swap_activity': 'Une nouvelle activité de swap a été enregistrée récemment.',
  'title.sim_running': 'Simulation en Cours',
  'desc.sim_running': 'Pipeline de simulation en cours d\'exécution. En attente des résultats.',
  'title.tvl': 'TVL DeFi à {value}B',
  'desc.tvl': 'Le TVL total en DeFi s\'élève à ${value} milliards, selon les données DefiLlama.',
  'title.btc_dom': 'Dominance du BTC à {value}%',
  'desc.btc_dom': 'La dominance du Bitcoin est de {value}% du marché des cryptomonnaies.',
  'title.no_changes': 'Pas de Nouveautés',
  'desc.no_changes': 'Aucun changement pertinent depuis la dernière mise à jour.',
};

const DICTS: Record<Locale, EventDict> = { 'pt-BR': ptBR, en, es, fr };

function getDict(locale: Locale): EventDict {
  return DICTS[locale] ?? DICTS['pt-BR'];
}

function fmt(d: EventDict, key: string, vars?: Record<string, string | number>): string {
  let str = d[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return str;
}

const PRIORITY_ORDER: Record<EventPriority, number> = {
  recent_change: 0,
  recent_activity: 1,
  network_status: 2,
  market_movement: 3,
  sentiment: 4,
  general: 5,
};

export function generateEditorialEvents(ctx: DashboardContext, locale: Locale): EditorialEvent[] {
  const d = getDict(locale);
  const now = Date.now();
  const events: EditorialEvent[] = [];

  // 1. Recent activity: swap
  if (ctx.recentSwapActivity) {
    events.push({
      id: 'swap_activity',
      category: fmt(d, 'cat.activity'),
      title: fmt(d, 'title.swap_activity'),
      description: fmt(d, 'desc.swap_activity'),
      priority: 'recent_activity',
      color: 'cyan',
      timestamp: now,
    });
  }

  // 2. Simulation running
  if (ctx.simulationRunning) {
    events.push({
      id: 'sim_running',
      category: fmt(d, 'cat.simulation'),
      title: fmt(d, 'title.sim_running'),
      description: fmt(d, 'desc.sim_running'),
      priority: 'recent_activity',
      color: 'violet',
      timestamp: now,
    });
  }

  // 3. Network status
  if (ctx.networkOnline) {
    events.push({
      id: 'network_online',
      category: fmt(d, 'cat.network'),
      title: fmt(d, 'title.network_online', { network: ctx.activeNetworkName }),
      description: fmt(d, 'desc.network_online', { network: ctx.activeNetworkName }),
      priority: 'network_status',
      color: 'violet',
      timestamp: now,
    });
  } else {
    events.push({
      id: 'network_offline',
      category: fmt(d, 'cat.network'),
      title: fmt(d, 'title.network_offline', { network: ctx.activeNetworkName }),
      description: fmt(d, 'desc.network_offline', { network: ctx.activeNetworkName }),
      priority: 'network_status',
      color: 'red',
      timestamp: now,
    });
  }

  // 4. Wallet status
  if (ctx.isWalletConnected) {
    events.push({
      id: 'wallet_connected',
      category: fmt(d, 'cat.wallet'),
      title: fmt(d, 'title.wallet_connected'),
      description: fmt(d, 'desc.wallet_connected', { network: ctx.activeNetworkName }),
      priority: 'network_status',
      color: 'emerald',
      timestamp: now,
    });
  } else {
    events.push({
      id: 'wallet_disconnected',
      category: fmt(d, 'cat.wallet'),
      title: fmt(d, 'title.wallet_disconnected'),
      description: fmt(d, 'desc.wallet_disconnected'),
      priority: 'general',
      color: 'orange',
      timestamp: now,
    });
  }

  // 5. Market movement: top gainer / loser
  const topGainer = ctx.topMovers.find(m => m.change > 0);
  const topLoser = ctx.topMovers.find(m => m.change < 0);
  if (topGainer) {
    events.push({
      id: 'gainer_' + topGainer.symbol,
      category: fmt(d, 'cat.market'),
      title: fmt(d, 'title.gainer', { symbol: topGainer.symbol }),
      description: fmt(d, 'desc.gainer', { symbol: topGainer.symbol, change: topGainer.change.toFixed(2) }),
      priority: 'market_movement',
      color: 'emerald',
      timestamp: now,
    });
  }
  if (topLoser) {
    events.push({
      id: 'loser_' + topLoser.symbol,
      category: fmt(d, 'cat.market'),
      title: fmt(d, 'title.loser', { symbol: topLoser.symbol }),
      description: fmt(d, 'desc.loser', { symbol: topLoser.symbol, change: Math.abs(topLoser.change).toFixed(2) }),
      priority: 'market_movement',
      color: 'orange',
      timestamp: now,
    });
  }

  // 6. Sentiment
  if (ctx.fearGreedIndex < 30) {
    events.push({
      id: 'sentiment_fear',
      category: fmt(d, 'cat.sentiment'),
      title: fmt(d, 'title.fear'),
      description: fmt(d, 'desc.fear', { value: ctx.fearGreedIndex }),
      priority: 'sentiment',
      color: 'orange',
      timestamp: now,
    });
  } else if (ctx.fearGreedIndex > 70) {
    events.push({
      id: 'sentiment_greed',
      category: fmt(d, 'cat.sentiment'),
      title: fmt(d, 'title.greed'),
      description: fmt(d, 'desc.greed', { value: ctx.fearGreedIndex }),
      priority: 'sentiment',
      color: 'emerald',
      timestamp: now,
    });
  } else {
    events.push({
      id: 'sentiment_neutral',
      category: fmt(d, 'cat.sentiment'),
      title: fmt(d, 'title.neutral_sentiment'),
      description: fmt(d, 'desc.neutral_sentiment', { label: ctx.fearGreedLabel, value: ctx.fearGreedIndex }),
      priority: 'sentiment',
      color: 'neutral',
      timestamp: now,
    });
  }

  // 7. TVL
  if (ctx.totalTvl > 0) {
    events.push({
      id: 'tvl',
      category: fmt(d, 'cat.market'),
      title: fmt(d, 'title.tvl', { value: (ctx.totalTvl / 1e9).toFixed(2) }),
      description: fmt(d, 'desc.tvl', { value: (ctx.totalTvl / 1e9).toFixed(2) }),
      priority: 'general',
      color: 'cyan',
      timestamp: now,
    });
  }

  // 8. BTC dominance
  if (ctx.btcDominance > 0) {
    events.push({
      id: 'btc_dom',
      category: fmt(d, 'cat.market'),
      title: fmt(d, 'title.btc_dom', { value: ctx.btcDominance.toFixed(1) }),
      description: fmt(d, 'desc.btc_dom', { value: ctx.btcDominance.toFixed(1) }),
      priority: 'general',
      color: 'cyan',
      timestamp: now,
    });
  }

  // Fallback: no changes
  if (events.length === 0) {
    events.push({
      id: 'no_changes',
      category: fmt(d, 'cat.general'),
      title: fmt(d, 'title.no_changes'),
      description: fmt(d, 'desc.no_changes'),
      priority: 'general',
      color: 'neutral',
      timestamp: now,
    });
  }

  // Sort by priority
  events.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
  return events;
}

export function colorClasses(color: EventColor): { text: string; bg: string; border: string; dot: string } {
  const map: Record<EventColor, { text: string; bg: string; border: string; dot: string }> = {
    emerald: { text: 'text-emerald-400', bg: 'bg-emerald-500/8', border: 'border-emerald-500/20', dot: 'bg-emerald-400' },
    cyan: { text: 'text-cyan-400', bg: 'bg-cyan-500/8', border: 'border-cyan-500/20', dot: 'bg-cyan-400' },
    violet: { text: 'text-violet-400', bg: 'bg-violet-500/8', border: 'border-violet-500/20', dot: 'bg-violet-400' },
    orange: { text: 'text-orange-400', bg: 'bg-orange-500/8', border: 'border-orange-500/20', dot: 'bg-orange-400' },
    red: { text: 'text-red-400', bg: 'bg-red-500/8', border: 'border-red-500/20', dot: 'bg-red-400' },
    neutral: { text: 'text-muted-foreground/60', bg: 'bg-secondary/30', border: 'border-border/30', dot: 'bg-muted-foreground/30' },
  };
  return map[color];
}

// ─── Legacy compatibility ────────────────────────────────────────────────────
export type EventCategory = 'asset_events' | 'network_events';
export type EventImpact = 'low' | 'medium' | 'high' | 'critical';

export interface MarketEvent {
  id: string;
  title: string;
  summary: string;
  category: EventCategory;
  timestamp: number;
  source: string;
  url?: string;
  relevance: number;
  locale: Locale;
  impact: EventImpact;
  relatedAssets?: string[];
}

export interface NewsProvider {
  name: string;
  fetchEvents(locale: Locale): Promise<MarketEvent[]>;
}

export const newsProviders: NewsProvider[] = [];

export function generateContextualMessages(ctx: DashboardContext, locale: Locale): string[] {
  return generateEditorialEvents(ctx, locale).map(e => e.description);
}
