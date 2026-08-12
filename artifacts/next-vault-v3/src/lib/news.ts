// ─── News / Event Architecture ───────────────────────────────────────────────
// Abstract layer for future news provider integration.
// No fake data is generated — only existing dashboard data is used.

import type { Locale } from '../i18n/types';

export type EventCategory =
  | 'economy'
  | 'markets'
  | 'crypto'
  | 'indicators'
  | 'central_banks'
  | 'geopolitics'
  | 'conflicts'
  | 'peace'
  | 'sanctions'
  | 'alliances'
  | 'mergers'
  | 'partnerships'
  | 'announcements'
  | 'dividends'
  | 'earnings'
  | 'asset_events'
  | 'network_events';

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

// ─── Abstract News Provider interface ────────────────────────────────────────

export interface NewsProvider {
  name: string;
  fetchEvents(locale: Locale): Promise<MarketEvent[]>;
}

// ─── Contextual commentary from existing dashboard data ──────────────────────

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
}

const CONTEXT_TEMPLATES: Record<Locale, (ctx: DashboardContext) => string[]> = {
  'pt-BR': (ctx) => {
    const msgs: string[] = [];
    if (ctx.fearGreedIndex < 30) {
      msgs.push(`O sentimento do mercado está em ${ctx.fearGreedLabel} (${ctx.fearGreedIndex}). Os dados apontam cautela por parte dos investidores.`);
    } else if (ctx.fearGreedIndex > 70) {
      msgs.push(`O sentimento do mercado está em ${ctx.fearGreedLabel} (${ctx.fearGreedIndex}). Segundo os dados disponíveis, o otimismo está elevado.`);
    } else {
      msgs.push(`O sentimento do mercado está em ${ctx.fearGreedLabel} (${ctx.fearGreedIndex}), indicando um equilíbrio entre otimismo e cautela.`);
    }
    const topGainer = ctx.topMovers.find(m => m.change > 0);
    const topLoser = ctx.topMovers.find(m => m.change < 0);
    if (topGainer) {
      msgs.push(`${topGainer.symbol} apresenta movimento relevante de +${topGainer.change.toFixed(2)}% nas últimas 24 horas.`);
    }
    if (topLoser) {
      msgs.push(`${topLoser.symbol} mostra queda de ${topLoser.change.toFixed(2)}% segundo os dados de mercado.`);
    }
    if (ctx.totalTvl > 0) {
      msgs.push(`O TVL total em DeFi está em $${(ctx.totalTvl / 1e9).toFixed(2)} bilhões, segundo dados da DefiLlama.`);
    }
    if (ctx.btcDominance > 0) {
      msgs.push(`A dominância do Bitcoin está em ${ctx.btcDominance.toFixed(1)}% do mercado de criptomoedas.`);
    }
    msgs.push(`A rede ${ctx.activeNetworkName} está ativa e operacional no NV Protocol.`);
    return msgs;
  },
  en: (ctx) => {
    const msgs: string[] = [];
    if (ctx.fearGreedIndex < 30) {
      msgs.push(`Market sentiment is at ${ctx.fearGreedLabel} (${ctx.fearGreedIndex}). Data suggests investor caution.`);
    } else if (ctx.fearGreedIndex > 70) {
      msgs.push(`Market sentiment is at ${ctx.fearGreedLabel} (${ctx.fearGreedIndex}). According to available data, optimism is elevated.`);
    } else {
      msgs.push(`Market sentiment is at ${ctx.fearGreedLabel} (${ctx.fearGreedIndex}), indicating a balance between optimism and caution.`);
    }
    const topGainer = ctx.topMovers.find(m => m.change > 0);
    const topLoser = ctx.topMovers.find(m => m.change < 0);
    if (topGainer) {
      msgs.push(`${topGainer.symbol} shows a notable movement of +${topGainer.change.toFixed(2)}% in the last 24 hours.`);
    }
    if (topLoser) {
      msgs.push(`${topLoser.symbol} is down ${topLoser.change.toFixed(2)}% according to market data.`);
    }
    if (ctx.totalTvl > 0) {
      msgs.push(`Total DeFi TVL stands at $${(ctx.totalTvl / 1e9).toFixed(2)} billion, according to DefiLlama data.`);
    }
    if (ctx.btcDominance > 0) {
      msgs.push(`Bitcoin dominance is at ${ctx.btcDominance.toFixed(1)}% of the cryptocurrency market.`);
    }
    msgs.push(`The ${ctx.activeNetworkName} network is active and operational on NV Protocol.`);
    return msgs;
  },
  es: (ctx) => {
    const msgs: string[] = [];
    if (ctx.fearGreedIndex < 30) {
      msgs.push(`El sentimiento del mercado está en ${ctx.fearGreedLabel} (${ctx.fearGreedIndex}). Los datos sugieren cautela por parte de los inversores.`);
    } else if (ctx.fearGreedIndex > 70) {
      msgs.push(`El sentimiento del mercado está en ${ctx.fearGreedLabel} (${ctx.fearGreedIndex}). Según los datos disponibles, el optimismo es elevado.`);
    } else {
      msgs.push(`El sentimiento del mercado está en ${ctx.fearGreedLabel} (${ctx.fearGreedIndex}), indicando un equilibrio entre optimismo y cautela.`);
    }
    const topGainer = ctx.topMovers.find(m => m.change > 0);
    const topLoser = ctx.topMovers.find(m => m.change < 0);
    if (topGainer) {
      msgs.push(`${topGainer.symbol} muestra un movimiento relevante de +${topGainer.change.toFixed(2)}% en las últimas 24 horas.`);
    }
    if (topLoser) {
      msgs.push(`${topLoser.symbol} muestra una caída de ${topLoser.change.toFixed(2)}% según los datos de mercado.`);
    }
    if (ctx.totalTvl > 0) {
      msgs.push(`El TVL total en DeFi está en $${(ctx.totalTvl / 1e9).toFixed(2)} mil millones, según datos de DefiLlama.`);
    }
    if (ctx.btcDominance > 0) {
      msgs.push(`La dominancia de Bitcoin está en ${ctx.btcDominance.toFixed(1)}% del mercado de criptomonedas.`);
    }
    msgs.push(`La red ${ctx.activeNetworkName} está activa y operacional en NV Protocol.`);
    return msgs;
  },
  fr: (ctx) => {
    const msgs: string[] = [];
    if (ctx.fearGreedIndex < 30) {
      msgs.push(`Le sentiment du marché est à ${ctx.fearGreedLabel} (${ctx.fearGreedIndex}). Les données suggèrent la prudence des investisseurs.`);
    } else if (ctx.fearGreedIndex > 70) {
      msgs.push(`Le sentiment du marché est à ${ctx.fearGreedLabel} (${ctx.fearGreedIndex}). Selon les données disponibles, l'optimisme est élevé.`);
    } else {
      msgs.push(`Le sentiment du marché est à ${ctx.fearGreedLabel} (${ctx.fearGreedIndex}), indiquant un équilibre entre optimisme et prudence.`);
    }
    const topGainer = ctx.topMovers.find(m => m.change > 0);
    const topLoser = ctx.topMovers.find(m => m.change < 0);
    if (topGainer) {
      msgs.push(`${topGainer.symbol} montre un mouvement notable de +${topGainer.change.toFixed(2)}% dans les dernières 24 heures.`);
    }
    if (topLoser) {
      msgs.push(`${topLoser.symbol} est en baisse de ${topLoser.change.toFixed(2)}% selon les données du marché.`);
    }
    if (ctx.totalTvl > 0) {
      msgs.push(`Le TVL total en DeFi s'élève à $${(ctx.totalTvl / 1e9).toFixed(2)} milliards, selon les données DefiLlama.`);
    }
    if (ctx.btcDominance > 0) {
      msgs.push(`La dominance du Bitcoin est de ${ctx.btcDominance.toFixed(1)}% du marché des cryptomonnaies.`);
    }
    msgs.push(`Le réseau ${ctx.activeNetworkName} est actif et opérationnel sur NV Protocol.`);
    return msgs;
  },
};

export function generateContextualMessages(ctx: DashboardContext, locale: Locale): string[] {
  const fn = CONTEXT_TEMPLATES[locale] ?? CONTEXT_TEMPLATES['pt-BR'];
  return fn(ctx);
}

// Registry for future real news providers
export const newsProviders: NewsProvider[] = [];
