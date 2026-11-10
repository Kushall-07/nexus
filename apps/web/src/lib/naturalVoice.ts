/**
 * Natural voice: speaks text with the Kokoro model running in a background worker, entirely in the
 * browser. Sentences arrive one by one and are queued for playback, so speech starts after the first
 * sentence is ready instead of after the whole reply. While it plays, the loudness is written into
 * `levelRef`, which makes the orb move with the real voice.
 *
 * It is free to run and to deploy: no server, no key, nothing leaves the computer. The first use
 * downloads the model once; the browser keeps it afterwards.
 */
import { useCallback, useEffect, useRef, useState } from "react";

// "unsupported": this device has no WebGPU, or is too slow to speak in real time, so it is skipped.
export type NaturalStatus = "idle" | "loading" | "ready" | "error" | "unsupported";

export interface NaturalVoice {
  supported: boolean;
  status: NaturalStatus;
  /** 0..1 while the model downloads for the first time, otherwise null. */
  progress: number | null;
  /** Id of what is being spoken right now, or null. */
  speakingId: string | null;
  /** Starts downloading and warming up the model. Safe to call repeatedly. */
  preload: () => void;
  /** Call from a click or tap so the browser allows sound. */
  prime: () => void;
  speak: (id: string, text: string, options: { voice: string; speed: number }) => void;
  cancel: () => void;
}

type WorkerMessage =
  | { type: "progress"; value: number }
  | { type: "ready" }
  | { type: "unavailable"; id?: number }
  | { type: "chunk"; id: number; audio: Float32Array; sampleRate: number; genMs: number }
  | { type: "done"; id: number }
  | { type: "error"; id?: number; message: string };

const SLOW_KEY = "nexus:natural-voice-too-slow";
// A chunk that takes this many times its own length to make cannot keep up with speech.
const TOO_SLOW_RATIO = 1.6;

function rememberedSlow(): boolean {
  try {
    return window.localStorage.getItem(SLOW_KEY) === "1";
  } catch {
    return false;
  }
}

export function naturalVoiceSupported(): boolean {
  return typeof window !== "undefined" && typeof Worker !== "undefined" && typeof WebAssembly !== "undefined" && typeof AudioContext !== "undefined";
}

/**
 * `onFailure` is called when the natural voice cannot speak a reply that was already handed to it, so the
 * caller can read it with another voice instead of staying silent.
 */
export function useNaturalVoice(levelRef: { current: number }, onFailure?: (id: string, text: string, speed: number) => void): NaturalVoice {
  const [status, setStatus] = useState<NaturalStatus>(() => (rememberedSlow() ? "unsupported" : "idle"));
  const [progress, setProgress] = useState<number | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  const onFailureRef = useRef(onFailure);
  onFailureRef.current = onFailure;

  const worker = useRef<Worker | null>(null);
  const context = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const sources = useRef(new Set<AudioBufferSourceNode>());
  const queueEnd = useRef(0);
  const meter = useRef(0);
  const request = useRef<{ numeric: number; id: string; text: string; speed: number; finished: boolean; chunks: number } | null>(null);
  const counter = useRef(0);
  const slowChunks = useRef(0);
  const supported = naturalVoiceSupported();

  const stopMeter = () => {
    if (meter.current) window.clearInterval(meter.current);
    meter.current = 0;
  };

  const startMeter = () => {
    if (meter.current || !analyser.current) return;
    const node = analyser.current;
    const samples = new Uint8Array(node.fftSize);
    meter.current = window.setInterval(() => {
      node.getByteTimeDomainData(samples);
      let sum = 0;
      for (let i = 0; i < samples.length; i += 1) {
        const centered = (samples[i] - 128) / 128;
        sum += centered * centered;
      }
      levelRef.current = Math.max(levelRef.current, Math.min(1, Math.sqrt(sum / samples.length) * 4.5));
    }, 40);
  };

  const watchdog = useRef(0);

  const finish = () => {
    window.clearTimeout(watchdog.current);
    stopMeter();
    request.current = null;
    setSpeakingId(null);
  };

  const stopPlayback = () => {
    for (const source of sources.current) {
      source.onended = null;
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
    }
    sources.current.clear();
    queueEnd.current = 0;
  };

  const ensureContext = (): AudioContext | null => {
    if (!context.current) {
      const created = new AudioContext();
      const node = created.createAnalyser();
      node.fftSize = 512;
      node.connect(created.destination);
      context.current = created;
      analyser.current = node;
    }
    if (context.current.state === "suspended") void context.current.resume();
    return context.current;
  };

  const getWorker = (): Worker => {
    if (worker.current) return worker.current;
    const instance = new Worker(new URL("./kokoro.worker.ts", import.meta.url), { type: "module" });
    instance.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;

      if (message.type === "progress") {
        setProgress(message.value < 1 ? message.value : null);
        return;
      }
      if (message.type === "ready") {
        setProgress(null);
        setStatus("ready");
        return;
      }

      const current = request.current;
      if (message.type === "unavailable") {
        setProgress(null);
        setStatus("unsupported");
        if (current) {
          const failed = current;
          stopPlayback();
          finish();
          onFailureRef.current?.(failed.id, failed.text, failed.speed);
        }
        return;
      }
      if (message.type === "chunk") {
        if (!current || message.id !== current.numeric) return;
        const audioContext = ensureContext();
        if (!audioContext || !analyser.current) return;
        const buffer = audioContext.createBuffer(1, message.audio.length, message.sampleRate);
        buffer.copyToChannel(new Float32Array(message.audio), 0);
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(analyser.current);
        const startAt = Math.max(audioContext.currentTime + 0.04, queueEnd.current);
        queueEnd.current = startAt + buffer.duration;
        sources.current.add(source);
        source.onended = () => {
          sources.current.delete(source);
          if (sources.current.size === 0 && request.current?.numeric === current.numeric && request.current.finished) finish();
        };
        source.start(startAt);
        startMeter();

        // If the browser is holding sound back (a page nobody has clicked yet leaves the audio system suspended), the
        // audio never plays and never "ends". Do not wait for it: give up a moment after it should have finished.
        window.clearTimeout(watchdog.current);
        const remainingMs = Math.max(0, (queueEnd.current - audioContext.currentTime) * 1000);
        const requestNumber = current.numeric;
        watchdog.current = window.setTimeout(() => {
          if (request.current?.numeric !== requestNumber) return;
          stopPlayback();
          finish();
        }, remainingMs + 2500);

        // The first sentence includes warming up, so judge speed from the second one on. If the voice cannot keep
        // up with its own speech twice in a row, stop using it on this device and remember that.
        if (current.chunks > 0) {
          slowChunks.current = message.genMs > buffer.duration * 1000 * TOO_SLOW_RATIO ? slowChunks.current + 1 : 0;
          if (slowChunks.current >= 2) {
            setStatus("unsupported");
            try {
              window.localStorage.setItem(SLOW_KEY, "1");
            } catch {
              /* the choice then lasts for this visit only */
            }
          }
        }
        current.chunks += 1;
      } else if (message.type === "done") {
        if (!current || message.id !== current.numeric) return;
        current.finished = true;
        if (sources.current.size === 0) finish();
      } else if (message.type === "error") {
        setProgress(null);
        setStatus("error");
        if (current && (message.id === undefined || message.id === current.numeric)) {
          const failed = current;
          stopPlayback();
          finish();
          onFailureRef.current?.(failed.id, failed.text, failed.speed);
        }
      }
    };
    worker.current = instance;
    return instance;
  };

  const preload = useCallback(() => {
    if (!naturalVoiceSupported() || status === "ready" || status === "loading" || status === "unsupported") return;
    setStatus("loading");
    getWorker().postMessage({ type: "load" });
  }, [status]);

  const prime = useCallback(() => {
    if (naturalVoiceSupported()) ensureContext();
  }, []);

  const cancel = useCallback(() => {
    counter.current += 1;
    worker.current?.postMessage({ type: "cancel" });
    stopPlayback();
    finish();
  }, []);

  const speak = useCallback(
    (id: string, text: string, options: { voice: string; speed: number }) => {
      if (!naturalVoiceSupported() || status === "unsupported") return;
      stopPlayback();
      ensureContext();
      slowChunks.current = 0;
      const numeric = ++counter.current;
      request.current = { numeric, id, text, speed: options.speed, finished: false, chunks: 0 };
      setSpeakingId(id);
      // If nothing at all comes back (a stalled worker, sound locked by the browser), do not stay "speaking" forever.
      window.clearTimeout(watchdog.current);
      watchdog.current = window.setTimeout(() => {
        if (request.current?.numeric !== numeric) return;
        const failed = request.current;
        stopPlayback();
        finish();
        onFailureRef.current?.(failed.id, failed.text, failed.speed);
      }, 30_000);
      if (status === "idle") setStatus("loading");
      getWorker().postMessage({ type: "speak", id: numeric, text, voice: options.voice, speed: options.speed });
    },
    [status],
  );

  // Release the worker and the audio when leaving the page.
  useEffect(
    () => () => {
      stopMeter();
      stopPlayback();
      worker.current?.terminate();
      worker.current = null;
      void context.current?.close();
      context.current = null;
    },
    [],
  );

  return { supported, status, progress, speakingId, preload, prime, speak, cancel };
}
