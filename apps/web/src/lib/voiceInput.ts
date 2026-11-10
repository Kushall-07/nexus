/**
 * One voice-input hook for the Copilot. It uses the browser's own speech service when that works,
 * and otherwise (Brave, Firefox, a blocked network) switches to speech recognition that runs on the
 * person's own computer, which is free and private. The switch is remembered for next time.
 */
import { useEffect, useRef, useState } from "react";
import { useLocalRecognizer } from "./localRecognizer";
import { useMicLevel, useSpeechRecognition } from "./speech";

const ENGINE_KEY = "nexus:voice-engine";

export interface VoiceInput {
  supported: boolean;
  /** "browser" uses the browser's speech service; "device" transcribes on this computer. */
  engine: "browser" | "device";
  listening: boolean;
  /** The recording is over and the text is being worked out (device engine only). */
  transcribing: boolean;
  /** 0..1 while the speech model downloads for the first time (device engine only). */
  modelProgress: number | null;
  /** Words heard so far (browser engine only). */
  interim: string;
  error: string | null;
  /** Why voice input is unavailable, when it is. */
  unsupportedNote: string | null;
  start: () => void;
  stop: () => void;
  cancel: () => void;
  clearError: () => void;
}

function rememberedDevice(): boolean {
  try {
    return window.localStorage.getItem(ENGINE_KEY) === "device";
  } catch {
    return false;
  }
}

export function useVoiceInput(onFinal: (transcript: string) => void, levelRef: { current: number }): VoiceInput {
  const browser = useSpeechRecognition(onFinal);
  const device = useLocalRecognizer(onFinal, levelRef);
  const [remembered] = useState(rememberedDevice);

  const useDevice = device.supported && (browser.unavailable || remembered);
  const engine = useDevice ? "device" : "browser";

  // The browser engine has no loudness of its own, so read the microphone for the orb.
  useMicLevel(!useDevice && browser.listening, levelRef);

  // If the browser's service fails in the middle of a tap, carry on with the device engine
  // so the person does not have to tap again, and remember to use it from now on.
  const triedBrowser = useRef(false);
  useEffect(() => {
    if (!browser.unavailable || !device.supported) return;
    try {
      window.localStorage.setItem(ENGINE_KEY, "device");
    } catch {
      /* storage can be blocked; the choice then lasts for this visit only */
    }
    if (triedBrowser.current) {
      triedBrowser.current = false;
      device.start();
    }
    // `device.start` is stable; only the browser engine becoming unavailable should trigger this.
  }, [browser.unavailable, device.supported]);

  return {
    supported: useDevice ? true : browser.supported,
    engine,
    listening: useDevice ? device.listening : browser.listening,
    transcribing: useDevice ? device.transcribing : false,
    modelProgress: useDevice ? device.modelProgress : null,
    interim: useDevice ? "" : browser.interim,
    error: useDevice ? device.error : browser.error,
    unsupportedNote: useDevice ? null : browser.unsupportedNote,
    start: () => {
      if (useDevice) {
        device.start();
      } else {
        triedBrowser.current = true;
        browser.start();
      }
    },
    stop: () => (useDevice ? device.stop() : browser.stop()),
    cancel: () => {
      browser.cancel();
      device.cancel();
    },
    clearError: () => {
      browser.clearError();
      device.clearError();
    },
  };
}
