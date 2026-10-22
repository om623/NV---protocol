# NV Agent — multilingual replies and NV Voice

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

## Required server-side environment variables

Configure these in the deployment platform's server-side environment settings. Do not put API keys in `VITE_*` variables or commit secrets.

- `OPENAI_API_KEY` — used by `/api/nv-agent-localize` to normalize questions for intent detection and translate answers.
- `NV_TRANSLATION_MODEL` — optional; defaults to `gpt-4.1-mini`.
- `ELEVENLABS_API_KEY` — used by `/api/nv-voice` to generate neural speech.
- `NV_ELEVENLABS_VOICE_ID` — the configured ElevenLabs voice ID for NV Voice.

The selected voice should be a voice the account is authorized to use and should support ElevenLabs' multilingual model. Configure provider usage limits before production deployment.

## Runtime behavior

- The chat keeps the original user question visible.
- The question is normalized to English for keyword intent detection when a non-English locale is selected.
- The agent's answer is translated into the selected locale; sources, token symbols, wallet addresses, transaction hashes, URLs, and numeric financial values are instructed to remain unchanged.
- Every assistant reply is submitted to the neural voice queue unless the user has enabled Silent mode.
- The queue plays one audio item at a time. New replies wait for the current audio to finish.
- Silent mode affects queued/future replies only; it never calls pause, stop, or cancellation on active audio.
- If translation or audio generation is not configured or fails, the chat remains usable and retains the text answer.

## Deployment note

This repository is a Vite frontend with Vercel serverless functions under `api/`. The new endpoints must be deployed as serverless functions for the API calls to work. Local development without a compatible serverless-function runner will show text replies but may not provide neural audio/localization.
