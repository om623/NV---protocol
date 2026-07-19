import React, { useState, useRef, useEffect } from 'react';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Settings, ArrowDown, ChevronDown, Activity, Shield, Zap } from 'lucide-react';

const queryClient = new QueryClient();

const TOKENS = [
  { symbol: 'ETH', name: 'Ethereum' },
  { symbol: 'USDC', name: 'USD Coin' },
  { symbol: 'DAI', name: 'Dai Stablecoin' }
];

function TokenIcon({ symbol }: { symbol: string }) {
  const colors: Record<string, string> = {
    ETH: 'bg-[#627EEA]',
    USDC: 'bg-[#2775CA]',
    DAI: 'bg-[#F5AC37]'
  };

  return (
    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm ${colors[symbol] || 'bg-gray-500'}`}>
      {symbol[0]}
    </div>
  );
}

function TokenSelect({ value, onChange }: { value: string, onChange: (val: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  
  return (
    <div className="relative" ref={ref}>
      <button 
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 bg-secondary hover:bg-secondary/80 text-foreground px-3 py-2 rounded-xl transition-colors font-medium border border-border/50 shadow-sm"
      >
        <TokenIcon symbol={value} />
        {value}
        <ChevronDown size={16} className={`text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-48 bg-card border border-border rounded-xl p-2 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-200">
          {TOKENS.map(t => (
            <button
              key={t.symbol}
              onClick={() => { onChange(t.symbol); setOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${t.symbol === value ? 'bg-primary/10 text-primary' : 'hover:bg-secondary text-foreground'}`}
            >
              <TokenIcon symbol={t.symbol} />
              <div className="text-left flex flex-col">
                <span className="font-medium text-sm">{t.symbol}</span>
                <span className="text-xs opacity-50">{t.name}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Home() {
  const [sourceToken, setSourceToken] = useState('ETH');
  const [destToken, setDestToken] = useState('USDC');
  const [amount, setAmount] = useState('');

  useEffect(() => {
    document.title = "Next Vault V3";
  }, []);

  const handleSwap = () => {
    alert("Swap realizado com sucesso!");
  };

  const handleReverse = () => {
    setSourceToken(destToken);
    setDestToken(sourceToken);
  };

  return (
    <div className="relative min-h-[100dvh] w-full flex flex-col items-center justify-center overflow-hidden bg-background">
      {/* Background Ambience */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent/5 rounded-full blur-[120px] pointer-events-none translate-x-[20%] translate-y-[20%]" />
      
      {/* Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* Top Nav */}
      <div className="absolute top-0 w-full p-6 flex justify-between items-center z-10">
        <div className="text-xl font-bold tracking-wider text-foreground flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/30 backdrop-blur-md relative group cursor-pointer">
            <div className="absolute inset-0 rounded-xl bg-primary/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div className="flex flex-col cursor-pointer">
            <span className="leading-none text-[1.1rem]">NEXT VAULT</span>
            <span className="text-primary font-mono text-[10px] tracking-widest uppercase mt-1 opacity-80">Protocol V3</span>
          </div>
        </div>
        <div className="hidden md:flex gap-8 text-sm font-mono text-muted-foreground tracking-wide">
          <span className="text-foreground border-b border-primary/50 pb-1 cursor-pointer">SWAP</span>
          <span className="hover:text-foreground transition-colors cursor-pointer">POOLS</span>
          <span className="hover:text-foreground transition-colors cursor-pointer">STAKE</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 bg-secondary/50 border border-border px-3 py-1.5 rounded-full text-xs font-mono backdrop-blur-md">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            Mainnet
          </div>
          <button className="bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 px-4 py-2 rounded-lg text-sm font-medium transition-colors font-mono">
            Connect
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-[480px] p-[1px] rounded-[2rem] bg-gradient-to-b from-border/80 to-transparent shadow-[0_0_50px_rgba(0,0,0,0.5)] animate-in fade-in slide-in-from-bottom-8 duration-700 mx-4">
        <div className="bg-card rounded-[calc(2rem-1px)] p-5 backdrop-blur-2xl border border-white/[0.02]">
          
          <div className="flex justify-between items-center mb-6 px-1">
            <h2 className="text-xl font-medium text-foreground">Swap</h2>
            <div className="flex items-center gap-2">
              <button className="text-muted-foreground hover:text-foreground transition-colors p-2 rounded-xl hover:bg-secondary">
                <Activity size={18} />
              </button>
              <button className="text-muted-foreground hover:text-foreground transition-colors p-2 rounded-xl hover:bg-secondary">
                <Settings size={18} />
              </button>
            </div>
          </div>

          <div className="relative flex flex-col gap-1">
            {/* Source Token Group */}
            <div className="bg-input/40 border border-transparent focus-within:border-primary/30 rounded-2xl p-4 transition-colors group relative overflow-hidden">
              <div className="text-sm text-muted-foreground font-medium mb-3">Token Origem</div>
              <div className="flex justify-between items-center gap-4">
                <input 
                  type="number"
                  placeholder="Quantia"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="bg-transparent text-4xl font-mono outline-none w-full text-foreground placeholder:text-muted-foreground/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <TokenSelect value={sourceToken} onChange={setSourceToken} />
              </div>
              <div className="text-xs text-muted-foreground mt-3 font-mono flex justify-between">
                <span>$0.00</span>
                <span className="flex items-center gap-2">
                  Balance: 0.00 
                  <button className="text-primary hover:text-primary-foreground hover:bg-primary px-1.5 py-0.5 rounded transition-colors bg-primary/10">MAX</button>
                </span>
              </div>
            </div>

            {/* Reverse Button */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
              <button 
                onClick={handleReverse}
                className="bg-card border-4 border-card bg-secondary hover:bg-primary/20 text-muted-foreground hover:text-primary w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 group"
              >
                <ArrowDown size={20} className="group-hover:rotate-180 transition-transform duration-500" />
              </button>
            </div>

            {/* Destination Token Group */}
            <div className="bg-input/40 border border-transparent rounded-2xl p-4 transition-colors">
              <div className="text-sm text-muted-foreground font-medium mb-3">Token Destino</div>
              <div className="flex justify-between items-center gap-4">
                <input 
                  type="number"
                  placeholder="0.0"
                  disabled
                  value={amount ? (parseFloat(amount) * 0.99).toFixed(4) : ''}
                  className="bg-transparent text-4xl font-mono outline-none w-full text-muted-foreground/50 cursor-not-allowed [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <TokenSelect value={destToken} onChange={setDestToken} />
              </div>
              <div className="text-xs text-muted-foreground mt-3 font-mono flex justify-between">
                <span>$0.00</span>
                <span>Balance: 0.00</span>
              </div>
            </div>
          </div>

          <div className="mt-6 mb-2 flex justify-between text-xs font-mono text-muted-foreground px-3">
            <span className="flex items-center gap-1"><Zap size={12} className="text-primary" /> Routing</span>
            <span>1 {sourceToken} = 0.99 {destToken}</span>
          </div>

          {/* Swap Button */}
          <button 
            onClick={handleSwap}
            className="w-full mt-2 bg-primary text-primary-foreground text-lg font-semibold py-4 rounded-2xl transition-all duration-300 hover:shadow-[0_0_30px_rgba(0,255,200,0.3)] hover:bg-primary/90 active:scale-[0.98] relative overflow-hidden group border border-primary/20 cursor-pointer"
          >
            <span className="relative z-10 flex items-center justify-center gap-2 tracking-wide">
              Swap!
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent w-[50%] -translate-x-[150%] group-hover:animate-shimmer skew-x-[-15deg]" />
          </button>
        </div>
      </div>
      
      {/* Bottom info */}
      <div className="absolute bottom-6 text-xs text-muted-foreground/50 font-mono flex gap-4">
        <span>Audited by NextSec</span>
        <span>•</span>
        <span>Block 1849204</span>
      </div>
    </div>
  );
}

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
