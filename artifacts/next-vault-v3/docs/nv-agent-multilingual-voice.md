# NV Agent — multilingual replies and browser voice

The NV Agent uses the locale already selected in Nexvault. The nine supported locales are:

- `pt-BR` — Brazilian Portuguese
- `en` — English
- `es` — Spanish
- `fr` — French
- `zh` — Simplified Chinese
- `ja` — Japanese
- `ko` — Korean
- `hi` — Hindi
- `ar` — Modern Standard Arabic

## Optional server-side environment variables

- `OPENAI_API_KEY` — used by `/api/nv-agent-localize` to normalize questions for intent detection and translate answers.
- `NV_TRANSLATION_MODEL` — optional; defaults to `gpt-4.1-mini`.

Do not put API keys in `VITE_*` variables or commit secrets. Without `OPENAI_API_KEY`, the agent keeps working but falls back to the original question/answer text if translation is unavailable.

## Runtime behavior

- The chat keeps the original user question visible.
- The question is normalized to English for keyword intent detection when a non-English locale is selected.
- The agent's answer is translated into the selected locale; sources, token symbols, wallet addresses, transaction hashes, URLs, and numeric financial values are instructed to remain unchanged.
- Chat replies use the browser's built-in speech synthesis; no neural voice service or voice API key is required.
- Speech is queued one reply at a time. Silent mode affects new replies only and never pauses or cancels speech already in progress.
- Voice quality and language availability depend on voices installed in the user's browser/device. If speech is unavailable, the text chat remains usable.

## Deployment note

This repository is a Vite frontend with Vercel serverless functions under `api/`. The localization endpoint must be deployed as a serverless function for cross-language normalization/translation. Browser speech itself runs locally in the user's browser/device.
