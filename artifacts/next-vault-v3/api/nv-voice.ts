// Vercel Serverless Function — NV Voice neural audio generation.
// Configure ELEVENLABS_API_KEY and NV_ELEVENLABS_VOICE_ID as server-side env vars.
// The client receives audio only; provider credentials remain server-side.

type VercelRequest = {
  method?: string;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
};
type VercelResponse = {
  status(code: number): VercelResponse;
  json(body: unknown): void;
  send(body: unknown): void;
  setHeader(name: string, value: string): void;
};

const VOICE_LANGUAGES: Record<string, string> = {
  "pt-BR": "pt",
  en: "en",
  es: "es",
  fr: "fr",
  zh: "zh",
  ja: "ja",
  ko: "ko",
  hi: "hi",
  ar: "ar",
};

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const body = (req.body && typeof req.body === "object" ? req.body : {}) as {
    text?: unknown;
    locale?: unknown;
  };
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const locale = typeof body.locale === "string" ? body.locale : "";

  if (!text || text.length > 2500 || !(locale in VOICE_LANGUAGES)) {
    res.status(400).json({ error: "invalid_request" });
    return;
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.NV_ELEVENLABS_VOICE_ID;
  if (!apiKey || !voiceId) {
    res.status(503).json({ error: "voice_not_configured" });
    return;
  }

  try {
    const upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        language_code: VOICE_LANGUAGES[locale],
        voice_settings: {
          stability: 0.68,
          similarity_boost: 0.78,
          style: 0.22,
          use_speaker_boost: true,
        },
      }),
    });

    if (!upstream.ok) {
      res.status(502).json({ error: "voice_provider_failed" });
      return;
    }
    const audio = Buffer.from(await upstream.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", String(audio.length));
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.status(200).send(audio);
  } catch {
    res.status(502).json({ error: "voice_generation_unavailable" });
  }
}
