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
