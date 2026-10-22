// ─── NV Protocol — Navigation Pub-Sub ────────────────────────────────────────
// Navigation requests can carry a non-sensitive, user-authored action draft.
// They never contain signing material and never execute a transaction.

export type SidebarView = string;
export type AgentNavigationParams = Record<string, string | number | null>;
export interface AgentNavigationRequest {
  view: SidebarView;
  params?: AgentNavigationParams;
  createdAt: number;
}
type NavigationListener = (view: SidebarView, params?: AgentNavigationParams) => void;
type RequestListener = (request: AgentNavigationRequest) => void;
const _listeners = new Set<NavigationListener>();
const _requestListeners = new Set<RequestListener>();
let _pendingRequest: AgentNavigationRequest | null = null;

export function requestNavigation(view: SidebarView, params?: AgentNavigationParams): void {
  const request: AgentNavigationRequest = { view, params, createdAt: Date.now() };
  _pendingRequest = request;
  for (const fn of _listeners) fn(view, params);
  for (const fn of _requestListeners) fn(request);
}

export function subscribeNavigation(fn: NavigationListener): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

export function subscribeNavigationRequest(fn: RequestListener): () => void {
  _requestListeners.add(fn);
  return () => _requestListeners.delete(fn);
}

/** Consume a draft only when the matching form is opened. */
export function consumeNavigationRequest(view: SidebarView): AgentNavigationRequest | null {
  if (!_pendingRequest || _pendingRequest.view !== view) return null;
  const request = _pendingRequest;
  _pendingRequest = null;
  return request;
}
