export type Locale = 'pt-BR' | 'en' | 'es' | 'fr';

export interface LocaleConfig {
  code: Locale;
  label: string;
  flag: string;
  bcp47: string;
}

export const LOCALES: LocaleConfig[] = [
  { code: 'pt-BR', label: 'Português', flag: '🇧🇷', bcp47: 'pt-BR' },
  { code: 'en',    label: 'English',   flag: '🇺🇸', bcp47: 'en-US' },
  { code: 'es',    label: 'Español',   flag: '🇪🇸', bcp47: 'es-ES' },
  { code: 'fr',    label: 'Français',  flag: '🇫🇷', bcp47: 'fr-FR' },
];

export const DEFAULT_LOCALE: Locale = 'pt-BR';

export function detectLocale(): Locale {
  try {
    const stored = localStorage.getItem('nv-locale');
    if (stored && LOCALES.some(l => l.code === stored)) return stored as Locale;
  } catch {}
  const nav = navigator.language || 'en';
  if (nav.startsWith('pt')) return 'pt-BR';
  if (nav.startsWith('es')) return 'es';
  if (nav.startsWith('fr')) return 'fr';
  return 'en';
}
