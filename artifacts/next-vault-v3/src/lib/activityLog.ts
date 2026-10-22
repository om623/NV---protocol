export type NVActivityCategory =
  | 'wallet'
  | 'swap'
  | 'bridge'
  | 'agent'
  | 'news'
  | 'markets'
  | 'navigation'
  | 'system';

export interface NVActivity {
  id: string;
  category: NVActivityCategory;
  action: string;
  details?: string;
  txHash?: string;
  network?: string;
  timestamp: number;
}

const STORAGE_KEY = 'nv_protocol_activity_v1';
const MAX_ENTRIES = 1000;

export function readNVActivity(): NVActivity[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((item): item is NVActivity =>
      item && typeof item.id === 'string' && typeof item.action === 'string' &&
      typeof item.timestamp === 'number'
    ) : [];
  } catch {
    return [];
  }
}

export function logNVActivity(
  entry: Omit<NVActivity, 'id' | 'timestamp'>,
): NVActivity | null {
  if (typeof window === 'undefined') return null;
  const item: NVActivity = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    timestamp: Date.now(),
  };
  try {
    const entries = [item, ...readNVActivity()].slice(0, MAX_ENTRIES);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    window.dispatchEvent(new CustomEvent('nv-activity-updated'));
    return item;
  } catch {
    return null;
  }
}

export function clearNVActivity(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('nv-activity-updated'));
}
