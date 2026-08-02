import { motion } from 'framer-motion';
import { Construction, X } from 'lucide-react';
import { useTranslation } from '@/i18n';

interface ModulePlaceholderProps {
  moduleLabel?: string;
  /** Render as a full-page placeholder (workspace) or a modal */
  mode?: 'page' | 'modal';
  onClose?: () => void;
}

/**
 * Standard "Em breve" placeholder. Used by Bridge, History, Gamification,
 * Settings and any future module not yet implemented — preserving the module
 * architecture while the feature is developed.
 */
export function ModulePlaceholder({ moduleLabel, mode = 'page', onClose }: ModulePlaceholderProps) {
  const { t } = useTranslation();

  if (mode === 'modal') {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/88 backdrop-blur-lg">
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          className="relative w-full max-w-md bg-card border border-border/60 rounded-2xl overflow-hidden"
        >
          <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-secondary cursor-pointer z-10">
            <X size={18} />
          </button>
          <div className="p-8 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center mb-5">
              <Construction size={28} className="text-amber-400" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">{t('comingSoon.title')}</h2>
            {moduleLabel && (
              <span className="text-xs font-mono text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20 mb-4">
                {moduleLabel}
              </span>
            )}
            <p className="text-sm text-muted-foreground/70 leading-relaxed max-w-xs">{t('comingSoon.description')}</p>
            <button onClick={onClose} className="mt-6 px-6 py-2.5 bg-secondary/80 hover:bg-secondary border border-border/50 hover:border-primary/20 text-foreground font-semibold rounded-xl transition-all duration-200 cursor-pointer">
              {t('comingSoon.ok')}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, duration: 0.4 }}
      className="w-full rounded-2xl border border-white/[0.06] bg-card/90 backdrop-blur-xl shadow-[0_4px_24px_rgba(0,0,0,0.3)]"
    >
      <div className="p-10 flex flex-col items-center text-center">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/20 to-transparent mb-8 -mt-2" />
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center mb-4">
          <Construction size={28} className="text-amber-400" />
        </div>
        <h2 className="text-lg font-semibold text-foreground mb-2">{t('comingSoon.title')}</h2>
        {moduleLabel && (
          <span className="text-xs font-mono text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20 mb-4">{moduleLabel}</span>
        )}
        <p className="text-sm text-muted-foreground/60 max-w-sm">{t('comingSoon.description')}</p>
      </div>
    </motion.div>
  );
}

