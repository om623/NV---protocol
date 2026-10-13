// ─── NV Protocol — Bridge State Pub-Sub ──────────────────────────────────────
//
// Lightweight module-level store that mirrors the active bridge step so the
// NV Agent can report live bridge status without being directly wired to the
// executor callback chain.
//
// Pattern mirrors payments.ts — same subscriber set, same reset-to-idle flow.
// Rules:
//   • Never stores wallet keys or private data.
//   • Step strings mirror BridgeStep / SolanaBridgeStep unions from the
//     respective executors — agent treats them as opaque display strings.
//   • Callers (SolanaBridgePanel, BridgeView) must call notifyBridgeStep on
//     each onStep callback — nothing is wired automatically.

import type { AgentBridgeSnapshot } from './agentContext';

export type { AgentBridgeSnapshot };

// ─── Store ────────────────────────────────────────────────────────────────────

let _state: AgentBridgeSnapshot = {
  step: null,
  txHash: null,
  evmTxHash: null,
  error: null,
  fromNetwork: null,
  toNetwork: null,
};

const _listeners = new Set<(s: AgentBridgeSnapshot) => void>();

// ─── Public API ───────────────────────────────────────────────────────────────

export function getBridgeState(): AgentBridgeSnapshot {
  return _state;
}

export function notifyBridgeStep(patch: Partial<AgentBridgeSnapshot>): void {
  _state = { ..._state, ...patch };
  for (const fn of _listeners) fn(_state);
}

export function subscribeBridgeState(
  fn: (s: AgentBridgeSnapshot) => void,
): () => void {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

/**
 * Reset to idle — call when a bridge flow completes (success, failure, or
 * the user navigates away). Callers should delay 5–10 s before resetting
 * so the agent can report the final status.
 */
export function resetBridgeState(): void {
  notifyBridgeStep({
    step: null,
    txHash: null,
    evmTxHash: null,
    error: null,
    fromNetwork: null,
    toNetwork: null,
  });
}
