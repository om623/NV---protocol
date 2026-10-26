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
import type { NewsItem, AgentResponse, AgentAction } from './intelligence';
import type { NVAgentContext }                 from './agentContext';
import type { MarketAsset }                    from './marketData';
import type { TvlEntry }                       from './tvl';

// Re-export AgentResponse so callers only need to import from one place
export type { AgentResponse } from './intelligence';

// ─── Intent detection ─────────────────────────────────────────────────────────

type QueryIntent =
  | 'market_price'    // specific asset price query
  | 'market_top'      // top assets by market cap
  | 'market_movers'   // gainers / losers
  | 'market_status'   // compact situational awareness
  | 'capabilities'    // what NV Agent can currently inspect/do
  | 'mode_assisted'   // assisted transaction mode
  | 'mode_authorized' // policy-authorized transaction mode
  | 'greeting'
  | 'thanks'
  | 'news'
  | 'tvl_chain'       // TVL for a specific chain
  | 'tvl_top'         // top chains by TVL
  | 'wallet_evm'      // EVM wallet info
  | 'wallet_solana'   // Solana wallet info
  | 'payment_info'    // questions about the payment system
  | 'bridge_info'     // questions about the bridge system
  | 'action_transfer' // user wants to send/transfer USDC/tokens
  | 'action_bridge'   // user wants to execute a bridge
  | 'action_swap'     // user wants to execute a swap
  | 'action_payment'  // user wants to make a gamification purchase
  | 'unknown';        // precise clarification fallback

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

// Action-intent keywords — "I want to DO something now"
const ACTION_TRANSFER_KW = [
  'send usdc to', 'enviar usdc para', 'transfer usdc to', 'transferir usdc para',
  'send to address', 'send to 0x', 'enviar para 0x', 'quero enviar', 'i want to send',
  'make a transfer', 'fazer uma transferência', 'send tokens',
];

const ACTION_BRIDGE_KW = [
  'bridge usdc from', 'bridge from', 'executar bridge', 'fazer bridge', 'quero fazer bridge',
  'move usdc from', 'mover usdc de', 'i want to bridge', 'start bridge', 'iniciar bridge',
];

const ACTION_SWAP_KW = [
  'swap usdc', 'swap from', 'executar swap', 'fazer swap', 'quero fazer swap',
  'swap tokens', 'i want to swap', 'start a swap', 'iniciar swap',
  'swap usdc to', 'swap eth for', 'operação de swap', 'operacao de swap',
  'faça um swap', 'faca um swap', 'faça uma operação de swap', 'faca uma operacao de swap',
  'troque ', 'trocar ', 'converter ', 'converta ',
];

const ACTION_PAYMENT_KW = [
  'buy skin', 'comprar skin', 'buy xp', 'comprar xp', 'purchase item', 'comprar item',
  'unlock feature', 'desbloquear', 'buy with usdc', 'comprar com usdc',
  'make a purchase', 'fazer uma compra',
];

const MODE_ASSISTED_KW = [
  'assisted manual mode', 'manual assisted mode', 'assisted mode', 'modo manual assistido',
  'modo assistido', 'ativar modo manual', 'activate assisted', 'use assisted',
];

const MODE_AUTHORIZED_KW = [
  'authorized mode', 'authorised mode', 'modo autorizado', 'ativar modo autorizado',
  'activate authorized', 'activate authorised', 'authorization policy', 'politica de autorizacao',
  'política de autorização',
];

const GREETING_KW = [
  'olá', 'ola', 'oi', 'bom dia', 'boa tarde', 'boa noite', 'hello', 'hi', 'hey',
  'welcome', 'bem vindo', 'bem-vindo',
];

const THANKS_KW = [
  'obrigado', 'obrigada', 'thanks', 'thank you', 'valeu', 'agradeço', 'agradeco',
];

const NEWS_KW = [
  'news', 'notícias', 'noticias', 'novidades', 'latest news', 'breaking news',
  'what happened', 'o que aconteceu', 'acontecimentos', 'eventos recentes',
  'mercado hoje', 'market news', 'recent events',
];

const LEARNING_KW = [
  'aprender', 'learn', 'estudar', 'study', 'livro', 'book', 'explicar', 'explain',
  'por que', 'porque', 'why', 'como funciona', 'how does',
];

const CAPABILITIES_KW = [
  'what can you do', 'what do you know', 'your capabilities', 'help me',
  'o que você faz', 'o que voce faz', 'o que você sabe', 'o que voce sabe',
  'suas capacidades', 'suas funções', 'suas funcoes', 'como pode me ajudar',
];

const STATUS_KW = [
  'market status', 'market overview', 'market summary', 'what is happening',
  'resumo do mercado', 'visão do mercado', 'visao do mercado', 'como está o mercado',
  'como esta o mercado', 'panorama', 'situação do mercado', 'situacao do mercado',
];

const MOVERS_KW = [
  'gainers', 'losers', 'top gainers', 'top losers', 'best performers',
  'worst performers', 'maiores altas', 'maiores quedas', 'quem mais subiu',
  'quem mais caiu', 'melhores desempenhos', 'piores desempenhos',
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
  'o que é', 'que es', 'qu\'est',
];

// Well-known asset names/symbols — used to detect price intent even without
// an explicit price keyword (e.g. "bitcoin" alone → price).
// Also includes category terms so "top cryptocurrencies" → market_top.
const KNOWN_ASSETS = [
  // individual coins
  'bitcoin', 'btc', 'ethereum', 'eth', 'solana', 'sol', 'usdc', 'usdt',
  'bnb', 'xrp', 'ada', 'avax', 'matic', 'polygon', 'dot', 'link', 'atom',
  'near', 'apt', 'arb', 'op', 'sui', 'sei', 'tia', 'doge', 'shib',
  'wbtc', 'dai', 'gold', 'silver', 'oil', 'brent', 'wti', 'ibovespa',
  's&p', 'sp500', 'nasdaq', 'dow', 'nikkei', 'euro', 'eur', 'usd', 'brl',
  // category terms — so "top cryptos", "ranking cripto", "biggest altcoins" etc. → market_top
  'crypto', 'cripto', 'criptos', 'cryptocurrency', 'cryptocurrencies',
  'criptomoeda', 'criptomoedas', 'altcoin', 'altcoins', 'coin', 'coins',
  'token', 'tokens', 'stablecoin', 'stablecoins',
];

function detectIntent(q: string): QueryIntent {
  const lq = q.toLowerCase().replace(/[?!.,;:]/g, ' ');
  const words = lq.split(/\s+/);

  // Action intents — checked FIRST. A request that says "swap" but names two
  // different networks is cross-chain and must go through Bridge, never the
  // same-chain swap executor.
  if (ACTION_TRANSFER_KW.some(kw => lq.includes(kw))) return 'action_transfer';
  const requestedNetworks = parseAgentNetworks(lq);
  const asksSwap = ACTION_SWAP_KW.some(kw => lq.includes(kw));
  if (ACTION_BRIDGE_KW.some(kw => lq.includes(kw)) || (asksSwap && requestedNetworks.length >= 2)) return 'action_bridge';
  if (asksSwap) return 'action_swap';
  if (ACTION_PAYMENT_KW.some(kw => lq.includes(kw))) return 'action_payment';

  // Query intents — most specific first
  if (MODE_ASSISTED_KW.some(kw => lq.includes(kw))) return 'mode_assisted';
  if (MODE_AUTHORIZED_KW.some(kw => lq.includes(kw))) return 'mode_authorized';
  if (GREETING_KW.some(kw => lq.includes(kw))) return 'greeting';
  if (THANKS_KW.some(kw => lq.includes(kw))) return 'thanks';
  if (CAPABILITIES_KW.some(kw => lq.includes(kw))) return 'capabilities';
  if (STATUS_KW.some(kw => lq.includes(kw))) return 'market_status';
  if (MOVERS_KW.some(kw => lq.includes(kw))) return 'market_movers';
  if (NEWS_KW.some(kw => lq.includes(kw))) return 'news';
  if (WALLET_SOL_KW.some(kw => lq.includes(kw))) return 'wallet_solana';
  if (WALLET_EVM_KW.some(kw => lq.includes(kw))) return 'wallet_evm';
  if (BRIDGE_KW.some(kw => lq.includes(kw)))     return 'bridge_info';
  if (PAYMENT_KW.some(kw => lq.includes(kw)))    return 'payment_info';

  if (TVL_KW.some(kw => lq.includes(kw))) {
    return TOP_KW.some(kw => lq.includes(kw)) ? 'tvl_top' : 'tvl_chain';
  }

  // Price intent: either explicit price keyword OR a lone well-known asset name
  const hasPriceKw = PRICE_KW.some(kw => lq.includes(kw));
  // Match complete tokens only; substring checks can mistake words such as "solution" for SOL.
  const hasAssetName = KNOWN_ASSETS.some(a => words.includes(a));

  if (hasPriceKw || hasAssetName) {
    return TOP_KW.some(kw => lq.includes(kw)) ? 'market_top' : 'market_price';
  }

  return 'unknown';
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

  const tokens = q.split(/\\s+/).filter(Boolean);
  const match = assets.find(a => {
    const symbol = a.symbol.toLowerCase();
    const name = a.name.toLowerCase();
    // Symbols such as OP, ARB and SOL must match complete tokens. Substring
    // matching made Portuguese words like "operação" look like the OP asset.
    return tokens.includes(symbol) || (name.length >= 4 && q.includes(name));
  });

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

  // Use actual connected network from context; fall back to display default
  const networkLabel = evm?.network ?? 'Base Mainnet';

  const lines: string[] = [
    t('intel.agentPaymentInfo'),
    '',
    `Network: ${networkLabel}`,
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

function answerAssistedMode(): AgentResponse {
  return { answer: [
    'Assisted Manual Mode is available.',
    'Tell me the transaction you want to prepare. I will inspect the available context, validate the request and prepare the operation for your review.',
    'You remain the signer: nothing is executed until you explicitly approve it in your wallet.',
  ].join('\n\n'), sources: [] };
}

function answerAuthorizedMode(): AgentResponse {
  return { answer: [
    'Authorized Mode uses a limited, revocable policy defined by you.',
    'The policy can restrict network, token, recipients, per-operation amount, cumulative spend and validity.',
    'No authorization is assumed from this conversation. A real financial authorization requires explicit wallet confirmation.',
  ].join('\n\n'), sources: [] };
}

function answerGreeting(locale: string): AgentResponse {
  return {
    answer: locale === 'pt-BR'
      ? 'Bem-vindo. Como posso servi-lo? Estou à disposição para analisar o mercado, consultar dados do NV ou preparar uma operação quando você solicitar.'
      : 'Welcome. How may I serve you? I can help analyze the market, inspect NV data, or prepare an operation when you ask.',
    sources: [],
  };
}

function answerThanks(locale: string): AgentResponse {
  return {
    answer: locale === 'pt-BR'
      ? 'Será um prazer. Se quiser, posso continuar daqui — analisar alguma coisa, acompanhar uma situação ou preparar a próxima ação.'
      : 'My pleasure. If you like, we can continue from here — analyze something, follow a situation, or prepare the next action.',
    sources: [],
  };
}

function answerTransactionMode(mode: 'assisted' | 'authorized'): AgentResponse {
  if (mode === 'assisted') {
    return {
      answer: [
        'Assisted Manual Mode.',
        '',
        'Tell me the operation you want. I will interpret the request, validate the available transaction details and prepare the operation for review.',
        'You remain the signer: execution requires your wallet signature.',
        '',
        'Example: “Send 5 USDC to 0x…”',
      ].join('\n'),
      sources: [],
    };
  }
  return {
    answer: [
      'Authorized Mode.',
      '',
      'This mode is governed by a prior, limited and revocable authorization policy.',
      'Networks, tokens, recipients, per-operation limits, cumulative limits and validity must be explicitly defined and confirmed before autonomous execution.',
      '',
      'Selecting the mode alone does not grant financial authorization.',
    ].join('\n'),
    sources: [],
  };
}

function addSpontaneousGuidance(
  response: AgentResponse,
  question: string,
  intent: QueryIntent,
  ctx: NVAgentContext,
  locale: string,
): AgentResponse {
  const q = question.toLowerCase();
  const learning = LEARNING_KW.some(k => q.includes(k));
  const marketRelated = ['market_price', 'market_top', 'market_movers', 'market_status', 'news'].includes(intent);
  if (learning || !marketRelated || !ctx.market?.assets?.length) return response;

  // Deterministic variation keeps the Agent lively without pretending to have
  // independent thoughts or interrupting transactional flows.
  const seed = Array.from(question).reduce((n, ch) => n + ch.charCodeAt(0), 0) % 5;
  const pt = [
    'Se quiser, posso ir além dos números e separar sinais, riscos e hipóteses desse cenário.',
    'Posso também comparar isso com outro ativo, período ou rede para dar mais contexto.',
    'Quer uma referência para aprofundar? Posso sugerir um livro relacionado ao assunto e resumir por que ele pode ser útil.',
    'Se preferir, posso transformar esses dados em uma leitura curta: o que mudou, o que importa e o que ainda não sabemos.',
    'Há mais de uma forma de olhar para isso. Posso montar uma visão técnica, fundamental ou de risco usando os dados disponíveis no NV.',
  ];
  const en = [
    'If you want, I can go beyond the numbers and separate signals, risks and hypotheses in this scenario.',
    'I can also compare this with another asset, period or network to add context.',
    'Want a reference to go deeper? I can suggest a relevant book and summarize why it may be useful.',
    'If you prefer, I can turn these data into a short read: what changed, what matters, and what we still do not know.',
    'There is more than one way to read this. I can build a technical, fundamental, or risk view using the data available in NV.',
  ];
  const suggestion = (locale === 'pt-BR' ? pt : en)[seed];
  return { ...response, answer: response.answer + '\n\n' + suggestion };
}

function answerUnknown(locale: string): AgentResponse {
  return {
    answer: locale === 'pt-BR'
      ? 'Entendi. Quero responder com precisão em vez de presumir o que você quis dizer. Você pode me dizer se deseja analisar o mercado, consultar um ativo, verificar TVL ou carteira, acompanhar notícias ou preparar uma operação?'
      : 'I understand. I would rather be precise than assume what you mean. Tell me whether you want to analyze the market, inspect an asset, check TVL or a wallet, follow news, or prepare an operation.',
    sources: [],
  };
}

function answerCapabilities(ctx: NVAgentContext): AgentResponse {
  const liveAssets = ctx.market?.assets.filter(a => a.isLive).length ?? 0;
  const tvlLoaded = ctx.tvl?.entries.filter(e => e.status === 'loaded').length ?? 0;
  const evm = ctx.evmWallet?.connected ? 'connected' : 'not connected';
  const sol = ctx.solanaWallet?.walletState.status === 'connected' ? 'connected' : 'not connected';
  return {
    answer: [
      'I am the NV Agent — the intelligence layer inside NV Protocol.',
      '',
      'I can inspect the live context available to me and answer about:',
      `• Markets and prices (${liveAssets} live assets currently in context)`,
      '• 24h / 7d performance, market cap, volume and RSI when available',
      `• TVL across supported chains (${tvlLoaded} entries currently loaded)`,
      `• EVM wallet: ${evm}`,
      `• Solana wallet: ${sol}`,
      '• Bridge and payment status',
      '• Global news and events',
      '• Preparing navigation/actions for Swap, Bridge and payments',
      '',
      'I do not invent unavailable data and I do not sign transactions by myself.',
    ].join('\n'),
    sources: [],
  };
}

function answerMarketMovers(question: string, assets: MarketAsset[]): AgentResponse {
  const q = question.toLowerCase();
  const wantsLosers = q.includes('loser') || q.includes('queda') || q.includes('caiu') || q.includes('worst') || q.includes('piores');
  const live = assets.filter(a => a.isLive && Number.isFinite(a.change24h));
  const sorted = [...live].sort((a, b) => wantsLosers ? a.change24h - b.change24h : b.change24h - a.change24h).slice(0, 7);
  if (!sorted.length) return { answer: 'I do not have live market-mover data in the current context.', sources: [] };
  return {
    answer: [
      wantsLosers ? 'Largest 24h declines in my current live context:' : 'Largest 24h gains in my current live context:',
      '',
      ...sorted.map((a, i) => `${i + 1}. ${a.symbol} — ${fmtUsd(a.price, a.decimals)} · ${fmtChange(a.change24h)}`),
      '',
      'This is a snapshot of the data currently loaded by NV, not investment advice.',
    ].join('\n'),
    sources: [],
  };
}

function answerMarketStatus(ctx: NVAgentContext): AgentResponse {
  const live = (ctx.market?.assets ?? []).filter(a => a.isLive);
  const crypto = live.filter(a => a.category === 'crypto');
  const gainers = crypto.filter(a => a.change24h > 0).length;
  const losers = crypto.filter(a => a.change24h < 0).length;
  const strongest = [...crypto].sort((a,b) => b.change24h - a.change24h)[0];
  const weakest = [...crypto].sort((a,b) => a.change24h - b.change24h)[0];
  const tvl = (ctx.tvl?.entries ?? []).filter(e => e.status === 'loaded' && e.tvlUsd !== null);
  const topTvl = [...tvl].sort((a,b) => (b.tvlUsd ?? 0) - (a.tvlUsd ?? 0))[0];
  const lines = [
    'NV situational snapshot:',
    '',
    `• Live market feeds in context: ${live.length}`,
    `• Crypto breadth: ${gainers} up / ${losers} down over 24h`,
    strongest ? `• Strongest 24h: ${strongest.symbol} ${fmtChange(strongest.change24h)}` : '',
    weakest ? `• Weakest 24h: ${weakest.symbol} ${fmtChange(weakest.change24h)}` : '',
    topTvl ? `• Highest loaded chain TVL: ${topTvl.displayName} ${fmtTvl(topTvl.tvlUsd)}` : '',
    `• EVM wallet: ${ctx.evmWallet?.connected ? 'connected' : 'not connected'}`,
    `• Solana wallet: ${ctx.solanaWallet?.walletState.status === 'connected' ? 'connected' : 'not connected'}`,
    '',
    'Ask me to drill into any asset, TVL, wallet, bridge, payment or recent event.',
  ].filter(Boolean);
  return { answer: lines.join('\n'), sources: [] };
}

// ─── Action handlers ──────────────────────────────────────────────────────────
// These handlers return an AgentResponse with an `action` field that the UI
// renders as a NavigateCard. They NEVER initiate a transaction themselves.

function parseAmount(q: string): number | null {
  // Require a financial unit next to the number. This prevents chain IDs,
  // addresses, dates and arbitrary numbers from becoming transaction amounts.
  const m = q.match(/(?:^|\s)(\d+(?:[.,]\d+)?)\s*(usdc|eurc|usd|eth|sol|pol|matic|avax)\b/i);
  if (!m) return null;
  const n = parseFloat(m[1].replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseTransferToken(q: string): string | null {
  const m = q.match(/\b(USDC|EURC|ETH|SOL|POL|MATIC|AVAX)\b/i);
  return m ? m[1].toUpperCase() : null;
}

function parseAddress(q: string): string | null {
  // EVM address
  const evm = q.match(/0x[0-9a-fA-F]{40}/);
  if (evm) return evm[0];
  // Solana address (base58, 32-44 chars)
  const sol = q.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
  if (sol) return sol[0];
  return null;
}

function parseSwapPair(question: string): { sourceToken: string | null; destinationToken: string | null } {
  const symbols = ['USDC', 'EURC', 'ETH', 'SOL', 'POL', 'MATIC', 'AVAX'];
  const upper = question.toUpperCase();
  const found = symbols
    .flatMap(symbol => {
      const match = new RegExp('\\\\b' + symbol + '\\\\b', 'i').exec(upper);
      return match ? [{ symbol: symbol === 'MATIC' ? 'POL' : symbol, index: match.index }] : [];
    })
    .sort((a, b) => a.index - b.index)
    .filter((item, index, arr) => index === arr.findIndex(x => x.symbol === item.symbol));
  return { sourceToken: found[0]?.symbol ?? null, destinationToken: found[1]?.symbol ?? null };
}

function parseAgentNetworks(question: string): string[] {
  let q = question.toLowerCase();
  const aliases: Array<[string, string]> = [
    ['arbitrum sepolia', 'arbitrum-sepolia'], ['optimism sepolia', 'optimism-sepolia'],
    ['ethereum sepolia', 'sepolia'], ['base sepolia', 'base-sepolia'],
    ['arc testnet', 'arc-testnet'], ['arc mainnet', 'arc-mainnet'],
    ['arbitrum', 'arbitrum'], ['optimism', 'optimism'], ['ethereum', 'ethereum'],
    ['polygon', 'polygon'], ['avalanche', 'avalanche'], ['base', 'base'], ['arc', 'arc-mainnet'],
  ];
  const found: Array<{ id: string; index: number }> = [];
  for (const [name, id] of aliases) {
    const index = q.indexOf(name);
    if (index < 0) continue;
    found.push({ id, index });
    q = q.slice(0, index) + ' '.repeat(name.length) + q.slice(index + name.length);
  }
  return found.sort((a, b) => a.index - b.index).map(x => x.id);
}

function answerActionTransfer(
  question: string,
  ctx: NVAgentContext,
  t: (k: string) => string,
): AgentResponse {
  const evm = ctx.evmWallet;
  const amount = parseAmount(question);
  const recipient = parseAddress(question);
  const token = parseTransferToken(question) ?? 'USDC';

  const lines = [t('agent.action.transferTitle'), ''];

  if (!evm?.connected || !evm.address) {
    lines.push(t('intel.agentEvmNotConnected'));
    lines.push(''); lines.push(t('agent.action.connectFirst'));
  } else {
    lines.push(`From: ${evm.address}`);
    if (evm.network) lines.push(`Network: ${evm.network}`);
    if (evm.usdcBalance) lines.push(`Available: ${evm.usdcBalance} USDC`);
    if (amount !== null) lines.push(`Amount: ${amount} ${token}`);
    if (recipient) lines.push(`To: ${recipient}`);
    lines.push('');
    lines.push(t('agent.action.reviewInWallet'));
  }

  lines.push(''); lines.push(t('agent.action.noAutoExecute'));

  const action: AgentAction = {
    type: 'transfer',
      executeInChat: true,
    navigateTo: 'carteira',
    params: {
      amount: amount ?? null,
      recipient: recipient ?? null,
      token,
    },
  };

  return { answer: lines.join('\n'), sources: [], action };
}

function answerActionBridge(
  question: string,
  ctx: NVAgentContext,
  t: (k: string) => string,
): AgentResponse {
  const evm = ctx.evmWallet;
  const sol = ctx.solanaWallet;
  const amount = parseAmount(question);
  const networks = parseAgentNetworks(question);

  const lq = question.toLowerCase();
  const isSolanaSource =
    lq.includes('solana') || lq.includes('from sol') || lq.includes('de solana');

  const lines = [t('agent.action.bridgeTitle'), ''];

  // Supported routes
  lines.push('Supported routes:');
  lines.push('  • EVM ↔ EVM via CCTP V2 (Arc, Base, Ethereum, Arbitrum, Optimism, Polygon, Avalanche +18)');
  lines.push('  • Solana → EVM via CCTP V2 (Arc, Base, Ethereum, Arbitrum, Optimism, Polygon, Avalanche)');
  lines.push('');

  if (isSolanaSource) {
    if (sol?.walletState.status === 'connected') {
      const { address } = sol.walletState as { status: 'connected'; address: string };
      lines.push(`From: Solana (${address})`);
      if (sol.usdcBalanceState.status === 'loaded') {
        const usdc = (sol.usdcBalanceState as { status: 'loaded'; usdc: number }).usdc;
        lines.push(`Solana USDC: ${usdc.toFixed(2)}`);
      }
    } else {
      lines.push(t('intel.agentSolNotConnected'));
    }
  } else {
    if (evm?.connected && evm.address) {
      lines.push(`From: ${evm.network ?? 'EVM'} (${evm.address})`);
      if (evm.usdcBalance) lines.push(`Available: ${evm.usdcBalance} USDC`);
    } else {
      lines.push(t('intel.agentEvmNotConnected'));
    }
  }

  if (amount !== null) lines.push(`Amount: ${amount} USDC`);
  lines.push('');
  lines.push(t('agent.action.reviewInWallet'));
  lines.push(''); lines.push(t('agent.action.noAutoExecute'));

  const action: AgentAction = {
    type: 'bridge',
      executeInChat: true,
    navigateTo: 'bridge',
    params: { amount: amount ?? null, fromSolana: isSolanaSource ? 1 : 0, fromNetwork: networks[0] ?? null, toNetwork: networks[1] ?? null },
  };

  return { answer: lines.join('\n'), sources: [], action };
}

function answerActionSwap(
  question: string,
  ctx: NVAgentContext,
  t: (k: string) => string,
): AgentResponse {
  const evm = ctx.evmWallet;
  const amount = parseAmount(question);
  const pair = parseSwapPair(question);

  const lines = [t('agent.action.swapTitle'), ''];
  lines.push(t('agent.action.swapDescription'));
  lines.push('');

  if (evm?.connected && evm.address) {
    lines.push(`Wallet: ${evm.address}`);
    if (evm.network) lines.push(`Network: ${evm.network}`);
    if (evm.usdcBalance) lines.push(`Available: ${evm.usdcBalance} USDC`);
  } else {
    lines.push(t('intel.agentEvmNotConnected'));
  }

  if (amount !== null) lines.push(`Amount: ${amount} USDC`);
  lines.push('');
  lines.push(t('agent.action.reviewInWallet'));
  lines.push(''); lines.push(t('agent.action.noAutoExecute'));

  const action: AgentAction = {
    type: 'swap',
      executeInChat: true,
    navigateTo: 'swap',
    params: { amount: amount ?? null, sourceToken: pair.sourceToken, destinationToken: pair.destinationToken },
  };

  return { answer: lines.join('\n'), sources: [], action };
}

function answerActionPayment(
  question: string,
  ctx: NVAgentContext,
  t: (k: string) => string,
): AgentResponse {
  const evm = ctx.evmWallet;
  const q = question.toLowerCase();
  let product: string | null = null;
  if (q.includes('1000')) product = 'premium-1000';
  else if (q.includes('500')) product = 'premium-500';
  else if (q.includes('trimestral') || q.includes('quarterly') || q.includes('300 xp')) product = 'xp-quarterly';
  else if (q.includes('semanal') || q.includes('weekly') || q.includes('60 xp')) product = 'xp-weekly';
  else if (q.includes('diário') || q.includes('diario') || q.includes('daily') || q.includes('30 xp')) product = 'xp-daily';

  const lines = [t('agent.action.paymentTitle'), ''];
  lines.push(t('agent.action.paymentDescription'));
  lines.push('');
  lines.push('Network: Base Mainnet · Token: USDC');

  if (evm?.connected && evm.address) {
    lines.push(`Wallet: ${evm.address}`);
    if (evm.usdcBalance) lines.push(`Available: ${evm.usdcBalance} USDC`);
  } else {
    lines.push(t('intel.agentEvmNotConnected'));
    lines.push(t('agent.action.connectFirst'));
  }

  lines.push('');
  lines.push(t('agent.action.reviewInWallet'));
  lines.push(''); lines.push(t('agent.action.noAutoExecute'));

  const action: AgentAction = {
    type: 'payment',
      executeInChat: true,
    navigateTo: 'perfil',
    params: { product },
  };

  return { answer: lines.join('\n'), sources: [], action };
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
    case 'mode_assisted':
      return addSpontaneousGuidance(answerTransactionMode('assisted'), question, intent, ctx, locale);

    case 'mode_authorized':
      return addSpontaneousGuidance(answerTransactionMode('authorized'), question, intent, ctx, locale);

    case 'greeting':
      return answerGreeting(locale);

    case 'thanks':
      return answerThanks(locale);

    case 'capabilities':
      return answerCapabilities(ctx);

    case 'market_status':
      return addSpontaneousGuidance(answerMarketStatus(ctx), question, intent, ctx, locale);

    case 'market_movers':
      if (ctx.market?.assets.length) return addSpontaneousGuidance(answerMarketMovers(question, ctx.market.assets), question, intent, ctx, locale);
      break;

    case 'wallet_evm':
      return answerEvmWallet(ctx, t);

    case 'wallet_solana':
      return answerSolanaWallet(ctx, t);

    case 'payment_info':
      return answerPaymentInfo(ctx, t);

    case 'bridge_info':
      return answerBridgeInfo(ctx, t);

    case 'action_transfer':
      return answerActionTransfer(question, ctx, t);

    case 'action_bridge':
      return answerActionBridge(question, ctx, t);

    case 'action_swap':
      return answerActionSwap(question, ctx, t);

    case 'action_payment':
      return answerActionPayment(question, ctx, t);

    case 'tvl_top':
      if (ctx.tvl?.entries.length) return answerTvlTop(ctx.tvl.entries, t);
      break;

    case 'tvl_chain':
      if (ctx.tvl?.entries.length) return answerTvlChain(question, ctx.tvl.entries, t);
      break;

    case 'market_price':
      if (ctx.market?.assets.length) return addSpontaneousGuidance(answerMarketPrice(question, ctx.market.assets, t), question, intent, ctx, locale);
      break;

    case 'market_top':
      if (ctx.market?.assets.length) return addSpontaneousGuidance(answerMarketTop(question, ctx.market.assets, t), question, intent, ctx, locale);
      break;

    case 'news':
      break;
    case 'unknown':
    default:
      return answerUnknown(locale);
  }

  // News is an explicit intent, not a generic fallback.
  if (ctx.news?.items.length) {
    return addSpontaneousGuidance(answerFromNews(
      question,
      ctx.news.items,
      locale as Parameters<typeof answerFromNews>[2],
      t as (key: string, vars?: Record<string, string | number>) => string,
    ), question, intent, ctx, locale);
  }

  return { answer: t('intel.agentNoData'), sources: [] };
}

// ─── Re-export helpers ────────────────────────────────────────────────────────
export { formatRelativeTime };
