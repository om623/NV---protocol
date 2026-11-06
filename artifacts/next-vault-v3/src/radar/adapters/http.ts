// ─── Shared HTTP layer for Radar source adapters ──────────────────────────────
// Timeouts, typed errors, in-flight de-duplication, localStorage cache with TTL,
// and a spaced queue for sources with strict rate limits.

export type SourceErrorCode =
  | 'timeout' | 'network' | 'rate_limited' | 'http' | 'not_configured' | 'not_found' | 'parse';

export class SourceError extends Error {
  code: SourceErrorCode;
  status?: number;
  constructor(code: SourceErrorCode, message?: string, status?: number) {
    super(message ?? code);
    this.name = 'SourceError';
    this.code = code;
    this.status = status;
  }
}

const CACHE_PREFIX = 'nv.radar.cache.v1:';
const mem = new Map<string, { t: number; v: unknown }>();

export function cacheGet<T>(key: string, ttlMs: number): T | null {
  const now = Date.now();
  const hit = mem.get(key);
  if (hit && now - hit.t < ttlMs) return hit.v as T;
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { t: number; v: T };
    if (now - parsed.t < ttlMs) {
      mem.set(key, parsed);
      return parsed.v;
    }
  } catch {
    // corrupt or unavailable cache is treated as a miss
  }
  return null;
}

export function cacheSet<T>(key: string, value: T): void {
  const entry = { t: Date.now(), v: value };
  mem.set(key, entry);
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // quota exceeded: memory cache still works for this session
  }
}

export function clearRadarCache(): void {
  mem.clear();
  try {
    const drop: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(CACHE_PREFIX)) drop.push(k);
    }
    drop.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}

const inflight = new Map<string, Promise<unknown>>();

/** Share one request between concurrent callers asking for the same key. */
export function dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const p = fn().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

interface FetchOpts {
  timeoutMs?: number;
  signal?: AbortSignal;
  retries?: number;
}

async function fetchRaw(url: string, opts: FetchOpts): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 15000);
  const onAbort = () => controller.abort();
  opts.signal?.addEventListener('abort', onAbort, { once: true });
  try {
    return await fetch(url, { signal: controller.signal });
  } catch (err) {
    if (opts.signal?.aborted) throw new SourceError('network', 'aborted');
    if ((err as Error).name === 'AbortError') throw new SourceError('timeout');
    throw new SourceError('network', (err as Error).message);
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onAbort);
  }
}

export async function fetchJson<T>(url: string, opts: FetchOpts = {}): Promise<T> {
  const retries = opts.retries ?? 1;
  let lastErr: SourceError | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchRaw(url, opts);
      if (res.status === 429) throw new SourceError('rate_limited', 'rate limited', 429);
      if (res.status === 404) throw new SourceError('not_found', 'not found', 404);
      if (res.status === 503) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        if (body?.error === 'not_configured') throw new SourceError('not_configured', 'not configured', 503);
        throw new SourceError('http', 'unavailable', 503);
      }
      if (!res.ok) throw new SourceError('http', `HTTP ${res.status}`, res.status);
      try {
        return (await res.json()) as T;
      } catch {
        throw new SourceError('parse', 'invalid JSON');
      }
    } catch (err) {
      lastErr = err instanceof SourceError ? err : new SourceError('network', (err as Error).message);
      const retryable = lastErr.code === 'timeout' || lastErr.code === 'network' || (lastErr.code === 'http' && (lastErr.status ?? 0) >= 500);
      if (!retryable || attempt === retries || opts.signal?.aborted) break;
      await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
    }
  }
  throw lastErr ?? new SourceError('network');
}

/** Serialises calls with a minimum gap between them (used for GDELT: 1 request / 5 s). */
export function createSpacedQueue(minGapMs: number) {
  let chain: Promise<unknown> = Promise.resolve();
  let last = 0;
  return function enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = chain.then(async () => {
      const wait = Math.max(0, last + minGapMs - Date.now());
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      try {
        return await fn();
      } finally {
        last = Date.now();
      }
    });
    chain = run.catch(() => undefined);
    return run;
  };
}

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;
