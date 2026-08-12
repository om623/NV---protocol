import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield } from 'lucide-react';
import { useI18n } from '../i18n';

interface SplashScreenProps {
  onFinish: () => void;
}

export function SplashScreen({ onFinish }: SplashScreenProps) {
  const { t } = useI18n();
  const LOADING_STEPS = [
    t('splash.initializing'),
    t('splash.connectingArc'),
    t('splash.loadingPools'),
    t('splash.syncingMarket'),
    t('splash.calibrating'),
    t('splash.ready'),
  ];
  const [progress, setProgress] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const [exiting, setExiting] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const start = Date.now();
    const DURATION = 3200;

    const progIv = window.setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, (elapsed / DURATION) * 100);
      setProgress(pct);
      const idx = Math.min(LOADING_STEPS.length - 1, Math.floor((pct / 100) * LOADING_STEPS.length));
      setStepIdx(idx);
    }, 40);
    timers.current.push(progIv);

    const exitT = window.setTimeout(() => setExiting(true), DURATION);
    timers.current.push(exitT);

    const finishT = window.setTimeout(onFinish, DURATION + 700);
    timers.current.push(finishT);

    return () => {
      timers.current.forEach(t => window.clearTimeout(t));
      window.clearInterval(progIv);
    };
  }, [onFinish]);

  return (
    <AnimatePresence>
      {!exiting && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background overflow-hidden"
        >
          {/* Ambient glows */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/8 rounded-full blur-[160px] animate-splash-glow" />
          <div className="absolute top-1/4 left-1/4 w-[300px] h-[300px] bg-accent/5 rounded-full blur-[100px]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808009_1px,transparent_1px),linear-gradient(to_bottom,#80808009_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_40%,transparent_100%)]" />

          {/* Logo */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 18, delay: 0.1 }}
            className="relative z-10 flex flex-col items-center"
          >
            <div className="relative mb-6">
              <div className="absolute inset-0 w-20 h-20 rounded-2xl bg-primary/20 blur-2xl animate-splash-pulse" />
              <motion.div
                animate={{ rotateY: [0, 360] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                className="relative w-20 h-20 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center"
                style={{ transformStyle: 'preserve-3d' }}
              >
                <div className="absolute inset-0 rounded-2xl bg-primary/15 blur-md" />
                <Shield size={36} className="text-primary relative z-10" style={{ filter: 'drop-shadow(0 0 12px rgba(0,229,188,0.6))' }} />
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="text-center"
            >
              <h1 className="text-2xl font-bold tracking-[0.3em] text-foreground">NV PROTOCOL</h1>
              <p className="text-[10px] text-primary font-mono tracking-[0.4em] uppercase mt-2 opacity-70">Protocol V3 · DeFi Intelligence</p>
            </motion.div>
          </motion.div>

          {/* Loading section */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.4 }}
            className="relative z-10 w-[280px] mt-10"
          >
            <div className="h-1 w-full bg-secondary/60 rounded-full overflow-hidden mb-3">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-primary via-emerald-400 to-primary bg-[length:200%_100%] animate-gradient-border shadow-[0_0_8px_rgba(0,229,188,0.5)]"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-muted-foreground/60 truncate">
                {LOADING_STEPS[stepIdx]}
              </span>
              <span className="text-[10px] font-mono text-primary font-bold tabular-nums shrink-0 ml-2">
                {Math.round(progress)}%
              </span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            transition={{ delay: 1.2, duration: 0.6 }}
            className="absolute bottom-8 text-[9px] font-mono text-muted-foreground/40 tracking-widest uppercase"
          >
            NextSec · Audited Protocol
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
