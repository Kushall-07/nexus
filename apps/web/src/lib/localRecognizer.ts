/**
 * Voice input that works in any browser, for free, with no server: the microphone is recorded in
 * the page, a small Whisper model turns it into text inside a background worker, and the audio
 * never leaves the computer. It stops by itself when the person pauses.
 *
 * It is the fallback for browsers whose built-in speech service is missing or blocked (Brave,
 * Firefox, Chromium builds, restricted networks). The first use downloads the model once.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { loadWhisper, releaseWhisper, retainWhisper, subscribeWhisper, transcribeAudio } from "./whisperClient";

const SPEECH_LEVEL = 0.025; // microphone loudness (0..1) that counts as talking
const PAUSE_MS = 1500; // silence after talking that ends the recording
const MAX_MS = 30_000; // longest single question
const NO_SPEECH_MS = 8000; // give up if nothing is said
const MIN_SAMPLES = 16_000 * 0.4; // shorter than this is just a click or a cough

export interface LocalRecognizer {
  supported: boolean;
  listening: boolean;
  /** The recording has ended and the text is being worked out. */
  transcribing: boolean;
  /** 0..1 while the speech model is downloading for the first time, otherwise null. */
  modelProgress: number | null;
  error: string | null;
  start: () => void;
  /** Ends the recording and transcribes what was said. */
  stop: () => void;
  /** Ends the recording and throws it away. */
  cancel: () => void;
  clearError: () => void;
}

export function localRecognitionSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof Worker !== "undefined" &&
    typeof WebAssembly !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    typeof AudioContext !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

/** Removes the sound labels Whisper adds for silence and noise, such as [BLANK_AUDIO] or (music). */
export function cleanTranscript(text: string): string {
  return text
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\((?:[a-z ,'-]{1,30})\)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function useLocalRecognizer(onFinal: (transcript: string) => void, levelRef: { current: number }): LocalRecognizer {
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [modelProgress, setModelProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const meter = useRef<{ context: AudioContext; timer: number } | null>(null);
  const chunks = useRef<Blob[]>([]);
  const discard = useRef(false);
  const busy = useRef(false);
  const supported = localRecognitionSupported();

  // Share the speech model with anything else on the page that needs it, and hear how it is doing.
  useEffect(() => {
    retainWhisper();
    const unsubscribe = subscribeWhisper((event) => {
      if (event.type === "progress") setModelProgress(event.value < 1 ? event.value : null);
      else if (event.type === "ready") setModelProgress(null);
      else {
        setModelProgress(null);
        setError("The voice model could not be loaded. The first use needs an internet connection to download it. Please try again.");
      }
    });
    return () => {
      unsubscribe();
      releaseWhisper();
    };
  }, []);

  function releaseMicrophone() {
    if (meter.current) {
      window.clearInterval(meter.current.timer);
      void meter.current.context.close();
      meter.current = null;
    }
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }

  async function transcribe(blob: Blob): Promise<void> {
    setTranscribing(true);
    try {
      const context = new AudioContext({ sampleRate: 16_000 });
      const decoded = await context.decodeAudioData(await blob.arrayBuffer());
      void context.close();
      const audio = decoded.getChannelData(0).slice();
      if (audio.length < MIN_SAMPLES) {
        setError("I didn't catch that. Tap the microphone and try again.");
        return;
      }

      const text = await transcribeAudio(audio);
      const cleaned = cleanTranscript(text);
      if (cleaned) onFinalRef.current(cleaned);
      else setError("I couldn't make out what you said. Please try again.");
    } catch {
      setError("Voice input could not turn that into text. Please try again.");
    } finally {
      setTranscribing(false);
      busy.current = false;
    }
  }

  const stop = useCallback(() => {
    const active = recorder.current;
    if (active && active.state !== "inactive") active.stop();
  }, []);

  const cancel = useCallback(() => {
    discard.current = true;
    stop();
  }, [stop]);

  const start = useCallback(() => {
    if (busy.current || !localRecognitionSupported()) return;
    busy.current = true;
    discard.current = false;
    chunks.current = [];
    setError(null);

    // Begin downloading the model now, while the person is still talking.
    loadWhisper();

    navigator.mediaDevices
      .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } })
      .then((media) => {
        stream.current = media;
        const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : undefined;
        const active = new MediaRecorder(media, mime ? { mimeType: mime } : undefined);
        recorder.current = active;
        active.ondataavailable = (event) => {
          if (event.data.size > 0) chunks.current.push(event.data);
        };
        active.onstop = () => {
          releaseMicrophone();
          setListening(false);
          recorder.current = null;
          if (discard.current || chunks.current.length === 0) {
            busy.current = false;
            return;
          }
          void transcribe(new Blob(chunks.current, { type: active.mimeType }));
        };

        // Watch the loudness: it drives the orb, and a pause after talking ends the recording.
        const context = new AudioContext();
        const analyser = context.createAnalyser();
        analyser.fftSize = 1024;
        context.createMediaStreamSource(media).connect(analyser);
        const samples = new Uint8Array(analyser.fftSize);
        const startedAt = performance.now();
        let heardSpeech = false;
        let lastLoud = startedAt;

        const timer = window.setInterval(() => {
          analyser.getByteTimeDomainData(samples);
          let sum = 0;
          for (let i = 0; i < samples.length; i += 1) {
            const centered = (samples[i] - 128) / 128;
            sum += centered * centered;
          }
          const rms = Math.sqrt(sum / samples.length);
          const now = performance.now();
          levelRef.current = Math.max(levelRef.current, Math.min(1, rms * 5));

          if (rms > SPEECH_LEVEL) {
            heardSpeech = true;
            lastLoud = now;
          }
          if (heardSpeech && now - lastLoud > PAUSE_MS) {
            window.clearInterval(timer);
            stop();
          } else if (now - startedAt > MAX_MS) {
            window.clearInterval(timer);
            stop();
          } else if (!heardSpeech && now - startedAt > NO_SPEECH_MS) {
            window.clearInterval(timer);
            discard.current = true;
            setError("I didn't hear anything. Tap the microphone and try again.");
            stop();
          }
        }, 40);
        meter.current = { context, timer };

        active.start(250);
        setListening(true);
      })
      .catch((failure: unknown) => {
        busy.current = false;
        releaseMicrophone();
        const name = failure instanceof DOMException ? failure.name : "";
        setError(
          name === "NotAllowedError" || name === "SecurityError"
            ? "Microphone access is blocked. Allow it in your browser's site settings, then try again."
            : name === "NotFoundError"
              ? "No microphone was found. Check that one is connected."
              : "Voice input could not start. Please try again.",
        );
      });
    // The helpers used above only touch refs and stable state setters, so they are safe to omit here.
  }, [levelRef, stop]);

  const clearError = useCallback(() => setError(null), []);

  // Release the microphone and stop the worker when leaving the page.
  useEffect(
    () => () => {
      discard.current = true;
      if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
      releaseMicrophone();
    },
    [],
  );

  return { supported, listening, transcribing, modelProgress, error, start, stop, cancel, clearError };
}
