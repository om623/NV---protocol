import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, PieChart, Pie, Cell,
  BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { TrendingUp, ChartPie as PieIcon, ChartBar as BarChart2 } from 'lucide-react';

// ─── Portfolio Evolution (Area) ───────────────────────────────────────────────

function genEvolutionData() {
  const days = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  let base = 43200;
  return days.map(d => {
    base += (Math.random() - 0.4) * 1200;
    return { day: d, value: Math.round(base) };
  });
}

function EvolutionChart() {
  const [data, setData] = useState(genEvolutionData);

  useEffect(() => {
    const iv = setInterval(() => setData(genEvolutionData()), 8000);
    return () => clearInterval(iv);
  }, []);

  return (
    <ResponsiveContainer width="100%" height={140}>
      <AreaChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="evolGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(0,229,188)" stopOpacity={0.3} />
            <stop offset="100%" stopColor="rgb(0,229,188)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 6" stroke="rgba(255,255,255,0.04)" vertical={false} />
        <XAxis dataKey="day" tick={{ fontSize: 9, fontFamily: 'monospace', fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 9, fontFamily: 'monospace', fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} width={40} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
        <Tooltip
          contentStyle={{ background: 'hsl(220 20% 6%)', border: '1px solid hsl(220 20% 14%)', borderRadius: 12, fontSize: 11, fontFamily: 'monospace' }}
          labelStyle={{ color: 'rgba(255,255,255,0.5)' }}
          formatter={(v: number) => [`$${v.toLocaleString()}`, 'Patrimônio']}
        />
        <Area type="monotone" dataKey="value" stroke="rgb(0,229,188)" strokeWidth={2} fill="url(#evolGrad)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── Allocation (Donut) ───────────────────────────────────────────────────────

const ALLOCATION = [
  { name: 'USDC',  value: 5420,  color: '#2775CA' },
  { name: 'EURC',  value: 3200,  color: '#003399' },
  { name: 'ETH',   value: 40110, color: '#627EEA' },
];

function AllocationChart() {
  return (
    <ResponsiveContainer width="100%" height={140}>
      <PieChart>
        <Pie data={ALLOCATION} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={38} outerRadius={56} paddingAngle={3} stroke="none">
          {ALLOCATION.map(a => <Cell key={a.name} fill={a.color} />)}
        </Pie>
        <Tooltip
          contentStyle={{ background: 'hsl(220 20% 6%)', border: '1px solid hsl(220 20% 14%)', borderRadius: 12, fontSize: 11, fontFamily: 'monospace' }}
          formatter={(v: number, n: string) => [`$${v.toLocaleString()}`, n]}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ─── Performance (Bars) ───────────────────────────────────────────────────────

function genPerfData() {
  const labels = ['Swap', 'Pool', 'Yield', 'Route', 'Hedge'];
  return labels.map(l => ({ name: l, roi: +(Math.random() * 12 - 2).toFixed(2) }));
}

function PerformanceChart() {
  const [data, setData] = useState(genPerfData);

  useEffect(() => {
    const iv = setInterval(() => setData(genPerfData()), 6000);
    return () => clearInterval(iv);
  }, []);

  return (
    <ResponsiveContainer width="100%" height={140}>
      <BarChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 6" stroke="rgba(255,255,255,0.04)" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 9, fontFamily: 'monospace', fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 9, fontFamily: 'monospace', fill: 'rgba(255,255,255,0.3)' }} axisLine={false} tickLine={false} width={36} tickFormatter={v => `${v}%`} />
        <Tooltip
          contentStyle={{ background: 'hsl(220 20% 6%)', border: '1px solid hsl(220 20% 14%)', borderRadius: 12, fontSize: 11, fontFamily: 'monospace' }}
          formatter={(v: number) => [`${v}%`, 'ROI']}
          cursor={{ fill: 'rgba(0,229,188,0.05)' }}
        />
        <Bar dataKey="roi" radius={[4, 4, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.roi >= 0 ? 'rgb(0,229,188)' : 'rgb(248,113,113)'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Exported component ───────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'evolution',   label: 'Evolução Patrimonial', Icon: TrendingUp },
  { id: 'allocation',  label: 'Alocação',             Icon: PieIcon },
  { id: 'performance', label: 'Performance',           Icon: BarChart2 },
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
        <div className="flex gap-1 bg-secondary/30 rounded-lg p-1 border border-border/30 mb-4">
          {SECTIONS.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setActive(id)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[10px] font-mono font-medium transition-all cursor-pointer ${
                active === id ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
              }`}>
              <Icon size={11} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* Chart */}
        <div className="bg-black/20 rounded-xl border border-border/20 p-3">
          {active === 'evolution'   && <EvolutionChart />}
          {active === 'allocation'  && <AllocationChart />}
          {active === 'performance' && <PerformanceChart />}
        </div>

        {/* Legend for allocation */}
        {active === 'allocation' && (
          <div className="flex items-center justify-center gap-4 mt-3">
            {ALLOCATION.map(a => (
              <div key={a.name} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: a.color }} />
                <span className="text-[9px] font-mono text-muted-foreground/60">{a.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
