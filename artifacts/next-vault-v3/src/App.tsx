import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  Settings, ArrowDown, ChevronDown, Activity, Shield, Zap, Loader2, Check,
  ArrowRight, Wallet, LogOut, CheckCircle2, TrendingUp, Flame,
  Terminal, BarChart2, Clock, Target, Cpu, RefreshCw, Download,
  AlertTriangle, Database, X, History, ChevronUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { twMerge } from 'tailwind-merge';
import {
  type EnvMode, type NetworkConfig,
  TESTNET_NETWORKS, MAINNET_NETWORKS,
  DEFAULT_TESTNET, DEFAULT_MAINNET,
  SIMULATED_WALLET_CHAIN_ID,
} from './networks';

const queryClient = new QueryClient();

// ─── Types ────────────────────────────────────────────────────────────────────

interface SimHistoryItem {
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

const TOKENS = [
  { symbol: 'ETH', name: 'Ethereum' },
  { symbol: 'USDC', name: 'USD Coin' },
  { symbol: 'DAI', name: 'Dai Stablecoin' }
];

const MOCK_BALANCES: Record<string, number> = { ETH: 12.48, USDC: 5420.18, DAI: 1834.72 };

const EXCHANGE_RATES: Record<string, number> = {
  'ETH-USDC': 3215.84, 'ETH-DAI': 3214.10,
  'USDC-ETH': 0.000311, 'USDC-DAI': 1.0003,
  'DAI-ETH': 0.000311, 'DAI-USDC': 0.9997,
};

const INITIAL_TRANSACTIONS = [
  { id: '1', fromToken: 'ETH', toToken: 'USDC', fromAmount: 0.5, toAmount: 1607.92, time: '2 min ago', status: 'Success' },
  { id: '2', fromToken: 'USDC', toToken: 'ETH', fromAmount: 500, toAmount: 0.1556, time: '1 hr ago', status: 'Success' },
  { id: '3', fromToken: 'DAI', toToken: 'ETH', fromAmount: 1000, toAmount: 0.3112, time: '3 hrs ago', status: 'Success' }
];

// Network lists live in ./networks.ts — imported above.

const PIPELINE_STEPS = [
  { label: 'Conectando carteira...',          Icon: Wallet },
  { label: 'Validando assinatura...',         Icon: Shield },
  { label: 'Lendo saldo...',                  Icon: Database },
  { label: 'Escaneando pools de liquidez...', Icon: Activity },
  { label: 'Analisando oportunidades...',     Icon: TrendingUp },
  { label: 'Calculando risco...',             Icon: AlertTriangle },
  { label: 'Selecionando estratégia ótima...', Icon: Target },
  { label: 'Simulando execução...',           Icon: Cpu },
  { label: 'Confirmando resultados...',       Icon: Check },
  { label: 'Finalizado.',                     Icon: CheckCircle2 },
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getRate = (from: string, to: string) => from === to ? 1.0 : (EXCHANGE_RATES[`${from}-${to}`] || 0);
const getUsdRate = (token: string) => token === 'ETH' ? 3215.84 : 1.0;
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
  <div><div class="brand-name">NEXT VAULT</div><div class="brand-sub">Protocol V3 · Simulation Report</div></div>
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
  <span>Next Vault Protocol V3</span>
  <span>Gerado em ${data.datetime}</span>
</div>
</div>
<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),800))</script>
</body></html>`;
}

// ─── RoiChart ─────────────────────────────────────────────────────────────────

function RoiChart({ points, isComplete = false }: { points: RoiPoint[]; isComplete?: boolean }) {
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
        <span className="text-[10px] font-mono text-muted-foreground/30 animate-pulse">aguardando dados do ROI...</span>
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

      {/* Y grid lines + labels */}
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

      {/* X baseline */}
      <line x1={PAD.l} y1={PAD.t + cH} x2={W - PAD.r} y2={PAD.t + cH}
        stroke="rgba(255,255,255,0.07)" strokeWidth="1" />

      {/* Area fill */}
      <polygon points={areaPts} fill="url(#roiFill)" />

      {/* Main line */}
      <polyline points={linePts} fill="none"
        stroke="rgb(0,229,188)" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round"
        filter="url(#neon)" />

      {/* Live dot */}
      <circle cx={lx} cy={ly} r={isComplete ? 3.5 : 3} fill="rgb(0,229,188)"
        style={{ filter: 'drop-shadow(0 0 5px rgb(0,229,188))' }}>
        {!isComplete && (
          <animate attributeName="r" values="2.5;4;2.5" dur="1.5s" repeatCount="indefinite" />
        )}
      </circle>

      {/* Value label near dot */}
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

function TokenCryptoIcon({ symbol, className = "" }: { symbol: string; className?: string }) {
  const cls = twMerge("w-6 h-6 rounded-full shadow-sm ring-2 ring-card z-10 shrink-0", className);
  if (symbol === 'ETH')  return <EthIcon className={cls} />;
  if (symbol === 'USDC') return <UsdcIcon className={cls} />;
  if (symbol === 'DAI')  return <DaiIcon className={cls} />;
  return <div className={`flex items-center justify-center text-[10px] font-bold text-white bg-gray-500 ${cls}`}>{symbol[0]}</div>;
}

// ─── TokenSelect ──────────────────────────────────────────────────────────────

function TokenSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
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
        {value}
        <ChevronDown size={16} className={`text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -5, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.95 }} transition={{ duration: 0.15 }}
            className="absolute top-full right-0 mt-2 w-48 bg-card border border-border rounded-xl p-2 shadow-2xl z-50">
            {TOKENS.map(t => (
              <button key={t.symbol} onClick={() => { onChange(t.symbol); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors cursor-pointer ${t.symbol === value ? 'bg-primary/10 text-primary' : 'hover:bg-secondary text-foreground'}`}>
                <TokenCryptoIcon symbol={t.symbol} className="w-5 h-5 ring-0 shadow-none" />
                <div className="text-left flex flex-col">
                  <span className="font-medium text-sm">{t.symbol}</span>
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
// Controlled component — state lives in Home and is passed via props.
// Renders: env toggle tab (🧪 Testnet / 🌐 Mainnet) + filtered network list.

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
    <div className="relative hidden md:block" ref={ref}>
      {/* Indicator button — shows active env + active network */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 bg-secondary/50 border border-border px-3 py-1.5 rounded-full text-xs font-mono backdrop-blur-md cursor-pointer hover:bg-secondary transition-colors"
      >
        <span className="text-base leading-none">{envEmoji}</span>
        <span className={envMode === 'testnet' ? 'text-amber-400 font-semibold' : 'text-foreground'}>
          {envLabel}
        </span>
        <span className="text-muted-foreground/40 select-none">•</span>
        <div className={`w-2 h-2 rounded-full ${activeNetwork.color} animate-pulse shrink-0`} />
        <span>{activeNetwork.shortName}</span>
        <ChevronDown size={14} className={`text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full right-0 mt-2 w-64 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden"
          >
            {/* Env toggle tabs */}
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

            {/* Network list (filtered by env) */}
            <div className="p-1 flex flex-col gap-0.5">
              {networks.map(n => (
                <button
                  key={n.id}
                  onClick={() => { onNetworkChange(n); setOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-xs font-mono cursor-pointer ${
                    n.id === activeNetwork.id
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-secondary text-foreground'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full shrink-0 ${n.color}`} />
                  <span className="flex-1 text-left">{n.name}</span>
                  {n.id === activeNetwork.id && <Check size={12} />}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Home ─────────────────────────────────────────────────────────────────────

function Home() {
  // ── Existing state ──────────────────────────────────────────────────────────
  const [sourceToken, setSourceToken] = useState('ETH');
  const [destToken,   setDestToken]   = useState('USDC');
  const [amount,      setAmount]      = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [showDisconnect, setShowDisconnect] = useState(false);

  // ── Environment / network state ─────────────────────────────────────────────
  // App always starts in Testnet mode on Sepolia.
  // walletChainId simulates what chain the injected wallet is currently on.
  // Phase 2 will replace this with a real provider.chainId query.
  const [envMode,       setEnvMode]       = useState<EnvMode>('testnet');
  const [activeNetwork, setActiveNetwork] = useState<NetworkConfig>(DEFAULT_TESTNET);
  const [walletChainId, setWalletChainId] = useState<number | null>(null);
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

  const consoleEndRef = useRef<HTMLDivElement>(null);
  const simTimers = useRef<{ intervals: number[]; timeouts: number[] }>({ intervals: [], timeouts: [] });

  useEffect(() => { document.title = 'Next Vault V3'; }, []);
  useEffect(() => { consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [consoleLogs]);

  // ── Simulation engine ───────────────────────────────────────────────────────

  const clearSim = useCallback(() => {
    simTimers.current.timeouts.forEach(t => window.clearTimeout(t));
    simTimers.current.intervals.forEach(t => window.clearInterval(t));
    simTimers.current = { intervals: [], timeouts: [] };
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

    // Pipeline steps
    PIPELINE_STEPS.forEach((_, i) => sto(() => setSimStep(i), i * 950));

    // Console logs
    CONSOLE_SCRIPT.forEach(({ type, text, delay }) =>
      sto(() => setConsoleLogs(prev => [...prev, { type, text }]), delay));

    // Progress bar
    const progIv = sin(() => {
      setSimProgress(Math.min(100, ((Date.now() - startTime) / SIM_TOTAL_MS) * 100));
    }, 50);

    // Exec timer
    const execIv = sin(() => {
      setSimStats(prev => ({ ...prev, execTime: (Date.now() - startTime) / 1000 }));
    }, 100);

    // ROI chart data points — pre-computed every 200ms
    for (let ms = 0; ms <= SIM_TOTAL_MS; ms += 200) {
      const scheduledMs = ms;
      sto(() => {
        const roiT = scheduledMs < ROI_START_MS ? 0 : Math.min(1, (scheduledMs - ROI_START_MS) / ROI_DURATION_MS);
        const roiVal = ROI_TARGET * (1 - Math.pow(1 - roiT, 3));
        setRoiPoints(prev => [...prev, { t: scheduledMs, roi: roiVal }]);
      }, ms);
    }

    // Animated stat counters
    sto(() => animateTo(v => setSimStats(p => ({ ...p, balance: v })), 46382.17, 2200), 1400);
    sto(() => animateTo(v => setSimStats(p => ({ ...p, poolsAnalyzed: v })), 23, 1400, true), 3500);
    sto(() => animateTo(v => setSimStats(p => ({ ...p, opportunities: v })), 7, 800, true), 5000);
    sto(() => animateTo(v => setSimStats(p => ({ ...p, risk: v })), 12.3, 900), 5800);
    sto(() => animateTo(v => setSimStats(p => ({ ...p, roi: v })), ROI_TARGET, 1400), ROI_START_MS);

    // Complete
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

  // Kick simulation on modal open
  useEffect(() => {
    if (swapModalOpen) {
      const id = getNextSimId();
      const dt = formatDateTime(new Date());
      setSimId(id);
      setSimDateTime(dt);
      setSimStep(-1); setSimProgress(0); setConsoleLogs([]);
      setSimPhase('pipeline'); setRoiPoints([]);
      setSimStats({ balance: 0, roi: 0, risk: 0, execTime: 0, poolsAnalyzed: 0, opportunities: 0 });
      setSimTotalTime(0); setReportExported(false);
      startSim(id, dt);
    } else { clearSim(); }
    return clearSim;
  }, [swapModalOpen]);

  // ── Existing handlers (unchanged) ───────────────────────────────────────────

  // ── Env / network handlers ──────────────────────────────────────────────────

  const handleEnvChange = (mode: EnvMode) => {
    setEnvMode(mode);
    // Switch default network when env mode changes
    setActiveNetwork(mode === 'testnet' ? DEFAULT_TESTNET : DEFAULT_MAINNET);
  };

  const handleNetworkChange = (network: NetworkConfig) => {
    setActiveNetwork(network);
  };

  // Simulates a wallet "Switch Network" request.
  // Phase 2 will call provider.request({ method: 'wallet_switchEthereumChain', ... })
  const handleSwitchNetwork = () => {
    setWalletChainId(activeNetwork.chainId);
  };

  // True when the wallet is connected but on a different chain than the selected network
  const networkMismatch = isConnected && walletChainId !== null && walletChainId !== activeNetwork.chainId;

  const handleSwap = () => {
    if (!isConnected) return;
    const n = parseFloat(amount);
    if (!n || n <= 0) return;
    setPendingSwap({ fromToken: sourceToken, toToken: destToken, fromAmount: n, toAmount: n * getRate(sourceToken, destToken) });
    setSwapModalOpen(true); setSwapStep(0);
    setTimeout(() => setSwapStep(1), 800);
    setTimeout(() => setSwapStep(2), 2000);
    setTimeout(() => setSwapStep(3), 3500);
    setTimeout(() => setSwapStep(4), 5500);
  };

  const closeSwapModal = () => {
    setSwapModalOpen(false);
    if (pendingSwap) {
      setTransactions(prev => [{
        id: Math.random().toString(),
        fromToken: pendingSwap.fromToken, toToken: pendingSwap.toToken,
        fromAmount: pendingSwap.fromAmount, toAmount: pendingSwap.toAmount,
        time: 'Just now', status: 'Success'
      }, ...prev]);
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
    window.setTimeout(() => startSim(id, dt), 60);
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
    setTimeout(() => setReportExported(false), 2500);
  };

  const handleReverse = () => { setSourceToken(destToken); setDestToken(sourceToken); };
  const handleMax = () => { if (isConnected) setAmount(MOCK_BALANCES[sourceToken].toString()); };

  const sourceAmountNum = parseFloat(amount) || 0;
  const rate = getRate(sourceToken, destToken);
  const destAmountNum = sourceAmountNum * rate;
  const sourceUsd = sourceAmountNum * getUsdRate(sourceToken);
  const destUsd   = destAmountNum   * getUsdRate(destToken);

  const logColor = (t: string) => t === 'success' ? 'text-emerald-400' : t === 'warn' ? 'text-yellow-400' : 'text-cyan-300';
  const logTag   = (t: string) => t === 'success' ? '[SUCCESS]' : t === 'warn' ? '[WARN]' : '[INFO]';

  const statCards = [
    { label: 'Saldo',   value: `$${simStats.balance.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`, Icon: BarChart2,    color: 'text-cyan-400',    glow: 'hover:shadow-[0_0_14px_rgba(34,211,238,0.2)]'  },
    { label: 'ROI Est.',value: `+${simStats.roi.toFixed(2)}%`,  Icon: TrendingUp,   color: 'text-emerald-400', glow: 'hover:shadow-[0_0_14px_rgba(52,211,153,0.2)]'  },
    { label: 'Risco',   value: `${simStats.risk.toFixed(1)}%`,  Icon: AlertTriangle,color: 'text-yellow-400',  glow: 'hover:shadow-[0_0_14px_rgba(250,204,21,0.15)]' },
    { label: 'Tempo',   value: `${simStats.execTime.toFixed(1)}s`, Icon: Clock,     color: 'text-primary',     glow: 'hover:shadow-[0_0_14px_rgba(0,229,188,0.2)]'   },
    { label: 'Pools',   value: `${simStats.poolsAnalyzed}`,     Icon: Database,     color: 'text-violet-400',  glow: 'hover:shadow-[0_0_14px_rgba(167,139,250,0.2)]' },
    { label: 'Oport.',  value: `${simStats.opportunities}`,     Icon: Target,       color: 'text-orange-400',  glow: 'hover:shadow-[0_0_14px_rgba(251,146,60,0.2)]'  },
  ];

  return (
    <div className="relative min-h-[100dvh] w-full flex flex-col items-center justify-center overflow-hidden bg-background py-24 md:py-16">

      {/* Ambient background */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent/5 rounded-full blur-[120px] pointer-events-none translate-x-[20%] translate-y-[20%]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Nav */}
      <div className="absolute top-0 w-full p-6 flex justify-between items-center z-10">
        <div className="flex items-center gap-3 text-xl font-bold tracking-wider text-foreground">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/30 backdrop-blur-md relative cursor-pointer animate-shield-glow">
            <div className="absolute inset-0 rounded-xl bg-primary/20 blur-md opacity-50" />
            <Shield className="w-5 h-5 text-primary relative z-10" />
          </div>
          <div className="hidden sm:flex flex-col cursor-pointer">
            <span className="leading-none text-[1.1rem]">NEXT VAULT</span>
            <span className="text-primary font-mono text-[10px] tracking-widest uppercase mt-1 opacity-80">Protocol V3</span>
          </div>
        </div>
        <div className="hidden lg:flex gap-8 text-sm font-mono text-muted-foreground tracking-wide">
          <span className="text-foreground border-b border-primary/50 pb-1 cursor-pointer">SWAP</span>
          <span className="hover:text-foreground transition-colors cursor-pointer">POOLS</span>
          <span className="hover:text-foreground transition-colors cursor-pointer">STAKE</span>
        </div>
        <div className="flex items-center gap-3">
          {/* Environment + network selector */}
          <EnvNetworkSelector
            envMode={envMode}
            activeNetwork={activeNetwork}
            onEnvChange={handleEnvChange}
            onNetworkChange={handleNetworkChange}
          />

          {/* Network mismatch warning — only shown when wallet chain ≠ selected chain */}
          <AnimatePresence>
            {networkMismatch && (
              <motion.button
                initial={{ opacity: 0, scale: 0.88 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.88 }}
                transition={{ type: 'spring', stiffness: 360, damping: 26 }}
                onClick={handleSwitchNetwork}
                className="hidden md:flex items-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-mono px-3 py-1.5 rounded-full cursor-pointer transition-colors whitespace-nowrap"
              >
                <AlertTriangle size={11} />
                Trocar para {activeNetwork.shortName}
              </motion.button>
            )}
          </AnimatePresence>

          {/* Connect / wallet button */}
          <div className="relative">
            {!isConnected ? (
              <div className="relative p-[1px] rounded-lg overflow-hidden cursor-pointer animate-gradient-border bg-gradient-to-r from-primary/50 via-accent/50 to-primary/50 shrink-0">
                <button
                  onClick={() => { setIsConnected(true); setWalletChainId(SIMULATED_WALLET_CHAIN_ID); }}
                  className="relative w-full h-full bg-secondary/90 hover:bg-secondary text-primary px-4 py-2 rounded-[7px] text-sm font-medium transition-colors font-mono flex items-center justify-center whitespace-nowrap cursor-pointer">
                  Connect
                </button>
              </div>
            ) : (
              <div className="relative">
                <div className="relative p-[1px] rounded-lg overflow-hidden cursor-pointer animate-gradient-border bg-gradient-to-r from-primary/30 via-accent/30 to-primary/30 shrink-0">
                  <button onClick={() => setShowDisconnect(!showDisconnect)}
                    className="relative flex items-center gap-2 bg-secondary/90 hover:bg-secondary px-3 py-2 rounded-[7px] text-sm font-medium transition-colors font-mono whitespace-nowrap cursor-pointer">
                    <div className={`w-2 h-2 rounded-full ${networkMismatch ? 'bg-amber-400' : 'bg-green-500'} transition-colors`} />
                    <span className="text-foreground">0x8F4A...91C2</span>
                  </button>
                </div>
                <AnimatePresence>
                  {showDisconnect && (
                    <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}
                      className="absolute top-full right-0 mt-2 bg-card border border-border rounded-lg shadow-xl overflow-hidden z-50 w-full">
                      <button onClick={() => { setIsConnected(false); setShowDisconnect(false); setWalletChainId(null); }}
                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-400 hover:bg-red-400/10 transition-colors cursor-pointer">
                        <LogOut size={14} /> Disconnect
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cards */}
      <div className="relative z-10 w-full max-w-[480px] flex flex-col gap-6 px-4 animate-in fade-in slide-in-from-bottom-8 duration-700">

        {/* Portfolio */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.5 }}
          className="w-full p-[1px] rounded-[2rem] bg-gradient-to-br from-white/10 via-white/5 to-transparent shadow-[0_0_30px_rgba(0,0,0,0.3)] hover:scale-[1.002] transition-all duration-300 group">
          <div className="bg-card rounded-[calc(2rem-1px)] p-6 backdrop-blur-xl border border-white/[0.02] transition-colors duration-300" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)' }}>
            <div className="flex flex-col gap-1 mb-4">
              <span className="uppercase tracking-widest text-muted-foreground text-[10px] font-mono">Portfolio Overview</span>
              <div className="text-3xl font-mono font-medium text-foreground mt-1">$46,382.17</div>
              <div className="flex items-center gap-1.5 text-green-400 text-sm mt-1">
                <TrendingUp size={14} /><span>+2.8% today</span>
              </div>
            </div>
            <div className="h-[1px] w-full bg-border/50 my-4" />
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {[
                { sym: 'ETH',  val: '12.48 · $40,133.28' },
                { sym: 'USDC', val: '5,420.18 · $5,420.18' },
                { sym: 'DAI',  val: '1,834.72 · $1,834.72' },
              ].map(({ sym, val }) => (
                <div key={sym} className="flex items-center gap-2 bg-secondary/50 rounded-xl py-2 px-3 border border-border/30 whitespace-nowrap">
                  <TokenCryptoIcon symbol={sym} className="w-5 h-5 ring-0" />
                  <span className="text-sm font-mono"><span className="text-muted-foreground">{sym}</span> {val}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Swap Card */}
        <div className="w-full p-[1px] rounded-[2rem] bg-gradient-to-br from-white/10 via-white/5 to-transparent shadow-[0_0_50px_rgba(0,0,0,0.5)] hover:scale-[1.002] transition-all duration-300 group">
          <div className="bg-card rounded-[calc(2rem-1px)] p-5 backdrop-blur-xl border border-white/[0.02] transition-colors duration-300" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)' }}>
            <div className="flex justify-between items-center mb-6 px-1">
              <h2 className="text-xl font-medium text-foreground">Swap</h2>
              <div className="flex items-center gap-2">
                <button className="text-muted-foreground hover:text-foreground transition-colors p-2 rounded-xl hover:bg-secondary cursor-pointer"><Activity size={18} /></button>
                <button className="text-muted-foreground hover:text-foreground transition-colors p-2 rounded-xl hover:bg-secondary cursor-pointer"><Settings size={18} /></button>
              </div>
            </div>
            <div className="relative flex flex-col gap-1">
              <div className="bg-input/40 border border-transparent focus-within:border-primary/30 rounded-2xl p-4 transition-colors relative overflow-hidden">
                <div className="text-sm text-muted-foreground font-medium mb-3">Token Origem</div>
                <div className="flex justify-between items-center gap-4">
                  <input type="number" placeholder="0.0" value={amount} onChange={e => setAmount(e.target.value)}
                    className="bg-transparent text-4xl font-mono outline-none w-full text-foreground placeholder:text-muted-foreground/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                  <TokenSelect value={sourceToken} onChange={setSourceToken} />
                </div>
                <div className="text-xs text-muted-foreground mt-3 font-mono flex justify-between h-5 items-center">
                  <span>${sourceUsd.toFixed(2)}</span>
                  <span className="flex items-center gap-2">
                    Balance: {isConnected ? MOCK_BALANCES[sourceToken].toFixed(4) : '0.00'}
                    {isConnected && (
                      <button onClick={handleMax} className="text-primary hover:text-primary-foreground hover:bg-primary px-1.5 py-0.5 rounded transition-colors bg-primary/10 cursor-pointer">MAX</button>
                    )}
                  </span>
                </div>
              </div>
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
                <button onClick={handleReverse}
                  className="bg-card border-4 border-card bg-secondary hover:bg-primary/20 text-muted-foreground hover:text-primary w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 group cursor-pointer">
                  <ArrowDown size={20} className="group-hover:rotate-180 transition-transform duration-500" />
                </button>
              </div>
              <div className="bg-input/40 border border-transparent rounded-2xl p-4 transition-colors">
                <div className="text-sm text-muted-foreground font-medium mb-3">Token Destino</div>
                <div className="flex justify-between items-center gap-4">
                  <input type="number" placeholder="0.0" disabled
                    value={amount && sourceAmountNum > 0 ? destAmountNum.toFixed(4) : ''}
                    className="bg-transparent text-4xl font-mono outline-none w-full text-muted-foreground/50 cursor-not-allowed [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                  <TokenSelect value={destToken} onChange={setDestToken} />
                </div>
                <div className="text-xs text-muted-foreground mt-3 font-mono flex justify-between h-5 items-center">
                  <span>${destUsd.toFixed(2)}</span>
                  <span>Balance: {isConnected ? MOCK_BALANCES[destToken].toFixed(4) : '0.00'}</span>
                </div>
              </div>
            </div>
            <div className="mt-6 mb-2 flex justify-between text-xs font-mono text-muted-foreground px-3">
              <span className="flex items-center gap-1"><Zap size={12} className="text-primary" /> Routing</span>
              <span>1 {sourceToken} = {formatRate(rate)} {destToken}</span>
            </div>
            <AnimatePresence>
              {amount && parseFloat(amount) > 0 && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="pt-3 pb-1 mt-2 mb-2 border-t border-border/50 flex justify-between text-xs font-mono px-3">
                    <span className="flex items-center gap-1.5 text-muted-foreground"><Flame size={12} className="text-orange-500" /> Est. Gas</span>
                    <span className="text-muted-foreground/80">$1.24</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {!isConnected ? (
              <div className="w-full mt-2 relative p-[1px] rounded-2xl overflow-hidden cursor-pointer animate-gradient-border bg-gradient-to-r from-primary/50 via-accent/50 to-primary/50">
                <button onClick={() => { setIsConnected(true); setWalletChainId(SIMULATED_WALLET_CHAIN_ID); }}
                  className="relative w-full h-full bg-secondary/90 hover:bg-secondary text-foreground text-lg font-semibold py-4 rounded-[15px] transition-colors flex items-center justify-center cursor-pointer">
                  Connect Wallet
                </button>
              </div>
            ) : (
              <button onClick={handleSwap} disabled={!amount || parseFloat(amount) <= 0}
                className={`w-full mt-2 text-lg font-semibold py-4 rounded-2xl transition-all duration-300 relative overflow-hidden group border cursor-pointer ${
                  !amount || parseFloat(amount) <= 0
                    ? 'bg-secondary/50 text-muted-foreground border-border/50 cursor-not-allowed'
                    : 'bg-primary text-primary-foreground border-primary/20 hover:bg-primary/90 hover:shadow-[0_0_30px_rgba(0,255,200,0.3)] active:scale-[0.98] animate-btn-pulse'
                }`}>
                <span className="relative z-10 flex items-center justify-center gap-2 tracking-wide">Swap</span>
                {amount && parseFloat(amount) > 0 && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent w-[50%] -translate-x-[150%] group-hover:animate-shimmer skew-x-[-15deg]" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="w-full p-[1px] rounded-[2rem] bg-gradient-to-br from-white/10 via-white/5 to-transparent shadow-[0_0_30px_rgba(0,0,0,0.2)] hover:scale-[1.002] transition-all duration-300 group">
          <div className="bg-card rounded-[calc(2rem-1px)] p-5 backdrop-blur-xl border border-white/[0.02] transition-colors duration-300" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)' }}>
            <h3 className="text-sm font-medium text-muted-foreground mb-4 px-1">Recent Transactions</h3>
            <div className="flex flex-col">
              <AnimatePresence initial={false}>
                {transactions.map(tx => (
                  <motion.div key={tx.id} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
                    <div className="mb-3 flex items-center justify-between bg-secondary/30 rounded-xl p-3 border border-border/50 hover:bg-secondary/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center -space-x-2">
                          <TokenCryptoIcon symbol={tx.fromToken} /><TokenCryptoIcon symbol={tx.toToken} />
                        </div>
                        <div className="flex items-center gap-2 text-sm font-mono">
                          <span className="text-foreground">{tx.fromAmount} {tx.fromToken}</span>
                          <ArrowRight size={12} className="text-muted-foreground" />
                          <span className="text-foreground">{tx.toAmount.toFixed(4)} {tx.toToken}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-xs text-muted-foreground">{tx.time}</span>
                        <div className="flex items-center gap-1 text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded uppercase font-medium">
                          <CheckCircle2 size={10} />{tx.status}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Simulation History */}
        <AnimatePresence>
          {simHistory.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
              className="w-full p-[1px] rounded-[2rem] bg-gradient-to-br from-primary/10 via-white/5 to-transparent shadow-[0_0_30px_rgba(0,0,0,0.2)] hover:scale-[1.002] transition-all duration-300">
              <div className="bg-card rounded-[calc(2rem-1px)] p-5 backdrop-blur-xl border border-white/[0.02]" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)' }}>
                <button onClick={() => setHistoryOpen(!historyOpen)}
                  className="w-full flex items-center justify-between px-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <History size={14} className="text-primary" />
                    <span className="text-sm font-medium text-muted-foreground">Histórico de Simulações</span>
                    <span className="text-[10px] font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">{simHistory.length}</span>
                  </div>
                  <ChevronUp size={16} className={`text-muted-foreground transition-transform duration-200 ${historyOpen ? '' : 'rotate-180'}`} />
                </button>
                <AnimatePresence>
                  {historyOpen && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                      <div className="mt-4 flex flex-col gap-2">
                        {simHistory.map((item, i) => (
                          <motion.div key={item.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                            className="flex items-center justify-between bg-secondary/30 rounded-xl p-3 border border-border/40 hover:bg-secondary/50 transition-colors">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[10px] font-mono text-primary">{item.id}</span>
                              <span className="text-[9px] text-muted-foreground/60">{item.datetime}</span>
                            </div>
                            <div className="flex items-center gap-3 text-right">
                              <div className="flex flex-col">
                                <span className="text-xs font-mono text-emerald-400">+{item.roi.toFixed(2)}%</span>
                                <span className="text-[9px] text-muted-foreground/60">{item.duration.toFixed(2)}s</span>
                              </div>
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/60" />
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
      </div>

      <div className="absolute bottom-6 text-xs text-muted-foreground/50 font-mono hidden sm:flex gap-4">
        <span>Audited by NextSec</span><span>•</span><span>Block 1849204</span>
      </div>

      {/* ── Simulation Modal ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {swapModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-background/85 backdrop-blur-lg">
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 24 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 24 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className="relative w-full max-w-3xl bg-card border border-border/60 shadow-[0_0_80px_rgba(0,255,200,0.07)] rounded-[2rem] overflow-hidden max-h-[95vh] overflow-y-auto"
            >
              {/* Ambient glows */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-40 bg-primary/8 blur-[60px] pointer-events-none" />
              <div className="absolute bottom-0 right-0 w-64 h-32 bg-accent/5 blur-[50px] pointer-events-none" />

              {/* Close */}
              <button onClick={closeSwapModal}
                className="absolute top-5 right-5 z-20 text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-secondary cursor-pointer">
                <X size={18} />
              </button>

              <AnimatePresence mode="wait">

                {/* ── PIPELINE PHASE ──────────────────────────────────────── */}
                {simPhase === 'pipeline' && (
                  <motion.div key="pipeline" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col">

                    {/* Header + progress */}
                    <div className="px-7 pt-7 pb-5 border-b border-border/50">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Simulação em andamento</span>
                        {simId && <span className="ml-auto text-[10px] font-mono text-primary/60">{simId}</span>}
                      </div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-base font-medium text-foreground">Executando pipeline...</span>
                        <span className="text-sm font-mono text-primary font-bold tabular-nums">{Math.round(simProgress)}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                        <motion.div className="h-full rounded-full bg-gradient-to-r from-primary via-emerald-400 to-primary bg-[length:200%_100%] animate-gradient-border"
                          style={{ width: `${simProgress}%` }} transition={{ ease: 'linear' }} />
                      </div>
                    </div>

                    {/* Body */}
                    <div className="flex flex-col md:flex-row min-h-0">
                      {/* Pipeline */}
                      <div className="w-full md:w-[42%] p-6 border-b md:border-b-0 md:border-r border-border/50">
                        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">Pipeline</div>
                        <div className="flex flex-col gap-2.5">
                          {PIPELINE_STEPS.map(({ label, Icon }, i) => {
                            const past   = simStep > i;
                            const active = simStep === i;
                            return (
                              <div key={label} className="flex items-center gap-3 relative">
                                {i < PIPELINE_STEPS.length - 1 && (
                                  <div className={`absolute left-[13px] top-7 w-[2px] h-3 rounded-full transition-colors duration-500 ${past ? 'bg-primary/50' : 'bg-border/25'}`} />
                                )}
                                <motion.div
                                  animate={active ? { boxShadow: ['0 0 0px rgba(0,229,188,0)', '0 0 14px rgba(0,229,188,0.35)', '0 0 0px rgba(0,229,188,0)'] } : {}}
                                  transition={{ duration: 1.4, repeat: Infinity }}
                                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all duration-400 ${
                                    past   ? 'bg-primary/20 text-primary' :
                                    active ? 'bg-primary/10 text-primary ring-2 ring-primary/40' :
                                             'bg-secondary text-muted-foreground/25'
                                  }`}>
                                  {past ? <Check size={12} /> : active ? <Loader2 size={12} className="animate-spin" /> : <Icon size={12} />}
                                </motion.div>
                                <span className={`text-[11px] font-mono transition-colors duration-400 truncate ${
                                  past   ? 'text-muted-foreground/40 line-through decoration-primary/25' :
                                  active ? 'text-foreground' : 'text-muted-foreground/25'
                                }`}>{label}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Terminal */}
                      <div className="w-full md:flex-1 p-6 flex flex-col">
                        <div className="flex items-center gap-2 mb-3">
                          <Terminal size={13} className="text-primary" />
                          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Console</span>
                          <div className="ml-auto flex gap-1.5">
                            {['bg-red-500/60','bg-yellow-500/60','bg-green-500/60'].map(c => <div key={c} className={`w-2.5 h-2.5 rounded-full ${c}`} />)}
                          </div>
                        </div>
                        <div className="flex-1 bg-black/40 rounded-xl border border-border/40 p-4 font-mono text-xs space-y-1.5 overflow-y-auto max-h-44 md:max-h-56 scrollbar-hide">
                          <AnimatePresence>
                            {consoleLogs.map((log, i) => (
                              <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.22 }} className="flex items-start gap-2">
                                <span className="text-muted-foreground/30 shrink-0 select-none">›</span>
                                <span className={`${logColor(log.type)} shrink-0 text-[10px]`}>{logTag(log.type)}</span>
                                <span className="text-foreground/75">{log.text}</span>
                              </motion.div>
                            ))}
                          </AnimatePresence>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground/30 select-none">›</span>
                            <span className="w-1.5 h-3.5 bg-primary/80 rounded-sm animate-cursor" />
                          </div>
                          <div ref={consoleEndRef} />
                        </div>

                        {/* Mini ROI chart during pipeline */}
                        <div className="mt-4">
                          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">ROI em tempo real</div>
                          <div className="bg-black/30 rounded-xl border border-border/30 px-3 py-2 overflow-hidden">
                            <RoiChart points={roiPoints} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="px-6 pb-6 pt-4 border-t border-border/50">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">Métricas em tempo real</div>
                      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                        {statCards.map(({ label, value, Icon, color, glow }) => (
                          <motion.div key={label}
                            animate={simStats.execTime > 0 ? { borderColor: ['rgba(255,255,255,0.1)', 'rgba(0,229,188,0.12)', 'rgba(255,255,255,0.1)'] } : {}}
                            transition={{ duration: 2, repeat: Infinity, delay: Math.random() * 1.5 }}
                            className={`bg-secondary/40 border border-border/40 rounded-xl p-3 flex flex-col gap-1.5 transition-all duration-300 ${glow}`}>
                            <div className="flex items-center gap-1.5">
                              <Icon size={11} className={color} />
                              <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/60">{label}</span>
                            </div>
                            <div className={`text-sm font-mono font-bold ${color} tabular-nums`}>{value}</div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ── COMPLETE PHASE ──────────────────────────────────────── */}
                {simPhase === 'complete' && (
                  <motion.div key="complete" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}
                    className="p-7 flex flex-col items-center">

                    {/* Checkmark */}
                    <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.08 }}
                      className="w-18 h-18 w-[72px] h-[72px] rounded-full bg-primary/15 border-2 border-primary/40 flex items-center justify-center mb-5 relative">
                      <div className="absolute inset-0 rounded-full bg-primary/10 blur-xl" />
                      <CheckCircle2 size={36} className="text-primary relative z-10" />
                    </motion.div>

                    {/* Title + ID + datetime */}
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="text-center mb-5">
                      <h2 className="text-2xl font-bold text-foreground mb-1">Operação Concluída</h2>
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">{simId}</span>
                      </div>
                      <p className="text-[11px] font-mono text-muted-foreground/60">Executado em: {simDateTime}</p>
                    </motion.div>

                    {/* ROI chart — full simulation */}
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
                      className="w-full bg-black/30 border border-border/40 rounded-2xl px-4 pt-3 pb-2 mb-5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Evolução do ROI</span>
                        <span className="text-sm font-mono font-bold text-emerald-400">+{simStats.roi.toFixed(2)}%</span>
                      </div>
                      <RoiChart points={roiPoints} isComplete />
                    </motion.div>

                    {/* Result stats */}
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }} className="grid grid-cols-3 gap-3 w-full mb-5">
                      {[
                        { label: 'Tempo Total', value: `${simTotalTime.toFixed(2)}s`, Icon: Clock, color: 'text-primary', shadow: '0 0 20px rgba(0,229,188,0.15)' },
                        { label: 'ROI Estimado', value: `+${simStats.roi.toFixed(2)}%`, Icon: TrendingUp, color: 'text-emerald-400', shadow: '0 0 20px rgba(52,211,153,0.15)' },
                        { label: 'Risco', value: `${simStats.risk.toFixed(1)}%`, Icon: AlertTriangle, color: 'text-yellow-400', shadow: '0 0 20px rgba(250,204,21,0.10)' },
                      ].map(({ label, value, Icon, color, shadow }) => (
                        <div key={label} className="bg-secondary/50 border border-border/50 rounded-2xl p-4 flex flex-col items-center gap-2 transition-all duration-300 hover:scale-[1.02]" style={{ boxShadow: shadow }}>
                          <Icon size={18} className={color} />
                          <div className={`text-xl font-bold font-mono ${color} tabular-nums`}>{value}</div>
                          <div className="text-[10px] text-muted-foreground uppercase tracking-widest text-center leading-tight">{label}</div>
                        </div>
                      ))}
                    </motion.div>

                    {/* Badges */}
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }} className="flex flex-wrap justify-center gap-2 w-full mb-5">
                      {BADGES.map(({ label, color, border, bg }, i) => (
                        <motion.span key={label} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.42 + i * 0.07, type: 'spring', stiffness: 300 }}
                          className={`flex items-center gap-1.5 ${bg} border ${border} rounded-full px-3 py-1.5 text-[11px] font-mono ${color}`}>
                          <Check size={10} />{label}
                        </motion.span>
                      ))}
                    </motion.div>

                    {/* Strategy + swap summary */}
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.44 }} className="w-full bg-secondary/30 border border-border/40 rounded-2xl p-4 mb-5">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">Estratégia utilizada</div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Zap size={14} className="text-primary" />
                          <span className="text-sm font-mono text-foreground">Arbitrum Optimal Route v2</span>
                        </div>
                        <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-full">{simStats.poolsAnalyzed} pools</span>
                      </div>
                      {pendingSwap && (
                        <div className="flex items-center justify-center gap-5 bg-background/40 rounded-xl p-3">
                          <div className="flex flex-col items-center gap-1.5">
                            <TokenCryptoIcon symbol={pendingSwap.fromToken} />
                            <span className="font-mono text-sm text-foreground">{pendingSwap.fromAmount?.toFixed(4)}</span>
                            <span className="text-[10px] text-muted-foreground">{pendingSwap.fromToken}</span>
                          </div>
                          <div className="flex flex-col items-center gap-1">
                            <ArrowRight className="text-muted-foreground" size={16} />
                            <span className="text-[10px] font-mono text-emerald-400">+{simStats.roi.toFixed(2)}% ROI</span>
                          </div>
                          <div className="flex flex-col items-center gap-1.5">
                            <TokenCryptoIcon symbol={pendingSwap.toToken} />
                            <span className="font-mono text-sm text-primary">{pendingSwap.toAmount?.toFixed(4)}</span>
                            <span className="text-[10px] text-muted-foreground">{pendingSwap.toToken}</span>
                          </div>
                        </div>
                      )}
                    </motion.div>

                    {/* Action buttons */}
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="flex flex-col sm:flex-row gap-3 w-full">
                      <button onClick={handleNovaSimulacao}
                        className="flex-1 flex items-center justify-center gap-2 bg-secondary hover:bg-secondary/80 border border-border hover:border-primary/30 text-foreground font-semibold py-3.5 rounded-2xl transition-all duration-200 cursor-pointer">
                        <RefreshCw size={16} className="text-primary" /> Nova Simulação
                      </button>
                      <button onClick={handleExportReport}
                        className={`flex-1 flex items-center justify-center gap-2 font-semibold py-3.5 rounded-2xl transition-all duration-200 cursor-pointer border ${
                          reportExported
                            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                            : 'bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-[0_0_24px_rgba(0,255,200,0.3)] border-primary/20'
                        }`}>
                        {reportExported ? <CheckCircle2 size={16} /> : <Download size={16} />}
                        {reportExported ? 'Exportado!' : 'Exportar Relatório'}
                      </button>
                    </motion.div>

                    <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
                      onClick={closeSwapModal}
                      className="mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer font-mono underline underline-offset-4">
                      Fechar
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Router & App ─────────────────────────────────────────────────────────────

function Router() {
  return <Switch><Route path="/" component={Home} /><Route component={NotFound} /></Switch>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
