import React, { Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { moduleRegistry } from '@/app/registry';
import { categoryRegistry } from '@/app/registry';
import { useWorkspace } from './useWorkspace';

/**
 * ─── Module Router ────────────────────────────────────────────────────────────
 * Renders exactly ONE module in the central workspace at a time.
 * Modules are lazy-loaded (code-split). Category panels (Fase 2) are rendered
 * through the same mechanism via the category registry.
 */
function FallbackLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 size={24} className="animate-spin text-primary/60" />
    </div>
  );
}

function CategoryPanel({ categoryId }: { categoryId: string }) {
  const category = categoryRegistry.get(categoryId);
  if (!category) return null;
  const Panel = category.panel;
  if (!Panel) {
    // Fase 0/1: category panels are structural; rendered in Fase 2.
    return null;
  }
  return (
    <Suspense fallback={<FallbackLoader />}>
      <Panel categoryId={categoryId} />
    </Suspense>
  );
}

export function ModuleRouter() {
  const { kind, activeId } = useWorkspace();
  const isModule = kind === 'module';
  const moduleDef = isModule ? moduleRegistry.get(activeId ?? '') : undefined;
  const ActiveComponent = moduleDef?.component;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`${kind}-${activeId ?? 'none'}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="flex-1 min-w-0"
      >
        {!isModule ? (
          <CategoryPanel categoryId={activeId ?? ''} />
        ) : ActiveComponent ? (
          <Suspense fallback={<FallbackLoader />}>
            <ActiveComponent />
          </Suspense>
        ) : (
          <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground/50 text-sm font-mono">
            Módulo não encontrado.
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

