import { twMerge } from 'tailwind-merge';

import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Returns true if the value is a renderable finite number. */
export function isValidNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** Format a number as USD currency, or return fallback if invalid. */
export function safeUsd(v: number | undefined | null, fallback = '—', locale = 'pt-BR'): string {
  if (!isValidNum(v)) return fallback;
  return `${v.toLocaleString(locale, { maximumFractionDigits: 2 })}`;
}

/** Format a number with a prefix/suffix, or return fallback if invalid. */
export function safeNum(
  v: number | undefined | null,
  opts: { prefix?: string; suffix?: string; decimals?: number; fallback?: string; locale?: string } = {},
): string {
  const { prefix = '', suffix = '', decimals = 2, fallback = '—', locale = 'pt-BR' } = opts;
  if (!isValidNum(v)) return fallback;
  return `${prefix}${v.toLocaleString(locale, { maximumFractionDigits: decimals, minimumFractionDigits: 0 })}${suffix}`;
}

/** Format a percentage, or return fallback if invalid. */
export function safePct(v: number | undefined | null, fallback = '—'): string {
  if (!isValidNum(v)) return fallback;
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
}

/** Return a finite balance number, or 0 if the value is missing/invalid. */
export function safeBalance(v: number | undefined | null): number {
  return isValidNum(v) ? v : 0;
}

/** Format a token balance with fixed decimals, or fallback if invalid. */
export function safeBalanceFmt(v: number | undefined | null, decimals = 4, fallback = '—'): string {
  if (!isValidNum(v)) return fallback;
  return v.toFixed(decimals);
}

interface TokenIdentity {
  symbol: string;
  address?: string | null;
  isNative?: boolean;
}

/**
 * Deduplicate a list of tokens by deterministic identity.
 * For ERC-20 tokens: chainId + contract address.
 * For native tokens: chainId + symbol + isNative.
 * Preserves the order of first occurrence.
 */
export function dedupTokens<T extends TokenIdentity>(tokens: T[], chainId: number): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const t of tokens) {
    const key = t.isNative
      ? `${chainId}:native:${t.symbol}`
      : `${chainId}:${t.address ?? t.symbol}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(t);
    }
  }
  return result;
}
