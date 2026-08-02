import { motion } from 'framer-motion';
import { Shield, X, ChevronRight } from 'lucide-react';
import { moduleRegistry } from '@/app/registry';
import { useWorkspace } from '@/app/workspace/useWorkspace';
import { useTranslation } from '@/i18n';

interface LeftNavProps {
  onClose?: () => void;
}

/**
 * ─── Left Navigation (Operações) ─────────────────────────────────────────────
 * Renders the moduleRegistry. Every registered module appears automatically.
 * Placeholder modules (comingSoon) trigger the standard modal experience.
 * Fase 0/1 preserves the exact visual identity of the current sidebar.
 */
export function LeftNav({ onClose }: LeftNavProps) {
  const { t } = useTranslation();
  const { activeId, openModule } = useWorkspace();

  const modules = moduleRegistry.getAll();

  return (
    <div className="flex flex-col h-full">
      {/* Brand header — identical to current sidebar */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-border/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center relative animate-shield-glow shrink-0">
            <div className="absolute inset-0 rounded-lg bg-primary/15 blur-md opacity-40" />
            <Shield size={15} className="text-primary relative z-10" />
          </div>
          <div>
            <div className="text-[13px] font-bold tracking-[0.18em] text-foreground leading-none">{t('app.name')}</div>
            <div className="text-[9px] text-primary font-mono tracking-widest mt-0.5 opacity-60">{t('app.tagline')}</div>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer lg:hidden">
            <X size={15} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 flex flex-col gap-0.5 overflow-y-auto">
        <div className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/40 px-3 py-2 mt-1">
          {t('nav.menu')}
        </div>
        {modules.map(({ id, labelKey, icon: Icon, comingSoon }) => {
          const active = activeId === id;
          return (
            <button
              key={id}
              onClick={() => openModule(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer group relative ${
                active
                  ? 'bg-primary/8 text-primary border border-primary/12 shadow-[0_0_12px_rgba(0,229,188,0.06)]'
                  : 'text-muted-foreground hover:bg-secondary/80 hover:text-foreground'
              }`}
            >
              {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r-full" />}
              <Icon size={15} className={`shrink-0 transition-colors ${active ? 'text-primary' : 'text-muted-foreground/60 group-hover:text-foreground'}`} />
              <span className="flex-1 text-left">{t(labelKey)}</span>
              {comingSoon && (
                <span className="text-[8px] font-mono bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded-full border border-amber-500/20 shrink-0">
                  {t('nav.comingSoon')}
                </span>
              )}
              {active && <ChevronRight size={12} className="text-primary/40" />}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border/40">
        <div className="text-[9px] font-mono text-muted-foreground/30 text-center leading-relaxed">
          Audited by NextSec<br />Block 1849204
        </div>
      </div>
    </div>
  );
}

