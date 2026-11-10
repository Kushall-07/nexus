/**
 * Hands-free listening.
 *
 * Keeps the microphone open and turns each thing the person says into text with the on-device speech model, then
 * hands the words to the caller, who decides what they mean (a wake phrase, a command, "stop", "that's all").
 * Nothing is recorded to disk or sent anywhere; a clip is dropped as soon as it has been read.
 *
 * The microphone is held for as long as `enabled` is true and `paused` is false, so a conversation is never
 * interrupted by letting go of it between sentences. The browser shows its microphone indicator the whole time.
 */
import { useEffect, useRef, useState } from "react";
import { cleanTranscript } from "./localRecognizer";
import { loadWhisper, releaseWhisper, retainWhisper, subscribeWhisper, transcribeAudio } from "./whisperClient";

const FLOOR_MIN = 0.012; // quietest level that can count as speech
const ABOVE_FLOOR = 2.6; // how far above the room's background noise speech has to be
const END_OF_SPEECH_MS = 750; // silence that ends an utterance
const MIN_CLIP_MS = 350; // shorter than this is a click or a cough
const MAX_CLIP_MS = 14000; // longest single thing to say
const PRE_ROLL_MS = 400; // audio kept from just before speech was noticed, so the first word is not cut off

export type WakeStatus = "off" | "starting" | "listening" | "checking";

export interface HandsFree {
  status: WakeStatus;
  /** 0..1 while the speech model downloads for the first time, otherwise null. */
  modelProgress: number | null;
  /** Set when the microphone cannot be used. The caller should switch the feature off. */
  error: string | null;
}

/** One thing the person said: the words, and when it started and ended (performance.now() milliseconds). */
export interface Utterance {
  text: string;
  startedAt: number;
  endedAt: number;
}

/** Averages the audio down to 16 kHz, which is what the speech model expects. */
function toSixteenKilohertz(samples: Float32Array, rate: number): Float32Array {
  if (rate === 16_000) return samples;
  const ratio = rate / 16_000;
  const out = new Float32Array(Math.floor(samples.length / ratio));
  for (let i = 0; i < out.length; i += 1) {
    const from = Math.floor(i * ratio);
    const to = Math.min(samples.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = from; j < to; j += 1) sum += samples[j]!;
    out[i] = sum / Math.max(1, to - from);
  }
  return out;
}

export function useHandsFree(options: { enabled: boolean; paused: boolean; onUtterance: (utterance: Utterance) => void }): HandsFree {
  const [status, setStatus] = useState<WakeStatus>("off");
  const [modelProgress, setModelProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onUtteranceRef = useRef(options.onUtterance);
  onUtteranceRef.current = options.onUtterance;

  useEffect(() => {
    if (!options.enabled) {
      setStatus("off");
      return undefined;
    }
    setError(null);
    retainWhisper();
    const unsubscribe = subscribeWhisper((event) => {
      if (event.type === "progress") setModelProgress(event.value < 1 ? event.value : null);
      else if (event.type === "ready") setModelProgress(null);
    });
    return () => {
      unsubscribe();
      releaseWhisper();
    };
  }, [options.enabled]);

  const active = options.enabled && !options.paused;

  useEffect(() => {
    if (!active || typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      if (options.enabled) setStatus("starting");
      return undefined;
    }

    let cancelled = false;
    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;
    let processor: ScriptProcessorNode | null = null;
    setStatus("starting");
    loadWhisper();

    navigator.mediaDevices
      .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } })
      .then((media) => {
        if (cancelled) {
          media.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = media;
        context = new AudioContext();
        const rate = context.sampleRate;
        const source = context.createMediaStreamSource(media);
        processor = context.createScriptProcessor(2048, 1, 1);
        const mute = context.createGain();
        mute.gain.value = 0;
        source.connect(processor);
        processor.connect(mute).connect(context.destination);

        let floor = 0.006;
        const preRoll: Float32Array[] = [];
        let preRollSamples = 0;
        let clip: Float32Array[] | null = null;
        let clipSamples = 0;
        let lastLoud = 0;
        let startedAt = 0;

        // One clip is turned into text at a time; the newest waiting clip is kept so a quick follow-up is not lost.
        let working = false;
        let waiting: { audio: Float32Array; startedAt: number; endedAt: number } | null = null;

        const transcribeNext = () => {
          if (working || !waiting || cancelled) return;
          const job = waiting;
          waiting = null;
          working = true;
          setStatus("checking");
          transcribeAudio(job.audio)
            .then((text) => {
              if (cancelled) return;
              const cleaned = cleanTranscript(text);
              if (cleaned) onUtteranceRef.current({ text: cleaned, startedAt: job.startedAt, endedAt: job.endedAt });
            })
            .catch(() => undefined)
            .finally(() => {
              working = false;
              if (cancelled) return;
              setStatus("listening");
              transcribeNext();
            });
        };

        const finishClip = () => {
          const parts = clip;
          clip = null;
          clipSamples = 0;
          if (!parts) return;
          if (lastLoud - startedAt < MIN_CLIP_MS) return;
          let total = 0;
          for (const part of parts) total += part.length;
          const joined = new Float32Array(total);
          let at = 0;
          for (const part of parts) {
            joined.set(part, at);
            at += part.length;
          }
          waiting = { audio: toSixteenKilohertz(joined, rate), startedAt, endedAt: lastLoud };
          transcribeNext();
        };

        processor.onaudioprocess = (event) => {
          const input = event.inputBuffer.getChannelData(0);
          const block = new Float32Array(input);
          let sum = 0;
          for (let i = 0; i < block.length; i += 1) sum += block[i]! * block[i]!;
          const rms = Math.sqrt(sum / block.length);
          const now = performance.now();
          const loud = rms > Math.max(FLOOR_MIN, floor * ABOVE_FLOOR);

          // Learn how noisy the room is from the quiet stretches.
          if (!loud && !clip) floor = floor * 0.98 + rms * 0.02;

          if (clip) {
            clip.push(block);
            clipSamples += block.length;
            if (loud) lastLoud = now;
            if (now - lastLoud > END_OF_SPEECH_MS || (clipSamples / rate) * 1000 > MAX_CLIP_MS) finishClip();
            return;
          }

          preRoll.push(block);
          preRollSamples += block.length;
          while (preRollSamples > (rate * PRE_ROLL_MS) / 1000 && preRoll.length > 1) preRollSamples -= preRoll.shift()!.length;

          if (loud) {
            clip = [...preRoll];
            clipSamples = preRollSamples;
            startedAt = now;
            lastLoud = now;
            preRoll.length = 0;
            preRollSamples = 0;
          }
        };

        setStatus("listening");
      })
      .catch((failure: unknown) => {
        if (cancelled) return;
        const name = failure instanceof DOMException ? failure.name : "";
        setError(
          name === "NotAllowedError" || name === "SecurityError"
            ? "Microphone access is blocked, so “Hey Nexus” cannot listen. Allow it in your browser's site settings."
            : name === "NotFoundError"
              ? "No microphone was found for “Hey Nexus”."
              : "“Hey Nexus” could not start the microphone.",
        );
      });

    return () => {
      cancelled = true;
      if (processor) {
        processor.onaudioprocess = null;
        processor.disconnect();
      }
      stream?.getTracks().forEach((track) => track.stop());
      void context?.close();
    };
  }, [active, options.enabled]);

  return { status: options.enabled ? status : "off", modelProgress, error };
}
