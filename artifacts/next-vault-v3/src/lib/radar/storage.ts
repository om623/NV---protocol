const FAVORITES_KEY = 'nv-global-radar-favorites';
const HISTORY_KEY = 'nv-global-radar-history';

function readList(key: string): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
    return Array.isArray(value) && value.every(item => typeof item === 'string') ? value : [];
  } catch { return []; }
}

function writeList(key: string, value: string[]): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

export function getRadarFavorites(): string[] { return readList(FAVORITES_KEY); }

export function toggleRadarFavorite(id: string): string[] {
  const current = getRadarFavorites();
  const next = current.includes(id) ? current.filter(item => item !== id) : [id, ...current];
  writeList(FAVORITES_KEY, next);
  return next;
}

export function saveRadarSearch(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return readList(HISTORY_KEY);
  const next = [trimmed, ...readList(HISTORY_KEY).filter(item => item.toLowerCase() !== trimmed.toLowerCase())].slice(0, 8);
  writeList(HISTORY_KEY, next);
  return next;
}

export function getRadarHistory(): string[] { return readList(HISTORY_KEY); }
