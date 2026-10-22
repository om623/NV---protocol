// ─── NV Protocol — Navigation Pub-Sub ────────────────────────────────────────
// Navigation requests can carry a non-sensitive, user-authored action draft.
// They never contain signing material and never execute a transaction.

export type SidebarView = string;
export type AgentNavigationParams = Record<string, string | number | null>;
type NavigationListener = (view: SidebarView, params?: AgentNavigationParams) => void;
const _listeners = new Set<NavigationListener>();

export function requestNavigation(view: SidebarView, params?: AgentNavigationParams): void {
  for (const fn of _listeners) fn(view, params);
}

export function subscribeNavigation(fn: NavigationListener): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}
