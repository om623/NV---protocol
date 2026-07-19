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
  AlertTriangle, Database, X, Percent
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { twMerge } from 'tailwind-merge';

const queryClient = new QueryClient();

// ─── Constants ────────────────────────────────────────────────────────────────

const TOKENS = [
  { symbol: 'ETH', name: 'Ethereum' },
  { symbol: 'USDC', name: 'USD Coin' },
  { symbol: 'DAI', name: 'Dai Stablecoin' }
];

const MOCK_BALANCES: Record<string, number> = {
  ETH: 12.48,
  USDC: 5420.18,
  DAI: 1834.72
};

const EXCHANGE_RATES: Record<string, number> = {
  'ETH-USDC': 3215.84,
  'ETH-DAI': 3214.10,
  'USDC-ETH': 0.000311,
  'USDC-DAI': 1.0003,
  'DAI-ETH': 0.000311,
  'DAI-USDC': 0.9997,
};

const INITIAL_TRANSACTIONS = [
  { id: '1', fromToken: 'ETH', toToken: 'USDC', fromAmount: 0.5, toAmount: 1607.92, time: '2 min ago', status: 'Success' },
  { id: '2', fromToken: 'USDC', toToken: 'ETH', fromAmount: 500, toAmount: 0.1556, time: '1 hr ago', status: 'Success' },
  { id: '3', fromToken: 'DAI', toToken: 'ETH', fromAmount: 1000, toAmount: 0.3112, time: '3 hrs ago', status: 'Success' }
];

const SWAP_STEPS = [
  "Preparing Transaction",
  "Getting Quote",
  "Signing Transaction",
  "Broadcasting to Testnet",
  "Swap Completed"
];

const NETWORKS = [
  { id: 'sepolia', name: 'Ethereum Sepolia Testnet', color: 'bg-green-500' },
  { id: 'mumbai', name: 'Polygon Mumbai', color: 'bg-purple-500' },
  { id: 'goerli', name: 'Arbitrum Goerli', color: 'bg-blue-500' },
];

const PIPELINE_STEPS = [
  { label: 'Conectando carteira...', Icon: Wallet },
  { label: 'Validando assinatura...', Icon: Shield },
  { label: 'Lendo saldo...', Icon: Database },
  { label: 'Escaneando pools de liquidez...', Icon: Activity },
  { label: 'Analisando oportunidades...', Icon: TrendingUp },
  { label: 'Calculando risco...', Icon: AlertTriangle },
  { label: 'Selecionando estratégia ótima...', Icon: Target },
  { label: 'Simulando execução...', Icon: Cpu },
  { label: 'Confirmando resultados...', Icon: Check },
  { label: 'Finalizado.', Icon: CheckCircle2 },
];

const CONSOLE_SCRIPT: { type: 'info' | 'success' | 'warn'; text: string; delay: number }[] = [
  { type: 'info',    text: 'Wallet connected',               delay: 350  },
  { type: 'info',    text: 'Reading balances...',            delay: 1400 },
  { type: 'warn',    text: 'High volatility detected',       delay: 2400 },
  { type: 'info',    text: '23 pools analyzed',              delay: 3500 },
  { type: 'info',    text: '7 opportunities found',          delay: 5000 },
  { type: 'info',    text: 'Best ROI selected',              delay: 6700 },
  { type: 'info',    text: 'Running final checks...',        delay: 7900 },
  { type: 'success', text: 'Simulation completed',           delay: 8900 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getRate = (from: string, to: string) => {
  if (from === to) return 1.0;
  return EXCHANGE_RATES[`${from}-${to}`] || 0;
};

const getUsdRate = (token: string) => {
  if (token === 'ETH') return 3215.84;
  return 1.0;
};

const formatRate = (rate: number) => {
  if (rate < 0.01) return rate.toFixed(6);
  if (rate < 1) return rate.toFixed(4);
  return rate.toFixed(2);
};

// ─── Token Icons ──────────────────────────────────────────────────────────────

const EthIcon = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
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
  <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="16" fill="#2775CA"/>
    <path d="M21.2 11.5c-1.3-1.4-3.1-2.1-5.2-2.1-3.9 0-7 2.9-7 7.1 0 4.2 3 7.1 7 7.1 2.2 0 4-.8 5.3-2.2l-2.4-2.5c-.8.9-1.8 1.4-2.9 1.4-2.1 0-3.6-1.5-3.6-3.8 0-2.3 1.5-3.8 3.6-3.8 1.1 0 2.1.5 2.9 1.4l2.5-2.6z" fill="white"/>
  </svg>
);

const DaiIcon = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="16" fill="#F5AC37"/>
    <path d="M11 9h5c3.5 0 6 2 6 5.5S19.5 20 16 20h-5V9zm3 3v5h2c1.7 0 3-1 3-2.5S17.7 12 16 12h-2z" fill="white"/>
    <path d="M10 11h11v2H10zM10 16h11v2H10z" fill="white"/>
  </svg>
);

function TokenCryptoIcon({ symbol, className = "" }: { symbol: string; className?: string }) {
  const finalClass = twMerge("w-6 h-6 rounded-full shadow-sm ring-2 ring-card z-10 shrink-0", className);
  if (symbol === 'ETH')  return <EthIcon className={finalClass} />;
  if (symbol === 'USDC') return <UsdcIcon className={finalClass} />;
  if (symbol === 'DAI')  return <DaiIcon className={finalClass} />;
  return (
    <div className={`flex items-center justify-center text-[10px] font-bold text-white bg-gray-500 ${finalClass}`}>
      {symbol[0]}
    </div>
  );
}

// ─── TokenSelect ──────────────────────────────────────────────────────────────

function TokenSelect({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 bg-secondary hover:bg-secondary/80 text-foreground px-3 py-2 rounded-xl transition-colors font-medium border border-border/50 shadow-sm cursor-pointer"
      >
        <TokenCryptoIcon symbol={value} className="w-5 h-5 ring-0 shadow-none" />
        {value}
        <ChevronDown size={16} className={`text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full right-0 mt-2 w-48 bg-card border border-border rounded-xl p-2 shadow-2xl z-50"
          >
            {TOKENS.map(t => (
              <button
                key={t.symbol}
                onClick={() => { onChange(t.symbol); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors cursor-pointer ${t.symbol === value ? 'bg-primary/10 text-primary' : 'hover:bg-secondary text-foreground'}`}
              >
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

// ─── NetworkSelector ──────────────────────────────────────────────────────────

function NetworkSelector() {
  const [open, setOpen] = useState(false);
  const [activeNetwork, setActiveNetwork] = useState(NETWORKS[0]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative hidden md:block" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 bg-secondary/50 border border-border px-3 py-1.5 rounded-full text-xs font-mono backdrop-blur-md cursor-pointer hover:bg-secondary transition-colors"
      >
        <div className={`w-2 h-2 rounded-full ${activeNetwork.color} animate-pulse`} />
        {activeNetwork.name}
        <ChevronDown size={14} className={`text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full right-0 mt-2 w-56 bg-card border border-border rounded-xl p-1 shadow-2xl z-50 flex flex-col gap-1"
          >
            {NETWORKS.map(n => (
              <button
                key={n.id}
                onClick={() => { setActiveNetwork(n); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-xs font-mono cursor-pointer ${n.id === activeNetwork.id ? 'bg-primary/10 text-primary' : 'hover:bg-secondary text-foreground'}`}
              >
                <div className={`w-2 h-2 rounded-full ${n.color}`} />
                {n.name}
              </button>
            ))}
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
  const [destToken, setDestToken] = useState('USDC');
  const [amount, setAmount] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [showDisconnect, setShowDisconnect] = useState(false);
  const [transactions, setTransactions] = useState(INITIAL_TRANSACTIONS);
  const [swapModalOpen, setSwapModalOpen] = useState(false);
  const [swapStep, setSwapStep] = useState(0);
  const [pendingSwap, setPendingSwap] = useState<any>(null);

  // ── Simulation state ────────────────────────────────────────────────────────
  const [simStep, setSimStep]       = useState(-1);
  const [simProgress, setSimProgress] = useState(0);
  const [consoleLogs, setConsoleLogs] = useState<{ type: 'info' | 'success' | 'warn'; text: string }[]>([]);
  const [simPhase, setSimPhase]     = useState<'pipeline' | 'complete'>('pipeline');
  const [simStats, setSimStats]     = useState({ balance: 0, roi: 0, risk: 0, execTime: 0, poolsAnalyzed: 0, opportunities: 0 });
  const [simTotalTime, setSimTotalTime] = useState(0);
  const [reportExported, setReportExported] = useState(false);
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const simTimers = useRef<{ intervals: number[]; timeouts: number[] }>({ intervals: [], timeouts: [] });

  useEffect(() => {
    document.title = "Next Vault V3";
  }, []);

  // ── Auto-scroll terminal ────────────────────────────────────────────────────
  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [consoleLogs]);

  // ── Simulation engine ───────────────────────────────────────────────────────
  const clearSim = useCallback(() => {
    simTimers.current.timeouts.forEach(t => window.clearTimeout(t));
    simTimers.current.intervals.forEach(t => window.clearInterval(t));
    simTimers.current = { intervals: [], timeouts: [] };
  }, []);

  const startSim = useCallback(() => {
    const sto = (fn: () => void, ms: number) => {
      const t = window.setTimeout(fn, ms);
      simTimers.current.timeouts.push(t);
    };
    const sin = (fn: () => void, ms: number): number => {
      const t = window.setInterval(fn, ms);
      simTimers.current.intervals.push(t);
      return t;
    };
    const animateToTarget = (
      setter: (v: number) => void,
      target: number,
      duration: number,
      round = false
    ) => {
      const s = Date.now();
      const iv = sin(() => {
        const t = Math.min(1, (Date.now() - s) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        const val = target * eased;
        setter(round ? Math.round(val) : val);
        if (t >= 1) {
          window.clearInterval(iv);
          simTimers.current.intervals = simTimers.current.intervals.filter(x => x !== iv);
        }
      }, 30);
    };

    const startTime = Date.now();

    // Pipeline steps — one every 950ms
    PIPELINE_STEPS.forEach((_, i) => sto(() => setSimStep(i), i * 950));

    // Console logs
    CONSOLE_SCRIPT.forEach(({ type, text, delay }) =>
      sto(() => setConsoleLogs(prev => [...prev, { type, text }]), delay)
    );

    // Progress bar
    const progIv = sin(() => {
      const elapsed = Date.now() - startTime;
      setSimProgress(Math.min(100, (elapsed / 9500) * 100));
    }, 50);

    // Exec timer
    const execIv = sin(() => {
      setSimStats(prev => ({ ...prev, execTime: (Date.now() - startTime) / 1000 }));
    }, 100);

    // Animated stat counters
    sto(() => animateToTarget(v => setSimStats(p => ({ ...p, balance: v })), 46382.17, 2200), 1400);
    sto(() => animateToTarget(v => setSimStats(p => ({ ...p, poolsAnalyzed: v })), 23, 1400, true), 3500);
    sto(() => animateToTarget(v => setSimStats(p => ({ ...p, opportunities: v })), 7, 800, true), 5000);
    sto(() => animateToTarget(v => setSimStats(p => ({ ...p, risk: v })), 12.3, 900), 5800);
    sto(() => animateToTarget(v => setSimStats(p => ({ ...p, roi: v })), 8.47, 1400), 6700);

    // Transition to complete
    sto(() => {
      const total = parseFloat(((Date.now() - startTime) / 1000).toFixed(2));
      setSimTotalTime(total);
      setSimPhase('complete');
      setSimProgress(100);
      window.clearInterval(progIv);
      window.clearInterval(execIv);
      simTimers.current.intervals = simTimers.current.intervals.filter(x => x !== progIv && x !== execIv);
    }, 9700);
  }, []);

  const restartSim = useCallback(() => {
    clearSim();
    setSimStep(-1);
    setSimProgress(0);
    setConsoleLogs([]);
    setSimPhase('pipeline');
    setSimStats({ balance: 0, roi: 0, risk: 0, execTime: 0, poolsAnalyzed: 0, opportunities: 0 });
    setSimTotalTime(0);
    setReportExported(false);
    setTimeout(startSim, 50);
  }, [clearSim, startSim]);

  // Kick off / tear down simulation with modal
  useEffect(() => {
    if (swapModalOpen) {
      setSimStep(-1);
      setSimProgress(0);
      setConsoleLogs([]);
      setSimPhase('pipeline');
      setSimStats({ balance: 0, roi: 0, risk: 0, execTime: 0, poolsAnalyzed: 0, opportunities: 0 });
      setSimTotalTime(0);
      setReportExported(false);
      startSim();
    } else {
      clearSim();
    }
    return clearSim;
  }, [swapModalOpen]);

  // ── Existing handlers ───────────────────────────────────────────────────────
  const handleSwap = () => {
    if (!isConnected) return;
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) return;

    setPendingSwap({
      fromToken: sourceToken,
      toToken: destToken,
      fromAmount: numAmount,
      toAmount: numAmount * getRate(sourceToken, destToken)
    });

    setSwapModalOpen(true);
    setSwapStep(0);

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
        fromToken: pendingSwap.fromToken,
        toToken: pendingSwap.toToken,
        fromAmount: pendingSwap.fromAmount,
        toAmount: pendingSwap.toAmount,
        time: 'Just now',
        status: 'Success'
      }, ...prev]);
    }
    setAmount('');
  };

  const handleReverse = () => {
    setSourceToken(destToken);
    setDestToken(sourceToken);
  };

  const handleMax = () => {
    if (isConnected) setAmount(MOCK_BALANCES[sourceToken].toString());
  };

  const sourceAmountNum = parseFloat(amount) || 0;
  const rate = getRate(sourceToken, destToken);
  const destAmountNum = sourceAmountNum * rate;
  const sourceUsd = sourceAmountNum * getUsdRate(sourceToken);
  const destUsd = destAmountNum * getUsdRate(destToken);

  // ── Console log colour ──────────────────────────────────────────────────────
  const logColor = (type: string) => {
    if (type === 'success') return 'text-emerald-400';
    if (type === 'warn')    return 'text-yellow-400';
    return 'text-cyan-300';
  };
  const logTag = (type: string) => {
    if (type === 'success') return '[SUCCESS]';
    if (type === 'warn')    return '[WARN]';
    return '[INFO]';
  };

  return (
    <div className="relative min-h-[100dvh] w-full flex flex-col items-center justify-center overflow-hidden bg-background py-24 md:py-16">

      {/* Background ambience */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent/5 rounded-full blur-[120px] pointer-events-none translate-x-[20%] translate-y-[20%]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Top Nav */}
      <div className="absolute top-0 w-full p-6 flex justify-between items-center z-10">
        <div className="text-xl font-bold tracking-wider text-foreground flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/30 backdrop-blur-md relative group cursor-pointer animate-shield-glow">
            <div className="absolute inset-0 rounded-xl bg-primary/20 blur-md opacity-50 transition-opacity" />
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
          <NetworkSelector />
          <div className="relative">
            {!isConnected ? (
              <div className="relative p-[1px] rounded-lg overflow-hidden group cursor-pointer animate-gradient-border bg-gradient-to-r from-primary/50 via-accent/50 to-primary/50 shrink-0">
                <button
                  onClick={() => setIsConnected(true)}
                  className="relative w-full h-full bg-secondary/90 hover:bg-secondary text-primary px-4 py-2 rounded-[7px] text-sm font-medium transition-colors font-mono flex items-center justify-center whitespace-nowrap cursor-pointer"
                >
                  Connect
                </button>
              </div>
            ) : (
              <div className="relative">
                <div className="relative p-[1px] rounded-lg overflow-hidden group cursor-pointer animate-gradient-border bg-gradient-to-r from-primary/30 via-accent/30 to-primary/30 shrink-0">
                  <button
                    onClick={() => setShowDisconnect(!showDisconnect)}
                    className="relative flex items-center gap-2 bg-secondary/90 hover:bg-secondary px-3 py-2 rounded-[7px] text-sm font-medium transition-colors font-mono whitespace-nowrap cursor-pointer"
                  >
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-foreground">0x8F4A...91C2</span>
                  </button>
                </div>
                <AnimatePresence>
                  {showDisconnect && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 5 }}
                      className="absolute top-full right-0 mt-2 bg-card border border-border rounded-lg shadow-xl overflow-hidden z-50 w-full"
                    >
                      <button
                        onClick={() => { setIsConnected(false); setShowDisconnect(false); }}
                        className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-400 hover:bg-red-400/10 transition-colors cursor-pointer"
                      >
                        <LogOut size={14} />
                        Disconnect
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main container */}
      <div className="relative z-10 w-full max-w-[480px] flex flex-col gap-6 px-4 animate-in fade-in slide-in-from-bottom-8 duration-700">

        {/* Portfolio Card */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="w-full p-[1px] rounded-[2rem] bg-gradient-to-br from-white/10 via-white/5 to-transparent shadow-[0_0_30px_rgba(0,0,0,0.3)] hover:scale-[1.002] transition-all duration-300 group"
        >
          <div className="bg-card rounded-[calc(2rem-1px)] p-6 backdrop-blur-xl group-hover:border-white/10 border-white/[0.02] border transition-colors duration-300" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)' }}>
            <div className="flex justify-between items-start mb-4">
              <div className="flex flex-col gap-1">
                <span className="uppercase tracking-widest text-muted-foreground text-[10px] font-mono">Portfolio Overview</span>
                <div className="text-3xl font-mono font-medium text-foreground mt-1">$46,382.17</div>
                <div className="flex items-center gap-1.5 text-green-400 text-sm mt-1">
                  <TrendingUp size={14} />
                  <span>+2.8% today</span>
                </div>
              </div>
            </div>
            <div className="h-[1px] w-full bg-border/50 my-4" />
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {['ETH', 'USDC', 'DAI'].map((sym, i) => {
                const vals: Record<string, string> = { ETH: '12.48 · $40,133.28', USDC: '5,420.18 · $5,420.18', DAI: '1,834.72 · $1,834.72' };
                return (
                  <div key={sym} className="flex items-center gap-2 bg-secondary/50 rounded-xl py-2 px-3 border border-border/30 whitespace-nowrap">
                    <TokenCryptoIcon symbol={sym} className="w-5 h-5 ring-0" />
                    <span className="text-sm font-mono"><span className="text-muted-foreground">{sym}</span> {vals[sym]}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* Swap Card */}
        <div className="w-full p-[1px] rounded-[2rem] bg-gradient-to-br from-white/10 via-white/5 to-transparent shadow-[0_0_50px_rgba(0,0,0,0.5)] hover:scale-[1.002] transition-all duration-300 group">
          <div className="bg-card rounded-[calc(2rem-1px)] p-5 backdrop-blur-xl group-hover:border-white/10 border-white/[0.02] border transition-colors duration-300" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)' }}>
            <div className="flex justify-between items-center mb-6 px-1">
              <h2 className="text-xl font-medium text-foreground">Swap</h2>
              <div className="flex items-center gap-2">
                <button className="text-muted-foreground hover:text-foreground transition-colors p-2 rounded-xl hover:bg-secondary cursor-pointer"><Activity size={18} /></button>
                <button className="text-muted-foreground hover:text-foreground transition-colors p-2 rounded-xl hover:bg-secondary cursor-pointer"><Settings size={18} /></button>
              </div>
            </div>

            <div className="relative flex flex-col gap-1">
              {/* Source */}
              <div className="bg-input/40 border border-transparent focus-within:border-primary/30 rounded-2xl p-4 transition-colors group relative overflow-hidden">
                <div className="text-sm text-muted-foreground font-medium mb-3">Token Origem</div>
                <div className="flex justify-between items-center gap-4">
                  <input
                    type="number" placeholder="0.0" value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="bg-transparent text-4xl font-mono outline-none w-full text-foreground placeholder:text-muted-foreground/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
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

              {/* Reverse */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
                <button onClick={handleReverse} className="bg-card border-4 border-card bg-secondary hover:bg-primary/20 text-muted-foreground hover:text-primary w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 group cursor-pointer">
                  <ArrowDown size={20} className="group-hover:rotate-180 transition-transform duration-500" />
                </button>
              </div>

              {/* Destination */}
              <div className="bg-input/40 border border-transparent rounded-2xl p-4 transition-colors">
                <div className="text-sm text-muted-foreground font-medium mb-3">Token Destino</div>
                <div className="flex justify-between items-center gap-4">
                  <input
                    type="number" placeholder="0.0" disabled
                    value={amount && sourceAmountNum > 0 ? destAmountNum.toFixed(4) : ''}
                    className="bg-transparent text-4xl font-mono outline-none w-full text-muted-foreground/50 cursor-not-allowed [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
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
              <div className="w-full mt-2 relative p-[1px] rounded-2xl overflow-hidden group cursor-pointer animate-gradient-border bg-gradient-to-r from-primary/50 via-accent/50 to-primary/50">
                <button onClick={() => setIsConnected(true)} className="relative w-full h-full bg-secondary/90 hover:bg-secondary text-foreground text-lg font-semibold py-4 rounded-[15px] transition-colors flex items-center justify-center cursor-pointer">
                  Connect Wallet
                </button>
              </div>
            ) : (
              <button
                onClick={handleSwap}
                disabled={!amount || parseFloat(amount) <= 0}
                className={`w-full mt-2 text-lg font-semibold py-4 rounded-2xl transition-all duration-300 relative overflow-hidden group border cursor-pointer ${
                  !amount || parseFloat(amount) <= 0
                    ? 'bg-secondary/50 text-muted-foreground border-border/50 cursor-not-allowed'
                    : 'bg-primary text-primary-foreground hover:shadow-[0_0_30px_rgba(0,255,200,0.3)] hover:bg-primary/90 active:scale-[0.98] border-primary/20'
                }`}
              >
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
          <div className="bg-card rounded-[calc(2rem-1px)] p-5 backdrop-blur-xl group-hover:border-white/10 border-white/[0.02] border transition-colors duration-300" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)' }}>
            <h3 className="text-sm font-medium text-muted-foreground mb-4 px-1">Recent Transactions</h3>
            <div className="flex flex-col">
              <AnimatePresence initial={false}>
                {transactions.map(tx => (
                  <motion.div key={tx.id} layout initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
                    <div className="mb-3 flex items-center justify-between bg-secondary/30 rounded-xl p-3 border border-border/50 hover:bg-secondary/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center -space-x-2">
                          <TokenCryptoIcon symbol={tx.fromToken} />
                          <TokenCryptoIcon symbol={tx.toToken} />
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
                          <CheckCircle2 size={10} />
                          {tx.status}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-6 text-xs text-muted-foreground/50 font-mono hidden sm:flex gap-4">
        <span>Audited by NextSec</span>
        <span>•</span>
        <span>Block 1849204</span>
      </div>

      {/* ── Simulation Modal ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {swapModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/85 backdrop-blur-lg"
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 24 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 24 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className="relative w-full max-w-3xl bg-card border border-border/60 shadow-[0_0_80px_rgba(0,255,200,0.07)] rounded-[2rem] overflow-hidden"
            >
              {/* Ambient glow */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-40 bg-primary/8 blur-[60px] pointer-events-none" />
              <div className="absolute bottom-0 right-0 w-64 h-32 bg-accent/5 blur-[50px] pointer-events-none" />

              {/* X close */}
              <button
                onClick={closeSwapModal}
                className="absolute top-5 right-5 z-20 text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-secondary cursor-pointer"
              >
                <X size={18} />
              </button>

              <AnimatePresence mode="wait">
                {/* ── PIPELINE PHASE ─────────────────────────────────────── */}
                {simPhase === 'pipeline' && (
                  <motion.div key="pipeline" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col">

                    {/* Header + progress */}
                    <div className="px-7 pt-7 pb-5 border-b border-border/50">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                        <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Simulação em andamento</span>
                      </div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-base font-medium text-foreground">Executando pipeline...</span>
                        <span className="text-sm font-mono text-primary font-bold">{Math.round(simProgress)}%</span>
                      </div>
                      {/* Progress bar */}
                      <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-primary via-emerald-400 to-primary bg-[length:200%_100%] animate-gradient-border"
                          style={{ width: `${simProgress}%` }}
                          transition={{ ease: 'linear' }}
                        />
                      </div>
                    </div>

                    {/* Body: pipeline + console */}
                    <div className="flex flex-col md:flex-row min-h-0">

                      {/* Pipeline steps */}
                      <div className="w-full md:w-[44%] p-6 border-b md:border-b-0 md:border-r border-border/50 flex flex-col gap-3">
                        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Pipeline</div>
                        {PIPELINE_STEPS.map(({ label, Icon }, i) => {
                          const isPast   = simStep > i;
                          const isActive = simStep === i;
                          return (
                            <div key={label} className="flex items-center gap-3 relative">
                              {/* connector line */}
                              {i < PIPELINE_STEPS.length - 1 && (
                                <div className={`absolute left-[13px] top-7 w-[2px] h-4 rounded-full transition-colors duration-500 ${isPast ? 'bg-primary/60' : 'bg-border/30'}`} />
                              )}
                              {/* icon bubble */}
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all duration-400 ${
                                isPast   ? 'bg-primary/20 text-primary' :
                                isActive ? 'bg-primary/10 text-primary ring-2 ring-primary/40 shadow-[0_0_12px_rgba(0,255,200,0.25)]' :
                                           'bg-secondary text-muted-foreground/30'
                              }`}>
                                {isPast ? (
                                  <Check size={13} />
                                ) : isActive ? (
                                  <Loader2 size={13} className="animate-spin" />
                                ) : (
                                  <Icon size={13} />
                                )}
                              </div>
                              <span className={`text-xs font-mono transition-colors duration-400 ${
                                isPast   ? 'text-muted-foreground/50 line-through decoration-primary/30' :
                                isActive ? 'text-foreground' :
                                           'text-muted-foreground/30'
                              }`}>
                                {label}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Terminal console */}
                      <div className="w-full md:flex-1 p-6 flex flex-col">
                        <div className="flex items-center gap-2 mb-3">
                          <Terminal size={13} className="text-primary" />
                          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Console</span>
                          <div className="ml-auto flex gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                            <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                          </div>
                        </div>
                        <div className="flex-1 bg-black/40 rounded-xl border border-border/40 p-4 font-mono text-xs overflow-y-auto max-h-52 md:max-h-72 space-y-1.5 scrollbar-hide">
                          <AnimatePresence>
                            {consoleLogs.map((log, i) => (
                              <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.25 }}
                                className="flex items-start gap-2"
                              >
                                <span className="text-muted-foreground/40 shrink-0 select-none">›</span>
                                <span className={`${logColor(log.type)} shrink-0`}>{logTag(log.type)}</span>
                                <span className="text-foreground/80">{log.text}</span>
                              </motion.div>
                            ))}
                          </AnimatePresence>
                          {/* blinking cursor */}
                          {simPhase === 'pipeline' && (
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground/40 select-none">›</span>
                              <span className="w-2 h-3.5 bg-primary/80 rounded-sm animate-cursor" />
                            </div>
                          )}
                          <div ref={consoleEndRef} />
                        </div>
                      </div>
                    </div>

                    {/* Stats cards */}
                    <div className="px-6 pb-6 pt-4 border-t border-border/50">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">Métricas em tempo real</div>
                      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                        {[
                          { label: 'Saldo',       value: `$${simStats.balance.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, icon: BarChart2, color: 'text-cyan-400' },
                          { label: 'ROI Est.',     value: `+${simStats.roi.toFixed(2)}%`,           icon: TrendingUp,    color: 'text-emerald-400' },
                          { label: 'Risco',        value: `${simStats.risk.toFixed(1)}%`,            icon: AlertTriangle, color: 'text-yellow-400' },
                          { label: 'Tempo',        value: `${simStats.execTime.toFixed(1)}s`,         icon: Clock,         color: 'text-primary' },
                          { label: 'Pools',        value: `${simStats.poolsAnalyzed}`,               icon: Database,      color: 'text-violet-400' },
                          { label: 'Oport.',       value: `${simStats.opportunities}`,               icon: Target,        color: 'text-orange-400' },
                        ].map(({ label, value, icon: Icon, color }) => (
                          <div key={label} className="bg-secondary/40 border border-border/40 rounded-xl p-3 flex flex-col gap-1.5 hover:bg-secondary/60 transition-colors">
                            <div className="flex items-center gap-1.5">
                              <Icon size={11} className={color} />
                              <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/70">{label}</span>
                            </div>
                            <div className={`text-sm font-mono font-bold ${color} tabular-nums`}>{value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ── COMPLETE PHASE ──────────────────────────────────────── */}
                {simPhase === 'complete' && (
                  <motion.div
                    key="complete"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4 }}
                    className="p-8 flex flex-col items-center"
                  >
                    {/* Big checkmark */}
                    <motion.div
                      initial={{ scale: 0, rotate: -20 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
                      className="w-20 h-20 rounded-full bg-primary/15 border-2 border-primary/40 flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(0,255,200,0.3)] relative"
                    >
                      <div className="absolute inset-0 rounded-full bg-primary/10 blur-xl" />
                      <CheckCircle2 size={40} className="text-primary relative z-10" />
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="text-center mb-6">
                      <h2 className="text-2xl font-bold text-foreground mb-2">Operação Concluída</h2>
                      <p className="text-muted-foreground text-sm font-mono">Arbitrum Optimal Route · {simTotalTime.toFixed(2)}s</p>
                    </motion.div>

                    {/* Result stats */}
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="grid grid-cols-3 gap-3 w-full mb-6">
                      {[
                        { label: 'Tempo Total',    value: `${simTotalTime.toFixed(2)}s`,       icon: Clock,      color: 'text-primary',     glow: 'shadow-[0_0_20px_rgba(0,255,200,0.15)]' },
                        { label: 'ROI Estimado',   value: `+${simStats.roi.toFixed(2)}%`,      icon: TrendingUp, color: 'text-emerald-400',  glow: 'shadow-[0_0_20px_rgba(52,211,153,0.15)]' },
                        { label: 'Risco',          value: `${simStats.risk.toFixed(1)}%`,      icon: AlertTriangle, color: 'text-yellow-400', glow: 'shadow-[0_0_20px_rgba(250,204,21,0.1)]' },
                      ].map(({ label, value, icon: Icon, color, glow }) => (
                        <div key={label} className={`bg-secondary/50 border border-border/50 rounded-2xl p-4 flex flex-col items-center gap-2 ${glow}`}>
                          <Icon size={18} className={color} />
                          <div className={`text-xl font-bold font-mono ${color}`}>{value}</div>
                          <div className="text-[10px] text-muted-foreground uppercase tracking-widest text-center">{label}</div>
                        </div>
                      ))}
                    </motion.div>

                    {/* Strategy + swap summary */}
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="w-full bg-secondary/30 border border-border/40 rounded-2xl p-4 mb-6">
                      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">Estratégia utilizada</div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Zap size={14} className="text-primary" />
                          <span className="text-sm font-mono text-foreground">Arbitrum Optimal Route v2</span>
                        </div>
                        <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-full">{simStats.poolsAnalyzed} pools</span>
                      </div>
                      {pendingSwap && (
                        <div className="flex items-center justify-center gap-4 bg-background/40 rounded-xl p-3">
                          <div className="flex flex-col items-center gap-1.5">
                            <TokenCryptoIcon symbol={pendingSwap.fromToken} />
                            <span className="font-mono text-sm text-foreground">{pendingSwap.fromAmount?.toFixed(4)} {pendingSwap.fromToken}</span>
                          </div>
                          <div className="flex flex-col items-center gap-1">
                            <ArrowRight className="text-muted-foreground" size={16} />
                            <span className="text-[10px] font-mono text-primary">+{simStats.roi.toFixed(2)}% ROI</span>
                          </div>
                          <div className="flex flex-col items-center gap-1.5">
                            <TokenCryptoIcon symbol={pendingSwap.toToken} />
                            <span className="font-mono text-sm text-primary">{pendingSwap.toAmount?.toFixed(4)} {pendingSwap.toToken}</span>
                          </div>
                        </div>
                      )}
                    </motion.div>

                    {/* Buttons */}
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="flex flex-col sm:flex-row gap-3 w-full">
                      <button
                        onClick={restartSim}
                        className="flex-1 flex items-center justify-center gap-2 bg-secondary hover:bg-secondary/80 border border-border text-foreground font-semibold py-3.5 rounded-2xl transition-all duration-200 hover:border-primary/30 cursor-pointer"
                      >
                        <RefreshCw size={16} className="text-primary" />
                        Nova Simulação
                      </button>
                      <button
                        onClick={() => {
                          setReportExported(true);
                          setTimeout(() => setReportExported(false), 2500);
                        }}
                        className={`flex-1 flex items-center justify-center gap-2 font-semibold py-3.5 rounded-2xl transition-all duration-200 cursor-pointer border ${
                          reportExported
                            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                            : 'bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-[0_0_24px_rgba(0,255,200,0.3)] border-primary/20'
                        }`}
                      >
                        {reportExported ? <CheckCircle2 size={16} /> : <Download size={16} />}
                        {reportExported ? 'Exportado!' : 'Exportar Relatório'}
                      </button>
                    </motion.div>

                    <motion.button
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.6 }}
                      onClick={closeSwapModal}
                      className="mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer font-mono underline underline-offset-4"
                    >
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
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route component={NotFound} />
    </Switch>
  );
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
