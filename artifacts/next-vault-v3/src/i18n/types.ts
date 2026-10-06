export type Locale = 'pt-BR' | 'en' | 'es' | 'fr' | 'zh' | 'ja' | 'ko' | 'hi' | 'ar';

export interface LocaleConfig {
  code: Locale;
  label: string;
  flag: string;
  bcp47: string;
  dir?: 'ltr' | 'rtl';
}

export const LOCALES: LocaleConfig[] = [
  { code: 'pt-BR', label: 'Português',  flag: '🇧🇷', bcp47: 'pt-BR' },
  { code: 'en',    label: 'English',    flag: '🇺🇸', bcp47: 'en-US' },
  { code: 'es',    label: 'Español',    flag: '🇪🇸', bcp47: 'es-ES' },
  { code: 'fr',    label: 'Français',   flag: '🇫🇷', bcp47: 'fr-FR' },
  { code: 'zh',    label: '中文',        flag: '🇨🇳', bcp47: 'zh-CN' },
  { code: 'ja',    label: '日本語',      flag: '🇯🇵', bcp47: 'ja-JP' },
  { code: 'ko',    label: '한국어',      flag: '🇰🇷', bcp47: 'ko-KR' },
  { code: 'hi',    label: 'हिन्दी',      flag: '🇮🇳', bcp47: 'hi-IN' },
  { code: 'ar',    label: 'العربية',    flag: '🇸🇦', bcp47: 'ar-SA', dir: 'rtl' },
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
  if (nav.startsWith('zh')) return 'zh';
  if (nav.startsWith('ja')) return 'ja';
  if (nav.startsWith('ko')) return 'ko';
  if (nav.startsWith('hi')) return 'hi';
  if (nav.startsWith('ar')) return 'ar';
  return 'en';
}
