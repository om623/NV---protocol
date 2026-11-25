// NV Agent language contract: every fallback is authored in the selected UI locale.
export const NV_AGENT_LOCALE_NAMES: Readonly<Record<string, string>> = {
  'pt-BR': 'português brasileiro',
  en: 'English',
  es: 'español',
  fr: 'français',
  zh: '简体中文',
  ja: '日本語',
  ko: '한국어',
  hi: 'हिन्दी',
  ar: 'العربية الفصحى',
};

const FALLBACKS: Readonly<Record<string, string>> = {
  'pt-BR': 'Não consegui preparar uma resposta confiável em português agora. Tente novamente em instantes.',
  en: 'I could not prepare a reliable response in English right now. Please try again shortly.',
  es: 'No pude preparar una respuesta fiable en español en este momento. Inténtalo de nuevo en unos instantes.',
  fr: 'Je n’ai pas pu préparer une réponse fiable en français pour le moment. Veuillez réessayer dans quelques instants.',
  zh: '目前无法用所选语言生成可靠的答复，请稍后重试。',
  ja: '現在、選択した言語で信頼できる回答を作成できません。しばらくしてからもう一度お試しください。',
  ko: '현재 선택한 언어로 신뢰할 수 있는 답변을 작성할 수 없습니다. 잠시 후 다시 시도해 주세요.',
  hi: 'अभी चुनी गई भाषा में विश्वसनीय उत्तर तैयार नहीं कर सका। कृपया कुछ देर बाद फिर प्रयास करें।',
  ar: 'تعذّر إعداد إجابة موثوقة باللغة المحددة حاليًا. يُرجى المحاولة مرة أخرى بعد قليل.',
};

export function getNVAgentLocaleFallback(locale: string): string {
  return FALLBACKS[locale] ?? FALLBACKS.en;
}

export function isNVAgentLocaleSupported(locale: string): boolean {
  return Object.prototype.hasOwnProperty.call(NV_AGENT_LOCALE_NAMES, locale);
}
