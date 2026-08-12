import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Database, TrendingUp, Plus, RefreshCw, Loader as Loader2 } from 'lucide-react';
import { type Eip1193Provider, type PoolInfo, getPools } from '../lib/arc';
import { useI18n, useFormat } from '../i18n';

interface PoolsViewProps {
  provider: Eip1193Provider | null;
  connectedAddress: string | null;
  onAddLiquidity: () => void;
}

const nvCard = "w-full rounded-2xl border border-white/[0.06] bg-card/90 backdrop-blur-xl shadow-[0_4px_24px_rgba(0,0,0,0.3)] hover:border-primary/15 transition-all duration-300";

export function PoolsView({ provider, connectedAddress, onAddLiquidity }: PoolsViewProps) {
  const { t } = useI18n();
  const fmt = useFormat();
  const [pools, setPools] = useState<PoolInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const loadPools = useCallback(async () => {
    try {
      const data = await getPools(provider, connectedAddress);
      if (!mounted.current) return;
      setPools(data);
    } catch {
      if (!mounted.current) return;
      setPools([]);
    } finally {
      if (!mounted.current) return;
      setLoading(false);
      setRefreshing(false);
    }
  }, [provider, connectedAddress]);

  useEffect(() => {
    loadPools();
  }, [loadPools]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadPools();
  };

  const totalTvl = pools.reduce((sum, p) => sum + p.tvl, 0);

  return (
    <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }}
      className={nvCard}>
      <div className="p-5">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/20 to-transparent mb-5 -mt-1" />

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Database size={16} className="text-primary" />
            <h2 className="text-base font-semibold text-foreground tracking-wide">{t('pools.title')}</h2>
          </div>
          <button onClick={handleRefresh} disabled={refreshing}
            className="p-2 rounded-xl hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-40">
            {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-primary/60" />
          </div>
        ) : (
          <>
            <div className="bg-secondary/30 rounded-xl p-4 mb-4 border border-border/30">
              <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/50 mb-1">{t('pools.totalTvl')}</div>
              <div className="text-2xl font-mono font-semibold text-foreground">
                {fmt.currency(totalTvl, 'USD', 0)}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {pools.map((pool, i) => (
                <motion.div key={pool.pair}
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                  className="bg-secondary/25 hover:bg-secondary/40 rounded-xl p-4 border border-border/30 hover:border-primary/10 transition-all duration-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-mono font-medium text-foreground" translate="no">{pool.pair}</span>
                    <span className="text-xs font-mono text-emerald-400 bg-emerald-500/8 px-2 py-0.5 rounded-full border border-emerald-500/15">
                      {pool.apr.toFixed(1)}% APR
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="text-muted-foreground/60">
                      {t('pools.reserveA')}: <span className="text-foreground/80">{fmt.number(pool.reserveA, 0)}</span>
                    </div>
                    <div className="text-muted-foreground/60">
                      {t('pools.reserveB')}: <span className="text-foreground/80">{fmt.number(pool.reserveB, 2)}</span>
                    </div>
                    <div className="text-muted-foreground/60 col-span-2">
                      {t('dash.tvl')}: <span className="text-primary">{fmt.currency(pool.tvl, 'USD', 0)}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <button onClick={onAddLiquidity}
              className="w-full mt-4 flex items-center justify-center gap-2 bg-primary/8 hover:bg-primary/12 border border-primary/20 text-primary font-semibold py-3 rounded-2xl transition-all duration-200 cursor-pointer">
              <Plus size={16} /> {t('action.addLiquidity')}
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}
