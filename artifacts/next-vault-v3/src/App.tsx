import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AnimatedDashboardObject } from "./components/AnimatedDashboardObject";
import { Toaster } from '@/components/ui/toaster';
import { toast } from '@/hooks/use-toast';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Settings, ArrowDown, ChevronDown, Activity, Shield, Zap, Loader as Loader2, Check, ArrowRight, Wallet, LogOut, CircleCheck as CheckCircle2, TrendingUp, Flame, Terminal, ChartBar as BarChart2, Clock, Target, Cpu, RefreshCw, Download, TriangleAlert as AlertTriangle, Database, X, Factory as History, ChevronUp, Sparkles, TrendingDown, LayoutDashboard, FileText, Circle as HelpCircle, Menu, Pause, ChevronRight, Award, Newspaper } from 'lucide-react';
import {
  type Eip1193Provider,
  getProvider, getAccounts, getChainId, ensureNetwork, ensureBaseNetwork, networkChainParams,
  getAllBalances, shortAddress,
  getTokensForNetwork, ARC_TOKENS,
} from './lib/arc';
import { type WalletInfo, getLegacyProvider } from './lib/walletDiscovery';
import {
  getCctpNetwork,
  approveCctpUsdc,
  startCctpBridge,
  waitForCctpAttestation,
  completeCctpBridge,
} from './components/cctp';
import type { EIP1193Provider as ViemEip1193Provider } from 'viem';
import { useGamification } from './hooks/useGamification';
import { usePurchases } from './hooks/usePurchases';
import { SKINS, XP_PACKAGES } from './lib/gamification';
import { WalletPickerModal } from './components/WalletPickerModal';
import { ProfileView } from './components/ProfileView';
import { SplashScreen } from './components/SplashScreen';
import { ComingSoonModal } from './components/ComingSoonModal';
import { BridgeView } from './components/BridgeView';
import { WalletView } from './components/WalletView';
import { ExecutiveDashboard } from './components/ExecutiveDashboard';
import { MarketGrid } from './components/MarketGrid';
import { MarketTicker } from './components/MarketTicker';
import { PortfolioCharts } from './components/PortfolioCharts';
import { motion, AnimatePresence } from 'framer-motion';
import { twMerge } from 'tailwind-merge';
import {
  type EnvMode, type NetworkConfig,
  NETWORKS_CONFIG,
  TESTNET_NETWORKS, MAINNET_NETWORKS,
  DEFAULT_TESTNET, DEFAULT_MAINNET,
  SIMULATED_WALLET_CHAIN_ID,
  ARC_TESTNET_CHAIN_PARAMS,
  getNetworkTokens,
} from './networks';
import { getAsset, refreshFromApis, getMarketSentiment, getAllAssets } from './lib/marketData';
import { isValidNum, safeBalance, safeBalanceFmt, dedupTokens } from './lib/utils';
import { useI18n, useFormat } from './i18n';
import { DigitalPresenter } from './components/DigitalPresenter';
import { LanguageSelector } from './components/LanguageSelector';
import { NVIntelligence } from './components/NVIntelligence';
import { SolanaWalletPanel } from './components/SolanaWalletPanel';
import type { DashboardContext } from './lib/news';
import { NVEvmWalletProvider, useSetNVEvmWallet } from './lib/NVEvmWalletContext';
import { subscribeNavigation } from './lib/navigationStore';


const queryClient = new QueryClient();

// ─── Types ────────────────────────────────────────────────────────────────────

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_TOKENS = [
  { symbol: 'USDC', name: 'USD Coin' },
  { symbol: 'EURC', name: 'Euro Coin' },
  { symbol: 'ETH',  name: 'Ethereum' },
];

// Live exchange rates are derived from real CoinGecko prices via getAsset().
// Falls back to reasonable defaults if the API hasn't loaded yet.
const FALLBACK_PRICES: Record<string, number> = { USDC: 1, EURC: 1.087, ETH: 3215.84 };
function livePrice(symbol: string): number {
  const a = getAsset(symbol);
  const p = a ? a.price : (FALLBACK_PRICES[symbol] ?? 1);
  return Number.isFinite(p) ? p : (FALLBACK_PRICES[symbol] ?? 1);
}

const INITIAL_TRANSACTIONS: { id: string; fromToken: string; toToken: string; fromAmount: number; toAmount: number; time: string; status: string }[] = [];

// Network lists live in ./networks.ts — imported above.

// ─── Sidebar config ───────────────────────────────────────────────────────────

type SidebarView = 'dashboard' | 'historico' | 'relatorios' | 'swap' | 'carteira' | 'solana' | 'perfil' | 'configuracoes' | 'ajuda' | 'bridge' | 'intelligence';

const SIDEBAR_ITEMS: { key: string; Icon: typeof LayoutDashboard; view: SidebarView; comingSoon?: boolean }[] = [
  { key: 'nav.dashboard',     Icon: LayoutDashboard, view: 'dashboard'     },
  { key: 'nav.intelligence',  Icon: Newspaper,       view: 'intelligence'   },
  { key: 'nav.history',       Icon: History,         view: 'historico',     comingSoon: true },
  { key: 'nav.reports',       Icon: FileText,        view: 'relatorios',    comingSoon: true },
  { key: 'swap.title',         Icon: ArrowDown,       view: 'swap'            },
  { key: 'nav.bridge',        Icon: ArrowRight,      view: 'bridge'         },
  { key: 'nav.wallet',        Icon: Wallet,          view: 'carteira'       },
  { key: 'nav.solana',        Icon: Zap,             view: 'solana'         },
  { key: 'nav.profile',      Icon: Award,           view: 'perfil'         },
  { key: 'nav.settings',     Icon: Settings,        view: 'configuracoes', comingSoon: true },
  { key: 'nav.help',          Icon: HelpCircle,      view: 'ajuda',         comingSoon: true },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getRate = (from: string, to: string) => {
  if (from === to) return 1.0;
  const fromPrice = livePrice(from);
  const toPrice = livePrice(to);
  if (!Number.isFinite(fromPrice) || !Number.isFinite(toPrice) || toPrice === 0) return 0;
  return fromPrice / toPrice;
};
const getUsdRate = (token: string) => livePrice(token);
const formatRate = (rate: number) => {
  if (!Number.isFinite(rate)) return '—';
  return rate < 0.01 ? rate.toFixed(6) : rate < 1 ? rate.toFixed(4) : rate.toFixed(2);
};

// ─── RoiChart ─────────────────────────────────────────────────────────────────

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

  // ── Subscribe to NV Agent navigation requests ───────────────────────────────
  useEffect(() => subscribeNavigation((view) => {
    // Only navigate to views that actually exist in the sidebar
    const valid: SidebarView[] = ['dashboard', 'carteira', 'bridge', 'intelligence', 'solana', 'swap', 'historico', 'relatorios', 'perfil', 'configuracoes', 'ajuda'];
    if (valid.includes(view as SidebarView)) setActiveView(view as SidebarView);
  }), []);

  // ── Sync EVM wallet state into NVEvmWalletContext (read-only, for NV Agent) ──
  const setNVEvmWallet = useSetNVEvmWallet();
  useEffect(() => {
    const usdcBal = realBalances?.['USDC'];
    setNVEvmWallet({
      address: connectedAddress,
      networkName: activeNetwork.name,
      chainId: activeNetwork.chainId,
      usdcBalance: usdcBal !== undefined && usdcBal !== null
        ? usdcBal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : null,
    });
  }, [connectedAddress, activeNetwork, realBalances, setNVEvmWallet]);

  // ── Gamification ───────────────────────────────────────────────────────────
  const gamification = useGamification();
  const purchases = usePurchases({
    walletAddress: connectedAddress,
    onSkinUnlocked: (skinId) => gamification.grantSkin(skinId),
    onXpGranted: (xpAmount, txHash) => gamification.grantXp(xpAmount, txHash),
  });
  const [transactions,   setTransactions]   = useState(INITIAL_TRANSACTIONS);
  // ── UI state (new) ──────────────────────────────────────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const miscTimers = useRef<number[]>([]);

  useEffect(() => { document.title = 'NV Protocol'; }, []);
  useEffect(() => () => miscTimers.current.forEach(t => window.clearTimeout(t)), []);

  // ── Existing handlers (unchanged) ───────────────────────────────────────────

  /** Pick the first valid same-env CCTP destination that differs from `sourceId`. */
  const defaultDestFor = (sourceId: string, envType: EnvMode): string => {
    const found = NETWORKS_CONFIG.find(
      n => n.id !== sourceId && n.type === envType && getCctpNetwork(n.id) !== null && n.tokens.some(tk => tk.symbol === 'USDC')
    );
    return found?.id ?? sourceId;
  };

  const handleEnvChange = (mode: EnvMode) => {
    setEnvMode(mode);
    const net = mode === 'testnet' ? DEFAULT_TESTNET : DEFAULT_MAINNET;
    setActiveNetwork(net);
    setSwapDestNetworkId(defaultDestFor(net.id, mode));
    const netTokens = dedupTokens(getNetworkTokens(net), net.chainId);
    if (netTokens.length > 0) {
      setSourceToken(netTokens[0].symbol);
      setDestToken((netTokens[1] ?? netTokens[0]).symbol);
      setAmount('');
      setRealBalances(null);
    }
  };
  const handleNetworkChange = (network: NetworkConfig) => {
    setActiveNetwork(network);
    setSwapDestNetworkId(defaultDestFor(network.id, network.type));
    const netTokens = dedupTokens(getNetworkTokens(network), network.chainId);
    if (netTokens.length > 0) {
      setSourceToken(netTokens[0].symbol);
      setDestToken((netTokens[1] ?? netTokens[0]).symbol);
      setAmount('');
      setRealBalances(null);
    }
  };
  const handleSwitchNetwork = async () => {
    if (!provider) { setWalletChainId(activeNetwork.chainId); return; }
    try {
      // Always use networkChainParams which correctly picks up each network's
      // native currency from the NetworkConfig (ETH, MATIC, USDC, etc.)
      await ensureNetwork(provider, networkChainParams(activeNetwork));
      const chainId = await getChainId(provider);
      setWalletChainId(chainId);
    } catch {
      // user refused or network unavailable — update local state only
      setWalletChainId(activeNetwork.chainId);
    }
  };
  const networkMismatch = isConnected && walletChainId !== null && walletChainId !== activeNetwork.chainId;

  // Destination network for cross-chain CCTP swap (separate from source activeNetwork)
  const [swapDestNetworkId, setSwapDestNetworkId] = useState<string>('base-sepolia');

  // isRealSwap: wallet connected AND active network has a CCTP config (testnet or mainnet)
  const isRealSwap = isConnected && getCctpNetwork(activeNetwork.id) !== null;

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
      await ensureNetwork(prov, networkChainParams(activeNetwork));
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

  // ── Swap CCTP step state ─────────────────────────────────────────────────────
  const [swapCctpStep, setSwapCctpStep] = useState<string | null>(null);
  const [swapCctpBurnTx, setSwapCctpBurnTx] = useState<string | null>(null);
  const [swapCctpMintTx, setSwapCctpMintTx] = useState<string | null>(null);
  const [swapCctpError, setSwapCctpError] = useState<string | null>(null);
  const [swapCctpRunning, setSwapCctpRunning] = useState(false);

  // ── Real CCTP cross-chain USDC swap ──────────────────────────────────────────

  const handleRealSwap = async () => {
    const n = parseFloat(amount);
    if (!n || n <= 0) return;

    const prov = provider ?? getLegacyProvider();

    if (!prov) {
      toast({ title: t('wallet.notFound'), description: t('wallet.installMetamask'), variant: 'destructive' });
      return;
    }

    // ── Same-chain non-CCTP swap guard ─────────────────────────────────────────
    // CCTP is cross-chain only. Same-chain USDC→EURC is not supported.
    if (sourceToken !== 'USDC' || destToken !== 'USDC') {
      // Cross-chain USDC→USDC is the only supported flow.
      // Same-chain or non-USDC swaps surface an explicit message.
      if (sourceToken !== 'USDC') {
        toast({
          title: 'Token not supported',
          description: `Cross-chain transfers only support USDC as the source token. Select USDC to continue.`,
          variant: 'destructive',
        });
        return;
      }
      // sourceToken is USDC but destToken is not USDC (e.g. EURC on same chain)
      toast({
        title: 'Same-chain USDC → EURC unavailable',
        description: 'Same-chain USDC → EURC swap is temporarily unavailable. Cross-chain USDC transfers are currently supported.',
        variant: 'destructive',
      });
      return;
    }

    // ── Determine destination network ──────────────────────────────────────────
    // The Swap card operates on a single active network. For cross-chain CCTP
    // the user must select source = activeNetwork and destination = a different
    // CCTP network. We use a second network picker stored in swapDestNetwork.
    // If it is not set or equals the source, we surface an error.
    const fromNetworkId = activeNetwork.id;
    const toNetworkId   = swapDestNetworkId;

    if (!toNetworkId || toNetworkId === fromNetworkId) {
      toast({
        title: 'Select destination network',
        description: 'Choose a different destination network for the cross-chain transfer.',
        variant: 'destructive',
      });
      return;
    }

    const sourceCctp = getCctpNetwork(fromNetworkId);
    const destCctp   = getCctpNetwork(toNetworkId);

    if (!sourceCctp) {
      toast({ title: 'Unsupported source network', description: `${activeNetwork.name} is not supported for CCTP transfers.`, variant: 'destructive' });
      return;
    }
    if (!destCctp) {
      toast({ title: 'Unsupported destination network', description: `Selected destination is not supported for CCTP transfers.`, variant: 'destructive' });
      return;
    }

    // ── Cross-environment guard ────────────────────────────────────────────────
    // CCTP testnet and mainnet are completely separate environments.
    // A testnet burn transaction cannot be attested on mainnet Iris and vice versa.
    if (sourceCctp.isMainnet !== destCctp.isMainnet) {
      toast({
        title: 'Invalid route',
        description: `Cross-environment transfers are not supported. Both networks must be ${sourceCctp.isMainnet ? 'mainnet' : 'testnet'}.`,
        variant: 'destructive',
      });
      return;
    }

    // ── Wallet check ───────────────────────────────────────────────────────────
    let from = connectedAddress;
    if (!from) {
      try {
        const accounts = await getAccounts(prov);
        from = accounts?.[0] ?? null;
      } catch { /* handled below */ }
    }
    if (!from) {
      toast({ title: t('wallet.accountNotAuth'), variant: 'destructive' });
      return;
    }

    setSwapCctpRunning(true);
    setSwapCctpStep(null);
    setSwapCctpBurnTx(null);
    setSwapCctpMintTx(null);
    setSwapCctpError(null);

    const step = (msg: string) => {
      setSwapCctpStep(msg);
      toast({ title: msg });
    };

    try {
      // 1. Switch to source network
      step(`Switching to ${sourceCctp.name}…`);
      await ensureNetwork(prov, {
        chainId: '0x' + sourceCctp.chainId.toString(16),
        chainName: sourceCctp.name,
        nativeCurrency: (sourceCctp.chain as { nativeCurrency?: { name: string; symbol: string; decimals: number } }).nativeCurrency ?? { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
        rpcUrls: [sourceCctp.rpcUrl],
        blockExplorerUrls: [sourceCctp.explorerUrl],
      });
      const liveChainId = await getChainId(prov);
      setWalletChainId(liveChainId);

      // 2. Approve USDC
      step(`Approving USDC on ${sourceCctp.name}…`);
      const approveTx = await approveCctpUsdc(
        prov as unknown as ViemEip1193Provider,
        from,
        fromNetworkId,
        n,
      );

      // Wait for approval confirmation
      step('Waiting for approval confirmation…');
      await waitForEthTx(prov, approveTx);

      // 3. Burn USDC via CCTP
      step(`Burning ${n} USDC on ${sourceCctp.name}…`);
      const burnTx = await startCctpBridge(
        prov as unknown as ViemEip1193Provider,
        from,
        fromNetworkId,
        toNetworkId,
        n,
      );
      setSwapCctpBurnTx(burnTx);
      toast({
        title: `USDC burned`,
        description: `TX: ${burnTx.slice(0, 18)}… — ${sourceCctp.explorerUrl}/tx/${burnTx}`,
      });

      // Wait for burn confirmation
      step('Waiting for burn confirmation…');
      await waitForEthTx(prov, burnTx);

      // 4. Poll Circle Iris for attestation
      step('Waiting for Circle attestation…');
      const attestation = await waitForCctpAttestation(fromNetworkId, burnTx);

      // 5. Switch to destination network
      step(`Switching to ${destCctp.name}…`);
      await ensureNetwork(prov, {
        chainId: '0x' + destCctp.chainId.toString(16),
        chainName: destCctp.name,
        nativeCurrency: (destCctp.chain as { nativeCurrency?: { name: string; symbol: string; decimals: number } }).nativeCurrency ?? { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
        rpcUrls: [destCctp.rpcUrl],
        blockExplorerUrls: [destCctp.explorerUrl],
      });

      // 6. Complete mint on destination
      step(`Completing transfer on ${destCctp.name}…`);
      const mintTx = await completeCctpBridge(
        prov as unknown as ViemEip1193Provider,
        from,
        toNetworkId,
        attestation,
      );
      setSwapCctpMintTx(mintTx);

      // Wait for mint confirmation
      step('Waiting for destination confirmation…');
      await waitForEthTx(prov, mintTx);

      // 7. Success
      setSwapCctpStep('Transfer complete!');
      toast({
        title: `Transfer complete ✓`,
        description: `Minted on ${destCctp.name}: ${mintTx.slice(0, 18)}… | ${destCctp.explorerUrl}/tx/${mintTx}`,
      });

      // Record in recent transactions
      const simTxId = mintTx;
      setTransactions(prev => [{
        id: simTxId,
        fromToken: 'USDC',
        toToken: 'USDC',
        fromAmount: n,
        toAmount: n,
        time: 'Just now',
        status: 'Success',
      }, ...prev]);

      const xpGained = gamification.recordSwap(simTxId);
      toast({ title: `+${xpGained} XP` });
      setAmount('');
    } catch (err) {
      const code = (err as { code?: number })?.code;
      let msg: string;

      if (code === 4001 || code === -32603) {
        msg = 'Transaction rejected by wallet.';
      } else if (err instanceof Error) {
        msg = err.message;
      } else {
        msg = 'Unknown error during CCTP transfer.';
      }

      setSwapCctpError(msg);
      setSwapCctpStep(null);
      toast({ title: t('wallet.swapFailed'), description: msg, variant: 'destructive' });
      console.error('CCTP SWAP ERROR:', err);
    } finally {
      setSwapCctpRunning(false);
    }
  };

  // ── Helper: wait for an EVM transaction receipt ───────────────────────────────
  async function waitForEthTx(prov: Eip1193Provider, txHash: string): Promise<void> {
    const maxMs = 5 * 60 * 1000;
    const started = Date.now();
    while (Date.now() - started < maxMs) {
      const receipt = await prov.request({ method: 'eth_getTransactionReceipt', params: [txHash] });
      if (receipt) {
        const status = (receipt as { status?: string }).status;
        if (status === '0x0') throw new Error('Transaction reverted on-chain.');
        return;
      }
      await new Promise(r => setTimeout(r, 3000));
    }
    throw new Error('Transaction confirmation timeout.');
  }

  const handleSwap = () => {
    if (!isConnected) {
      toast({ title: 'Connect wallet first', description: 'Connect a supported wallet before starting an on-chain operation.', variant: 'destructive' });
      return;
    }
    if (!isRealSwap) {
      toast({ title: 'Unsupported route', description: 'This network is not configured for a supported CCTP USDC transfer.', variant: 'destructive' });
      return;
    }
    void handleRealSwap();
  };

  const handleReverse = () => { setSourceToken(destToken); setDestToken(sourceToken); };
  const handleMax = () => {
    if (!isConnected || !realBalances) {
      toast({ title: 'Wallet balance unavailable', description: 'Connect your wallet and refresh its balance first.', variant: 'destructive' });
      return;
    }
    setAmount(safeBalance(realBalances[sourceToken] ?? 0).toString());
  };

  // ── Derived values ───────────────────────────────────────────────────────────

  const networkTokenOptions = useMemo(
    () => {
      const raw = getNetworkTokens(activeNetwork);
      const deduped = dedupTokens(raw, activeNetwork.chainId);
      return deduped.map(t => ({ symbol: t.symbol, name: t.name }));
    },
    [activeNetwork],
  );

  const sourceAmountNum = parseFloat(amount) || 0;
  const rate = getRate(sourceToken, destToken);
  const destAmountNum = sourceAmountNum * rate;
  const sourceUsd = sourceAmountNum * getUsdRate(sourceToken);
  const destUsd   = destAmountNum   * getUsdRate(destToken);

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
    };
  }, [activeNetwork.name, isConnected, transactions.length]);

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

         <AnimatedDashboardObject />
      
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

        {/* ── Content row ───────────────────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden">

          {/* ── Main scroll area ────────────────────────────────────────── */}
          <main className="flex-1 overflow-y-auto">
            <div className="max-w-[520px] mx-auto px-4 pt-5 pb-10 flex flex-col gap-5">

              {/* ── Dedicated Swap View ────────────────────────────────────── */}
              {activeView === 'swap' && (
                <>
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
                          {t('swap.balance')}: {realBalances ? safeBalanceFmt(realBalances[sourceToken]) : '—'}
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
                          value={amount && sourceAmountNum > 0 && Number.isFinite(destAmountNum) ? destAmountNum.toFixed(4) : ''}
                          className="bg-transparent text-4xl font-mono outline-none w-full text-muted-foreground/40 cursor-not-allowed [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                        <TokenSelect value={destToken} onChange={setDestToken} tokens={networkTokenOptions} />
                      </div>
                      <div className="text-xs text-muted-foreground/50 mt-3 font-mono flex justify-between h-5 items-center">
                        <span>${isValidNum(destUsd) ? destUsd.toFixed(2) : '—'}</span>
                        <span>{t('swap.balance')}: {realBalances ? safeBalanceFmt(realBalances[destToken]) : '—'}</span>
                      </div>
                    </div>
                  </div>

                  {/* ── Destination network selector (real CCTP swap only) ── */}
                  {isRealSwap && sourceToken === 'USDC' && (
                    <div className="mt-4 rounded-xl border border-border/40 bg-secondary/20 p-3">
                      <div className="text-xs text-muted-foreground/60 font-mono mb-2">Destination Network (CCTP)</div>
                      <select
                        value={swapDestNetworkId}
                        onChange={e => setSwapDestNetworkId(e.target.value)}
                        disabled={swapCctpRunning}
                        className="w-full bg-background border border-border/50 rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50 disabled:opacity-50"
                      >
                        {NETWORKS_CONFIG
                          // Same-env only: testnet → testnet, mainnet → mainnet.
                          // Exclude source network and networks without CCTP or USDC.
                          .filter(n =>
                            n.id !== activeNetwork.id &&
                            n.type === activeNetwork.type &&
                            getCctpNetwork(n.id) !== null &&
                            n.tokens.some(tk => tk.symbol === 'USDC')
                          )
                          .map(n => (
                            <option key={n.id} value={n.id}>{n.name}</option>
                          ))
                        }
                      </select>
                    </div>
                  )}

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

                  {/* ── CCTP transfer status panel ───────────────────────── */}
                  <AnimatePresence>
                    {(swapCctpStep || swapCctpError || swapCctpBurnTx || swapCctpMintTx) && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className={`mt-3 rounded-xl border p-3 text-xs font-mono space-y-1 ${
                          swapCctpError
                            ? 'border-red-500/20 bg-red-500/5 text-red-400'
                            : 'border-primary/20 bg-primary/5 text-primary'
                        }`}>
                          {swapCctpError && <div className="flex items-start gap-1.5"><AlertTriangle size={11} className="mt-0.5 shrink-0" /><span>{swapCctpError}</span></div>}
                          {swapCctpStep && !swapCctpError && (
                            <div className="flex items-center gap-1.5">
                              <Loader2 size={11} className={swapCctpRunning ? 'animate-spin' : ''} />
                              <span>{swapCctpStep}</span>
                            </div>
                          )}
                          {swapCctpBurnTx && (
                            <div className="flex items-start gap-1.5 text-muted-foreground/60">
                              <span className="shrink-0">Burn TX:</span>
                              <a
                                href={`${getCctpNetwork(activeNetwork.id)?.explorerUrl ?? ''}/tx/${swapCctpBurnTx}`}
                                target="_blank" rel="noopener noreferrer"
                                className="truncate hover:text-primary transition-colors"
                              >
                                {swapCctpBurnTx.slice(0, 20)}…
                              </a>
                            </div>
                          )}
                          {swapCctpMintTx && (
                            <div className="flex items-start gap-1.5 text-emerald-400">
                              <Check size={11} className="mt-0.5 shrink-0" />
                              <span className="shrink-0">Mint TX:</span>
                              <a
                                href={`${getCctpNetwork(swapDestNetworkId)?.explorerUrl ?? ''}/tx/${swapCctpMintTx}`}
                                target="_blank" rel="noopener noreferrer"
                                className="truncate hover:text-emerald-300 transition-colors"
                              >
                                {swapCctpMintTx.slice(0, 20)}…
                              </a>
                            </div>
                          )}
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
                      <span className="relative z-10 flex items-center justify-center gap-2 tracking-wide"><Sparkles size={16} /> {t('action.swap')}</span>
                      {amount && parseFloat(amount) > 0 && (
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent w-[50%] -translate-x-[150%] group-hover:animate-shimmer skew-x-[-15deg]" />
                      )}
                    </button>
                  ) : (
                    <button onClick={handleSwap} disabled={!amount || parseFloat(amount) <= 0 || swapCctpRunning}
                      className={`w-full mt-3 text-base font-semibold py-3.5 rounded-2xl transition-all duration-300 relative overflow-hidden group border cursor-pointer ${
                        !amount || parseFloat(amount) <= 0 || swapCctpRunning
                          ? 'bg-secondary/40 text-muted-foreground/50 border-border/30 cursor-not-allowed'
                          : 'bg-primary text-primary-foreground border-primary/20 hover:bg-primary/90 hover:shadow-[0_0_30px_rgba(0,255,200,0.3)] active:scale-[0.98] animate-btn-pulse'
                      }`}>
                      <span className="relative z-10 flex items-center justify-center gap-2 tracking-wide">
                        {swapCctpRunning ? (
                          <><Loader2 size={16} className="animate-spin" /> Processing…</>
                        ) : isRealSwap ? (
                          <><Zap size={16} /> {t('action.swapOn')} {activeNetwork.shortName}</>
                        ) : (
                          <><Wallet size={16} /> {t('action.swap')}</>
                        )}
                      </span>
                      {amount && parseFloat(amount) > 0 && !swapCctpRunning && (
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
                                <span className="text-foreground/90">{safeBalanceFmt(tx.toAmount)} {tx.toToken}</span>
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


                </>
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

              {/* ── Solana Wallet View ─────────────────────────────────── */}
              {activeView === 'solana' && (
                <SolanaWalletPanel />
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

              {/* ── NV Intelligence View ────────────────────────────────────── */}
              {activeView === 'intelligence' && (
                <NVIntelligence />
              )}

              {/* ── Bridge View ─────────────────────────────────────────────── */}
              {activeView === 'bridge' && (
               <BridgeView
                  provider={provider}
                  connectedAddress={connectedAddress}
                />
              )}
              
              {/* ── Dashboard / Simulation View (default) ──────────────────── */}
              {activeView === 'dashboard' && (
                <>

              {/* ── Market Ticker Tape ────────────────────────────────── */}
              <MarketTicker />

              {/* ── Digital Presenter ─────────────────────────────────── */}
              <DigitalPresenter context={dashboardContext} />

              {/* ── Executive Dashboard ──────────────────────────────────── */}
              <ExecutiveDashboard
                envMode={envMode}
                activeNetwork={activeNetwork}
                realBalances={realBalances}
              />

              {/* ── Market grid ──────────────────────────────────────── */}
              <MarketGrid />

              {/* ── Portfolio charts ──────────────────────────────────── */}
              <PortfolioCharts />

                </>
              )}
            </div>
          </main>

        </div>
      </div>

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
      <NVEvmWalletProvider>
        <TooltipProvider>
          {showSplash && <SplashScreen onFinish={handleSplashFinish} />}
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </NVEvmWalletProvider>
    </QueryClientProvider>
  );
}

export default App;
