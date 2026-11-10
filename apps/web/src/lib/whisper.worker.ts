/**
 * Speech-to-text worker. It runs a small Whisper model entirely in the browser (WebAssembly), so
 * the person's voice never leaves their computer and nothing is paid for. The model files
 * (about 40 MB) are downloaded once from Hugging Face and then cached by the browser.
 *
 * Messages in:  { type: "load" } | { type: "transcribe", id, audio: Float32Array (16 kHz mono) }
 * Messages out: { type: "progress", value } | { type: "ready" } | { type: "result", id, text } | { type: "error", id?, message }
 */
import { env, pipeline } from "@huggingface/transformers";

type Transcriber = (audio: Float32Array, options?: Record<string, unknown>) => Promise<{ text: string } | Array<{ text: string }>>;

const MODEL = "Xenova/whisper-tiny.en";

env.allowLocalModels = false;
// Use the runtime files this app serves itself instead of a CDN.
const origin = self.location.origin;
env.backends.onnx.wasm!.wasmPaths = {
  mjs: `${origin}/ort/ort-wasm-simd-threaded.mjs`,
  wasm: `${origin}/ort/ort-wasm-simd-threaded.wasm`,
};

const post = (message: unknown) => (self as unknown as { postMessage: (data: unknown) => void }).postMessage(message);

let loading: Promise<Transcriber> | null = null;
const downloads = new Map<string, { loaded: number; total: number }>();
let lastReported = -1;

function reportProgress() {
  let loaded = 0;
  let total = 0;
  for (const file of downloads.values()) {
    loaded += file.loaded;
    total += file.total;
  }
  if (total === 0) return;
  const value = Math.min(1, loaded / total);
  if (value - lastReported >= 0.02 || value === 1) {
    lastReported = value;
    post({ type: "progress", value });
  }
}

function load(): Promise<Transcriber> {
  if (!loading) {
    loading = (
      pipeline("automatic-speech-recognition", MODEL, {
        dtype: "q8",
        device: "wasm",
        progress_callback: (info: { status?: string; file?: string; loaded?: number; total?: number }) => {
          if (info.status === "progress" && info.file && typeof info.loaded === "number" && typeof info.total === "number") {
            downloads.set(info.file, { loaded: info.loaded, total: info.total });
            reportProgress();
          }
        },
      }) as unknown as Promise<Transcriber>
    ).then(
      (transcriber) => {
        post({ type: "ready" });
        return transcriber;
      },
      (failure: unknown) => {
        loading = null; // allow a retry
        throw failure;
      },
    );
  }
  return loading;
}

self.addEventListener("message", (event: MessageEvent<{ type: string; id?: number; audio?: Float32Array }>) => {
  const data = event.data;

  if (data.type === "load") {
    load().catch((failure: unknown) => post({ type: "error", message: failure instanceof Error ? failure.message : "The speech model could not be loaded." }));
    return;
  }

  if (data.type === "transcribe" && data.audio) {
    const audio = data.audio;
    const id = data.id;
    load()
      .then((transcribe) => transcribe(audio, { chunk_length_s: 30, return_timestamps: false }))
      .then((output) => {
        const text = Array.isArray(output) ? output.map((part) => part.text).join(" ") : output.text;
        post({ type: "result", id, text });
      })
      .catch((failure: unknown) => post({ type: "error", id, message: failure instanceof Error ? failure.message : "Transcription failed." }));
  }
});
