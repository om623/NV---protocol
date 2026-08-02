import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu } from 'lucide-react';
import { LeftNav } from './LeftNav';
import { RightIntelligence } from './RightIntelligence';
import { ModuleRouter } from '@/app/workspace/ModuleRouter';
import { WorkspaceProvider } from '@/app/workspace/useWorkspace';
import { useTranslation } from '@/i18n';

/**
 * ─── App Shell ────────────────────────────────────────────────────────────────
 * The 3-zone layout of the NV Protocol:
 *   Left  → Operações (LeftNav from moduleRegistry)
 *   Center→ Workspace (ModuleRouter — one module at a time)
 *   Right → Global Intelligence (RightIntelligence — reserved until Fase 2)
 * A bottom Ticker bar zone is reserved for Fase 3 (renders null today).
 * Fase 0/1: preserves the exact visual identity of the current dashboard.
 */
export function AppShell() {
  const { t } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <WorkspaceProvider>
      <div className="flex min-h-screen bg-background overflow-hidden">
        {/* Ambient background — identical to current */}
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] bg-primary/6 rounded-full blur-[180px] pointer-events-none z-0" />
        <div className="fixed top-1/4 right-1/4 w-[500px] h-[500px] bg-accent/3 rounded-full blur-[120px] pointer-events-none z-0" />
        <div className="fixed inset-0 bg-[linear-gradient(to_right,#80808009_1px,transparent_1px),linear-gradient(to_bottom,#80808009_1px,transparent_1px)] bg-[size:28px_28px] [mask-image:radial-gradient(ellipse_70%_70%_at_50%_50%,#000_60%,transparent_100%)] pointer-events-none z-0" />

        {/* Desktop sidebar */}
        <aside className="hidden lg:flex flex-col w-60 shrink-0 border-r border-border/40 bg-background/95 backdrop-blur-xl min-h-screen z-10 relative">
          <LeftNav />
        </aside>

        {/* Mobile sidebar overlay */}
        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setSidebarOpen(false)}
                className="fixed inset-0 bg-background/70 backdrop-blur-sm z-40 lg:hidden"
              />
              <motion.aside
                initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                className="fixed inset-y-0 left-0 z-50 w-60 flex flex-col border-r border-border/50 bg-background/98 backdrop-blur-xl lg:hidden"
              >
                <LeftNav onClose={() => setSidebarOpen(false)} />
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Main column */}
        <div className="flex-1 flex flex-col min-w-0 relative z-10">
          {/* Header */}
          <header className="sticky top-0 z-30 border-b border-border/40 bg-background/90 backdrop-blur-xl">
            <div className="flex items-center justify-between px-4 py-3 gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden p-2 rounded-xl hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0">
                  <Menu size={18} />
                </button>
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center relative animate-shield-glow shrink-0">
                    <div className="absolute inset-0 rounded-lg bg-primary/15 blur-md opacity-40" />
                    <span className="text-primary relative z-10 text-sm font-bold">🛡️</span>
                  </div>
                  <div className="hidden sm:flex flex-col min-w-0">
                    <span className="text-[13px] font-bold tracking-[0.2em] text-foreground leading-none truncate">{t('app.name')}</span>
                    <span className="text-[9px] text-primary font-mono tracking-widest opacity-60 uppercase mt-0.5">{t('app.tagline')}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* Placeholder for env/network controls — moved into modules in Fase 1 */}
                <span className="text-[10px] font-mono text-muted-foreground/50 hidden sm:inline-flex items-center gap-1.5 px-2 py-1 rounded-full border border-border/40">
                  🧪 Testnet • Arc
                </span>
              </div>
            </div>
          </header>

          {/* Content row */}
          <div className="flex flex-1 overflow-hidden">
            {/* Workspace — one module at a time */}
            <ModuleRouter />

            {/* Right Intelligence — reserved zone until Fase 2 */}
            <RightIntelligence enabled={false} />
          </div>

          {/* Reserved zone: bottom Ticker bar (Fase 3) */}
        </div>
      </div>
    </WorkspaceProvider>
  );
}

