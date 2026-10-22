import type { Locale } from "../i18n/types";

let muted = false;
let queue: Promise<void> = Promise.resolve();
let activeAudio: HTMLAudioElement | null = null;

export function isNVVoiceMuted(): boolean {
  return muted;
}

/** Muting affects queued/future replies only. It never pauses or stops active audio. */
export function setNVVoiceMuted(nextMuted: boolean): void {
  muted = nextMuted;
}

export function enqueueNVVoice(text: string, locale: Locale): void {
  const spokenText = text.trim().slice(0, 2500);
  if (!spokenText || muted || typeof window === "undefined") return;

  queue = queue
    .then(async () => {
      // Respect a mute choice made while this item was waiting in the queue.
      if (muted) return;

      const response = await fetch("/api/nv-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: spokenText, locale }),
      });
      if (!response.ok) {
        throw new Error(response.status === 503 ? "NV Voice is not configured." : "NV Voice request failed.");
      }

      const blob = await response.blob();
      if (muted || !blob.size) return;
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      activeAudio = audio;

      try {
        await new Promise<void>((resolve, reject) => {
          audio.addEventListener("ended", () => resolve(), { once: true });
          audio.addEventListener("error", () => reject(new Error("Audio playback failed.")), { once: true });
          void audio.play().catch(reject);
        });
      } finally {
        if (activeAudio === audio) activeAudio = null;
        URL.revokeObjectURL(url);
      }
    })
    .catch((error: unknown) => {
      // Text remains available if voice generation/playback fails.
      console.warn("[NV Voice]", error instanceof Error ? error.message : error);
    });
}
