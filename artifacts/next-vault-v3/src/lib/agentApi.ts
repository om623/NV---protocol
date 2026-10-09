// ─── NV Agent — Pure Query API ────────────────────────────────────────────────
//
// agentQuery() is a pure, stateless function: given a question string and an
// NVAgentContext snapshot it returns a structured AgentResponse.
//
// Design constraints:
//   • No global state read or written.
//   • No network calls — context is assembled by the caller.
//   • No LLM, CRE, oracle, or external service calls.
//   • Answers ONLY from data present in the context — never invented.
//   • Backward-compatible: still accepts raw NewsItem[] for callers
//     that have not been migrated to NVAgentContext yet.

import { answerFromNews, formatRelativeTime } from './intelligence';
import type { NewsItem, AgentResponse }        from './intelligence';
import type { NVAgentContext }                 from './agentContext';
import type { MarketAsset }                    from './marketData';
import type { TvlEntry }                       from './tvl';

// Re-export AgentResponse so callers only need to import from one place
export type { AgentResponse } from './intelligence';

// ─── Intent detection ─────────────────────────────────────────────────────────

type QueryIntent =
  | 'market_price'   // specific asset price query
  | 'market_top'     // top assets by market cap
  | 'tvl_chain'      // TVL for a specific chain
  | 'tvl_top'        // top chains by TVL
  | 'wallet_evm'     // EVM wallet info
  | 'wallet_solana'  // Solana wallet info
  | 'payment_info'   // questions about sending/paying
  | 'bridge_info'    // questions about bridging
  | 'news'           // news/events query
  | 'unknown';       // fallback → news

// Keyword lists — order matters: more specific first in detectIntent()
const WALLET_SOL_KW = [
  'solana wallet', 'sol wallet', 'sol balance', 'phantom', 'solflare',
  'carteira solana', 'saldo sol', 'solana conectada', 'saldo solana',
  'my solana', 'solana address',
];

const WALLET_EVM_KW = [
  'evm wallet', 'ethereum wallet', 'my wallet', 'minha carteira',
  'balance evm', 'connected wallet', 'carteira conectada', 'arc wallet',
  'base wallet', 'my address', 'meu endereço', 'carteira conectada',
  'wallet address', 'evm balance', 'my eth', 'eth wallet',
];

const PAYMENT_KW = [
  'send', 'enviar', 'pay', 'pagar', 'payment', 'pagamento',
  'transfer', 'transferir', 'transferência', 'transferencia',
  'how to pay', 'como pagar', 'send usdc', 'enviar usdc',
  'send eth', 'how to send', 'como enviar', 'make a payment',
  'fazer pagamento', 'realizar pagamento', 'usdc payment',
  'base payment', 'purchase', 'compra',
];

const BRIDGE_KW = [
  'bridge', 'bridging', 'cross-chain', 'crosschain', 'cctp',
  'pontes', 'ponte', 'mover usdc', 'move usdc', 'transfer across',
  'transferir entre redes', 'from solana', 'solana to', 'to arc',
  'to base', 'to ethereum', 'to arbitrum', 'bridging usdc',
  'cross chain transfer', 'interoperability',
];

const TVL_KW = [
  'tvl', 'total value locked', 'defi tvl', 'chain tvl', 'valor bloqueado',
  'locked value', 'protocol tvl', 'rede tvl', 'blockchain tvl',
  'quanto está bloqueado', 'how much locked',
];

const TOP_KW = [
  'top', 'best', 'biggest', 'largest', 'highest', 'maior', 'maiores',
  'principais', 'ranking', 'rank', 'melhor', 'melhores', 'list', 'lista',
  'most', 'leading', 'líderes',
];

const PRICE_KW = [
  'price', 'preço', 'precio', 'prix', 'valor', 'vale', 'custo', 'cotação',
  'how much', 'quanto', 'cuánto', 'combien', '価格', '가격', '价格',
  'worth', 'cost', 'rate', 'trading at', 'market price', 'current price',
  'what is', 'what\'s', 'o que é', 'que es', 'qu\'est',
];

// Well-known asset names/symbols — used to detect price intent even without
// an explicit price keyword (e.g. "bitcoin" alone → price)
const KNOWN_ASSETS = [
  'bitcoin', 'btc', 'ethereum', 'eth', 'solana', 'sol', 'usdc', 'usdt',
  'bnb', 'xrp', 'ada', 'avax', 'matic', 'polygon', 'dot', 'link', 'atom',
  'near', 'apt', 'arb', 'op', 'sui', 'sei', 'tia', 'doge', 'shib',
  'wbtc', 'dai', 'gold', 'silver', 'oil', 'brent', 'wti', 'ibovespa',
  's&p', 'sp500', 'nasdaq', 'dow', 'nikkei', 'euro', 'eur', 'usd', 'brl',
];

function detectIntent(q: string): QueryIntent {
  const lq = q.toLowerCase().replace(/[?!.,;:]/g, ' ');
  const words = lq.split(/\s+/);

  // Most specific first
  if (WALLET_SOL_KW.some(kw => lq.includes(kw))) return 'wallet_solana';
  if (WALLET_EVM_KW.some(kw => lq.includes(kw))) return 'wallet_evm';
  if (BRIDGE_KW.some(kw => lq.includes(kw)))     return 'bridge_info';
  if (PAYMENT_KW.some(kw => lq.includes(kw)))    return 'payment_info';

  if (TVL_KW.some(kw => lq.includes(kw))) {
    return TOP_KW.some(kw => lq.includes(kw)) ? 'tvl_top' : 'tvl_chain';
  }

  // Price intent: either explicit price keyword OR a lone well-known asset name
  const hasPriceKw   = PRICE_KW.some(kw => lq.includes(kw));
  const hasAssetName = KNOWN_ASSETS.some(a => words.includes(a) || lq.includes(a));

  if (hasPriceKw || hasAssetName) {
    return TOP_KW.some(kw => lq.includes(kw)) ? 'market_top' : 'market_price';
  }

  return 'news';
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtUsd(p: number, dec: number): string {
  return p.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });
}

function fmtChange(c: number): string {
  const sign = c >= 0 ? '+' : '';
  return `${sign}${c.toFixed(2)}%`;
}

function fmtTvl(usd: number | null): string {
  if (usd === null || !Number.isFinite(usd)) return 'N/A';
  if (usd >= 1e9) return `$${(usd / 1e9).toFixed(2)}B`;
  if (usd >= 1e6) return `$${(usd / 1e6).toFixed(1)}M`;
  return `$${usd.toFixed(0)}`;
}

// ─── Answer builders ──────────────────────────────────────────────────────────

function answerMarketPrice(
  question: string,
  assets: MarketAsset[],
  t: (k: string) => string,
): AgentResponse {
  const q = question.toLowerCase().replace(/[?!.,;:]/g, ' ');

  const match = assets.find(a =>
    q.includes(a.symbol.toLowerCase()) ||
    q.includes(a.name.toLowerCase())
  );

  if (!match) {
    // No specific asset found — show top 8 by market cap across all categories
    const top = [...assets]
      .filter(a => a.isLive && a.marketCap > 0)
      .sort((a, b) => b.marketCap - a.marketCap)
      .slice(0, 8);

    if (!top.length) return { answer: t('intel.agentNoData'), sources: [] };

    const lines = top
      .map(a => `• ${a.symbol} (${a.name}): ${fmtUsd(a.price, a.decimals)}  ${fmtChange(a.change24h)} 24h`)
      .join('\n');

    return {
      answer: `${t('intel.agentTopMarkets')}\n\n${lines}`,
      sources: [],
    };
  }

  const liveness = match.isLive ? '(live)' : '(estimated)';
  const lines = [
    `${match.symbol} — ${match.name}`,
    `Price: ${fmtUsd(match.price, match.decimals)} ${liveness}`,
    `24h: ${fmtChange(match.change24h)}   7d: ${fmtChange(match.change7d)}`,
    match.marketCap > 0   ? `Market cap: ${fmtUsd(match.marketCap, 0)}`   : '',
    match.volume24h > 0   ? `Volume 24h: ${fmtUsd(match.volume24h, 0)}`   : '',
    match.rsi !== undefined && match.rsi > 0
      ? `RSI: ${match.rsi.toFixed(1)}`
      : '',
  ].filter(Boolean).join('\n');

  return { answer: lines, sources: [] };
}

function answerMarketTop(
  question: string,
  assets: MarketAsset[],
  t: (k: string) => string,
): AgentResponse {
  const q = question.toLowerCase();

  // Detect category filter in the question
  let filtered = [...assets].filter(a => a.isLive);
  if (q.includes('stable') || q.includes('stablecoin'))   filtered = filtered.filter(a => a.category === 'stablecoins');
  else if (q.includes('crypto') || q.includes('cripto'))  filtered = filtered.filter(a => a.category === 'crypto');
  else if (q.includes('commodity') || q.includes('commodities') || q.includes('commodidade'))
                                                           filtered = filtered.filter(a => a.category === 'commodities');
  else if (q.includes('index') || q.includes('indices') || q.includes('índice'))
                                                           filtered = filtered.filter(a => a.category === 'indices');
  else if (q.includes('fiat') || q.includes('currency'))  filtered = filtered.filter(a => a.category === 'fiat');
  else                                                     filtered = filtered.filter(a => a.category === 'crypto');

  const sorted = filtered
    .sort((a, b) => (b.marketCap || b.price) - (a.marketCap || a.price))
    .slice(0, 10);

  if (!sorted.length) return { answer: t('intel.agentNoData'), sources: [] };

  const lines = sorted
    .map((a, i) => `${i + 1}. ${a.symbol} — ${fmtUsd(a.price, a.decimals)}  ${fmtChange(a.change24h)} 24h`)
    .join('\n');

  return {
    answer: `${t('intel.agentTopCrypto')}\n\n${lines}`,
    sources: [],
  };
}

function answerTvlTop(
  entries: TvlEntry[],
  t: (k: string) => string,
): AgentResponse {
  const available = entries
    .filter(e => e.status === 'loaded' && e.tvlUsd !== null)
    .slice(0, 10);

  if (!available.length) return { answer: t('intel.agentNoData'), sources: [] };

  const lines = available
    .map((e, i) => `${i + 1}. ${e.displayName}: ${fmtTvl(e.tvlUsd)}`)
    .join('\n');

  return {
    answer: `${t('intel.agentTopTvl')}\n\n${lines}\n\nSource: DeFiLlama`,
    sources: [],
  };
}

function answerTvlChain(
  question: string,
  entries: TvlEntry[],
  t: (k: string) => string,
): AgentResponse {
  const q = question.toLowerCase();
  const match = entries.find(e =>
    q.includes(e.displayName.toLowerCase()) ||
    q.includes(e.id.toLowerCase())
  );

  if (!match) return answerTvlTop(entries, t);

  if (match.status === 'unavailable' || match.tvlUsd === null) {
    return { answer: `${match.displayName}: N/A (not available from DeFiLlama)`, sources: [] };
  }

  const answer = [
    `${match.displayName} TVL: ${fmtTvl(match.tvlUsd)}`,
    match.fetchedAt > 0
      ? `Last updated: ${new Date(match.fetchedAt).toLocaleTimeString()}`
      : '',
    'Source: DeFiLlama',
  ].filter(Boolean).join('\n');

  return { answer, sources: [] };
}

function answerEvmWallet(
  ctx: NVAgentContext,
  t: (k: string) => string,
): AgentResponse {
  const w = ctx.evmWallet;
  if (!w || !w.connected || !w.address) {
    return { answer: t('intel.agentEvmNotConnected'), sources: [] };
  }

  const lines = [
    `EVM wallet: ${w.address}`,
    w.network      ? `Network: ${w.network}`           : '',
    w.usdcBalance  ? `USDC balance: ${w.usdcBalance}`  : '',
  ].filter(Boolean);

  return { answer: lines.join('\n'), sources: [] };
}

function answerSolanaWallet(
  ctx: NVAgentContext,
  t: (k: string) => string,
): AgentResponse {
  const s = ctx.solanaWallet;
  if (!s || s.walletState.status !== 'connected') {
    return { answer: t('intel.agentSolNotConnected'), sources: [] };
  }

  const { address } = s.walletState as { status: 'connected'; address: string; walletName: string };

  const solBal =
    s.balanceState.status === 'loaded'
      ? `${(s.balanceState as { status: 'loaded'; sol: number }).sol.toFixed(4)} SOL`
      : s.balanceState.status === 'loading' ? 'loading…' : 'N/A';

  const usdcBal =
    s.usdcBalanceState.status === 'loaded'
      ? `${(s.usdcBalanceState as { status: 'loaded'; usdc: number }).usdc.toFixed(2)} USDC`
      : s.usdcBalanceState.status === 'noAccount' ? '0 USDC (no token account)'
      : s.usdcBalanceState.status === 'loading'   ? 'loading…'
      : 'N/A';

  return {
    answer: [`Solana wallet: ${address}`, `SOL balance: ${solBal}`, `USDC balance: ${usdcBal}`].join('\n'),
    sources: [],
  };
}

function answerPaymentInfo(
  ctx: NVAgentContext,
  t: (k: string) => string,
): AgentResponse {
  const evm = ctx.evmWallet;
  const evmConnected = evm?.connected && Boolean(evm.address);
  const payment = ctx.payment;

  const lines: string[] = [
    t('intel.agentPaymentInfo'),
    '',
    `Network: Base Mainnet (chain 8453)`,
    `Token: USDC`,
    '',
  ];

  if (evmConnected) {
    lines.push(`Your wallet: ${evm!.address}`);
    if (evm!.usdcBalance) lines.push(`USDC balance: ${evm!.usdcBalance}`);
  } else {
    lines.push(t('intel.agentEvmNotConnected'));
  }

  if (payment) {
    lines.push('');
    if (payment.status === 'sending_tx') lines.push('Status: sending transaction…');
    else if (payment.status === 'verifying') lines.push('Status: verifying on-chain…');
    else if (payment.status === 'confirmed') {
      lines.push('Status: confirmed ✓');
      if (payment.txHash) lines.push(`Tx: ${payment.txHash}`);
    } else if (payment.status === 'failed') {
      lines.push(`Status: failed — ${payment.error ?? 'unknown error'}`);
    }
  }

  lines.push('');
  lines.push(t('intel.agentPaymentNote'));

  return { answer: lines.filter(l => l !== undefined).join('\n'), sources: [] };
}

function answerBridgeInfo(
  ctx: NVAgentContext,
  t: (k: string) => string,
): AgentResponse {
  const evm = ctx.evmWallet;
  const sol = ctx.solanaWallet;
  const bridge = ctx.bridge;

  const lines: string[] = [
    t('intel.agentBridgeInfo'),
    '',
    'Supported routes:',
    '  • EVM ↔ EVM (CCTP V2): Arc, Base, Ethereum, Arbitrum, Optimism, Polygon, Avalanche +18 chains',
    '  • Solana → EVM (CCTP V2): Solana → Arc / Base / Ethereum / Arbitrum / Optimism / Polygon / Avalanche',
    '',
  ];

  if (evm?.connected && evm.address) {
    lines.push(`EVM wallet: ${evm.address}`);
    if (evm.network) lines.push(`Current network: ${evm.network}`);
    if (evm.usdcBalance) lines.push(`USDC balance: ${evm.usdcBalance}`);
  } else {
    lines.push(t('intel.agentEvmNotConnected'));
  }

  if (sol?.walletState.status === 'connected') {
    const { address } = sol.walletState as { status: 'connected'; address: string };
    lines.push(`Solana wallet: ${address}`);
    if (sol.usdcBalanceState.status === 'loaded') {
      const usdc = (sol.usdcBalanceState as { status: 'loaded'; usdc: number }).usdc;
      lines.push(`Solana USDC: ${usdc.toFixed(2)}`);
    }
  }

  if (bridge) {
    lines.push('');
    if (bridge.step && bridge.step !== 'idle') {
      lines.push(`Bridge status: ${bridge.step}`);
    }
    if (bridge.txHash) lines.push(`Solana tx: ${bridge.txHash}`);
    if (bridge.evmTxHash) lines.push(`EVM tx: ${bridge.evmTxHash}`);
    if (bridge.error) lines.push(`Error: ${bridge.error}`);
  }

  lines.push('');
  lines.push(t('intel.agentBridgeNote'));

  return { answer: lines.join('\n'), sources: [] };
}

// ─── Main export: pure agentQuery() ──────────────────────────────────────────

export interface AgentQueryOptions {
  locale?: string;
  t?: (key: string) => string;
}

export function agentQuery(
  question: string,
  context: NVAgentContext,
  options?: AgentQueryOptions,
): AgentResponse;

export function agentQuery(
  question: string,
  items: NewsItem[],
  locale?: string,
  t?: (key: string, vars?: Record<string, string | number>) => string,
): AgentResponse;

export function agentQuery(
  question: string,
  contextOrItems: NVAgentContext | NewsItem[],
  localeOrOptions?: string | AgentQueryOptions,
  legacyT?: (key: string, vars?: Record<string, string | number>) => string,
): AgentResponse {
  // ── Backward-compatible branch: raw NewsItem[] ────────────────────────────
  if (Array.isArray(contextOrItems)) {
    const locale = typeof localeOrOptions === 'string' ? localeOrOptions : 'en';
    return answerFromNews(
      question,
      contextOrItems,
      locale as Parameters<typeof answerFromNews>[2],
      legacyT,
    );
  }

  // ── Full NVAgentContext branch ─────────────────────────────────────────────
  const ctx    = contextOrItems;
  const opts   = (typeof localeOrOptions === 'object' ? localeOrOptions : {}) as AgentQueryOptions;
  const locale = opts.locale ?? ctx.locale ?? 'en';
  const t      = opts.t ?? ((k: string) => k);

  const intent = detectIntent(question);

  switch (intent) {
    case 'wallet_evm':
      return answerEvmWallet(ctx, t);

    case 'wallet_solana':
      return answerSolanaWallet(ctx, t);

    case 'payment_info':
      return answerPaymentInfo(ctx, t);

    case 'bridge_info':
      return answerBridgeInfo(ctx, t);

    case 'tvl_top':
      if (ctx.tvl?.entries.length) return answerTvlTop(ctx.tvl.entries, t);
      break;

    case 'tvl_chain':
      if (ctx.tvl?.entries.length) return answerTvlChain(question, ctx.tvl.entries, t);
      break;

    case 'market_price':
      if (ctx.market?.assets.length) return answerMarketPrice(question, ctx.market.assets, t);
      break;

    case 'market_top':
      if (ctx.market?.assets.length) return answerMarketTop(question, ctx.market.assets, t);
      break;

    case 'news':
    case 'unknown':
    default:
      break;
  }

  // Always fall back to the news corpus — never return empty if news is loaded
  if (ctx.news?.items.length) {
    return answerFromNews(
      question,
      ctx.news.items,
      locale as Parameters<typeof answerFromNews>[2],
      t as (key: string, vars?: Record<string, string | number>) => string,
    );
  }

  return { answer: t('intel.agentNoData'), sources: [] };
}

// ─── Re-export helpers ────────────────────────────────────────────────────────
export { formatRelativeTime };
