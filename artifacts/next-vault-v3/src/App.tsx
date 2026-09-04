import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { toast } from '@/hooks/use-toast';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Settings, ArrowDown, ChevronDown, Activity, Shield, Zap, Loader as Loader2, Check, ArrowRight, Wallet, LogOut, CircleCheck as CheckCircle2, TrendingUp, Flame, Terminal, ChartBar as BarChart2, Clock, Target, Cpu, RefreshCw, Download, TriangleAlert as AlertTriangle, Database, X, Factory as History, ChevronUp, Sparkles, TrendingDown, LayoutDashboard, FileText, Circle as HelpCircle, Menu, Pause, ChevronRight, Award } from 'lucide-react';
import {
  type Eip1193Provider,
  getProvider, getAccounts, getChainId, ensureNetwork, ensureBaseNetwork, networkChainParams,
  transferNative, transferErc20, getAllBalances, shortAddress,
  getTokensForNetwork, ARC_TOKENS,
} from './lib/arc';
import { type WalletInfo, getLegacyProvider } from './lib/walletDiscovery';
import { useGamification } from './hooks/useGamification';
import { usePurchases } from './hooks/usePurchases';
import { SKINS, XP_PACKAGES } from './lib/gamification';
import { WalletPickerModal } from './components/WalletPickerModal';
import { ProfileView } from './components/ProfileView';
import { SplashScreen } from './components/SplashScreen';
import { ComingSoonModal } from './components/ComingSoonModal';
import { PoolsView } from './components/PoolsView';
import { WalletView } from './components/WalletView';
import { SimAdvancedMetrics } from './components/SimAdvancedMetrics';
import { ExecutiveDashboard } from './components/ExecutiveDashboard';
import { MarketGrid } from './components/MarketGrid';
import { PortfolioCharts } from './components/PortfolioCharts';
import { IntelligenceColumn } from './components/IntelligenceColumn';
import { motion, AnimatePresence } from 'framer-motion';
import { twMerge } from 'tailwind-merge';
import {
  type EnvMode, type NetworkConfig,
  TESTNET_NETWORKS, MAINNET_NETWORKS,
  DEFAULT_TESTNET, DEFAULT_MAINNET,
  SIMULATED_WALLET_CHAIN_ID,
  ARC_TESTNET_CHAIN_PARAMS,
  getNetworkTokens,
} from './networks';
import { getAsset, refreshFromApis, getMarketSentiment, getAllAssets } from './lib/marketData';
import { isValidNum } from './lib/utils';
import { useI18n, useFormat } from './i18n';
import { DigitalPresenter } from './components/DigitalPresenter';
import { LanguageSelector } from './components/LanguageSelector';
import type { DashboardContext } from './lib/news';

const queryClient = new QueryClient();

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SimHistoryItem {
  id: string;
  datetime: string;
  roi: number;
  risk: number;
  duration: number;
  strategy: string;
  pools: number;
  opportunities: number;
  fromToken: string;
  toToken: string;
}

interface RoiPoint { t: number; roi: number; }

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_TOKENS = [
  { symbol: 'USDC', name: 'USD Coin' },
  { symbol: 'EURC', name: 'Euro Coin' },
  { symbol: 'ETH',  name: 'Ethereum' },
];

const MOCK_BALANCES: Record<string, number> = { USDC: 5420.18, EURC: 3200.50, ETH: 12.48 };

// Live exchange rates are derived from real CoinGecko prices via getAsset().
// Falls back to reasonable defaults if the API hasn't loaded yet.
const FALLBACK_PRICES: Record<string, number> = { USDC: 1, EURC: 1.087, ETH: 3215.84 };
function livePrice(symbol: string): number {
  const a = getAsset(symbol);
  return a ? a.price : (FALLBACK_PRICES[symbol] ?? 1);
}

const INITIAL_TRANSACTIONS = [
  { id: '1', fromToken: 'USDC', toToken: 'EURC', fromAmount: 500, toAmount: 460.0, time: '2 min ago', status: 'Success' },
  { id: '2', fromToken: 'EURC', toToken: 'USDC', fromAmount: 200, toAmount: 217.4, time: '1 hr ago', status: 'Success' },
  { id: '3', fromToken: 'USDC', toToken: 'ETH', fromAmount: 1000, toAmount: 0.3112, time: '3 hrs ago', status: 'Success' }
];

// Network lists live in ./networks.ts — imported above.

const PIPELINE_STEPS = [
  { labelKey: 'sim.step.connecting',          Icon: Wallet },
  { labelKey: 'sim.step.validating',          Icon: Shield },
  { labelKey: 'sim.step.readingBalance',      Icon: Database },
  { labelKey: 'sim.step.scanningPools',       Icon: Activity },
  { labelKey: 'sim.step.analyzingOpps',       Icon: TrendingUp },
  { labelKey: 'sim.step.calculatingRisk',     Icon: AlertTriangle },
  { labelKey: 'sim.step.selectingStrategy',   Icon: Target },
  { labelKey: 'sim.step.simulating',          Icon: Cpu },
  { labelKey: 'sim.step.confirming',          Icon: Check },
  { labelKey: 'sim.step.finished',            Icon: CheckCircle2 },
];

const CONSOLE_SCRIPT: { type: 'info' | 'success' | 'warn'; text: string; delay: number }[] = [
  { type: 'info',    text: 'Wallet connected',         delay: 350  },
  { type: 'info',    text: 'Reading balances...',      delay: 1400 },
  { type: 'warn',    text: 'High volatility detected', delay: 2400 },
  { type: 'info',    text: '23 pools analyzed',        delay: 3500 },
  { type: 'info',    text: '7 opportunities found',    delay: 5000 },
  { type: 'info',    text: 'Best ROI selected',        delay: 6700 },
  { type: 'info',    text: 'Running final checks...',  delay: 7900 },
  { type: 'success', text: 'Simulation completed',     delay: 8900 },
];

const BADGES = [
  { label: 'Secure Wallet',       color: 'text-cyan-400',    border: 'border-cyan-400/30',    bg: 'bg-cyan-400/8'    },
  { label: 'AI Strategy',         color: 'text-violet-400',  border: 'border-violet-400/30',  bg: 'bg-violet-400/8'  },
  { label: 'Smart Routing',       color: 'text-blue-400',    border: 'border-blue-400/30',    bg: 'bg-blue-400/8'    },
  { label: 'Simulation Complete', color: 'text-emerald-400', border: 'border-emerald-400/30', bg: 'bg-emerald-400/8' },
];

const SIM_TOTAL_MS = 9700;
const ROI_START_MS = 6700;
const ROI_DURATION_MS = 1400;
const ROI_TARGET = 8.47;

// ─── Sidebar config ───────────────────────────────────────────────────────────

type SidebarView = 'dashboard' | 'simulacao' | 'historico' | 'relatorios' | 'pools' | 'carteira' | 'perfil' | 'configuracoes' | 'ajuda' | 'bridge';

const SIDEBAR_ITEMS: { key: string; Icon: typeof LayoutDashboard; view: SidebarView; comingSoon?: boolean }[] = [
  { key: 'nav.dashboard',     Icon: LayoutDashboard, view: 'dashboard'     },
  { key: 'nav.simulation',    Icon: Activity,        view: 'simulacao'      },
  { key: 'nav.history',       Icon: History,         view: 'historico',     comingSoon: true },
  { key: 'nav.reports',       Icon: FileText,        view: 'relatorios',    comingSoon: true },
  { key: 'nav.pools',         Icon: Database,        view: 'pools'          },
  { key: 'nav.bridge',        Icon: ArrowRight,      view: 'bridge'         },
  { key: 'nav.wallet',        Icon: Wallet,          view: 'carteira'       },
  { key: 'nav.profile',      Icon: Award,           view: 'perfil'         },
  { key: 'nav.settings',     Icon: Settings,        view: 'configuracoes', comingSoon: true },
  { key: 'nav.help',          Icon: HelpCircle,      view: 'ajuda',         comingSoon: true },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getRate = (from: string, to: string) => {
  if (from === to) return 1.0;
  const fromPrice = livePrice(from);
  const toPrice = livePrice(to);
  if (toPrice === 0) return 0;
  return fromPrice / toPrice;
};
const getUsdRate = (token: string) => livePrice(token);
const formatRate = (rate: number) => rate < 0.01 ? rate.toFixed(6) : rate < 1 ? rate.toFixed(4) : rate.toFixed(2);

function getNextSimId(): string {
  try {
    const count = parseInt(localStorage.getItem('vault-sim-count') || '0') + 1;
    localStorage.setItem('vault-sim-count', String(count));
    const d = new Date();
    const ds = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
    return `SIM-${ds}-${String(count).padStart(4, '0')}`;
  } catch { return `SIM-${Date.now()}`; }
}

function formatDateTime(d: Date): string {
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function generateReportHtml(data: {
  simId: string; datetime: string; wallet: string;
  fromToken: string; toToken: string; fromAmount: number; toAmount: number;
  totalTime: number; roi: number; risk: number;
  strategy: string; pools: number; opportunities: number;
}): string {
  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8">
<title>Relatório — ${data.simId}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Courier New',monospace;background:#070c18;color:#c8d8e8;padding:0}
.page{max-width:680px;margin:0 auto;padding:52px 44px}
.brand{display:flex;align-items:center;gap:12px;margin-bottom:36px}
.brand-icon{width:36px;height:36px;background:rgba(0,229,188,.15);border:1px solid rgba(0,229,188,.3);border-radius:10px;display:flex;align-items:center;justify-content:center}
.brand-name{font-size:14px;font-weight:700;letter-spacing:4px;color:#e2e8f0}
.brand-sub{font-size:9px;color:#00e5bc;letter-spacing:3px;text-transform:uppercase;margin-top:3px}
.divider{height:1px;background:linear-gradient(to right,rgba(0,229,188,.4),transparent);margin:24px 0}
.title{font-size:22px;font-weight:700;color:#f8fafc;margin-bottom:6px}
.sim-id{font-size:11px;color:#00e5bc;letter-spacing:1px;margin-bottom:4px}
.dt{font-size:11px;color:#64748b}
.section-title{font-size:9px;text-transform:uppercase;letter-spacing:2px;color:#475569;margin:28px 0 12px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.field{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:14px 16px}
.field-label{font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:#475569;margin-bottom:6px}
.field-value{font-size:14px;color:#e2e8f0}
.field-value.accent{color:#00e5bc}
.field-value.green{color:#34d399}
.field-value.yellow{color:#fbbf24}
.badges{display:flex;flex-wrap:wrap;gap:8px;margin-top:24px}
.badge{display:inline-flex;align-items:center;gap:5px;background:rgba(0,229,188,.08);border:1px solid rgba(0,229,188,.2);border-radius:999px;padding:5px 12px;font-size:10px;color:#00e5bc}
.footer{margin-top:48px;padding-top:20px;border-top:1px solid rgba(255,255,255,.06);font-size:10px;color:#1e293b;display:flex;justify-content:space-between}
@media print{body{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}}
</style></head><body><div class="page">
<div class="brand">
  <div class="brand-icon"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#00e5bc" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>
  <div><div class="brand-name">NV PROTOCOL</div><div class="brand-sub">Protocol V3 · Simulation Report</div></div>
</div>
<div class="divider"></div>
<div class="title">Relatório de Simulação</div>
<div class="sim-id">${data.simId}</div>
<div class="dt">Executado em: ${data.datetime}</div>

<div class="section-title">Identificação</div>
<div class="grid">
  <div class="field"><div class="field-label">ID da Simulação</div><div class="field-value accent">${data.simId}</div></div>
  <div class="field"><div class="field-label">Carteira Conectada</div><div class="field-value">${data.wallet}</div></div>
</div>

<div class="section-title">Operação</div>
<div class="grid">
  <div class="field"><div class="field-label">Token Origem</div><div class="field-value">${data.fromToken} &nbsp;(${data.fromAmount.toFixed(4)})</div></div>
  <div class="field"><div class="field-label">Token Destino</div><div class="field-value">${data.toToken} &nbsp;(${data.toAmount.toFixed(4)})</div></div>
</div>

<div class="section-title">Métricas</div>
<div class="grid">
  <div class="field"><div class="field-label">Tempo de Execução</div><div class="field-value">${data.totalTime.toFixed(2)}s</div></div>
  <div class="field"><div class="field-label">ROI Estimado</div><div class="field-value green">+${data.roi.toFixed(2)}%</div></div>
  <div class="field"><div class="field-label">Risco</div><div class="field-value yellow">${data.risk.toFixed(1)}% (Moderado)</div></div>
  <div class="field"><div class="field-label">Estratégia</div><div class="field-value">${data.strategy}</div></div>
  <div class="field"><div class="field-label">Pools Analisados</div><div class="field-value">${data.pools}</div></div>
  <div class="field"><div class="field-label">Oportunidades</div><div class="field-value">${data.opportunities}</div></div>
</div>

<div class="section-title">Verificações de Segurança</div>
<div class="badges">
  <span class="badge">✓ Secure Wallet</span>
  <span class="badge">✓ AI Strategy</span>
  <span class="badge">✓ Smart Routing</span>
  <span class="badge">✓ Simulation Complete</span>
</div>
<div class="footer">
  <span>NV Protocol V3</span>
  <span>Gerado em ${data.datetime}</span>
</div>
</div>
<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),800))</script>
</body></html>`;
}

// ─── RoiChart ─────────────────────────────────────────────────────────────────

function RoiChart({ points, isComplete = false }: { points: RoiPoint[]; isComplete?: boolean }) {
  const { t } = useI18n();
  const W = 400; const H = 90;
  const PAD = { t: 10, b: 12, l: 6, r: 40 };
  const cW = W - PAD.l - PAD.r;
  const cH = H - PAD.t - PAD.b;
  const maxRoi = ROI_TARGET;

  const toX = (t: number) => PAD.l + (Math.min(t, SIM_TOTAL_MS) / SIM_TOTAL_MS) * cW;
  const toY = (roi: number) => PAD.t + cH - (Math.max(0, roi) / maxRoi) * cH;

  if (points.length < 2) {
    return (
      <div className="w-full flex items-center justify-center" style={{ height: H }}>
        <span className="text-[10px] font-mono text-muted-foreground/30 animate-pulse">{t('sim.waitingRoi')}</span>
      </div>
    );
  }

  const linePts = points.map(p => `${toX(p.t).toFixed(1)},${toY(p.roi).toFixed(1)}`).join(' ');
  const last = points[points.length - 1];
  const lx = toX(last.t);
  const ly = toY(last.roi);
  const areaBase = (PAD.t + cH).toFixed(1);
  const areaPts = `${toX(points[0].t).toFixed(1)},${areaBase} ${linePts} ${lx.toFixed(1)},${areaBase}`;
  const yTicks = [0.25, 0.5, 0.75, 1.0];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="roiFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(0,229,188)" stopOpacity="0.22" />
          <stop offset="85%" stopColor="rgb(0,229,188)" stopOpacity="0.02" />
        </linearGradient>
        <filter id="neon" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {yTicks.map(r => {
        const y = toY(maxRoi * r);
        return (
          <g key={r}>
            <line x1={PAD.l} y1={y} x2={W - PAD.r + 4} y2={y}
              stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="3 5" />
            <text x={W - PAD.r + 7} y={y + 4} fill="rgba(255,255,255,0.2)"
              fontSize="7" fontFamily="monospace">{(maxRoi * r).toFixed(1)}%</text>
          </g>
        );
      })}

      <line x1={PAD.l} y1={PAD.t + cH} x2={W - PAD.r} y2={PAD.t + cH}
        stroke="rgba(255,255,255,0.07)" strokeWidth="1" />

      <polygon points={areaPts} fill="url(#roiFill)" />

      <polyline points={linePts} fill="none"
        stroke="rgb(0,229,188)" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round"
        filter="url(#neon)" />

      <circle cx={lx} cy={ly} r={isComplete ? 3.5 : 3} fill="rgb(0,229,188)"
        style={{ filter: 'drop-shadow(0 0 5px rgb(0,229,188))' }}>
        {!isComplete && (
          <animate attributeName="r" values="2.5;4;2.5" dur="1.5s" repeatCount="indefinite" />
        )}
      </circle>

      {last.roi > 0.05 && (
        <text x={Math.min(lx + 5, W - PAD.r - 2)} y={Math.max(ly - 5, PAD.t + 8)}
          fill="rgb(0,229,188)" fontSize="9" fontFamily="monospace" fontWeight="bold">
          +{last.roi.toFixed(2)}%
        </text>
      )}
    </svg>
  );
}

// ─── Token Icons ──────────────────────────────────────────────────────────────

const EthIcon = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none">
    <circle cx="16" cy="16" r="16" fill="#627EEA"/>
    <path d="M15.86 5L15.65 5.7V20.1L15.86 20.32L23 16.1L15.86 5Z" fill="white" fillOpacity="0.9"/>
    <path d="M15.86 5L8.72 16.1L15.86 20.32V5Z" fill="white" fillOpacity="0.5"/>
    <path d="M15.86 21.61L15.74 21.75V26.47L15.86 26.82L23.01 17.4L15.86 21.61Z" fill="white" fillOpacity="0.8"/>
    <path d="M15.86 26.82V21.61L8.72 17.4L15.86 26.82Z" fill="white" fillOpacity="0.5"/>
    <path d="M15.86 20.32L23 16.1L15.86 12.87V20.32Z" fill="white" fillOpacity="0.4"/>
    <path d="M8.72 16.1L15.86 20.32V12.87L8.72 16.1Z" fill="white" fillOpacity="0.8"/>
  </svg>
);
const UsdcIcon = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none">
    <circle cx="16" cy="16" r="16" fill="#2775CA"/>
    <path d="M21.2 11.5c-1.3-1.4-3.1-2.1-5.2-2.1-3.9 0-7 2.9-7 7.1 0 4.2 3 7.1 7 7.1 2.2 0 4-.8 5.3-2.2l-2.4-2.5c-.8.9-1.8 1.4-2.9 1.4-2.1 0-3.6-1.5-3.6-3.8 0-2.3 1.5-3.8 3.6-3.8 1.1 0 2.1.5 2.9 1.4l2.5-2.6z" fill="white"/>
  </svg>
);
const DaiIcon = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none">
    <circle cx="16" cy="16" r="16" fill="#F5AC37"/>
    <path d="M11 9h5c3.5 0 6 2 6 5.5S19.5 20 16 20h-5V9zm3 3v5h2c1.7 0 3-1 3-2.5S17.7 12 16 12h-2z" fill="white"/>
    <path d="M10 11h11v2H10zM10 16h11v2H10z" fill="white"/>
  </svg>
);

const EurcIcon = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none">
    <circle cx="16" cy="16" r="16" fill="#003399"/>
    <text x="16" y="21" textAnchor="middle" fontSize="13" fontWeight="bold" fill="#FFCC00" fontFamily="sans-serif">EUR</text>
  </svg>
);

function TokenCryptoIcon({ symbol, className = "" }: { symbol: string; className?: string }) {
  const cls = twMerge("w-6 h-6 rounded-full shadow-sm ring-2 ring-card z-10 shrink-0", className);
  if (symbol === 'ETH')  return <EthIcon className={cls} />;
  if (symbol === 'USDC') return <UsdcIcon className={cls} />;
  if (symbol === 'EURC') return <EurcIcon className={cls} />;
  if (symbol === 'DAI')  return <DaiIcon className={cls} />;
  return <div className={`flex items-center justify-center text-[10px] font-bold text-white bg-gray-500 ${cls}`}>{symbol[0]}</div>;
}

// ─── TokenSelect ──────────────────────────────────────────────────────────────

function TokenSelect({ value, onChange, tokens = DEFAULT_TOKENS }: { value: string; onChange: (v: string) => void; tokens?: { symbol: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-2 bg-secondary hover:bg-secondary/80 text-foreground px-3 py-2 rounded-xl transition-colors font-medium border border-border/50 shadow-sm cursor-pointer">
        <TokenCryptoIcon symbol={value} className="w-5 h-5 ring-0 shadow-none" />
        <span translate="no">{value}</span>
        <ChevronDown size={16} className={`text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -5, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.95 }} transition={{ duration: 0.15 }}
            className="absolute top-full right-0 mt-2 w-48 bg-card border border-border rounded-xl p-2 shadow-2xl z-50">
            {tokens.map(t => (
              <button key={t.symbol} onClick={() => { onChange(t.symbol); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors cursor-pointer ${t.symbol === value ? 'bg-primary/10 text-primary' : 'hover:bg-secondary text-foreground'}`}>
                <TokenCryptoIcon symbol={t.symbol} className="w-5 h-5 ring-0 shadow-none" />
                <div className="text-left flex flex-col">
                  <span className="font-medium text-sm" translate="no">{t.symbol}</span>
                  <span className="text-xs opacity-50">{t.name}</span>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── EnvNetworkSelector ───────────────────────────────────────────────────────

interface EnvNetworkSelectorProps {
  envMode: EnvMode;
  activeNetwork: NetworkConfig;
  onEnvChange: (mode: EnvMode) => void;
  onNetworkChange: (network: NetworkConfig) => void;
}

function EnvNetworkSelector({ envMode, activeNetwork, onEnvChange, onNetworkChange }: EnvNetworkSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const networks = envMode === 'testnet' ? TESTNET_NETWORKS : MAINNET_NETWORKS;
  const envEmoji = envMode === 'testnet' ? '🧪' : '🌐';
  const envLabel = envMode === 'testnet' ? 'Testnet' : 'Mainnet';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 bg-secondary/50 border border-border px-2.5 py-1.5 rounded-full text-xs font-mono backdrop-blur-md cursor-pointer hover:bg-secondary transition-colors"
      >
        <span className="text-sm leading-none">{envEmoji}</span>
        <span className={envMode === 'testnet' ? 'text-amber-400 font-semibold hidden sm:inline' : 'text-foreground hidden sm:inline'}>
          {envLabel}
        </span>
        <span className="text-muted-foreground/40 select-none hidden sm:inline">•</span>
        <div className={`w-5 h-5 rounded-md ${activeNetwork.color} flex items-center justify-center text-[9px] font-bold text-white shrink-0`}>{activeNetwork.icon}</div>
        <span className="hidden sm:inline">{activeNetwork.shortName}</span>
        <ChevronDown size={13} className={`text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full right-0 mt-2 w-80 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden"
          >
            <div className="flex gap-1 p-2 border-b border-border/50">
              {(['testnet', 'mainnet'] as EnvMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => onEnvChange(mode)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
                    envMode === mode
                      ? 'bg-primary/10 text-primary border border-primary/20'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  }`}
                >
                  <span>{mode === 'testnet' ? '🧪' : '🌐'}</span>
                  <span className="capitalize">{mode}</span>
                </button>
              ))}
            </div>
            <div className="p-1.5 flex flex-col gap-1 max-h-[340px] overflow-y-auto">
              {networks.map(n => {
                const isActive = n.id === activeNetwork.id;
                const statusColor = n.status === 'online' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                  : n.status === 'unstable' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                  : 'text-red-400 bg-red-500/10 border-red-500/20';
                const statusDot = n.status === 'online' ? 'bg-emerald-400' : n.status === 'unstable' ? 'bg-amber-400' : 'bg-red-400';
                return (
                  <button
                    key={n.id}
                    onClick={() => { onNetworkChange(n); setOpen(false); }}
                    className={`w-full flex items-start gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-left cursor-pointer ${
                      isActive ? 'bg-primary/10 ring-1 ring-primary/20' : 'hover:bg-secondary'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg ${n.color} flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5`}>{n.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`text-xs font-mono font-medium truncate ${isActive ? 'text-primary' : 'text-foreground'}`} translate="no">{n.name}</span>
                        {envMode === 'testnet' && (
                          <span className="text-[7px] font-mono bg-violet-500/10 text-violet-400 px-1 py-px rounded border border-violet-500/20 shrink-0" translate="no">TESTNET</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[9px] font-mono text-muted-foreground/50 mb-0.5">
                        <span translate="no">Chain {n.chainId}</span>
                        <span className="opacity-30">|</span>
                        <span className="truncate">{n.rpcUrl.replace(/^https?:\/\//, '')}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[9px] font-mono text-muted-foreground/40 truncate">{n.explorerUrl.replace(/^https?:\/\//, '')}</span>
                        <span className={`text-[8px] font-mono px-1.5 py-px rounded-full border shrink-0 flex items-center gap-1 ${statusColor}`}>
                          <span className={`w-1 h-1 rounded-full ${statusDot}`} />
                          {n.status}
                        </span>
                      </div>
                    </div>
                    {isActive && <Check size={14} className="text-primary shrink-0 mt-1" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── NetworkBadge ─────────────────────────────────────────────────────────────

function NetworkBadge({ envMode, activeNetwork, className = '' }: {
  envMode: EnvMode;
  activeNetwork: NetworkConfig;
  className?: string;
}) {
  const { t } = useI18n();
  const isTestnet = envMode === 'testnet';
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`${envMode}-${activeNetwork.id}`}
        initial={{ opacity: 0, scale: 0.9, y: -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 4 }}
        transition={{ duration: 0.2 }}
        className={twMerge(
          'inline-flex items-center gap-2 px-4 py-1.5 rounded-full border font-mono text-sm font-semibold tracking-wide',
          isTestnet
            ? 'bg-green-500/8 border-green-500/25 text-green-400 shadow-[0_0_18px_rgba(34,197,94,0.08)]'
            : 'bg-amber-500/8 border-amber-500/25 text-amber-400 shadow-[0_0_18px_rgba(245,158,11,0.08)]',
          className,
        )}
      >
        <span className="text-base leading-none">{isTestnet ? '🧪' : '🌐'}</span>
        <span className="tracking-widest text-xs" translate="no">{isTestnet ? t('net.testnet') : t('net.mainnet')}</span>
        <span className="opacity-40 select-none">•</span>
        <div className={`w-2 h-2 rounded-full ${activeNetwork.color} animate-pulse shrink-0`} />
        <span className="text-xs" translate="no">{activeNetwork.shortName}</span>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── MarketPanel (removed — replaced by MarketGrid component) ─────────────────

// ─── SidebarContent ───────────────────────────────────────────────────────────

function SidebarContent({ onClose, activeView, onNavigate }: { onClose?: () => void; activeView: SidebarView; onNavigate: (view: SidebarView) => void }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col h-full">
      {/* Brand header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-border/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center relative animate-shield-glow shrink-0">
            <div className="absolute inset-0 rounded-lg bg-primary/15 blur-md opacity-40" />
            <Shield size={15} className="text-primary relative z-10" />
          </div>
          <div>
            <div className="text-[13px] font-bold tracking-[0.18em] text-foreground leading-none">NV PROTOCOL</div>
            <div className="text-[9px] text-primary font-mono tracking-widest mt-0.5 opacity-60">Protocol V3</div>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer lg:hidden">
            <X size={15} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 flex flex-col gap-0.5 overflow-y-auto">
        <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/40 px-3 py-2 mt-1">{t('nav.menu')}</div>
        {SIDEBAR_ITEMS.map(({ key, Icon, view, comingSoon }) => {
          const active = activeView === view;
          return (
            <button key={key}
              onClick={() => { onNavigate(view); onClose?.(); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer group relative ${
                active
                  ? 'bg-primary/8 text-primary border border-primary/12 shadow-[0_0_12px_rgba(0,229,188,0.06)]'
                  : 'text-muted-foreground hover:bg-secondary/80 hover:text-foreground'
              }`}>
              {active && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r-full" />
              )}
              <Icon size={15} className={`shrink-0 transition-colors ${active ? 'text-primary' : 'text-muted-foreground/60 group-hover:text-foreground'}`} />
              <span className="flex-1 text-left">{t(key)}</span>
              {comingSoon && (
                <span className="text-[8px] font-mono bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded-full border border-amber-500/20 shrink-0">{t('nav.comingSoon')}</span>
              )}
              {active && <ChevronRight size={12} className="text-primary/40" />}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border/40">
        <div className="text-[9px] font-mono text-muted-foreground/30 text-center leading-relaxed">
          {t('net.auditBy')}<br />{t('net.block')}
        </div>
      </div>
    </div>
  );
}

// ─── RightPanel (removed — replaced by IntelligenceColumn component) ──────────

// ─── Home ─────────────────────────────────────────────────────────────────────

function Home() {
  // ── i18n ────────────────────────────────────────────────────────────────────
  const { t, locale, localeBcp47 } = useI18n();
  const fmt = useFormat();

  // ── Existing state ──────────────────────────────────────────────────────────
  const [sourceToken, setSourceToken] = useState('USDC');
  const [destToken,   setDestToken]   = useState('EURC');
  const [amount,      setAmount]      = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [showDisconnect, setShowDisconnect] = useState(false);
  const [showWalletPicker, setShowWalletPicker] = useState(false);
  const [activeWalletName, setActiveWalletName] = useState<string | null>(null);

  // Real wallet state
  const [provider, setProvider] = useState<Eip1193Provider | null>(null);
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [realBalances, setRealBalances] = useState<Record<string, number> | null>(null);

  // View + coming-soon state
  const [activeView, setActiveView] = useState<SidebarView>('dashboard');
  const [comingSoonFeature, setComingSoonFeature] = useState<string | null>(null);

  // ── Environment / network state ─────────────────────────────────────────────
  const [envMode,       setEnvMode]       = useState<EnvMode>('testnet');
  const [activeNetwork, setActiveNetwork] = useState<NetworkConfig>(DEFAULT_TESTNET);
  const [walletChainId, setWalletChainId] = useState<number | null>(null);

  // ── Gamification ───────────────────────────────────────────────────────────
  const gamification = useGamification();
  const purchases = usePurchases({
    walletAddress: connectedAddress,
    onSkinUnlocked: (skinId) => gamification.grantSkin(skinId),
    onXpGranted: (xpAmount, txHash) => gamification.grantXp(xpAmount, txHash),
  });
  const [transactions,   setTransactions]   = useState(INITIAL_TRANSACTIONS);
  const [swapModalOpen,  setSwapModalOpen]  = useState(false);
  const [swapStep,       setSwapStep]       = useState(0);
  const [pendingSwap,    setPendingSwap]    = useState<any>(null);

  // ── Simulation state ────────────────────────────────────────────────────────
  const [simId,        setSimId]        = useState('');
  const [simDateTime,  setSimDateTime]  = useState('');
  const [simStep,      setSimStep]      = useState(-1);
  const [simProgress,  setSimProgress]  = useState(0);
  const [consoleLogs,  setConsoleLogs]  = useState<{ type: 'info'|'success'|'warn'; text: string }[]>([]);
  const [simPhase,     setSimPhase]     = useState<'pipeline'|'complete'>('pipeline');
  const [simStats,     setSimStats]     = useState({ balance: 0, roi: 0, risk: 0, execTime: 0, poolsAnalyzed: 0, opportunities: 0 });
  const [simTotalTime, setSimTotalTime] = useState(0);
  const [roiPoints,    setRoiPoints]    = useState<RoiPoint[]>([]);
  const [reportExported, setReportExported] = useState(false);
  const [simHistory,   setSimHistory]   = useState<SimHistoryItem[]>(() => {
    try { return JSON.parse(localStorage.getItem('vault-sim-history') || '[]'); } catch { return []; }
  });
  const [historyOpen,  setHistoryOpen]  = useState(false);

  // ── UI state (new) ──────────────────────────────────────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [simPaused,   setSimPaused]   = useState(false);

  const consoleEndRef = useRef<HTMLDivElement>(null);
  const simTimers = useRef<{ intervals: number[]; timeouts: number[] }>({ intervals: [], timeouts: [] });
  const swapStepTimers = useRef<number[]>([]);
  const miscTimers = useRef<number[]>([]);

  useEffect(() => { document.title = 'NV Protocol'; }, []);
  useEffect(() => { consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [consoleLogs]);

  // Centralised unmount cleanup — clears every timer that escapes clearSim.
  useEffect(() => {
    return () => {
      simTimers.current.intervals.forEach(t => window.clearInterval(t));
      simTimers.current.timeouts.forEach(t => window.clearTimeout(t));
      swapStepTimers.current.forEach(t => window.clearTimeout(t));
      miscTimers.current.forEach(t => window.clearTimeout(t));
    };
  }, []);

  // ── Simulation engine (unchanged) ───────────────────────────────────────────

  const clearSim = useCallback(() => {
    simTimers.current.timeouts.forEach(t => window.clearTimeout(t));
    simTimers.current.intervals.forEach(t => window.clearInterval(t));
    swapStepTimers.current.forEach(t => window.clearTimeout(t));
    simTimers.current = { intervals: [], timeouts: [] };
    swapStepTimers.current = [];
  }, []);

  const startSim = useCallback((id: string, dt: string) => {
    const sto = (fn: () => void, ms: number) => {
      const t = window.setTimeout(fn, ms);
      simTimers.current.timeouts.push(t);
    };
    const sin = (fn: () => void, ms: number): number => {
      const t = window.setInterval(fn, ms);
      simTimers.current.intervals.push(t);
      return t;
    };
    const animateTo = (setter: (v: number) => void, target: number, duration: number, round = false) => {
      const s = Date.now();
      const iv = sin(() => {
        const t = Math.min(1, (Date.now() - s) / duration);
        const e = 1 - Math.pow(1 - t, 3);
        setter(round ? Math.round(target * e) : target * e);
        if (t >= 1) { window.clearInterval(iv); simTimers.current.intervals = simTimers.current.intervals.filter(x => x !== iv); }
      }, 30);
    };

    const startTime = Date.now();
    PIPELINE_STEPS.forEach((_, i) => sto(() => setSimStep(i), i * 950));
    CONSOLE_SCRIPT.forEach(({ type, text, delay }) =>
      sto(() => setConsoleLogs(prev => [...prev, { type, text }]), delay));

    const progIv = sin(() => {
      setSimProgress(Math.min(100, ((Date.now() - startTime) / SIM_TOTAL_MS) * 100));
    }, 50);
    const execIv = sin(() => {
      setSimStats(prev => ({ ...prev, execTime: (Date.now() - startTime) / 1000 }));
    }, 100);

    for (let ms = 0; ms <= SIM_TOTAL_MS; ms += 200) {
      const scheduledMs = ms;
      sto(() => {
        const roiT = scheduledMs < ROI_START_MS ? 0 : Math.min(1, (scheduledMs - ROI_START_MS) / ROI_DURATION_MS);
        const roiVal = ROI_TARGET * (1 - Math.pow(1 - roiT, 3));
        setRoiPoints(prev => [...prev, { t: scheduledMs, roi: roiVal }]);
      }, ms);
    }

    sto(() => animateTo(v => setSimStats(p => ({ ...p, balance: v })), 46382.17, 2200), 1400);
    sto(() => animateTo(v => setSimStats(p => ({ ...p, poolsAnalyzed: v })), 23, 1400, true), 3500);
    sto(() => animateTo(v => setSimStats(p => ({ ...p, opportunities: v })), 7, 800, true), 5000);
    sto(() => animateTo(v => setSimStats(p => ({ ...p, risk: v })), 12.3, 900), 5800);
    sto(() => animateTo(v => setSimStats(p => ({ ...p, roi: v })), ROI_TARGET, 1400), ROI_START_MS);

    sto(() => {
      const total = parseFloat(((Date.now() - startTime) / 1000).toFixed(2));
      window.clearInterval(progIv);
      window.clearInterval(execIv);
      simTimers.current.intervals = simTimers.current.intervals.filter(x => x !== progIv && x !== execIv);
      setSimTotalTime(total);
      setSimPhase('complete');
      setSimProgress(100);
      const item: SimHistoryItem = {
        id, datetime: dt, roi: ROI_TARGET, risk: 12.3, duration: total,
        strategy: 'Arbitrum Optimal Route v2', pools: 23, opportunities: 7,
        fromToken: '', toToken: '',
      };
      setSimHistory(prev => {
        const updated = [item, ...prev].slice(0, 10);
        try { localStorage.setItem('vault-sim-history', JSON.stringify(updated)); } catch {}
        return updated;
      });
    }, SIM_TOTAL_MS);
  }, []);

  useEffect(() => {
    if (swapModalOpen) {
      const id = getNextSimId();
      const dt = formatDateTime(new Date());
      setSimId(id); setSimDateTime(dt);
      setSimStep(-1); setSimProgress(0); setConsoleLogs([]);
      setSimPhase('pipeline'); setRoiPoints([]);
      setSimStats({ balance: 0, roi: 0, risk: 0, execTime: 0, poolsAnalyzed: 0, opportunities: 0 });
      setSimTotalTime(0); setReportExported(false);
      startSim(id, dt);
    } else { clearSim(); }
    return clearSim;
  }, [swapModalOpen]);

  // ── Existing handlers (unchanged) ───────────────────────────────────────────

  const handleEnvChange = (mode: EnvMode) => {
    setEnvMode(mode);
    setActiveNetwork(mode === 'testnet' ? DEFAULT_TESTNET : DEFAULT_MAINNET);
  };
  const handleNetworkChange = (network: NetworkConfig) => {
    setActiveNetwork(network);
    const netTokens = getNetworkTokens(network).map(t => ({ symbol: t.symbol, name: t.name }));
    if (netTokens.length > 0) {
      const first = netTokens[0];
      const second = netTokens[1] ?? netTokens[0];
      setSourceToken(first.symbol);
      setDestToken(second.symbol);
      setAmount('');
      setRealBalances(null);
    }
  };
  const handleSwitchNetwork = async () => {
    if (!provider) { setWalletChainId(activeNetwork.chainId); return; }
    try {
      if (activeNetwork.type === 'testnet') {
        await ensureNetwork(provider, networkChainParams(activeNetwork));
      } else {
        await ensureBaseNetwork(provider);
      }
      const chainId = await getChainId(provider);
      setWalletChainId(chainId);
    } catch {
      // user refused or network unavailable — update local state only
      setWalletChainId(activeNetwork.chainId);
    }
  };
  const networkMismatch = isConnected && walletChainId !== null && walletChainId !== activeNetwork.chainId;

  // True when a wallet is connected and the active network is a testnet
  // (real swaps are supported on every registered testnet, not only Arc).
  const isRealSwap = isConnected && activeNetwork.type === 'testnet';

  const refreshBalances = useCallback(async (prov: Eip1193Provider, addr: string) => {
    try {
      const tokenMap = getTokensForNetwork(activeNetwork);
      const bal = await getAllBalances(prov, addr, tokenMap);
      setRealBalances(bal);
    } catch {
      // non-fatal
    }
  }, []);

  const connectWithWallet = async (wallet: WalletInfo) => {
    const prov = wallet.provider;
    try {
      const accounts = await getAccounts(prov);
      const addr = accounts?.[0];
      if (!addr) { toast({ title: t('wallet.accountNotAuth'), variant: 'destructive' }); return; }
      if (activeNetwork.type === 'testnet') {
        await ensureNetwork(prov, networkChainParams(activeNetwork));
      } else {
        await ensureBaseNetwork(prov);
      }
      const chainId = await getChainId(prov);
      setProvider(prov);
      setConnectedAddress(addr);
      setIsConnected(true);
      setWalletChainId(chainId);
      setActiveWalletName(wallet.name);
      setShowWalletPicker(false);
      await refreshBalances(prov, addr);
      toast({ title: t('wallet.connected'), description: `${wallet.name} · ${shortAddress(addr)}` });
    } catch (err) {
      const code = (err as { code?: number })?.code;
      if (code === 4001) toast({ title: t('wallet.connectionRefused'), variant: 'destructive' });
      else toast({ title: t('wallet.connectError'), description: (err as Error)?.message, variant: 'destructive' });
      setShowWalletPicker(false);
    }
  };

  const handleConnect = () => {
    // Legacy fallback: if only one wallet is likely available, connect directly.
    // Otherwise open the picker modal.
    setShowWalletPicker(true);
  };

  const handleDisconnect = () => {
    setIsConnected(false);
    setProvider(null);
    setConnectedAddress(null);
    setRealBalances(null);
    setWalletChainId(null);
    setShowDisconnect(false);
    setActiveWalletName(null);
    toast({ title: t('wallet.disconnected') });
  };

  // ── Real swap via injected EIP-1193 provider (Arc Testnet) ───────────────────

const handleRealSwap = async () => {
  const n = parseFloat(amount);
  if (!n || n <= 0) return;

  const prov = provider ?? getLegacyProvider();

  if (!prov) {
    toast({
      title: t('wallet.notFound'),
      description: t('wallet.installMetamask'),
      variant: 'destructive',
    });
    return;
  }

  try {
    const accounts = await getAccounts(prov);
    const from = accounts?.[0];

    if (!from) {
      toast({
        title: t('wallet.accountNotAuth'),
        variant: 'destructive',
      });
      return;
    }

    // ─────────────────────────────────────────────
    // BASE MAINNET
    // ─────────────────────────────────────────────

    await ensureBaseNetwork(prov);
    setWalletChainId(8453);

    // ─────────────────────────────────────────────
    // TOKEN CONFIGURATION
    // ─────────────────────────────────────────────

    const tokenMap = getTokensForNetwork(DEFAULT_MAINNET);

    const fromTokenCfg = tokenMap[sourceToken];
    const toTokenCfg = tokenMap[destToken];

    if (!fromTokenCfg || !toTokenCfg) {
      throw new Error(
        `Token não suportado na Base: ${sourceToken} → ${destToken}`,
      );
    }

    if (fromTokenCfg.isNative) {
      throw new Error(
        'A primeira versão do swap real utiliza tokens ERC-20.',
      );
    }

    if (!fromTokenCfg.address || !toTokenCfg.address) {
      throw new Error(
        'Endereço do token não configurado na Base.',
      );
    }

    // ─────────────────────────────────────────────
    // AMOUNT → BASE UNITS
    // ─────────────────────────────────────────────

    const amountBase = BigInt(
      Math.round(
        n * Math.pow(10, fromTokenCfg.decimals),
      ),
    ).toString();

    const supabaseUrl =
      import.meta.env.VITE_SUPABASE_URL as
        | string
        | undefined;

    if (!supabaseUrl) {
      throw new Error(
        'VITE_SUPABASE_URL não configurada.',
      );
    }

    const functionUrl =
      `${supabaseUrl}/functions/v1/swap-transaction`;

    // ─────────────────────────────────────────────
    // FUNCTION CALL
    // ─────────────────────────────────────────────

    const requestSwap = async () => {
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: from,
          tokenIn: fromTokenCfg.address,
          tokenOut: toTokenCfg.address,
          amount: amountBase,
          tokenInChainId: 8453,
          tokenOutChainId: 8453,
          slippageTolerance: 0.5,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result?.success) {
        throw new Error(
          result?.error ||
            'Falha ao processar o swap.',
        );
      }

      return result;
    };

    // ═════════════════════════════════════════════
    // 1. CHECK APPROVAL
    // ═════════════════════════════════════════════

    let result = await requestSwap();

    if (
      result.stage === 'APPROVAL_REQUIRED' &&
      result.approvalRequired
    ) {
      const approval = result.approval;

      if (!approval?.to || !approval?.data) {
        throw new Error(
          'Uniswap não retornou uma transação de aprovação válida.',
        );
      }

      toast({
        title: 'Aprovação necessária',
        description:
          `Autorize ${sourceToken} para realizar o swap.`,
      });

      // ───────────────────────────────────────────
      // META MASK — APPROVE USDC
      // ───────────────────────────────────────────

      const approvalTxHash =
        await prov.request({
          method: 'eth_sendTransaction',
          params: [
            {
              from,
              to: approval.to,
              data: approval.data,
              value:
                approval.value ?? '0x00',
              chainId:
                '0x' +
                Number(8453).toString(16),
            },
          ],
        });

      if (!approvalTxHash) {
        throw new Error(
          'A carteira não retornou o hash da aprovação.',
        );
      }

      toast({
        title: 'Aprovação enviada',
        description:
          'Aguardando confirmação na Base...',
      });

      // ───────────────────────────────────────────
      // WAIT FOR APPROVAL RECEIPT
      // ───────────────────────────────────────────

      let approvalReceipt: any = null;

      for (let i = 0; i < 60; i++) {
        approvalReceipt =
          await prov.request({
            method: 'eth_getTransactionReceipt',
            params: [approvalTxHash],
          });

        if (approvalReceipt) break;

        await new Promise(resolve =>
          setTimeout(resolve, 2000),
        );
      }

      if (!approvalReceipt) {
        throw new Error(
          'Tempo limite aguardando a confirmação da aprovação.',
        );
      }

      if (
        approvalReceipt.status !== '0x1'
      ) {
        throw new Error(
          'A transação de aprovação foi revertida.',
        );
      }

      toast({
        title: 'USDC aprovado',
        description:
          'Aprovação confirmada. Obtendo a cotação final...',
      });

      // ───────────────────────────────────────────
      // 2. REQUEST AGAIN
      // ───────────────────────────────────────────

      result = await requestSwap();
    }

    // ═════════════════════════════════════════════
    // 3. SWAP READY
    // ═════════════════════════════════════════════

    if (result.stage !== 'SWAP_READY') {
      throw new Error(
        'A Uniswap não retornou uma transação de swap pronta.',
      );
    }

    const transaction =
      result.transaction;

    const swap =
      transaction?.swap;

    if (!swap?.to || !swap?.data) {
      throw new Error(
        'Uniswap não retornou os dados da transação de swap.',
      );
    }

    // ─────────────────────────────────────────────
    // OUTPUT AMOUNT
    // ─────────────────────────────────────────────

    const outputBase = BigInt(
      transaction.outputAmount || '0',
    );

    const minimumOutputBase =
      BigInt(
        transaction.minimumOutputAmount ||
          '0',
      );

    const outputAmount =
      Number(outputBase) /
      Math.pow(
        10,
        toTokenCfg.decimals,
      );

    const minimumOutputAmount =
      Number(minimumOutputBase) /
      Math.pow(
        10,
        toTokenCfg.decimals,
      );

    if (
      !Number.isFinite(outputAmount) ||
      outputAmount <= 0
    ) {
      throw new Error(
        'Valor de saída inválido retornado pela Uniswap.',
      );
    }

    setPendingSwap({
      fromToken: sourceToken,
      toToken: destToken,
      fromAmount: n,
      toAmount: outputAmount,
    });

    toast({
      title: 'Swap pronto',
      description:
        `${n} ${sourceToken} → ${outputAmount} ${destToken}`,
    });

    // ═════════════════════════════════════════════
    // 4. META MASK — REAL SWAP
    // ═════════════════════════════════════════════

    const swapTxHash =
      await prov.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from,
            to: swap.to,
            data: swap.data,
            value:
              swap.value ?? '0x00',
            chainId:
              '0x' +
              Number(8453).toString(16),
          },
        ],
      });

    if (!swapTxHash) {
      throw new Error(
        'A carteira não retornou o hash do swap.',
      );
    }

    toast({
      title: 'Swap enviado',
      description:
        'Aguardando confirmação na Base...',
    });

    // ═════════════════════════════════════════════
    // 5. WAIT FOR SWAP RECEIPT
    // ═════════════════════════════════════════════

    let swapReceipt: any = null;

    for (let i = 0; i < 90; i++) {
      swapReceipt =
        await prov.request({
          method:
            'eth_getTransactionReceipt',
          params: [swapTxHash],
        });

      if (swapReceipt) break;

      await new Promise(resolve =>
        setTimeout(resolve, 2000),
      );
    }

    if (!swapReceipt) {
      throw new Error(
        'Tempo limite aguardando a confirmação do swap.',
      );
    }

    if (
      swapReceipt.status !== '0x1'
    ) {
      throw new Error(
        'O swap foi revertido na Base.',
      );
    }

    // ═════════════════════════════════════════════
    // 6. SUCCESS
    // ═════════════════════════════════════════════

    const realTxId = String(
      swapTxHash,
    );

    setTransactions(prev => [
      {
        id: realTxId,
        fromToken: sourceToken,
        toToken: destToken,
        fromAmount: n,
        toAmount: outputAmount,
        time: 'Just now',
        status: 'Success',
      },
      ...prev,
    ]);

    const xpGained =
      gamification.recordSwap(
        realTxId,
      );

    toast({
      title: 'Swap concluído com sucesso!',
      description:
        `+${xpGained} XP • ${n} ${sourceToken} → ${outputAmount} ${destToken}`,
    });

    setAmount('');

    console.log(
      'REAL SWAP SUCCESS',
      {
        approvalTxHash,
        swapTxHash,
        amountIn: n,
        amountOut: outputAmount,
        minimumOutput:
          minimumOutputAmount,
      },
    );

  } catch (err) {
    const code =
      (err as { code?: number })?.code;

    if (code === 4001) {
      toast({
        title: t('wallet.txRefused'),
        description:
          t('wallet.walletRefused'),
        variant: 'destructive',
      });
    } else {
      toast({
        title: t('wallet.swapFailed'),
        description:
          (err as Error)?.message ||
          'Erro desconhecido.',
        variant: 'destructive',
      });
    }

    console.error(
      'REAL SWAP ERROR:',
      err,
    );
  }
};

  const handleSwap = () => {
    if (isConnected && isRealSwap) {
      handleRealSwap();
      return;
    }
    const n = parseFloat(amount);
    if (!n || n <= 0) return;
    setPendingSwap({ fromToken: sourceToken, toToken: destToken, fromAmount: n, toAmount: n * getRate(sourceToken, destToken) });
    setSwapModalOpen(true); setSwapStep(0);
    swapStepTimers.current.forEach(t => window.clearTimeout(t));
    swapStepTimers.current = [];
    [800, 2000, 3500, 5500].forEach((ms, i) => {
      const t = window.setTimeout(() => setSwapStep(i + 1), ms);
      swapStepTimers.current.push(t);
    });
  };

  const closeSwapModal = () => {
    setSwapModalOpen(false);
    if (pendingSwap) {
      const simTxId = Math.random().toString();
      setTransactions(prev => [{
        id: simTxId,
        fromToken: pendingSwap.fromToken, toToken: pendingSwap.toToken,
        fromAmount: pendingSwap.fromAmount, toAmount: pendingSwap.toAmount,
        time: 'Just now', status: 'Success'
      }, ...prev]);
      const xpGained = gamification.recordSwap(simTxId);
      toast({ title: `+${xpGained} XP`, description: gamification.hasBoost ? `${gamification.state.boostMultiplier}x ${t('profile.boostActive')}` : undefined });
    }
    setAmount('');
  };

  const handleNovaSimulacao = () => {
    const id = getNextSimId(); const dt = formatDateTime(new Date());
    setSimId(id); setSimDateTime(dt);
    clearSim();
    setSimStep(-1); setSimProgress(0); setConsoleLogs([]);
    setSimPhase('pipeline'); setRoiPoints([]);
    setSimStats({ balance: 0, roi: 0, risk: 0, execTime: 0, poolsAnalyzed: 0, opportunities: 0 });
    setSimTotalTime(0); setReportExported(false);
    const t = window.setTimeout(() => startSim(id, dt), 60);
    simTimers.current.timeouts.push(t);
  };

  const handleExportReport = () => {
    const html = generateReportHtml({
      simId, datetime: simDateTime, wallet: '0x8F4A...91C2',
      fromToken: pendingSwap?.fromToken || 'ETH',
      toToken:   pendingSwap?.toToken   || 'USDC',
      fromAmount: pendingSwap?.fromAmount || 0,
      toAmount:   pendingSwap?.toAmount   || 0,
      totalTime: simTotalTime,
      roi: simStats.roi, risk: simStats.risk,
      strategy: 'Arbitrum Optimal Route v2',
      pools: simStats.poolsAnalyzed, opportunities: simStats.opportunities,
    });
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
    setReportExported(true);
    const tm = window.setTimeout(() => setReportExported(false), 2500);
    miscTimers.current.push(tm);
  };

  const handleReverse = () => { setSourceToken(destToken); setDestToken(sourceToken); };
  const handleMax = () => {
    const bal = realBalances
      ? (realBalances[sourceToken] ?? 0)
      : MOCK_BALANCES[sourceToken];
    setAmount(bal.toString());
  };

  // ── New action handlers ──────────────────────────────────────────────────────

  const handleStartNewSim = () => {
    setSimPaused(false);
    if (!swapModalOpen) {
      const n = parseFloat(amount) || 1;
      setPendingSwap({ fromToken: sourceToken, toToken: destToken, fromAmount: n, toAmount: n * getRate(sourceToken, destToken) });
      setSwapModalOpen(true);
    } else {
      handleNovaSimulacao();
    }
  };

  const handlePause = () => {
    if (!swapModalOpen || simPhase === 'complete') return;
    if (simPaused) {
      setSimPaused(false);
      handleNovaSimulacao();
    } else {
      clearSim();
      setSimPaused(true);
    }
  };

  const handleCancel = () => {
    setSimPaused(false);
    closeSwapModal();
  };

  // ── Derived values ───────────────────────────────────────────────────────────

  const networkTokenOptions = useMemo(
    () => getNetworkTokens(activeNetwork).map(t => ({ symbol: t.symbol, name: t.name })),
    [activeNetwork],
  );

  const sourceAmountNum = parseFloat(amount) || 0;
  const rate = getRate(sourceToken, destToken);
  const destAmountNum = sourceAmountNum * rate;
  const sourceUsd = sourceAmountNum * getUsdRate(sourceToken);
  const destUsd   = destAmountNum   * getUsdRate(destToken);

  const logColor = (type: string) => type === 'success' ? 'text-emerald-400' : type === 'warn' ? 'text-yellow-400' : 'text-cyan-300';
  const logTag   = (type: string) => type === 'success' ? '[SUCCESS]' : type === 'warn' ? '[WARN]' : '[INFO]';

  const statCards = [
    { label: t('swap.balance'),   value: fmt.currency(simStats.balance, 'USD', 0), Icon: BarChart2,    color: 'text-cyan-400',    glow: 'hover:shadow-[0_0_14px_rgba(34,211,238,0.2)]'  },
    { label: t('sim.estimatedRoi'),value: `+${simStats.roi.toFixed(2)}%`,  Icon: TrendingUp,   color: 'text-emerald-400', glow: 'hover:shadow-[0_0_14px_rgba(52,211,153,0.2)]'  },
    { label: t('dash.risk'),   value: `${simStats.risk.toFixed(1)}%`,  Icon: AlertTriangle,color: 'text-yellow-400',  glow: 'hover:shadow-[0_0_14px_rgba(250,204,21,0.15)]' },
    { label: t('sim.totalTime'),   value: `${simStats.execTime.toFixed(1)}s`, Icon: Clock,     color: 'text-primary',     glow: 'hover:shadow-[0_0_14px_rgba(0,229,188,0.2)]'   },
    { label: t('intel.pools'),   value: `${simStats.poolsAnalyzed}`,     Icon: Database,     color: 'text-violet-400',  glow: 'hover:shadow-[0_0_14px_rgba(167,139,250,0.2)]' },
    { label: t('intel.opportunities'),  value: `${simStats.opportunities}`,     Icon: Target,       color: 'text-orange-400',  glow: 'hover:shadow-[0_0_14px_rgba(251,146,60,0.2)]'  },
  ];

  // ── Dashboard context for Digital Presenter ─────────────────────────────────
  const dashboardContext: DashboardContext = useMemo(() => {
    const sentiment = getMarketSentiment();
    const allAssets = getAllAssets();
    const movers = allAssets
      .filter(a => a.isLive)
      .sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h))
      .slice(0, 5)
      .map(a => ({ symbol: a.symbol, change: a.change24h }));
    return {
      fearGreedIndex: sentiment.fearGreedIndex,
      fearGreedLabel: sentiment.label,
      dominantTrend: sentiment.dominantTrend,
      bullishCount: sentiment.bullishCount,
      bearishCount: sentiment.bearishCount,
      neutralCount: sentiment.neutralCount,
      totalVolume: sentiment.totalVolume,
      totalTvl: sentiment.totalTvl,
      btcDominance: sentiment.btcDominance,
      activeNetworkName: activeNetwork.name,
      topMovers: movers,
      isLiveData: sentiment.isLive,
      isWalletConnected: isConnected,
      networkOnline: true,
      recentSwapActivity: transactions.length > 0,
      simulationRunning: swapModalOpen && !simPaused && simPhase === 'pipeline',
    };
  }, [activeNetwork.name, isConnected, transactions.length, swapModalOpen, simPaused, simPhase]);

  // ── Wallet event listeners (account / chain changes) ───────────────────────
  useEffect(() => {
    if (!provider || !isConnected) return;
    const handleAccountsChanged = (...args: unknown[]) => {
      const accounts = args[0] as string[];
      if (!accounts || accounts.length === 0) {
        handleDisconnect();
        return;
      }
      const newAddr = accounts[0];
      setConnectedAddress(newAddr);
      toast({ title: t('wallet.accountChanged'), description: shortAddress(newAddr) });
      refreshBalances(provider, newAddr);
    };
    const handleChainChanged = (...args: unknown[]) => {
      const raw = args[0] as string;
      const newChainId = typeof raw === 'string' ? parseInt(raw, 16) : (raw as number);
      setWalletChainId(newChainId);
      toast({ title: t('wallet.networkChanged') });
      if (connectedAddress) refreshBalances(provider, connectedAddress);
    };
    provider.on?.('accountsChanged', handleAccountsChanged);
    provider.on?.('chainChanged', handleChainChanged);
    return () => {
      provider.removeListener?.('accountsChanged', handleAccountsChanged);
      provider.removeListener?.('chainChanged', handleChainChanged);
    };
  }, [provider, isConnected, connectedAddress, t]);

  // shared NV card wrapper style
  const nvCard = "w-full rounded-2xl border border-white/[0.06] bg-card/90 backdrop-blur-xl shadow-[0_4px_24px_rgba(0,0,0,0.3)] hover:border-primary/15 hover:shadow-[0_4px_32px_rgba(0,0,0,0.4),0_0_18px_rgba(0,229,188,0.04)] transition-all duration-300";

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen bg-background overflow-hidden">

      {/* ── Ambient background ───────────────────────────────────────────── */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] bg-primary/6 rounded-full blur-[180px] pointer-events-none z-0" />
      <div className="fixed top-1/4 right-1/4 w-[500px] h-[500px] bg-accent/3 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#80808009_1px,transparent_1px),linear-gradient(to_bottom,#80808009_1px,transparent_1px)] bg-[size:28px_28px] [mask-image:radial-gradient(ellipse_70%_70%_at_50%_50%,#000_60%,transparent_100%)] pointer-events-none z-0" />

      {/* ── Desktop sidebar ──────────────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-60 shrink-0 border-r border-border/40 bg-background/95 backdrop-blur-xl min-h-screen z-10 relative">
        <SidebarContent activeView={activeView} onNavigate={(v) => {
          const item = SIDEBAR_ITEMS.find(i => i.view === v);
          if (item?.comingSoon) { setComingSoonFeature(t(item.key)); return; }
          setActiveView(v);
        }} />
      </aside>

      {/* ── Mobile sidebar overlay ───────────────────────────────────────── */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 bg-background/70 backdrop-blur-sm z-40 lg:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed inset-y-0 left-0 z-50 w-60 flex flex-col border-r border-border/50 bg-background/98 backdrop-blur-xl lg:hidden"
            >
              <SidebarContent onClose={() => setSidebarOpen(false)} activeView={activeView} onNavigate={(v) => {
                const item = SIDEBAR_ITEMS.find(i => i.view === v);
                if (item?.comingSoon) { setComingSoonFeature(t(item.key)); return; }
                setActiveView(v);
              }} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Main column ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">

        {/* ── Header ───────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-30 border-b border-border/40 bg-background/90 backdrop-blur-xl">
          <div className="flex items-center justify-between px-4 py-3 gap-3">

            {/* Left: hamburger + NV Protocol logo */}
            <div className="flex items-center gap-2.5 min-w-0">
              <button onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 rounded-xl hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0">
                <Menu size={18} />
              </button>
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center relative animate-shield-glow shrink-0">
                  <div className="absolute inset-0 rounded-lg bg-primary/15 blur-md opacity-40" />
                  <Shield size={15} className="text-primary relative z-10" />
                </div>
                <div className="hidden sm:flex flex-col min-w-0">
                  <span className="text-[13px] font-bold tracking-[0.2em] text-foreground leading-none truncate">NV PROTOCOL</span>
                  <span className="text-[9px] text-primary font-mono tracking-widest opacity-60 uppercase mt-0.5">Protocol V3</span>
                </div>
              </div>
            </div>

            {/* Center: network badge (desktop) */}
            <div className="hidden lg:flex items-center justify-center flex-1">
              <NetworkBadge envMode={envMode} activeNetwork={activeNetwork} />
            </div>

            {/* Right: env indicator + selector + mismatch + wallet */}
            <div className="flex items-center gap-2 shrink-0">

              {/* Permanent environment indicator: Testnet • Arc | Mainnet (Em breve) */}
              <span className={`hidden sm:inline-flex items-center gap-1.5 text-[10px] font-mono font-bold px-2 py-1 rounded-full border tracking-widest ${
                envMode === 'testnet'
                  ? 'text-green-400 border-green-400/25 bg-green-400/6'
                  : 'text-amber-400 border-amber-400/25 bg-amber-400/6'
              }`}>
                {envMode === 'testnet' ? '🧪' : '🌐'}
                <span className="hidden md:inline ml-0.5">
                  {envMode === 'testnet' ? t('net.testnetArc') : t('net.mainnetBase')}
                </span>
              </span>

              <EnvNetworkSelector
                envMode={envMode}
                activeNetwork={activeNetwork}
                onEnvChange={handleEnvChange}
                onNetworkChange={handleNetworkChange}
              />

              <AnimatePresence>
                {networkMismatch && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.88 }}
                    transition={{ type: 'spring', stiffness: 360, damping: 26 }}
                    onClick={handleSwitchNetwork}
                    className="hidden md:flex items-center gap-1.5 bg-amber-500/8 hover:bg-amber-500/15 border border-amber-500/25 text-amber-400 text-xs font-mono px-2.5 py-1.5 rounded-full cursor-pointer transition-colors whitespace-nowrap"
                  >
                    <AlertTriangle size={11} /> {t('net.switchTo')} {activeNetwork.shortName}
                  </motion.button>
                )}
              </AnimatePresence>

              {/* Language Selector */}
              <LanguageSelector compact />

              {/* Wallet button */}
              <div className="relative">
                {!isConnected ? (
                  <div className="relative p-[1px] rounded-lg overflow-hidden cursor-pointer animate-gradient-border bg-gradient-to-r from-primary/50 via-accent/50 to-primary/50 shrink-0">
                    <button
                      onClick={handleConnect}
                      className="relative w-full h-full bg-secondary/90 hover:bg-secondary text-primary px-3 py-2 rounded-[7px] text-sm font-medium transition-colors font-mono whitespace-nowrap cursor-pointer">
                      {t('action.connect')}
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="relative p-[1px] rounded-lg overflow-hidden cursor-pointer animate-gradient-border bg-gradient-to-r from-primary/30 via-accent/30 to-primary/30 shrink-0">
                      <button onClick={() => setShowDisconnect(!showDisconnect)}
                        className="relative flex items-center gap-2 bg-secondary/90 hover:bg-secondary px-3 py-2 rounded-[7px] text-sm font-medium transition-colors font-mono whitespace-nowrap cursor-pointer">
                        <div className={`w-2 h-2 rounded-full ${networkMismatch ? 'bg-amber-400' : 'bg-green-500'} transition-colors`} />
                        <span className="text-foreground hidden sm:inline">{connectedAddress ? shortAddress(connectedAddress) : '0x8F4A...91C2'}</span>
                        <Wallet size={14} className="text-primary sm:hidden" />
                      </button>
                    </div>
                    <AnimatePresence>
                      {showDisconnect && (
                        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}
                          className="absolute top-full right-0 mt-2 bg-card border border-border rounded-xl shadow-xl overflow-hidden z-50 min-w-[180px]">
                          {activeWalletName && (
                            <div className="px-4 py-2 text-[10px] font-mono text-muted-foreground/40 border-b border-border/30 truncate">
                              {activeWalletName}
                            </div>
                          )}
                          <button onClick={() => { setShowDisconnect(false); setShowWalletPicker(true); }}
                            className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-foreground hover:bg-secondary transition-colors cursor-pointer whitespace-nowrap">
                            <Wallet size={14} /> {t('wallet.pickerTitle')}
                          </button>
                          <button onClick={handleDisconnect}
                            className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-400 hover:bg-red-400/8 transition-colors cursor-pointer whitespace-nowrap">
                            <LogOut size={14} /> {t('action.disconnect')}
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Network badge row — mobile */}
          <div className="lg:hidden flex items-center justify-center py-2 border-t border-border/30">
            <NetworkBadge envMode={envMode} activeNetwork={activeNetwork} />
          </div>

          {/* Network mismatch banner — mobile */}
          <AnimatePresence>
            {networkMismatch && (
              <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden md:hidden">
                <button onClick={handleSwitchNetwork}
                  className="w-full flex items-center justify-center gap-2 bg-amber-500/8 text-amber-400 text-xs font-mono py-2 border-t border-amber-500/20 cursor-pointer">
                  <AlertTriangle size={11} /> Trocar para {activeNetwork.shortName}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </header>

        {/* ── Action buttons bar ────────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/25 bg-background/50 overflow-x-auto scrollbar-hide">
          {/* Nova Simulação */}
          <button onClick={handleStartNewSim}
            className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:shadow-[0_0_20px_rgba(0,229,188,0.3)] cursor-pointer shrink-0 active:scale-[0.97]">
        {/* ── Simulation mode banner (shown when no wallet connected) ── */}
        <AnimatePresence>
          {!isConnected && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden border-b border-border/25 bg-gradient-to-r from-violet-500/8 via-blue-500/5 to-transparent"
            >
              <div className="flex items-center gap-3 px-4 py-2.5">
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-base leading-none">🧪</span>
                  <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-violet-400">
                    Simulation Mode
                  </span>
                </div>
                <div className="w-px h-4 bg-border/40 shrink-0" />
                <span className="text-[11px] font-mono text-muted-foreground/70 hidden sm:inline">
                  Nenhuma carteira conectada — usando dados simulados. Nenhuma transação blockchain será enviada.
                </span>
                <span className="text-[11px] font-mono text-muted-foreground/70 sm:hidden">
                  Dados simulados — sem transações reais.
                </span>
                <div className="ml-auto flex items-center gap-1.5 shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                  <span className="text-[9px] font-mono text-muted-foreground/40 uppercase tracking-wider hidden md:inline">
                    {activeNetwork.shortName} Testnet
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

            <RefreshCw size={13} className={swapModalOpen && !simPaused && simPhase === 'pipeline' ? 'animate-spin' : ''} />
            {t('action.newSimulation')}
          </button>

          {/* Pausar / Retomar */}
          <button onClick={handlePause}
            disabled={!swapModalOpen || simPhase === 'complete'}
            className={`flex items-center gap-1.5 border px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 active:scale-[0.97] disabled:opacity-35 disabled:cursor-not-allowed ${
              simPaused
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/15'
                : 'bg-secondary/80 hover:bg-secondary border-border/50 text-foreground'
            }`}>
            <Pause size={13} className={simPaused ? 'text-emerald-400' : 'text-yellow-400'} />
            {simPaused ? t('action.resume') : t('action.pause')}
          </button>

          {/* Cancelar */}
          <button onClick={handleCancel}
            disabled={!swapModalOpen}
            className="flex items-center gap-1.5 bg-secondary/80 hover:bg-red-500/8 border border-border/50 hover:border-red-500/25 text-foreground hover:text-red-400 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 active:scale-[0.97] disabled:opacity-35 disabled:cursor-not-allowed">
            <X size={13} />
            {t('action.cancel')}
          </button>

          <div className="w-px h-5 bg-border/50 shrink-0" />

          {/* Exportar Relatório */}
          <button onClick={handleExportReport}
            disabled={!simId || simPhase !== 'complete'}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 active:scale-[0.97] border disabled:opacity-35 disabled:cursor-not-allowed ${
              reportExported
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-secondary/80 hover:bg-primary/8 border-border/50 hover:border-primary/25 text-foreground hover:text-primary'
            }`}>
            {reportExported ? <CheckCircle2 size={13} /> : <Download size={13} />}
            {reportExported ? t('action.exported') : t('action.exportReport')}
          </button>
        </div>

        {/* ── Content row ───────────────────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden">

          {/* ── Main scroll area ────────────────────────────────────────── */}
          <main className="flex-1 overflow-y-auto">
            <div className="max-w-[520px] mx-auto px-4 pt-5 pb-10 flex flex-col gap-5">

              {/* ── Pools View ─────────────────────────────────────────────── */}
              {activeView === 'pools' && (
                <PoolsView
                  provider={provider}
                  connectedAddress={connectedAddress}
                  onAddLiquidity={() => setComingSoonFeature(t('action.addLiquidity'))}
                />
              )}

              {/* ── Wallet View ────────────────────────────────────────────── */}
              {activeView === 'carteira' && (
                <WalletView
                  provider={provider}
                  connectedAddress={connectedAddress}
                  onConnect={handleConnect}
                  explorerUrl={activeNetwork.explorerUrl}
                  activeNetwork={activeNetwork}
                  walletName={activeWalletName}
                />
              )}

              {/* ── Profile / Gamification View ─────────────────────────── */}
              {activeView === 'perfil' && (
                <ProfileView
                  gamification={gamification.state}
                  hasBoost={gamification.hasBoost}
                  boostRemaining={gamification.boostRemaining}
                  onEquipSkin={gamification.setEquippedSkin}
                  onEquipTitle={gamification.setEquippedTitle}
                  onActivateBoost={gamification.startBoost}
                  walletAddress={connectedAddress}
                  purchaseState={purchases.purchaseState}
                  entitlements={purchases.entitlements}
                  isSkinOwned={purchases.isSkinOwned}
                  getLimit={purchases.getLimit}
                  limits={purchases.limits}
                  onBuySkin={(skinId) => {
                    const skin = SKINS.find(s => s.id === skinId);
                    if (!skin || !skin.premium) return;
                    const prov = provider ?? getLegacyProvider();
                    if (!prov) {
                      toast({ title: t('wallet.notFound'), description: t('wallet.installMetamask'), variant: 'destructive' });
                      return;
                    }
                    purchases.buyProduct({
                      provider: prov,
                      productId: skinId,
                      productType: 'skin',
                      amountUsd: skin.price ?? 0,
                    }).then(({ success, error }) => {
                      if (success) toast({ title: t('purchase.confirmed'), description: t('skin.' + skinId) });
                      else if (error) toast({ title: t('purchase.failed'), description: error, variant: 'destructive' });
                    });
                  }}
                  onBuyXp={(packageId) => {
                    const pkg = XP_PACKAGES.find(p => p.id === packageId);
                    if (!pkg) return;
                    const prov = provider ?? getLegacyProvider();
                    if (!prov) {
                      toast({ title: t('wallet.notFound'), description: t('wallet.installMetamask'), variant: 'destructive' });
                      return;
                    }
                    purchases.buyProduct({
                      provider: prov,
                      productId: packageId,
                      productType: 'xp',
                      amountUsd: pkg.price,
                      xpAmount: pkg.xp,
                    }).then(({ success, error }) => {
                      if (success) toast({ title: t('purchase.confirmed'), description: `+${pkg.xp} XP` });
                      else if (error) toast({ title: t('purchase.failed'), description: error, variant: 'destructive' });
                    });
                  }}
                />
              )}

              {/* ── Dashboard / Simulation View (default) ──────────────────── */}
              {activeView === 'dashboard' && (
                <>

              {/* ── Digital Presenter ─────────────────────────────────── */}
              <DigitalPresenter context={dashboardContext} />

              {/* ── Executive Dashboard ──────────────────────────────────── */}
              <ExecutiveDashboard
                envMode={envMode}
                activeNetwork={activeNetwork}
                realBalances={realBalances}
                simStats={simStats}
              />

              {/* ── Market grid ──────────────────────────────────────── */}
              <MarketGrid />

              {/* ── Portfolio charts ──────────────────────────────────── */}
              <PortfolioCharts />

              {/* ── Swap card ───────────────────────────────────────────── */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: 0.4 }}
                className={nvCard}>
                <div className="p-5">
                  <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/15 to-transparent mb-5 -mt-1" />
                  <div className="flex justify-between items-center mb-5 px-0.5">
                    <h2 className="text-base font-semibold text-foreground tracking-wide">{t('swap.title')}</h2>
                    <div className="flex items-center gap-1.5">
                      <button className="text-muted-foreground/60 hover:text-foreground transition-colors p-1.5 rounded-xl hover:bg-secondary cursor-pointer"><Activity size={16} /></button>
                      <button className="text-muted-foreground/60 hover:text-foreground transition-colors p-1.5 rounded-xl hover:bg-secondary cursor-pointer"><Settings size={16} /></button>
                    </div>
                  </div>
                  <div className="relative flex flex-col gap-1">
                    <div className="bg-input/30 border border-border/30 focus-within:border-primary/30 focus-within:shadow-[0_0_0_3px_rgba(0,229,188,0.05)] rounded-2xl p-4 transition-all duration-200">
                      <div className="text-xs text-muted-foreground/60 font-mono mb-3">{t('swap.tokenOrigin')}</div>
                      <div className="flex justify-between items-center gap-4">
                        <input type="number" placeholder="0.0" value={amount} onChange={e => setAmount(e.target.value)}
                          className="bg-transparent text-4xl font-mono outline-none w-full text-foreground placeholder:text-muted-foreground/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                        <TokenSelect value={sourceToken} onChange={setSourceToken} tokens={networkTokenOptions} />
                      </div>
                      <div className="text-xs text-muted-foreground/50 mt-3 font-mono flex justify-between h-5 items-center">
                        <span>${isValidNum(sourceUsd) ? sourceUsd.toFixed(2) : '—'}</span>
                        <span className="flex items-center gap-2">
                          {t('swap.balance')}: {realBalances ? (realBalances[sourceToken] ?? 0).toFixed(4) : MOCK_BALANCES[sourceToken].toFixed(4)}
                          <button onClick={handleMax} className="text-primary hover:text-primary-foreground hover:bg-primary px-1.5 py-0.5 rounded transition-colors bg-primary/10 cursor-pointer text-[10px]">{t('action.max')}</button>
                        </span>
                      </div>
                    </div>
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
                      <button onClick={handleReverse}
                        className="bg-card border-4 border-card bg-secondary hover:bg-primary/15 text-muted-foreground hover:text-primary w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 group cursor-pointer shadow-lg">
                        <ArrowDown size={18} className="group-hover:rotate-180 transition-transform duration-500" />
                      </button>
                    </div>
                    <div className="bg-input/30 border border-border/30 rounded-2xl p-4 transition-all duration-200">
                      <div className="text-xs text-muted-foreground/60 font-mono mb-3">{t('swap.tokenDest')}</div>
                      <div className="flex justify-between items-center gap-4">
                        <input type="number" placeholder="0.0" disabled
                          value={amount && sourceAmountNum > 0 ? destAmountNum.toFixed(4) : ''}
                          className="bg-transparent text-4xl font-mono outline-none w-full text-muted-foreground/40 cursor-not-allowed [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                        <TokenSelect value={destToken} onChange={setDestToken} tokens={networkTokenOptions} />
                      </div>
                      <div className="text-xs text-muted-foreground/50 mt-3 font-mono flex justify-between h-5 items-center">
                        <span>${isValidNum(destUsd) ? destUsd.toFixed(2) : '—'}</span>
                        <span>{t('swap.balance')}: {realBalances ? (realBalances[destToken] ?? 0).toFixed(4) : MOCK_BALANCES[destToken].toFixed(4)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 mb-2 flex justify-between text-xs font-mono text-muted-foreground/50 px-1">
                    <span className="flex items-center gap-1"><Zap size={11} className="text-primary" /> {t('swap.routing')}</span>
                    <span translate="no">1 {sourceToken} = {formatRate(rate)} {destToken}</span>
                  </div>
                  <AnimatePresence>
                    {amount && parseFloat(amount) > 0 && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                        <div className="pt-2.5 pb-1 mt-1.5 mb-1.5 border-t border-border/40 flex justify-between text-xs font-mono px-1">
                          <span className="flex items-center gap-1.5 text-muted-foreground/50"><Flame size={11} className="text-orange-500" /> {t('swap.estGas')}</span>
                          <span className="text-muted-foreground/60">$1.24</span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {!isConnected ? (
                    <button onClick={handleSwap} disabled={!amount || parseFloat(amount) <= 0}
                      className={`w-full mt-3 text-base font-semibold py-3.5 rounded-2xl transition-all duration-300 relative overflow-hidden group border cursor-pointer ${
                        !amount || parseFloat(amount) <= 0
                          ? 'bg-secondary/40 text-muted-foreground/50 border-border/30 cursor-not-allowed'
                          : 'bg-primary text-primary-foreground border-primary/20 hover:bg-primary/90 hover:shadow-[0_0_30px_rgba(0,255,200,0.3)] active:scale-[0.98] animate-btn-pulse'
                      }`}>
                      <span className="relative z-10 flex items-center justify-center gap-2 tracking-wide"><Sparkles size={16} /> {t('action.simulateSwap')}</span>
                      {amount && parseFloat(amount) > 0 && (
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent w-[50%] -translate-x-[150%] group-hover:animate-shimmer skew-x-[-15deg]" />
                      )}
                    </button>
                  ) : (
                    <button onClick={handleSwap} disabled={!amount || parseFloat(amount) <= 0}
                      className={`w-full mt-3 text-base font-semibold py-3.5 rounded-2xl transition-all duration-300 relative overflow-hidden group border cursor-pointer ${
                        !amount || parseFloat(amount) <= 0
                          ? 'bg-secondary/40 text-muted-foreground/50 border-border/30 cursor-not-allowed'
                          : 'bg-primary text-primary-foreground border-primary/20 hover:bg-primary/90 hover:shadow-[0_0_30px_rgba(0,255,200,0.3)] active:scale-[0.98] animate-btn-pulse'
                      }`}>
                      <span className="relative z-10 flex items-center justify-center gap-2 tracking-wide">
                        {isRealSwap ? <Zap size={16} /> : <Wallet size={16} />}
                        {isRealSwap ? t('action.swapOn') + ' ' + activeNetwork.shortName : t('action.swap')}
                      </span>
                      {amount && parseFloat(amount) > 0 && (
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent w-[50%] -translate-x-[150%] group-hover:animate-shimmer skew-x-[-15deg]" />
                      )}
                    </button>
                  )}
                </div>
              </motion.div>

              {/* ── Recent Transactions ─────────────────────────────────── */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26, duration: 0.4 }}
                className={nvCard}>
                <div className="p-5">
                  <div className="h-px w-full bg-gradient-to-r from-transparent via-white/8 to-transparent mb-5 -mt-1" />
                  <div className="flex items-center gap-2 mb-4 px-0.5">
                    <ArrowRight size={13} className="text-primary" />
                    <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60">{t('swap.recentTransactions')}</h3>
                  </div>
                  <div className="flex flex-col gap-2">
                    <AnimatePresence initial={false}>
                      {transactions.map(tx => (
                        <motion.div key={tx.id} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
                          <div className="flex items-center justify-between bg-secondary/25 hover:bg-secondary/40 rounded-xl p-3 border border-border/30 hover:border-primary/10 transition-all duration-200 cursor-pointer">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center -space-x-2">
                                <TokenCryptoIcon symbol={tx.fromToken} /><TokenCryptoIcon symbol={tx.toToken} />
                              </div>
                              <div className="flex items-center gap-2 text-sm font-mono">
                                <span className="text-foreground/90">{tx.fromAmount} {tx.fromToken}</span>
                                <ArrowRight size={11} className="text-muted-foreground/40" />
                                <span className="text-foreground/90">{tx.toAmount.toFixed(4)} {tx.toToken}</span>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <span className="text-xs text-muted-foreground/50">{tx.time}</span>
                              <div className="flex items-center gap-1 text-[10px] text-primary bg-primary/8 px-1.5 py-0.5 rounded uppercase font-mono">
                                <CheckCircle2 size={9} />{tx.status}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>

              {/* ── Simulation History ──────────────────────────────────── */}
              <AnimatePresence>
                {simHistory.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                    className={nvCard + ' border-primary/8'}>
                    <div className="p-5">
                      <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/15 to-transparent mb-5 -mt-1" />
                      <button onClick={() => setHistoryOpen(!historyOpen)}
                        className="w-full flex items-center justify-between cursor-pointer group">
                        <div className="flex items-center gap-2">
                          <History size={13} className="text-primary" />
                          <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground/60">{t('sim.simulationHistory')}</span>
                          <span className="text-[9px] font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{simHistory.length}</span>
                        </div>
                        <ChevronUp size={14} className={`text-muted-foreground/50 transition-transform duration-200 ${historyOpen ? '' : 'rotate-180'}`} />
                      </button>
                      <AnimatePresence>
                        {historyOpen && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                            <div className="mt-4 flex flex-col gap-1.5">
                              {simHistory.map((item, i) => (
                                <motion.div key={item.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                                  className="flex items-center justify-between bg-secondary/25 hover:bg-secondary/40 rounded-xl p-3 border border-border/30 hover:border-primary/10 transition-all duration-200 cursor-pointer">
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-[10px] font-mono text-primary">{item.id}</span>
                                    <span className="text-[9px] text-muted-foreground/40">{item.datetime}</span>
                                  </div>
                                  <div className="flex items-center gap-3 text-right">
                                    <div className="flex flex-col">
                                      <span className="text-xs font-mono text-emerald-400">+{item.roi.toFixed(2)}%</span>
                                      <span className="text-[9px] text-muted-foreground/40">{item.duration.toFixed(2)}s</span>
                                    </div>
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/50" />
                                  </div>
                                </motion.div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

                </>
              )}
            </div>
          </main>

          {/* ── Intelligence column ──────────────────────────────────── */}
          <IntelligenceColumn
            envMode={envMode}
            activeNetwork={activeNetwork}
            simStats={simStats}
            simPhase={simPhase}
            simId={simId}
            simHistory={simHistory}
            simProgress={simProgress}
          />
        </div>
      </div>

      {/* ── Simulation Modal (logic + core layout unchanged, visual enhanced) ── */}
      <AnimatePresence>
        {swapModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-background/88 backdrop-blur-lg">
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 24 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 24 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className="relative w-full max-w-3xl bg-card border border-border/60 shadow-[0_0_80px_rgba(0,255,200,0.06),0_0_0_1px_rgba(0,229,188,0.04)] rounded-[2rem] overflow-hidden max-h-[95vh] overflow-y-auto"
            >
              {/* Ambient glows */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-40 bg-primary/6 blur-[60px] pointer-events-none" />
              <div className="absolute bottom-0 right-0 w-64 h-32 bg-accent/4 blur-[50px] pointer-events-none" />
              {/* Top neon line */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

              {/* Close */}
              <button onClick={closeSwapModal}
                className="absolute top-5 right-5 z-20 text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-secondary cursor-pointer">
                <X size={18} />
              </button>

              <AnimatePresence mode="wait">

                {/* ── PIPELINE PHASE ──────────────────────────────────── */}
                {simPhase === 'pipeline' && (
                  <motion.div key="pipeline" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col">

                    {/* Header + progress */}
                    <div className="px-7 pt-7 pb-5 border-b border-border/40">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                        <span className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest">{t('sim.inProgress')}</span>
                        {simId && <span className="ml-auto text-[10px] font-mono text-primary/50">{simId}</span>}
                      </div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-base font-medium text-foreground">{t('sim.executingPipeline')}</span>
                        <span className="text-sm font-mono text-primary font-bold tabular-nums">{Math.round(simProgress)}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-secondary/60 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-primary via-emerald-400 to-primary bg-[length:200%_100%] animate-gradient-border shadow-[0_0_8px_rgba(0,229,188,0.5)]"
                          style={{ width: `${simProgress}%` }} transition={{ ease: 'linear' }} />
                      </div>
                    </div>

                    {/* Body */}
                    <div className="flex flex-col md:flex-row min-h-0">
                      {/* Pipeline steps */}
                      <div className="w-full md:w-[42%] p-6 border-b md:border-b-0 md:border-r border-border/40">
                        <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/50 mb-3">{t('sim.pipeline')}</div>
                        <div className="flex flex-col gap-2.5">
                          {PIPELINE_STEPS.map(({ labelKey, Icon }, i) => {
                            const past   = simStep > i;
                            const active = simStep === i;
                            return (
                              <div key={labelKey} className="flex items-center gap-3 relative">
                                {i < PIPELINE_STEPS.length - 1 && (
                                  <div className={`absolute left-[13px] top-7 w-[2px] h-3 rounded-full transition-colors duration-500 ${past ? 'bg-primary/40' : 'bg-border/20'}`} />
                                )}
                                <motion.div
                                  animate={active ? { boxShadow: ['0 0 0px rgba(0,229,188,0)', '0 0 16px rgba(0,229,188,0.4)', '0 0 0px rgba(0,229,188,0)'] } : {}}
                                  transition={{ duration: 1.4, repeat: Infinity }}
                                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all duration-400 ${
                                    past   ? 'bg-primary/20 text-primary' :
                                    active ? 'bg-primary/10 text-primary ring-2 ring-primary/35' :
                                             'bg-secondary/50 text-muted-foreground/20'
                                  }`}>
                                  {past ? <Check size={12} /> : active ? <Loader2 size={12} className="animate-spin" /> : <Icon size={12} />}
                                </motion.div>
                                <span className={`text-[11px] font-mono transition-colors duration-400 truncate ${
                                  past   ? 'text-muted-foreground/30 line-through decoration-primary/20' :
                                  active ? 'text-foreground' : 'text-muted-foreground/20'
                                }`}>{t(labelKey)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Terminal */}
                      <div className="w-full md:flex-1 p-6 flex flex-col">
                        <div className="flex items-center gap-2 mb-3">
                          <Terminal size={13} className="text-primary" />
                          <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/50">{t('sim.console')}</span>
                          <div className="ml-auto flex gap-1.5">
                            {['bg-red-500/60','bg-yellow-500/60','bg-green-500/60'].map(c => <div key={c} className={`w-2.5 h-2.5 rounded-full ${c}`} />)}
                          </div>
                        </div>
                        <div className="flex-1 bg-black/50 rounded-xl border border-border/30 p-4 font-mono text-xs space-y-1.5 overflow-y-auto max-h-44 md:max-h-56 scrollbar-hide" style={{ boxShadow: 'inset 0 0 24px rgba(0,0,0,0.4)' }}>
                          <AnimatePresence>
                            {consoleLogs.map((log, i) => (
                              <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.22 }} className="flex items-start gap-2">
                                <span className="text-muted-foreground/25 shrink-0 select-none">›</span>
                                <span className={`${logColor(log.type)} shrink-0 text-[10px]`}>{logTag(log.type)}</span>
                                <span className="text-foreground/70">{log.text}</span>
                              </motion.div>
                            ))}
                          </AnimatePresence>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground/25 select-none">›</span>
                            <span className="w-1.5 h-3.5 bg-primary/80 rounded-sm animate-cursor" />
                          </div>
                          <div ref={consoleEndRef} />
                        </div>

                        {/* Mini ROI chart */}
                        <div className="mt-4">
                          <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/50 mb-2">{t('sim.realTimeRoi')}</div>
                          <div className="bg-black/40 rounded-xl border border-border/25 px-3 py-2 overflow-hidden" style={{ boxShadow: 'inset 0 0 16px rgba(0,0,0,0.3)' }}>
                            <RoiChart points={roiPoints} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="px-6 pb-6 pt-4 border-t border-border/40">
                      <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/50 mb-3">{t('sim.realTimeMetrics')}</div>
                      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                        {statCards.map(({ label, value, Icon, color, glow }) => (
                          <motion.div key={label}
                            animate={simStats.execTime > 0 ? { borderColor: ['rgba(255,255,255,0.08)', 'rgba(0,229,188,0.1)', 'rgba(255,255,255,0.08)'] } : {}}
                            transition={{ duration: 2, repeat: Infinity, delay: Math.random() * 1.5 }}
                            className={`bg-secondary/30 border border-border/30 rounded-xl p-3 flex flex-col gap-1.5 transition-all duration-300 ${glow}`}>
                            <div className="flex items-center gap-1.5">
                              <Icon size={11} className={color} />
                              <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/50">{label}</span>
                            </div>
                            <div className={`text-sm font-mono font-bold ${color} tabular-nums`}>{value}</div>
                          </motion.div>
                        ))}
                      </div>
                    </div>

                    {/* Advanced metrics: Liquidity / AI Confidence / Gas / Time / Route */}
                    <SimAdvancedMetrics simProgress={simProgress} simPhase={simPhase} activeNetworkName={activeNetwork.shortName} />
                  </motion.div>
                )}

                {/* ── COMPLETE PHASE ──────────────────────────────────── */}
                {simPhase === 'complete' && (
                  <motion.div key="complete" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}
                    className="p-7 flex flex-col items-center">

                    <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.08 }}
                      className="w-[72px] h-[72px] rounded-full bg-primary/12 border-2 border-primary/35 flex items-center justify-center mb-5 relative">
                      <div className="absolute inset-0 rounded-full bg-primary/8 blur-xl" />
                      <CheckCircle2 size={36} className="text-primary relative z-10" />
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="text-center mb-5">
                      <h2 className="text-2xl font-bold text-foreground mb-1">{t('sim.operationComplete')}</h2>
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <span className="text-xs font-mono text-primary bg-primary/8 px-2 py-0.5 rounded-full border border-primary/20">{simId}</span>
                      </div>
                      <p className="text-[11px] font-mono text-muted-foreground/50">{t('sim.executedAt')} {simDateTime}</p>
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
                      className="w-full bg-black/30 border border-border/35 rounded-2xl px-4 pt-3 pb-2 mb-5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/50">{t('sim.roiEvolution')}</span>
                        <span className="text-sm font-mono font-bold text-emerald-400">+{simStats.roi.toFixed(2)}%</span>
                      </div>
                      <RoiChart points={roiPoints} isComplete />
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }} className="grid grid-cols-3 gap-3 w-full mb-5">
                      {[
                        { label: t('sim.totalTime'), value: `${simTotalTime.toFixed(2)}s`, Icon: Clock, color: 'text-primary', shadow: '0 0 20px rgba(0,229,188,0.12)' },
                        { label: t('sim.estimatedRoi'), value: `+${simStats.roi.toFixed(2)}%`, Icon: TrendingUp, color: 'text-emerald-400', shadow: '0 0 20px rgba(52,211,153,0.12)' },
                        { label: t('dash.risk'), value: `${simStats.risk.toFixed(1)}%`, Icon: AlertTriangle, color: 'text-yellow-400', shadow: '0 0 20px rgba(250,204,21,0.08)' },
                      ].map(({ label, value, Icon, color, shadow }) => (
                        <div key={label} className="bg-secondary/40 border border-border/40 rounded-2xl p-4 flex flex-col items-center gap-2 transition-all duration-300 hover:scale-[1.02]" style={{ boxShadow: shadow }}>
                          <Icon size={18} className={color} />
                          <div className={`text-xl font-bold font-mono ${color} tabular-nums`}>{value}</div>
                          <div className="text-[10px] text-muted-foreground/50 uppercase tracking-widest text-center leading-tight">{label}</div>
                        </div>
                      ))}
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }} className="flex flex-wrap justify-center gap-2 w-full mb-5">
                      {BADGES.map(({ label, color, border, bg }, i) => (
                        <motion.span key={label} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.42 + i * 0.07, type: 'spring', stiffness: 300 }}
                          className={`flex items-center gap-1.5 ${bg} border ${border} rounded-full px-3 py-1.5 text-[11px] font-mono ${color}`}>
                          <Check size={10} />{label}
                        </motion.span>
                      ))}
                    </motion.div>

                    <SimAdvancedMetrics simProgress={simProgress} simPhase={simPhase} activeNetworkName={activeNetwork.shortName} />

                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.44 }} className="w-full bg-secondary/25 border border-border/35 rounded-2xl p-4 mb-5">
                      <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/50 mb-3">{t('sim.strategyUsed')}</div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Zap size={14} className="text-primary" />
                          <span className="text-sm font-mono text-foreground">Arbitrum Optimal Route v2</span>
                        </div>
                        <span className="text-xs font-mono text-primary bg-primary/8 px-2 py-0.5 rounded-full">{simStats.poolsAnalyzed} pools</span>
                      </div>
                      {pendingSwap && (
                        <div className="flex items-center justify-center gap-5 bg-background/40 rounded-xl p-3">
                          <div className="flex flex-col items-center gap-1.5">
                            <TokenCryptoIcon symbol={pendingSwap.fromToken} />
                            <span className="font-mono text-sm text-foreground">{pendingSwap.fromAmount?.toFixed(4)}</span>
                            <span className="text-[10px] text-muted-foreground/50">{pendingSwap.fromToken}</span>
                          </div>
                          <div className="flex flex-col items-center gap-1">
                            <ArrowRight className="text-muted-foreground/50" size={16} />
                            <span className="text-[10px] font-mono text-emerald-400">+{simStats.roi.toFixed(2)}% ROI</span>
                          </div>
                          <div className="flex flex-col items-center gap-1.5">
                            <TokenCryptoIcon symbol={pendingSwap.toToken} />
                            <span className="font-mono text-sm text-primary">{pendingSwap.toAmount?.toFixed(4)}</span>
                            <span className="text-[10px] text-muted-foreground/50">{pendingSwap.toToken}</span>
                          </div>
                        </div>
                      )}
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="flex flex-col sm:flex-row gap-3 w-full">
                      <button onClick={handleNovaSimulacao}
                        className="flex-1 flex items-center justify-center gap-2 bg-secondary/80 hover:bg-secondary border border-border/50 hover:border-primary/20 text-foreground font-semibold py-3.5 rounded-2xl transition-all duration-200 cursor-pointer">
                        <RefreshCw size={16} className="text-primary" /> {t('action.newSimulation')}
                      </button>
                      <button onClick={handleExportReport}
                        className={`flex-1 flex items-center justify-center gap-2 font-semibold py-3.5 rounded-2xl transition-all duration-200 cursor-pointer border ${
                          reportExported
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                            : 'bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-[0_0_24px_rgba(0,255,200,0.25)] border-primary/20'
                        }`}>
                        {reportExported ? <CheckCircle2 size={16} /> : <Download size={16} />}
                        {reportExported ? t('action.exported') : t('action.exportReport')}
                      </button>
                    </motion.div>

                    <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
                      onClick={closeSwapModal}
                      className="mt-4 text-sm text-muted-foreground/50 hover:text-foreground transition-colors cursor-pointer font-mono underline underline-offset-4">
                      {t('action.close')}
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ComingSoonModal
        open={comingSoonFeature !== null}
        onClose={() => setComingSoonFeature(null)}
        featureName={comingSoonFeature ?? undefined}
      />

      <WalletPickerModal
        open={showWalletPicker}
        onClose={() => setShowWalletPicker(false)}
        onSelect={connectWithWallet}
      />
    </div>
  );
}

// ─── Router & App ─────────────────────────────────────────────────────────────

function Router() {
  return <Switch><Route path="/" component={Home} /><Route component={NotFound} /></Switch>;
}

function App() {
  const [showSplash, setShowSplash] = useState(() => {
    try {
      return sessionStorage.getItem('nv_splash_seen') !== '1';
    } catch {
      return true;
    }
  });

  const handleSplashFinish = () => {
    try {
      sessionStorage.setItem('nv_splash_seen', '1');
    } catch {
      // ignore
    }
    setShowSplash(false);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {showSplash && <SplashScreen onFinish={handleSplashFinish} />}
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
