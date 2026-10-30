/**
 * NV Agent response voice — browser-native speech, no paid voice API.
 *
 * Speech is queued serially. Never call speechSynthesis.cancel(), pause(), or
 * resume(): changing Silent mode affects future replies only and never cuts
 * off speech already in progress.
 */

const LOCALE_TO_BCP47: Record<string, string> = {
  'pt-BR': 'pt-BR',
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  zh: 'zh-CN',
  ja: 'ja-JP',
  ko: 'ko-KR',
  hi: 'hi-IN',
  ar: 'ar-SA',
};

let muted = false;
let queue: Promise<void> = Promise.resolve();

export function isNVVoiceMuted(): boolean {
  return muted;
}

export function setNVVoiceMuted(nextMuted: boolean): void {
  // Intentionally does not interrupt or cancel current/previously queued speech.
  muted = nextMuted;
}

function pickMicrosoftEdgeVoice(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | undefined {
  const language = lang.toLowerCase();
  const prefix = language.split('-')[0];
  const microsoft = voices.filter(v => /microsoft/i.test(v.name));
  return microsoft.find(v => v.lang.toLowerCase() === language && /online|natural/i.test(v.name))
    ?? microsoft.find(v => v.lang.toLowerCase() === language)
    ?? microsoft.find(v => v.lang.toLowerCase().startsWith(prefix) && /online|natural/i.test(v.name))
    ?? microsoft.find(v => v.lang.toLowerCase().startsWith(prefix))
    ?? voices.find(v => v.lang.toLowerCase() === language)
    ?? voices.find(v => v.lang.toLowerCase().startsWith(prefix));
}

function speak(text: string, locale: string): Promise<void> {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    console.warn('[NV Agent voice] Browser speech synthesis is unavailable.');
    return Promise.resolve();
  }

  return new Promise(resolve => {
    const utterance = new SpeechSynthesisUtterance(text);
    const lang = LOCALE_TO_BCP47[locale] ?? 'en-US';
    utterance.lang = lang;
    utterance.rate = 0.96;
    utterance.pitch = 0.88;
    utterance.volume = 1;

    const chooseVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      const selected = pickMicrosoftEdgeVoice(voices, lang);
      if (selected) utterance.voice = selected;
    };
    chooseVoice();

    utterance.onend = () => resolve();
    utterance.onerror = event => {
      console.warn('[NV Agent voice] Speech playback failed:', event.error);
      resolve();
    };

    try {
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      console.warn('[NV Agent voice] Unable to start speech:', error);
      resolve();
    }
  });
}

/** Queue one reply; speech already in progress is never interrupted. */
export function enqueueNVVoice(text: string, locale: string): void {
  const cleanText = text.trim();
  if (!cleanText || muted) return;
  queue = queue.then(() => speak(cleanText, locale)).catch(error => {
    console.warn('[NV Agent voice] Queue error:', error);
  });
}
