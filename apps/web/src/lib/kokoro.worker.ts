/**
 * Natural-voice worker. It runs the Kokoro text-to-speech model (82 million parameters, Apache-2.0)
 * on the computer's graphics card through WebGPU, entirely inside the browser, so the reply is spoken
 * without any server, any cost, or any text leaving the device. The model files are downloaded once
 * from Hugging Face and then cached by the browser (about 330 MB: the GPU needs full precision, because the
 * smaller half-precision model produces invalid audio).
 *
 * It only runs on the GPU. On a plain CPU the model is slower than real time, which is no use for
 * conversation, so without WebGPU it reports "unavailable" and the app keeps the browser voice.
 *
 * Messages in:  { type: "load" } | { type: "speak", id, text, voice, speed } | { type: "cancel" }
 * Messages out: { type: "progress", value } | { type: "ready" } | { type: "unavailable", id? }
 *               | { type: "chunk", id, audio: Float32Array, sampleRate, genMs } | { type: "done", id }
 *               | { type: "error", id?, message }
 */
import { KokoroTTS, env } from "kokoro-js";

const MODEL = "onnx-community/Kokoro-82M-v1.0-ONNX";

// Use the runtime files this app serves itself instead of a CDN.
env.wasmPaths = `${self.location.origin}/ort-kokoro/`;

const post = (message: unknown, transfer: Transferable[] = []) =>
  (self as unknown as { postMessage: (data: unknown, transfer?: Transferable[]) => void }).postMessage(message, transfer);

class Unavailable extends Error {}

interface GpuAdapter {
  features: { has: (feature: string) => boolean };
}

/** Whether this device has a graphics card the browser can use through WebGPU. */
async function hasGpu(): Promise<boolean> {
  const gpu = (self.navigator as unknown as { gpu?: { requestAdapter: () => Promise<GpuAdapter | null> } }).gpu;
  if (!gpu) return false;
  try {
    return (await gpu.requestAdapter()) !== null;
  } catch {
    return false;
  }
}

let loading: Promise<KokoroTTS> | null = null;
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

function load(): Promise<KokoroTTS> {
  if (!loading) {
    loading = (async () => {
      if (!(await hasGpu())) throw new Unavailable("WebGPU is not available");
      try {
        const model = await KokoroTTS.from_pretrained(MODEL, {
          dtype: "fp32",
          device: "webgpu",
          progress_callback: (info: { status?: string; file?: string; loaded?: number; total?: number }) => {
            if (info.status === "progress" && info.file && typeof info.loaded === "number" && typeof info.total === "number") {
              downloads.set(info.file, { loaded: info.loaded, total: info.total });
              reportProgress();
            }
          },
        });
        // The first run compiles the GPU programs, which takes many seconds. Do it now, out of sight, so the first
        // real sentence is not slow.
        await model.generate("Hello there.", { voice: "af_heart" as never });
        post({ type: "ready" });
        return model;
      } catch (failure) {
        // A GPU that exists but cannot start a device (missing driver parts, blocked, out of memory) is treated
        // as "no GPU", so the browser voice takes over instead of the voice failing.
        if (failure instanceof Error && /backend|webgpu|requestDevice|gpu/i.test(failure.message)) throw new Unavailable(failure.message);
        throw failure;
      }
    })().catch((failure: unknown) => {
      // An unavailable GPU is final; anything else (a dropped download) may be retried.
      if (!(failure instanceof Unavailable)) loading = null;
      throw failure;
    });
  }
  return loading;
}

// A newer request (or a cancel) makes older ones stop after the sentence they are on.
let current = 0;

type Incoming =
  | { type: "load" }
  | { type: "cancel" }
  | { type: "speak"; id: number; text: string; voice: string; speed: number };

self.addEventListener("message", (event: MessageEvent<Incoming>) => {
  const data = event.data;

  if (data.type === "load") {
    load().catch((failure: unknown) =>
      post(failure instanceof Unavailable ? { type: "unavailable" } : { type: "error", message: failure instanceof Error ? failure.message : "The voice model could not be loaded." }),
    );
    return;
  }

  if (data.type === "cancel") {
    current += 1;
    return;
  }

  if (data.type === "speak") {
    current += 1;
    const mine = current;
    const { id, text, voice, speed } = data;

    void (async () => {
      try {
        const tts = await load();
        let last = performance.now();
        const stream = tts.stream(text, { voice: voice as never, speed });
        for await (const part of stream) {
          if (mine !== current) return; // superseded or cancelled
          const now = performance.now();
          const audio = part.audio.audio.slice();
          post({ type: "chunk", id, audio, sampleRate: part.audio.sampling_rate, genMs: now - last }, [audio.buffer]);
          last = performance.now();
        }
        if (mine === current) post({ type: "done", id });
      } catch (failure) {
        post(failure instanceof Unavailable ? { type: "unavailable", id } : { type: "error", id, message: failure instanceof Error ? failure.message : "The voice could not speak that." });
      }
    })();
  }
});
