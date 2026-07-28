import { motion, AnimatePresence } from 'framer-motion';
import { Construction, X } from 'lucide-react';

interface ComingSoonModalProps {
  open: boolean;
  onClose: () => void;
  featureName?: string;
}

export function ComingSoonModal({ open, onClose, featureName }: ComingSoonModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/88 backdrop-blur-lg"
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md bg-card border border-border/60 rounded-2xl shadow-[0_0_60px_rgba(0,229,188,0.06)] overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-secondary cursor-pointer z-10"
            >
              <X size={18} />
            </button>

            <div className="p-8 flex flex-col items-center text-center">
              <motion.div
                initial={{ scale: 0, rotate: -15 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.08 }}
                className="w-16 h-16 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center mb-5 relative"
              >
                <div className="absolute inset-0 rounded-2xl bg-amber-500/5 blur-lg" />
                <Construction size={28} className="text-amber-400 relative z-10" />
              </motion.div>

              <h2 className="text-xl font-bold text-foreground mb-2">Em breve</h2>
              {featureName && (
                <span className="text-xs font-mono text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20 mb-4">
                  {featureName}
                </span>
              )}
              <p className="text-sm text-muted-foreground/70 leading-relaxed max-w-xs">
                Esta funcionalidade esta em desenvolvimento e estara disponivel em uma futura atualizacao do NV Protocol.
              </p>

              <button
                onClick={onClose}
                className="mt-6 px-6 py-2.5 bg-secondary/80 hover:bg-secondary border border-border/50 hover:border-primary/20 text-foreground font-semibold rounded-xl transition-all duration-200 cursor-pointer"
              >
                Entendi
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
