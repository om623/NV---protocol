import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, PieChart, Pie, Cell,
  BarChart, Bar,
  ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { TrendingUp, ChartPie as PieIcon, ChartBar as BarChart2, Activity } from 'lucide-react';
import { fetchPriceChart, fetchCryptoPrices, fetchGlobalMarket, fetchFearGreed, fetchChainTvl } from '../lib/api';
import { useI18n } from '../i18n';

// ─── Portfolio Evolution (Area) — real 30-day ETH price from CoinGecko ────────

interface EvolPoint { day: string; value: number; benchmark: number; }

function EvolutionChart() {
  const { t } = useI18n();
  const [data, setData] = useState<EvolPoint[]>([]);

  useEffect(() => {
    let alive = true;
    fetchPriceChart('ethereum', 30).then(prices => {
      if (!alive || prices.length < 2) return;
      const start = prices[0].v;
      setData(prices.map((p, i) => ({ day: `D${i + 1}`, value: Math.round(p.v), benchmark: Math.round(start) })));
    }).catch(() => {});
    const iv = setInterval(() => {
      fetchPriceChart('ethereum', 30).then(prices => {
        if (!alive || prices.length < 2) return;
        const start = prices[0].v;
        setData(prices.map((p, i) => ({ day: `D${i + 1}`, value: Math.round(p.v), benchmark: Math.round(start) })));
      }).catch(() => {});
    }, 60000);
    return () => { alive = false; clearInterval(iv); };
  }, []);

  const totalChange = data.length > 1 ? data[data.length - 1].value - data[0].value : 0;
  const pctChange = data.length > 1 ? ((totalChange / data[0].value) * 100).toFixed(2) : '0';

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[9px] font-mono text-muted-foreground/40">{t('portfolio.30daysBenchmark')}</span>
        <span className={`text-[10px] font-mono font-bold ${totalChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {totalChange >= 0 ? '+' : ''}{pctChange}%
        </span>
      </div>
      <ResponsiveContainer width="100%" height={150}>
        <AreaChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="evolGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(0,229,188)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="rgb(0,229,188)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="benchGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(100,116,139)" stopOpacity={0.12} />
              <stop offset="100%" stopColor="rgb(100,116,139)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 6" stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis dataKey="day" tick={{ fontSize: 8, fontFamily: 'monospace', fill: 'rgba(255,255,255,0.25)' }} axisLine={false} tickLine={false} interval={4} />
          <YAxis tick={{ fontSize: 8, fontFamily: 'monospace', fill: 'rgba(255,255,255,0.25)' }} axisLine={false} tickLine={false} width={38} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
          <Tooltip
            contentStyle={{ background: 'hsl(220 20% 6%)', border: '1px solid hsl(220 20% 14%)', borderRadius: 12, fontSize: 11, fontFamily: 'monospace' }}
            labelStyle={{ color: 'rgba(255,255,255,0.5)' }}
            formatter={(v: number, n: string) => [`${v.toLocaleString()}`, n === 'value' ? t('portfolio.evolution') : 'Benchmark']}
          />
          <Area type="monotone" dataKey="benchmark" stroke="rgb(100,116,139)" strokeWidth={1} strokeDasharray="4 4" fill="url(#benchGrad)" />
          <Area type="monotone" dataKey="value" stroke="rgb(0,229,188)" strokeWidth={2} fill="url(#evolGrad)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Allocation — real crypto market-cap composition ────────────────────────

function AllocationChart() {
  const [data, setData] = useState<{name:string;value:number;color:string}[]>([]);
  useEffect(() => { let alive=true; const load=()=>fetchCryptoPrices().then(m=>{if(!alive)return; const colors=['#F7931A','#627EEA','#14F195','#2775CA']; setData(['BTC','ETH','SOL','USDC'].map((name,i)=>({name,value:m.get(name)?.market_cap||0,color:colors[i]})).filter(x=>x.value>0));}); load(); const iv=setInterval(load,60000); return()=>{alive=false;clearInterval(iv)};},[]);
  const total=data.reduce((s,a)=>s+a.value,0);
  if(!total) return <div className="h-[180px] flex items-center justify-center text-[10px] font-mono text-muted-foreground/50">Loading real market allocation…</div>;
  return <div className="w-full"><div className="relative h-[150px]"><ResponsiveContainer width="100%" height={150}><PieChart><Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={38} outerRadius={56} paddingAngle={3} stroke="none">{data.map(a=><Cell key={a.name} fill={a.color}/>)}</Pie><Tooltip formatter={(v:number,n:string)=>[`$${(v/1e9).toFixed(1)}B (${((v/total)*100).toFixed(1)}%)`,n]}/></PieChart></ResponsiveContainer><div className="absolute inset-0 flex items-center justify-center pointer-events-none text-[9px] font-mono text-muted-foreground/50">MARKET CAP</div></div><div className="flex justify-center gap-3">{data.map(a=><span key={a.name} className="text-[9px] font-mono text-muted-foreground/60">{a.name} {((a.value/total)*100).toFixed(0)}%</span>)}</div></div>;
}

// ─── Performance — real 24h market performance ───────────────────────────────
function PerformanceChart(){const [data,setData]=useState<{name:string;change:number}[]>([]);useEffect(()=>{let alive=true;const load=()=>fetchCryptoPrices().then(m=>{if(alive)setData(['BTC','ETH','SOL','LINK','AAVE','ARB'].map(name=>({name,change:m.get(name)?.price_change_percentage_24h||0})))});load();const iv=setInterval(load,60000);return()=>{alive=false;clearInterval(iv)}},[]);return <ResponsiveContainer width="100%" height={180}><BarChart data={data}><CartesianGrid strokeDasharray="3 6" stroke="rgba(255,255,255,0.04)" vertical={false}/><XAxis dataKey="name" tick={{fontSize:9}} axisLine={false}/><YAxis tick={{fontSize:8}} axisLine={false} tickFormatter={v=>`${v}%`}/><Tooltip formatter={(v:number)=>[`${v.toFixed(2)}%`,'24h']}/><Bar dataKey="change" radius={[4,4,0,0]}>{data.map((d,i)=><Cell key={i} fill={d.change>=0?'rgb(0,229,188)':'rgb(248,113,113)'}/>)}</Bar></BarChart></ResponsiveContainer>}

// ─── Indicators — real global market indicators ──────────────────────────────
function IndicatorChart(){const [d,setD]=useState<{btc:number;eth:number;mcap:number;fg:number;fgLabel:string;tvl:number}|null>(null);useEffect(()=>{let alive=true;const load=()=>Promise.all([fetchGlobalMarket(),fetchFearGreed(),fetchChainTvl()]).then(([g,f,chains])=>{if(alive&&g)setD({btc:g.btcDominance,eth:g.ethDominance,mcap:g.marketCapChange24h,fg:f?.value||0,fgLabel:f?.classification||'—',tvl:chains.reduce((s,x)=>s+(x.tvl||0),0)})});load();const iv=setInterval(load,120000);return()=>{alive=false;clearInterval(iv)}},[]);if(!d)return <div className="h-[180px] flex items-center justify-center text-[10px] font-mono text-muted-foreground/50">Loading real indicators…</div>;const rows=[['BTC Dominance',`${d.btc.toFixed(1)}%`],['ETH Dominance',`${d.eth.toFixed(1)}%`],['Market Cap 24h',`${d.mcap>=0?'+':''}${d.mcap.toFixed(2)}%`],['Fear & Greed',`${d.fg} · ${d.fgLabel}`],['DeFi TVL',`$${(d.tvl/1e9).toFixed(1)}B`]];return <div className="grid grid-cols-2 gap-2 min-h-[180px] content-center">{rows.map(([k,v])=><div key={k} className="rounded-xl border border-border/30 bg-secondary/20 p-3"><div className="text-[8px] font-mono uppercase text-muted-foreground/45">{k}</div><div className="mt-1 text-sm font-mono font-semibold text-foreground">{v}</div></div>)}</div>}

// ─── Exported component ───────────────────────────────────────────────────────

const SECTIONS_KEYS = [
  { id: 'evolution',   key: 'portfolio.evolution',     Icon: TrendingUp },
  { id: 'allocation',  key: 'portfolio.allocation',    Icon: PieIcon },
  { id: 'performance', key: 'portfolio.performance',   Icon: BarChart2 },
  { id: 'indicators',  key: 'portfolio.indicators',    Icon: Activity },
] as const;

export function PortfolioCharts() {
  const { t } = useI18n();
  const [active, setActive] = useState<typeof SECTIONS_KEYS[number]['id']>('evolution');

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.16, duration: 0.4 }}
      className="w-full rounded-2xl border border-white/[0.06] bg-card/90 backdrop-blur-xl shadow-[0_4px_24px_rgba(0,0,0,0.3)] hover:border-primary/15 transition-all duration-300"
    >
      <div className="p-5">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/15 to-transparent mb-4 -mt-1" />

        {/* Tab switcher */}
        <div className="flex gap-1 bg-secondary/30 rounded-lg p-1 border border-border/30 mb-4 overflow-x-auto scrollbar-hide">
          {SECTIONS_KEYS.map(({ id, key, Icon }) => (
            <button key={id} onClick={() => setActive(id)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[10px] font-mono font-medium transition-all cursor-pointer whitespace-nowrap ${
                active === id ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
              }`}>
              <Icon size={11} />
              <span>{t(key)}</span>
            </button>
          ))}
        </div>

        {/* Chart */}
        <div className="bg-black/20 rounded-xl border border-border/20 p-3">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.25 }}
            >
              {active === 'evolution'   && <EvolutionChart />}
              {active === 'allocation'  && <AllocationChart />}
              {active === 'performance' && <PerformanceChart />}
              {active === 'indicators'  && <IndicatorChart />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
