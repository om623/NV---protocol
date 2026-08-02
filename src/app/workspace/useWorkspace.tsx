import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';

/**
 * ─── Workspace state ──────────────────────────────────────────────────────────
 * Tracks which module is active in the central workspace. One module at a time.
 * The active module id maps to the moduleRegistry; the ModuleRouter renders it.
 */
export type WorkspaceKind = 'module' | 'category';

export interface WorkspaceState {
  kind: WorkspaceKind;
  /** Active module id (from moduleRegistry) or category id (from categoryRegistry) */
  activeId: string | null;
}

interface WorkspaceContextValue extends WorkspaceState {
  openModule: (moduleId: string) => void;
  openCategory: (categoryId: string) => void;
  close: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WorkspaceState>({
    kind: 'module',
    activeId: 'dashboard',
  });

  const openModule = useCallback((moduleId: string) => {
    setState({ kind: 'module', activeId: moduleId });
  }, []);

  const openCategory = useCallback((categoryId: string) => {
    setState({ kind: 'category', activeId: categoryId });
  }, []);

  const close = useCallback(() => {
    setState({ kind: 'module', activeId: 'dashboard' });
  }, []);

  const value = useMemo<WorkspaceContextValue>(
    () => ({ ...state, openModule, openCategory, close }),
    [state, openModule, openCategory, close],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within <WorkspaceProvider>');
  return ctx;
}

