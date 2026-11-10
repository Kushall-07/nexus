/**
 * One speaker for the Copilot. It uses the natural voice (Kokoro, on this device) once that is ready, and
 * the browser's built-in voice until then, or whenever the natural voice cannot be used, so a reply is
 * never left unspoken. The first reply is read by the browser voice while the natural one downloads.
 */
import { useEffect, useRef } from "react";
import { useNaturalVoice, type NaturalStatus } from "./naturalVoice";
import { useSpeechSynthesis, type VoicePrefs } from "./speech";

export interface VoiceOutput {
  supported: boolean;
  speakingId: string | null;
  speak: (id: string, text: string, rate?: number) => void;
  cancel: () => void;
  /** Call from a click or tap so the browser allows sound. */
  prime: () => void;
  /** Like prime, and also starts getting the natural voice ready. Call when the person starts talking. */
  prepare: () => void;
  natural: { supported: boolean; status: NaturalStatus; progress: number | null; active: boolean };
}

export function useVoiceOutput(prefs: VoicePrefs, levelRef: { current: number }, onWord?: () => void): VoiceOutput {
  const browser = useSpeechSynthesis(onWord);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  const natural = useNaturalVoice(levelRef, (id, text, speed) => {
    // The natural voice failed on this reply: read it with the browser voice instead.
    browser.speak(id, text, speed);
  });

  // Switching the natural voice on starts getting it ready right away. Merely opening the page does not:
  // the model is a sizeable download, so it waits until the person shows they want to use voice.
  const wasOn = useRef(prefs.naturalVoice);
  useEffect(() => {
    if (prefs.naturalVoice && !wasOn.current && natural.supported) natural.preload();
    wasOn.current = prefs.naturalVoice;
  }, [prefs.naturalVoice, natural.supported]);

  const useNatural = prefs.naturalVoice && natural.supported && natural.status === "ready";

  return {
    supported: browser.supported || natural.supported,
    speakingId: natural.speakingId ?? browser.speakingId,
    speak: (id, text, rate = 1) => {
      if (prefsRef.current.naturalVoice && natural.supported && natural.status !== "unsupported") {
        if (natural.status === "ready") {
          browser.cancel();
          natural.speak(id, text, { voice: prefsRef.current.voice, speed: rate });
          return;
        }
        natural.preload();
      }
      natural.cancel();
      browser.speak(id, text, rate);
    },
    cancel: () => {
      natural.cancel();
      browser.cancel();
    },
    prime: natural.prime,
    // The person is about to talk and will be answered aloud: allow sound and start getting the voice ready.
    prepare: () => {
      natural.prime();
      if (prefsRef.current.naturalVoice && natural.supported && natural.status !== "unsupported") natural.preload();
    },
    natural: { supported: natural.supported, status: natural.status, progress: natural.progress, active: useNatural },
  };
}
