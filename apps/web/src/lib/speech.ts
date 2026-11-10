/**
 * Voice helpers for the Career Copilot: speech-to-text and text-to-speech built on the browser's
 * own Web Speech API. Nothing is sent to a NEXUS server and nothing is stored.
 *
 * Browser support differs: speech recognition exists in Chrome, Edge and Safari (not Firefox), while
 * speech synthesis is near-universal. Both hooks report `supported` so the UI can hide what a browser lacks.
 */
import { useCallback, useEffect, useRef, useState } from "react";

/* ───────────────────────────── text preparation ───────────────────────────── */

/** Makes a reply read naturally: drops markdown marks and spells out "x/100". */
export function cleanForSpeech(text: string): string {
  return text
    .replace(/[*_`#>]+/g, "")
    .replace(/(\d+(?:\.\d+)?)\s*\/\s*100\b/g, "$1 out of 100")
    .replace(/https?:\/\/\S+/g, "a link")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Splits text into short sentence-sized chunks. Chrome silently stops long utterances after
 * roughly fifteen seconds, so speaking several small ones is more reliable than one big one.
 */
export function splitForSpeech(text: string, max = 180): string[] {
  const sentences = cleanForSpeech(text).match(/[^.!?]+[.!?]*\s*/g) ?? [];
  const chunks: string[] = [];
  let current = "";

  const flush = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };

  for (const sentence of sentences) {
    if (sentence.length > max) {
      flush();
      let rest = sentence.trim();
      while (rest.length > max) {
        const cut = rest.lastIndexOf(" ", max);
        const at = cut > 40 ? cut : max;
        chunks.push(rest.slice(0, at).trim());
        rest = rest.slice(at).trim();
      }
      current = rest;
    } else if ((current + sentence).length > max) {
      flush();
      current = sentence;
    } else {
      current += sentence;
    }
  }
  flush();
  return chunks;
}

/* ───────────────────────────── saved preferences ───────────────────────────── */

export interface VoicePrefs {
  /** Read every Copilot reply aloud, even when the question was typed. */
  readAloud: boolean;
  /** Send a spoken question as soon as the user stops talking. */
  autoSend: boolean;
  /** Speaking speed, 1 is normal. */
  rate: number;
  /** Use the warmer, human-sounding voice that runs on this device (downloads a model once). */
  naturalVoice: boolean;
  /** Which natural voice to use. */
  voice: string;
  /** Listen for "Hey Nexus" and answer without any clicking (off until the person turns it on). */
  heyNexus: boolean;
}

/** The natural voices on offer: the best-rated ones in the Kokoro model, with a plain description. */
export const NATURAL_VOICES = [
  { id: "af_heart", label: "Heart", note: "Warm, female" },
  { id: "af_bella", label: "Bella", note: "Bright, female" },
  { id: "af_nicole", label: "Nicole", note: "Soft, female" },
  { id: "bf_emma", label: "Emma", note: "British, female" },
  { id: "am_michael", label: "Michael", note: "Calm, male" },
  { id: "am_fenrir", label: "Fenrir", note: "Deep, male" },
] as const;

const PREFS_KEY = "nexus:voice-prefs";

/** Phones, small devices and people who save data start with the lighter browser voice. */
function naturalVoiceByDefault(): boolean {
  if (typeof navigator === "undefined" || typeof window === "undefined") return false;
  const connection = (navigator as unknown as { connection?: { saveData?: boolean } }).connection;
  const memory = (navigator as unknown as { deviceMemory?: number }).deviceMemory;
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  return !(connection?.saveData || coarse || (typeof memory === "number" && memory < 4));
}

const DEFAULT_PREFS: VoicePrefs = { readAloud: false, autoSend: true, rate: 1, naturalVoice: true, voice: "af_heart", heyNexus: false };

function readPrefs(): VoicePrefs {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFS, naturalVoice: naturalVoiceByDefault() };
    const parsed = JSON.parse(raw) as Partial<VoicePrefs>;
    return {
      readAloud: typeof parsed.readAloud === "boolean" ? parsed.readAloud : DEFAULT_PREFS.readAloud,
      autoSend: typeof parsed.autoSend === "boolean" ? parsed.autoSend : DEFAULT_PREFS.autoSend,
      rate: typeof parsed.rate === "number" && parsed.rate >= 0.5 && parsed.rate <= 2 ? parsed.rate : DEFAULT_PREFS.rate,
      naturalVoice: typeof parsed.naturalVoice === "boolean" ? parsed.naturalVoice : naturalVoiceByDefault(),
      voice: NATURAL_VOICES.some((voice) => voice.id === parsed.voice) ? (parsed.voice as string) : DEFAULT_PREFS.voice,
      heyNexus: typeof parsed.heyNexus === "boolean" ? parsed.heyNexus : DEFAULT_PREFS.heyNexus,
    };
  } catch {
    return { ...DEFAULT_PREFS, naturalVoice: naturalVoiceByDefault() };
  }
}

export function useVoicePrefs(): [VoicePrefs, (patch: Partial<VoicePrefs>) => void] {
  const [prefs, setPrefs] = useState<VoicePrefs>(readPrefs);

  const update = useCallback((patch: Partial<VoicePrefs>) => {
    setPrefs((current) => {
      const next = { ...current, ...patch };
      try {
        window.localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {
        /* storage can be blocked; the preference then lasts for this visit only */
      }
      return next;
    });
  }, []);

  return [prefs, update];
}

/* ───────────────────────────── speech to text ───────────────────────────── */

interface RecognitionAlternative {
  transcript: string;
}
interface RecognitionResult {
  isFinal: boolean;
  0: RecognitionAlternative;
}
interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}
interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type RecognitionCtor = new () => RecognitionLike;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const RECOGNITION_ERRORS: Record<string, string> = {
  "not-allowed": "Microphone access is blocked. Allow it in your browser's site settings, then try again.",
  "service-not-allowed": "Microphone access is blocked. Allow it in your browser's site settings, then try again.",
  "no-speech": "I didn't hear anything. Tap the microphone and try again.",
  "audio-capture": "No microphone was found. Check that one is connected.",
  network: "The browser's speech service could not be reached.",
  "language-not-supported": "This language is not supported for voice input in your browser.",
};

/**
 * Chrome-style voice input sends audio to the browser maker's speech service, so a "network" error
 * means that service was unreachable. The cause decides the advice, so say which one it likely is.
 */
export function describeNetworkError(online: boolean, brave: boolean): string {
  if (!online) return "You appear to be offline. Voice input needs an internet connection; you can still type.";
  if (brave) {
    return "Brave blocks the speech service that voice input relies on. Open NEXUS in Chrome or Edge to talk, or keep typing.";
  }
  return "The browser's speech service could not be reached. A VPN, firewall, proxy or ad blocker may be blocking it, or this browser has no speech service (Chromium builds and Firefox). Try Chrome or Edge, turn off the VPN, or type instead.";
}

export interface Recognizer {
  supported: boolean;
  listening: boolean;
  /** What has been heard so far, updating as the person speaks. */
  interim: string;
  error: string | null;
  /** Why voice input is unavailable in this browser, or null when it works. */
  unsupportedNote: string | null;
  /** The browser's speech service cannot be used here (missing, blocked, or unreachable). */
  unavailable: boolean;
  start: () => void;
  /** Stops listening and still delivers what was heard. */
  stop: () => void;
  /** Stops listening and throws away what was heard. */
  cancel: () => void;
  clearError: () => void;
}

export function useSpeechRecognition(onFinal: (transcript: string) => void): Recognizer {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognition = useRef<RecognitionLike | null>(null);
  const discard = useRef(false);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  // Brave defines the speech API but blocks the service behind it, so it can never work there.
  const [brave, setBrave] = useState(false);
  useEffect(() => {
    const detector = (navigator as unknown as { brave?: { isBrave?: () => Promise<boolean> } }).brave;
    detector?.isBrave?.().then(setBrave, () => undefined);
  }, []);

  // Set once the speech service has been unreachable even after a retry.
  const [serviceFailed, setServiceFailed] = useState(false);

  const hasApi = recognitionCtor() !== null;
  const supported = hasApi && !brave;
  const unavailable = !supported || serviceFailed;
  const unsupportedNote = brave
    ? "Brave blocks the speech service that voice input relies on. Open NEXUS in Chrome or Edge to talk, or keep typing."
    : hasApi
      ? null
      : "Voice input is not supported in this browser. Try Chrome, Edge or Safari.";

  const retrying = useRef(false);

  // `attempt` is only used internally: one quiet retry when the speech service fails on the first try.
  const start = useCallback(function begin(attempt = 0) {
    const Ctor = recognitionCtor();
    if (!Ctor || recognition.current) return;

    const instance = new Ctor();
    instance.lang = (typeof navigator !== "undefined" && navigator.language) || "en-US";
    instance.continuous = false;
    instance.interimResults = true;
    instance.maxAlternatives = 1;
    discard.current = false;
    let transcript = "";
    let started = false;
    let watchdog = 0;

    instance.onstart = () => {
      started = true;
      window.clearTimeout(watchdog);
      setListening(true);
      setError(null);
      setInterim("");
    };
    instance.onresult = (event) => {
      let text = "";
      for (let i = 0; i < event.results.length; i += 1) text += event.results[i][0].transcript;
      transcript = text.trim();
      setInterim(transcript);
    };
    instance.onerror = (event) => {
      window.clearTimeout(watchdog);
      if (event.error === "aborted") return;
      discard.current = true;
      if (event.error === "network") {
        const online = typeof navigator === "undefined" || navigator.onLine !== false;
        if (attempt === 0 && online) {
          // The service sometimes fails once and then works; try one more time before complaining.
          retrying.current = true;
          return;
        }
        setServiceFailed(true);
        setError(describeNetworkError(online, false));
        return;
      }
      setError(RECOGNITION_ERRORS[event.error] ?? "Voice input stopped unexpectedly. Please try again.");
    };
    instance.onend = () => {
      window.clearTimeout(watchdog);
      recognition.current = null;
      setListening(false);
      setInterim("");
      if (retrying.current) {
        retrying.current = false;
        window.setTimeout(() => begin(1), 350);
        return;
      }
      if (!discard.current && transcript) onFinalRef.current(transcript);
    };

    recognition.current = instance;
    try {
      instance.start();
    } catch {
      recognition.current = null;
      setError("Voice input could not start. Please try again.");
      return;
    }

    // Some browsers define the speech API but never start it. Once the microphone is already allowed
    // (so no permission prompt can be holding things up), give up after a few seconds and let the
    // caller switch to a different engine.
    navigator.permissions
      ?.query({ name: "microphone" as PermissionName })
      .then((permission) => {
        if (permission.state !== "granted") return;
        watchdog = window.setTimeout(() => {
          if (started || recognition.current !== instance) return;
          discard.current = true;
          try {
            instance.abort();
          } catch {
            /* the engine is not running anyway */
          }
          recognition.current = null;
          setListening(false);
          setServiceFailed(true);
          setError(describeNetworkError(true, false));
        }, 4000);
      })
      .catch(() => undefined);
  }, []);

  const stop = useCallback(() => recognition.current?.stop(), []);
  const cancel = useCallback(() => {
    discard.current = true;
    recognition.current?.abort();
  }, []);
  const clearError = useCallback(() => setError(null), []);

  // Never leave the microphone open after leaving the page.
  useEffect(
    () => () => {
      discard.current = true;
      recognition.current?.abort();
    },
    [],
  );

  return { supported, listening, interim, error, unsupportedNote, unavailable, start, stop, cancel, clearError };
}

/**
 * While `active`, writes the microphone loudness (0..1) into `levelRef` so a visual can react to the
 * person's voice. It is best effort: if the browser will not share the microphone with speech
 * recognition, nothing happens and everything else keeps working.
 */
export function useMicLevel(active: boolean, levelRef: { current: number }): void {
  useEffect(() => {
    if (!active || typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return undefined;

    let cancelled = false;
    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;
    let raf = 0;

    navigator.mediaDevices
      .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      .then((media) => {
        if (cancelled) {
          media.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = media;
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        context = new Ctor();
        const analyser = context.createAnalyser();
        analyser.fftSize = 512;
        context.createMediaStreamSource(media).connect(analyser);
        const samples = new Uint8Array(analyser.fftSize);

        const tick = () => {
          analyser.getByteTimeDomainData(samples);
          let sum = 0;
          for (let i = 0; i < samples.length; i += 1) {
            const centered = (samples[i] - 128) / 128;
            sum += centered * centered;
          }
          const loudness = Math.min(1, Math.sqrt(sum / samples.length) * 5);
          if (loudness > levelRef.current) levelRef.current = loudness;
          raf = requestAnimationFrame(tick);
        };
        tick();
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((track) => track.stop());
      void context?.close();
    };
  }, [active, levelRef]);
}

/* ───────────────────────────── text to speech ───────────────────────────── */

function synth(): SpeechSynthesis | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") return null;
  return window.speechSynthesis;
}

/** Picks the most natural-sounding voice for the visitor's language. */
function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const language = ((typeof navigator !== "undefined" && navigator.language) || "en-US").toLowerCase();
  const base = language.slice(0, 2);
  let best: SpeechSynthesisVoice | null = null;
  let bestScore = -1;

  for (const voice of voices) {
    const voiceLang = voice.lang.toLowerCase();
    if (!voiceLang.startsWith(base)) continue;
    let score = voiceLang === language ? 3 : 1;
    if (/natural|neural|online|google|samantha|aria|jenny|serena|daniel/i.test(voice.name)) score += 4;
    if (voice.default) score += 1;
    if (score > bestScore) {
      best = voice;
      bestScore = score;
    }
  }
  return best;
}

export interface Speaker {
  supported: boolean;
  /** Id of whatever is being read aloud right now, or null. */
  speakingId: string | null;
  speak: (id: string, text: string, rate?: number) => void;
  cancel: () => void;
}

/** `onWord` fires as each spoken word starts (where the browser reports it), so visuals can pulse with the voice. */
export function useSpeechSynthesis(onWord?: () => void): Speaker {
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const token = useRef(0);
  // Chrome can garbage-collect an utterance that nothing holds on to, and then its "finished" event never fires, which
  // would leave the app thinking it is still talking. Keep every utterance referenced until it is done.
  const alive = useRef<SpeechSynthesisUtterance[]>([]);
  const onWordRef = useRef(onWord);
  onWordRef.current = onWord;
  const supported = synth() !== null;

  useEffect(() => {
    const engine = synth();
    if (!engine) return undefined;
    const load = () => setVoices(engine.getVoices());
    load();
    engine.addEventListener?.("voiceschanged", load);
    return () => engine.removeEventListener?.("voiceschanged", load);
  }, []);

  const cancel = useCallback(() => {
    token.current += 1;
    synth()?.cancel();
    alive.current = [];
    setSpeakingId(null);
  }, []);

  // Safety net: if the speech engine has gone quiet but the "finished" event was lost, stop claiming to be speaking.
  useEffect(() => {
    const engine = synth();
    if (!engine || speakingId === null) return undefined;
    let quiet = 0;
    const startedAt = performance.now();
    const timer = window.setInterval(() => {
      if (engine.speaking || engine.pending) {
        quiet = 0;
        return;
      }
      quiet += 1;
      if (quiet >= 2 && performance.now() - startedAt > 1500) {
        alive.current = [];
        setSpeakingId(null);
      }
    }, 500);
    return () => window.clearInterval(timer);
  }, [speakingId]);

  const speak = useCallback(
    (id: string, text: string, rate = 1) => {
      const engine = synth();
      if (!engine) return;
      const chunks = splitForSpeech(text);
      if (chunks.length === 0) return;

      engine.cancel();
      alive.current = [];
      token.current += 1;
      const mine = token.current;
      const voice = pickVoice(voices);
      setSpeakingId(id);

      chunks.forEach((chunk, index) => {
        const utterance = new SpeechSynthesisUtterance(chunk);
        if (voice) {
          utterance.voice = voice;
          utterance.lang = voice.lang;
        }
        utterance.rate = rate;
        const done = () => {
          if (token.current !== mine) return;
          alive.current = alive.current.filter((held) => held !== utterance);
          if (index === chunks.length - 1) setSpeakingId(null);
        };
        utterance.onend = done;
        utterance.onerror = done;
        utterance.onboundary = (event) => {
          if (token.current === mine && event.name === "word") onWordRef.current?.();
        };
        alive.current.push(utterance);
        engine.speak(utterance);
      });
    },
    [voices],
  );

  // Stop talking when the person leaves the page.
  useEffect(
    () => () => {
      token.current += 1;
      synth()?.cancel();
    },
    [],
  );

  return { supported, speakingId, speak, cancel };
}
