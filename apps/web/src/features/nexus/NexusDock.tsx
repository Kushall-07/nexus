/**
 * The small floating Nexus orb that follows you around the app (everywhere except the Copilot page, which has its
 * own bigger panel). It shows what Nexus is doing, lets you tap to talk, and, with "Hey Nexus" turned on, needs no
 * tapping at all.
 */
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { CrystalizedBall } from "../../components/CrystalizedBall";
import { prefersReducedMotion } from "../career/spotlight";
import { useNexus } from "./NexusProvider";

const TITLES = { idle: "Nexus", listening: "Listening…", thinking: "Thinking…", speaking: "Nexus" } as const;

export function NexusDock() {
  const location = useLocation();
  const { orbMode, recognizer, speaker, handsFreeAvailable, heyNexusListening, voicePrefs, setVoicePrefs, voiceStatus, levelRef, toggleMic, lastReply, spokenMessage, sending, wake, sessionActive, audioLocked } = useNexus();

  // After Nexus answers, keep the answer on screen for a few seconds, then tuck it away.
  const [showReply, setShowReply] = useState(false);
  useEffect(() => {
    if (!lastReply) return undefined;
    setShowReply(true);
    const timer = window.setTimeout(() => setShowReply(false), 9000);
    return () => window.clearTimeout(timer);
  }, [lastReply?.id]);

  const canTalk = recognizer.supported;
  if (location.pathname.startsWith("/copilot") || (!canTalk && !speaker.supported && !handsFreeAvailable)) return null;

  const busy = orbMode !== "idle";
  // Sound is held back until the page has been clicked once; say so instead of staying silent without a reason.
  const needsClick = audioLocked && heyNexusListening;
  const caption = needsClick && orbMode !== "speaking"
    ? "Click anywhere on the page once so I can talk back. I'm listening in the meantime."
    : orbMode === "listening"
      ? recognizer.listening
        ? recognizer.interim
        : "I'm listening. Say “that's all” when you're done."
      : orbMode === "speaking"
        ? (spokenMessage?.role === "assistant" ? spokenMessage.text : "")
        : voiceStatus || (showReply && lastReply?.role === "assistant" ? lastReply.text : "");
  const open = needsClick || busy || sessionActive || Boolean(voiceStatus) || (showReply && Boolean(caption)) || sending;

  return (
    <div data-nexus-ignore="" className="group pointer-events-none fixed bottom-4 right-4 z-40 flex items-end gap-3 sm:bottom-6 sm:right-6">
      <AnimatePresence>
        {open ? (
          <motion.div
            key="bubble"
            role="status"
            aria-live="polite"
            initial={prefersReducedMotion() ? false : { opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-auto mb-1 w-[min(20rem,calc(100vw-8rem))] rounded-2xl bg-gradient-to-br from-indigo-700 via-indigo-800 to-indigo-900 p-3.5 text-[var(--color-indigo-950)] shadow-[0_20px_44px_-20px_rgba(10,42,39,0.8)]"
          >
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-[#9CCBC2]">{sending && orbMode === "idle" ? "Thinking…" : TITLES[orbMode]}</p>
            {caption ? <p className="mt-1 line-clamp-4 text-sm leading-relaxed">{caption}</p> : <p className="mt-1 text-sm text-[#CFE5E0]">{orbMode === "listening" ? "Go ahead, I'm listening…" : "…"}</p>}
            <div className="mt-2.5 flex items-center gap-2">
              {orbMode === "speaking" ? (
                <button type="button" onClick={speaker.cancel} className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold transition-colors hover:bg-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
                  Stop
                </button>
              ) : null}
              {orbMode === "listening" ? (
                <button type="button" onClick={recognizer.stop} className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold transition-colors hover:bg-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
                  Done
                </button>
              ) : null}
              <Link to="/copilot" className="ml-auto text-xs font-semibold text-[#CFE5E0] underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
                Open chat
              </Link>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {!open && handsFreeAvailable ? (
        <button
          type="button"
          onClick={() => setVoicePrefs({ heyNexus: !voicePrefs.heyNexus })}
          aria-pressed={voicePrefs.heyNexus}
          title={wake.error ?? "Say “Hey Nexus” to talk, hands-free, on any page"}
          className="pointer-events-auto mb-4 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-700 opacity-0 shadow-md ring-1 ring-slate-200 transition-opacity duration-200 hover:bg-white focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 group-focus-within:opacity-100 group-hover:opacity-100"
        >
          <span aria-hidden="true" className={`h-2 w-2 rounded-full ${voicePrefs.heyNexus ? "bg-[#2FBF84]" : "bg-slate-300"}`} />
          Hey Nexus {voicePrefs.heyNexus ? "on" : "off"}
        </button>
      ) : null}

      <div className="pointer-events-auto relative h-16 w-16 shrink-0">
        <button
          type="button"
          onClick={canTalk ? toggleMic : undefined}
          disabled={!canTalk}
          aria-label={orbMode === "listening" ? "Stop listening" : "Talk to Nexus"}
          title={heyNexusListening ? "Hey Nexus is on. Say “Hey Nexus”, or tap to talk." : "Talk to Nexus"}
          className="relative block h-full w-full rounded-full bg-[#082F2C] shadow-[0_14px_30px_-12px_rgba(10,42,39,0.9)] ring-1 ring-white/20 transition-transform duration-200 hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 disabled:cursor-default disabled:hover:scale-100"
        >
          <span aria-hidden="true" className="absolute inset-0 overflow-hidden rounded-full">
            <CrystalizedBall preset="plasma" color="#ef5050" size={0.92} crackle={0.85} fill={0.5} interactive hoverStrength={0.7} mode={orbMode} levelRef={levelRef} />
          </span>
        </button>
        {heyNexusListening ? (
          <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#082F2C] bg-[#7FE0B0]" title="Hey Nexus is on" />
        ) : null}
      </div>
    </div>
  );
}
