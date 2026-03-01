/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Web Worker: runs Whisper tiny locally via @huggingface/transformers (ONNX).
 * Used for wake word detection — transcribes short speech segments (~1-4s)
 * captured by Silero VAD and checks for wake words offline.
 *
 * First load downloads ~42 MB (cached in IndexedDB after that).
 */
import { pipeline, env } from "@huggingface/transformers";

// Use browser cache (IndexedDB) — never attempt Node.js fs
env.allowLocalModels = false;
env.useBrowserCache = true;

let transcriber: any = null;
let loading = false;

async function getTranscriber() {
  if (transcriber) return transcriber;
  if (loading) {
    // Wait for the in-progress load
    while (loading) await new Promise((r) => setTimeout(r, 100));
    return transcriber;
  }
  loading = true;
  self.postMessage({ type: "loading" });
  try {
    transcriber = await pipeline(
      "automatic-speech-recognition",
      "Xenova/whisper-tiny",
      { dtype: "q8" } // ~42 MB quantised — cached after first load
    );
    self.postMessage({ type: "ready" });
  } finally {
    loading = false;
  }
  return transcriber;
}

// Pre-load the model as soon as the worker starts
getTranscriber().catch(() => {
  self.postMessage({ type: "error", message: "Failed to load Whisper model" });
});

self.addEventListener("message", async (event: MessageEvent) => {
  const { audio, sampleRate } = event.data as {
    audio: Float32Array;
    sampleRate: number;
  };

  try {
    const pipe = await getTranscriber();
    const result: any = await pipe(audio, {
      sampling_rate: sampleRate ?? 16000,
      language: "english",
      task: "transcribe",
    });
    const text: string = (result?.text ?? "").trim();
    self.postMessage({ type: "transcript", text });
  } catch (err: any) {
    self.postMessage({ type: "error", message: String(err?.message ?? err) });
  }
});
