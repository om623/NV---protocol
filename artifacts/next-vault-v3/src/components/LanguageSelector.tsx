import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { useI18n, LOCALES, type Locale } from '../i18n';

export function LanguageSelector({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = LOCALES.find(l => l.code === locale);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 bg-secondary/50 border border-border rounded-lg text-xs font-mono backdrop-blur-md cursor-pointer hover:bg-secondary transition-colors ${compact ? 'px-2 py-1.5' : 'px-3 py-2'}`}
      >
        <Globe size={14} className="text-muted-foreground" />
        <span className="text-sm leading-none">{current?.flag}</span>
        {!compact && <span className="text-foreground">{current?.label}</span>}
        <ChevronDown size={12} className={`text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full right-0 mt-2 w-44 bg-card border border-border rounded-xl p-2 shadow-2xl z-50"
          >
            <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/40 px-2 py-1.5">{t('settings.selectLanguage')}</div>
            {LOCALES.map(l => (
              <button
                key={l.code}
                onClick={() => { setLocale(l.code as Locale); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors cursor-pointer ${
                  l.code === locale ? 'bg-primary/10 text-primary' : 'hover:bg-secondary text-foreground'
                }`}
              >
                <span className="text-base leading-none">{l.flag}</span>
                <span className="flex-1 text-left text-sm font-medium">{l.label}</span>
                {l.code === locale && <Check size={14} />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
