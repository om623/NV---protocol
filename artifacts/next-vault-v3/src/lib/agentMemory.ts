export type NVAgentMode = 'assisted' | 'authorized' | null;

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
