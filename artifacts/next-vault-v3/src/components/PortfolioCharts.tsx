import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, PieChart, Pie, Cell,
  BarChart, Bar, LineChart, Line,
  ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { TrendingUp, ChartPie as PieIcon, ChartBar as BarChart2, Activity } from 'lucide-react';

// ─── Portfolio Evolution (Area) — 30-day richer dataset ───────────────────────

function genEvolutionData() {
  const days = Array.from({ length: 30 }, (_, i) => `D${i + 1}`);
  let base = 43200;
  return days.map(d => {
    base += (Math.random() - 0.42) * 1400;
    return { day: d, value: Math.round(base), benchmark: Math.round(base * 0.94 + Math.random() * 800) };
  });
}

function EvolutionChart() {
  const [data, setData] = useState(genEvolutionData);

  useEffect(() => {
    const iv = setInterval(() => setData(genEvolutionData()), 8000);
    return () => clearInterval(iv);
  }, []);

  const totalChange = data.length > 1 ? data[data.length - 1].value - data[0].value : 0;
  const pctChange = data.length > 1 ? ((totalChange / data[0].value) * 100).toFixed(2) : '0';

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[9px] font-mono text-muted-foreground/40">30 dias · Patrimônio vs Benchmark</span>
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
            formatter={(v: number, n: string) => [`$${v.toLocaleString()}`, n === 'value' ? 'Patrimônio' : 'Benchmark']}
          />
          <Area type="monotone" dataKey="benchmark" stroke="rgb(100,116,139)" strokeWidth={1} strokeDasharray="4 4" fill="url(#benchGrad)" />
          <Area type="monotone" dataKey="value" stroke="rgb(0,229,188)" strokeWidth={2} fill="url(#evolGrad)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Allocation (Donut) ───────────────────────────────────────────────────────

const ALLOCATION = [
  { name: 'USDC',  value: 5420,  color: '#2775CA' },
  { name: 'EURC',  value: 3200,  color: '#003399' },
  { name: 'ETH',   value: 40110, color: '#627EEA' },
];

function AllocationChart() {
  const total = ALLOCATION.reduce((s, a) => s + a.value, 0);
  return (
    <div className="w-full">
      <div className="relative" style={{ height: 150 }}>
        <ResponsiveContainer width="100%" height={150}>
          <PieChart>
            <Pie
              data={ALLOCATION}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={38}
              outerRadius={56}
              paddingAngle={3}
              stroke="none"
              isAnimationActive
              animationDuration={600}
            >
              {ALLOCATION.map(a => <Cell key={a.name} fill={a.color} />)}
            </Pie>
            <Tooltip
              contentStyle={{ background: 'hsl(220 20% 6%)', border: '1px solid hsl(220 20% 14%)', borderRadius: 12, fontSize: 11, fontFamily: 'monospace' }}
              formatter={(v: number, n: string) => [`$${v.toLocaleString()} (${((v / total) * 100).toFixed(1)}%)`, n]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[8px] font-mono uppercase text-muted-foreground/40 tracking-widest">Total</span>
          <span className="text-sm font-mono font-bold text-foreground">${(total / 1000).toFixed(1)}k</span>
        </div>
      </div>
      <div className="flex items-center justify-center gap-3 mt-2">
        {ALLOCATION.map(a => (
          <div key={a.name} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: a.color }} />
            <span className="text-[9px] font-mono text-muted-foreground/60">{a.name}</span>
            <span className="text-[9px] font-mono text-muted-foreground/40">{((a.value / total) * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Performance (Bars) — strategy comparison ─────────────────────────────────

function genPerfData() {
  const labels = ['Swap', 'Pool', 'Yield', 'Route', 'Hedge', 'Arb'];
  return labels.map(l => ({ name: l, roi: +(Math.random() * 14 - 2).toFixed(2), benchmark: +(Math.random() * 8 - 1).toFixed(2) }));
}

function PerformanceChart() {
  const [data, setData] = useState(genPerfData);

  useEffect(() => {
    const iv = setInterval(() => setData(genPerfData()), 6000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[9px] font-mono text-muted-foreground/40">ROI por estratégia (24h)</span>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-[9px] font-mono text-primary"><div className="w-1.5 h-1.5 rounded-sm bg-primary" />NV</span>
          <span className="flex items-center gap-1 text-[9px] font-mono text-muted-foreground/40"><div className="w-1.5 h-1.5 rounded-sm bg-slate-500" />Market</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={150}>
        <BarChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 6" stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 9, fontFamily: 'monospace', fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 9, fontFamily: 'monospace', fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} width={36} tickFormatter={v => `${v}%`} />
          <Tooltip
            contentStyle={{ background: 'hsl(220 20% 6%)', border: '1px solid hsl(220 20% 14%)', borderRadius: 12, fontSize: 11, fontFamily: 'monospace' }}
            formatter={(v: number) => [`${v}%`, 'ROI']}
            cursor={{ fill: 'rgba(0,229,188,0.05)' }}
          />
          <Bar dataKey="benchmark" radius={[3, 3, 0, 0]} fill="rgb(100,116,139)" barSize={10} />
          <Bar dataKey="roi" radius={[4, 4, 0, 0]} barSize={10}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.roi >= 0 ? 'rgb(0,229,188)' : 'rgb(248,113,113)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Indicators line chart (RSI / Momentum) ───────────────────────────────────

function genIndicatorData() {
  return Array.from({ length: 20 }, (_, i) => ({
    time: `T${i + 1}`,
    rsi: Math.round(30 + Math.random() * 50),
    momentum: +(Math.random() * 100 - 50).toFixed(1),
  }));
}

function IndicatorChart() {
  const [data, setData] = useState(genIndicatorData);

  useEffect(() => {
    const iv = setInterval(() => setData(genIndicatorData()), 5000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[9px] font-mono text-muted-foreground/40">RSI & Momentum (20 ticks)</span>
        <span className="flex items-center gap-1 text-[9px] font-mono text-primary">
          <Activity size={9} /> Live
        </span>
      </div>
      <ResponsiveContainer width="100%" height={150}>
        <LineChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 6" stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis dataKey="time" tick={{ fontSize: 8, fontFamily: 'monospace', fill: 'rgba(255,255,255,0.25)' }} axisLine={false} tickLine={false} interval={3} />
          <YAxis tick={{ fontSize: 8, fontFamily: 'monospace', fill: 'rgba(255,255,255,0.25)' }} axisLine={false} tickLine={false} width={32} />
          <Tooltip
            contentStyle={{ background: 'hsl(220 20% 6%)', border: '1px solid hsl(220 20% 14%)', borderRadius: 12, fontSize: 11, fontFamily: 'monospace' }}
          />
          <Line type="monotone" dataKey="rsi" stroke="rgb(0,229,188)" strokeWidth={1.8} dot={false} />
          <Line type="monotone" dataKey="momentum" stroke="rgb(167,139,250)" strokeWidth={1.5} dot={false} strokeDasharray="3 3" />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex items-center justify-center gap-4 mt-2">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 rounded bg-primary" />
          <span className="text-[9px] font-mono text-muted-foreground/60">RSI</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 rounded bg-violet-400" style={{ borderTop: '1px dashed' }} />
          <span className="text-[9px] font-mono text-muted-foreground/60">Momentum</span>
        </div>
      </div>
    </div>
  );
}

// ─── Exported component ───────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'evolution',   label: 'Evolução',     Icon: TrendingUp },
  { id: 'allocation',  label: 'Alocação',     Icon: PieIcon },
  { id: 'performance', label: 'Performance',  Icon: BarChart2 },
  { id: 'indicators',  label: 'Indicadores',  Icon: Activity },
] as const;

export function PortfolioCharts() {
  const [active, setActive] = useState<typeof SECTIONS[number]['id']>('evolution');

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
          {SECTIONS.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setActive(id)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[10px] font-mono font-medium transition-all cursor-pointer whitespace-nowrap ${
                active === id ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
              }`}>
              <Icon size={11} />
              <span>{label}</span>
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
