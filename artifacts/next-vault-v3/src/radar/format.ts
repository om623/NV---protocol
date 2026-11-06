import type { FieldStatus } from './types';

const STALE_AFTER_DAYS = 548; // ~18 months

/** A figure older than ~18 months is flagged as outdated (still shown, clearly labelled). */
export function computeStatus(asOf?: string, now: number = Date.now()): FieldStatus {
  if (!asOf) return 'available';
  const t = Date.parse(asOf.length === 4 ? `${asOf}-12-31` : asOf);
  if (!Number.isFinite(t)) return 'available';
  return (now - t) / 86_400_000 > STALE_AFTER_DAYS ? 'stale' : 'available';
}

export function formatCompact(n: number, locale: string, currency?: string): string {
  try {
    if (currency && /^[A-Z]{3}$/.test(currency)) {
      return new Intl.NumberFormat(locale, { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 2 }).format(n);
    }
    return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 2 }).format(n);
  } catch {
    return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 2 }).format(n);
  }
}

export function formatPercent(n: number, locale: string, digits = 2): string {
  return `${new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits, signDisplay: 'exceptZero' }).format(n)}%`;
}

export function formatPrice(n: number, locale: string, currency?: string): string {
  try {
    if (currency && /^[A-Z]{3}$/.test(currency)) {
      return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 }).format(n);
    }
  } catch {
    // fall through
  }
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(n);
}

/** Wikidata fiscal-year markers (YYYY-01-01) are shown as just the year. */
export function formatAsOf(asOf: string | undefined, locale: string): string {
  if (!asOf) return '';
  if (/^\d{4}$/.test(asOf) || /^\d{4}-01-01$/.test(asOf)) return asOf.slice(0, 4);
  const d = new Date(asOf);
  if (Number.isNaN(d.getTime())) return asOf;
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(d);
}

export function formatDateTime(iso: string | null | undefined, locale: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
}

export function normalizeText(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
