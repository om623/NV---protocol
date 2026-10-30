export type NVAgentMode = 'assisted' | 'authorized' | null;

export interface NVAgentAutomationPreference {
  preferredNetwork?: string;
  preferredToken?: string;
  lastActionType?: 'swap' | 'bridge' | 'transfer' | 'payment';
  updatedAt: number;
}

export interface NVAgentIntentMemory {
  id: string;
  text: string;
  normalizedText?: string;
  mode: NVAgentMode;
  createdAt: number;
}

const MODE_KEY = 'nv-agent-mode-v1';
const INTENTS_KEY = 'nv-agent-intents-v1';
const MAX_INTENTS = 100;
const PREFS_KEY = 'nv-agent-automation-prefs-v1';

function canStore(): boolean {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}

export function getNVAgentMode(): NVAgentMode {
  if (!canStore()) return null;
  const value = window.localStorage.getItem(MODE_KEY);
  return value === 'assisted' || value === 'authorized' ? value : null;
}

export function setNVAgentMode(mode: NVAgentMode): void {
  if (!canStore()) return;
  if (mode) window.localStorage.setItem(MODE_KEY, mode);
  else window.localStorage.removeItem(MODE_KEY);
}

export function getNVAgentIntentMemory(): NVAgentIntentMemory[] {
  if (!canStore()) return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(INTENTS_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is NVAgentIntentMemory =>
      Boolean(item) && typeof item.text === 'string' && typeof item.createdAt === 'number'
    ).slice(-MAX_INTENTS);
  } catch {
    return [];
  }
}

export function rememberNVAgentIntent(input: Omit<NVAgentIntentMemory, 'id' | 'createdAt'>): void {
  if (!canStore()) return;
  const history = getNVAgentIntentMemory();
  history.push({
    ...input,
    id: `intent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  });
  window.localStorage.setItem(INTENTS_KEY, JSON.stringify(history.slice(-MAX_INTENTS)));
}

export const NV_AGENT_INTENT_MEMORY_LIMIT = MAX_INTENTS;


export function getNVAgentAutomationPreferences(): NVAgentAutomationPreference {
  if (!canStore()) return { updatedAt: 0 };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PREFS_KEY) ?? '{}');
    if (!parsed || typeof parsed !== 'object') return { updatedAt: 0 };
    return {
      ...(typeof parsed.preferredNetwork === 'string' ? { preferredNetwork: parsed.preferredNetwork } : {}),
      ...(typeof parsed.preferredToken === 'string' ? { preferredToken: parsed.preferredToken } : {}),
      ...( ['swap','bridge','transfer','payment'].includes(parsed.lastActionType) ? { lastActionType: parsed.lastActionType } : {}),
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
    };
  } catch {
    return { updatedAt: 0 };
  }
}

export function rememberNVAgentAutomationPreferences(patch: Partial<Omit<NVAgentAutomationPreference,'updatedAt'>>): void {
  if (!canStore()) return;
  const current = getNVAgentAutomationPreferences();
  window.localStorage.setItem(PREFS_KEY, JSON.stringify({ ...current, ...patch, updatedAt: Date.now() }));
}

export function clearNVAgentAutomationPreferences(): void {
  if (!canStore()) return;
  window.localStorage.removeItem(PREFS_KEY);
}
