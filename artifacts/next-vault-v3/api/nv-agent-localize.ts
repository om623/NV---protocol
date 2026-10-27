// Vercel Serverless Function — localize NV Agent replies into the selected UI language.
// Requires OPENAI_API_KEY to be configured as a server-side environment variable.
// Never expose provider credentials to the browser.

type VercelRequest = {
  method?: string;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
};
type VercelResponse = {
  status(code: number): VercelResponse;
  json(body: unknown): void;
  setHeader(name: string, value: string): void;
};

const LANGUAGES: Record<string, string> = {
  "pt-BR": "Brazilian Portuguese",
  en: "English",
  es: "Spanish",
  fr: "French",
  zh: "Simplified Chinese",
  ja: "Japanese",
  ko: "Korean",
  hi: "Hindi",
  ar: "Modern Standard Arabic",
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
    sourceLocale?: unknown;
  };
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const locale = typeof body.locale === "string" ? body.locale : "";
  const sourceLocale = typeof body.sourceLocale === "string" ? body.sourceLocale : "";

  if (!text || text.length > 8000 || !(locale in LANGUAGES) || (sourceLocale && !(sourceLocale in LANGUAGES))) {
    res.status(400).json({ error: "invalid_request" });
    return;
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: "localization_not_configured" });
    return;
  }

  try {
    const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.NV_TRANSLATION_MODEL || "gpt-4.1-mini",
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content:
              `Translate the user's text${sourceLocale ? ` from ${LANGUAGES[sourceLocale]}` : ""} into ${LANGUAGES[locale]}. Return only the translation, preserving line breaks and formatting. Do not answer or summarize it. Preserve all numbers, prices, percentages, token symbols, ticker symbols, blockchain/network names, wallet addresses, transaction hashes, URLs, code, and technical identifiers exactly. Never change financial facts or invent missing information. Keep product names such as Nexvault, NV Protocol, NV Agent, NV Voice, Chainlink CRE, USDC, and EURC unchanged. Use natural, professional language appropriate for a global Web3 finance application. For Arabic, use clear Modern Standard Arabic.`,
          },
          { role: "user", content: text },
        ],
      }),
    });

    if (!upstream.ok) {
      res.status(502).json({ error: "localization_provider_failed" });
      return;
    }
    const payload = (await upstream.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const translated = payload.choices?.[0]?.message?.content?.trim();
    if (!translated) {
      res.status(502).json({ error: "empty_translation" });
      return;
    }
    res.status(200).json({ text: translated });
  } catch {
    res.status(502).json({ error: "localization_unavailable" });
  }
}
