// ─── NV Protocol — Navigation Pub-Sub ────────────────────────────────────────
//
// Lightweight module-level store that lets any component (e.g. NV Agent panel)
// request a top-level navigation change without needing prop drilling.
//
// Usage:
//   // Producer (NVIntelligence.tsx):
//   import { requestNavigation } from '../lib/navigationStore';
//   requestNavigation('bridge');
//
//   // Consumer (App.tsx):
//   import { subscribeNavigation } from '../lib/navigationStore';
//   useEffect(() => subscribeNavigation(view => setActiveView(view)), []);
//
// Rules:
//   • Never stores sensitive data — only a view key string.
//   • The navigation request fires once; App.tsx decides whether to honour it.
//   • Never triggers a transaction, signing, or any financial action.

export type SidebarView = string; // mirror of App.tsx SidebarView — kept loose to avoid coupling

type NavigationListener = (view: SidebarView) => void;
type IntelligenceTab = 'feed' | 'agent' | 'nvnews';
type IntelligenceTabListener = (tab: IntelligenceTab) => void;

const _intelligenceTabListeners = new Set<IntelligenceTabListener>();
let _pendingIntelligenceTab: IntelligenceTab | null = null;

export function requestIntelligenceTab(tab: IntelligenceTab): void {
  _pendingIntelligenceTab = tab;
  for (const fn of _intelligenceTabListeners) fn(tab);
}

export function subscribeIntelligenceTab(fn: IntelligenceTabListener): () => void {
  _intelligenceTabListeners.add(fn);
  if (_pendingIntelligenceTab) {
    const pending = _pendingIntelligenceTab;
    _pendingIntelligenceTab = null;
    fn(pending);
  }
  return () => _intelligenceTabListeners.delete(fn);
}

const _listeners = new Set<NavigationListener>();

/** Request top-level navigation to a named view. */
export function requestNavigation(view: SidebarView): void {
  for (const fn of _listeners) fn(view);
}

/** Subscribe to navigation requests. Returns a cleanup function. */
export function subscribeNavigation(fn: NavigationListener): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}


// ─── NV Agent action execution bridge ───────────────────────────────────────
// Lets the Agent ask App.tsx (the owner of wallet/network transaction state) to
// execute an already-reviewed action without duplicating signing logic.
export interface NVAgentExecutionRequest {
  id: string;
  type: 'transfer' | 'bridge' | 'swap' | 'payment';
  params: Record<string, string | number | null>;
}
export interface NVAgentExecutionResult {
  id: string;
  ok: boolean;
  message: string;
  txHash?: string;
}
type AgentExecutionListener = (request: NVAgentExecutionRequest) => void;
type AgentExecutionResultListener = (result: NVAgentExecutionResult) => void;
const _agentExecutionListeners = new Set<AgentExecutionListener>();
const _agentExecutionResultListeners = new Set<AgentExecutionResultListener>();

export function requestAgentExecution(request: NVAgentExecutionRequest): void {
  for (const fn of _agentExecutionListeners) fn(request);
}
export function subscribeAgentExecution(fn: AgentExecutionListener): () => void {
  _agentExecutionListeners.add(fn);
  return () => _agentExecutionListeners.delete(fn);
}
export function publishAgentExecutionResult(result: NVAgentExecutionResult): void {
  for (const fn of _agentExecutionResultListeners) fn(result);
}
export function subscribeAgentExecutionResult(fn: AgentExecutionResultListener): () => void {
  _agentExecutionResultListeners.add(fn);
  return () => _agentExecutionResultListeners.delete(fn);
}
