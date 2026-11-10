/**
 * One shared connection to the speech-to-text worker (Whisper, running on this device). Voice dictation and
 * the "Hey Nexus" listener both use it, so the model is loaded once, not twice.
 *
 * The worker is created on first use and shut down when the last user lets go of it.
 */

export type WhisperEvent = { type: "progress"; value: number } | { type: "ready" } | { type: "error"; message: string };

type WorkerMessage =
  | { type: "progress"; value: number }
  | { type: "ready" }
  | { type: "result"; id: number; text: string }
  | { type: "error"; id?: number; message: string };

let worker: Worker | null = null;
let users = 0;
let nextId = 0;
const listeners = new Set<(event: WhisperEvent) => void>();
const pending = new Map<number, { resolve: (text: string) => void; reject: (reason: Error) => void }>();

function getWorker(): Worker {
  if (worker) return worker;
  const instance = new Worker(new URL("./whisper.worker.ts", import.meta.url), { type: "module" });
  instance.onmessage = (event: MessageEvent<WorkerMessage>) => {
    const message = event.data;
    if (message.type === "result") {
      pending.get(message.id)?.resolve(message.text);
      pending.delete(message.id);
    } else if (message.type === "error" && message.id !== undefined) {
      pending.get(message.id)?.reject(new Error(message.message));
      pending.delete(message.id);
    } else if (message.type === "error") {
      for (const listener of listeners) listener({ type: "error", message: message.message });
    } else {
      for (const listener of listeners) listener(message);
    }
  };
  worker = instance;
  return instance;
}

/** Call when a feature starts needing the model; pair with `releaseWhisper`. */
export function retainWhisper(): void {
  users += 1;
}

export function releaseWhisper(): void {
  users = Math.max(0, users - 1);
  if (users === 0 && worker) {
    for (const request of pending.values()) request.reject(new Error("Speech recognition was shut down."));
    pending.clear();
    worker.terminate();
    worker = null;
  }
}

/** Hears about the model downloading, being ready, or failing to load. */
export function subscribeWhisper(listener: (event: WhisperEvent) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Starts downloading and warming up the model. Safe to call repeatedly. */
export function loadWhisper(): void {
  getWorker().postMessage({ type: "load" });
}

/** Turns 16 kHz mono audio into text. The array is handed over to the worker and cannot be reused. */
export function transcribeAudio(audio: Float32Array): Promise<string> {
  const id = ++nextId;
  return new Promise<string>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ type: "transcribe", id, audio }, [audio.buffer]);
  });
}
