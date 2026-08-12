import { motion } from 'framer-motion';
import { Droplets, Brain, Flame, Clock, Route } from 'lucide-react';
import { useI18n } from '../i18n';

interface SimAdvancedMetricsProps {
  simProgress: number;
  simPhase: 'pipeline' | 'complete';
  activeNetworkName: string;
}

interface MetricDef {
  label: string;
  value: string;
  Icon: typeof Droplets;
  color: string;
  /** Animated bar fraction (0–1); undefined = no bar */
  bar?: number;
}

/**
 * Extra "advanced" metrics shown in the simulation modal:
 * Liquidity Score, AI Confidence, Estimated Gas, Estimated Time, Route Selected.
 * Values are derived deterministically from the simulation progress so the
 * motion feels live without changing the existing sim engine.
 */
export function SimAdvancedMetrics({ simProgress, simPhase, activeNetworkName }: SimAdvancedMetricsProps) {
  const { t } = useI18n();
  const p = simProgress / 100;
  const liquidityScore = Math.round(72 + 24 * p);
  const aiConfidence = Math.round(64 + 33 * p);
  const estGasUsd = (0.42 + 1.6 * (1 - p)).toFixed(2);
  const estTimeSec = Math.max(0, Math.round((1 - p) * 9.7 * 10) / 10);
  const routeSelected = simPhase === 'complete' || p > 0.7 ? `${activeNetworkName} v2` : t('sim.adv.calculating');

  const metrics: MetricDef[] = [
    { label: t('sim.adv.liquidityScore'), value: `${liquidityScore}/100`, Icon: Droplets, color: 'text-cyan-400', bar: liquidityScore / 100 },
    { label: t('sim.adv.aiConfidence'), value: `${aiConfidence}%`, Icon: Brain, color: 'text-violet-400', bar: aiConfidence / 100 },
    { label: t('sim.adv.estimatedGas'), value: `${estGasUsd}`, Icon: Flame, color: 'text-orange-400' },
    { label: t('sim.adv.estimatedTime'), value: simPhase === 'complete' ? '0s' : `${estTimeSec}s`, Icon: Clock, color: 'text-primary' },
    { label: t('sim.adv.routeSelected'), value: routeSelected, Icon: Route, color: 'text-emerald-400' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="px-6 pb-6 pt-4 border-t border-border/40"
    >
      <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/50 mb-3">
        {t('sim.advancedMetrics')}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {metrics.map(({ label, value, Icon, color, bar }) => (
          <motion.div
            key={label}
            animate={
              simPhase === 'pipeline'
                ? { borderColor: ['rgba(255,255,255,0.08)', 'rgba(0,229,188,0.12)', 'rgba(255,255,255,0.08)'] }
                : {}
            }
            transition={{ duration: 2, repeat: Infinity, delay: Math.random() * 1.2 }}
            className="bg-secondary/30 border border-border/30 rounded-xl p-3 flex flex-col gap-1.5 transition-all duration-300"
          >
            <div className="flex items-center gap-1.5">
              <Icon size={11} className={color} />
              <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/50 truncate">{label}</span>
            </div>
            <div className={`text-sm font-mono font-bold ${color} tabular-nums truncate`}>{value}</div>
            {bar !== undefined && (
              <div className="h-1 bg-secondary rounded-full overflow-hidden mt-0.5">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: 'currentColor' }}
                  animate={{ width: `${Math.round(bar * 100)}%` }}
                  transition={{ ease: 'easeOut', duration: 0.6 }}
                />
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
