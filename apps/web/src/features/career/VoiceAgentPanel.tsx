/**
 * The voice agent: a tall dark panel with the crystal orb, what is being heard or said, and the
 * main microphone control. The orb listens (pulls everything to the centre), talks (shakes and
 * flashes) and thinks (swirls).
 */
import type { MutableRefObject } from "react";
import { Mic, Square } from "lucide-react";
import { CrystalizedBall, type OrbMode } from "../../components/CrystalizedBall";
import { heroShell } from "./spotlight";

const COPY: Record<OrbMode, { title: string; hint: string }> = {
  idle: { title: "Hi, I am Nexus", hint: "Tap the orb or the microphone, then talk about your career." },
  listening: { title: "Listening…", hint: "Go ahead, I'm listening." },
  thinking: { title: "Thinking…", hint: "Looking through your NEXUS data." },
  speaking: { title: "Speaking…", hint: "Tap Stop to interrupt." },
};

export function VoiceAgentPanel({
  mode,
  heard,
  said,
  canListen,
  canSpeak,
  listenNote,
  heyNexus = false,
  sessionActive = false,
  status = "",
  micDisabled = false,
  levelRef,
  onToggleMic,
  onStopSpeaking,
  className = "",
}: {
  mode: OrbMode;
  /** What the microphone has caught so far. */
  heard: string;
  /** The reply being read aloud. */
  said: string;
  canListen: boolean;
  canSpeak: boolean;
  /** Why voice input is unavailable, when it is. */
  listenNote?: string | null;
  /** What the voice input is busy doing (downloading the model, transcribing), if anything. */
  status?: string;
  /** "Hey Nexus" is switched on and listening. */
  heyNexus?: boolean;
  /** A hands-free conversation is under way. */
  sessionActive?: boolean;
  micDisabled?: boolean;
  levelRef: MutableRefObject<number>;
  onToggleMic: () => void;
  onStopSpeaking: () => void;
  className?: string;
}) {
  const copy = COPY[mode];
  const caption = mode === "listening" ? heard : mode === "speaking" ? said : "";
  const listening = mode === "listening";

  return (
    <aside aria-label="Nexus voice agent" className={`${heroShell} flex flex-col ${className}`}>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -left-16 top-1/3 h-64 w-64 rounded-full"
        style={{ background: "radial-gradient(circle, oklch(62% 0.2 25 / 0.28), transparent 70%)" }}
      />

      <div className="relative flex items-center justify-between px-5 pt-5">
        <p className="flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[#9CCBC2]">
          Nexus
          {heyNexus ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2 py-0.5 normal-case tracking-normal text-[var(--color-indigo-950)]">
              <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#7FE0B0]" />
              Hey Nexus on
            </span>
          ) : null}
        </p>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wider text-[var(--color-indigo-950)]">
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 rounded-full ${mode === "idle" ? "bg-[#9CCBC2]" : "bg-[oklch(70%_0.148_36)]"}`}
          />
          {mode}
        </span>
      </div>

      {/* The orb. Clicking it works like the microphone button for people using a mouse. */}
      <div
        className={`relative min-h-[15rem] flex-1 ${canListen ? "cursor-pointer" : ""}`}
        onClick={canListen ? onToggleMic : undefined}
      >
        <CrystalizedBall preset="plasma" color="#ef5050" size={0.7} crackle={0.85} fill={0.5} interactive hoverStrength={0.7} mode={mode} levelRef={levelRef} />
      </div>

      <div className="relative space-y-3 px-5 pb-5 text-center">
        <div aria-live="polite">
          <h2 className="font-display text-3xl leading-none text-[var(--color-indigo-950)]">{copy.title}</h2>
          <p className="mx-auto mt-2 line-clamp-3 min-h-[3.4rem] max-w-[22rem] text-sm leading-relaxed text-[#CFE5E0]">
            {sessionActive && mode === "listening" ? <span className="font-medium text-[var(--color-indigo-950)]">I'm listening. Say “that's all” when you're done.</span> : status ? <span className="font-medium text-[var(--color-indigo-950)]">{status}</span> : caption ? <span className="font-medium text-[var(--color-indigo-950)]">{caption}</span> : heyNexus && mode === "idle" ? "Just say “Hey Nexus” whenever you like. No clicking needed." : canListen || mode !== "idle" ? copy.hint : `${listenNote ?? "Voice input is not supported in this browser."} Replies can still be read aloud.`}
          </p>
        </div>

        <div className="flex items-center justify-center gap-3">
          {canListen ? (
            <button
              type="button"
              onClick={onToggleMic}
              disabled={micDisabled}
              aria-pressed={listening}
              aria-label={listening ? "Stop listening" : "Talk to Nexus"}
              className={`relative inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-indigo-900 ${
                micDisabled
                  ? "cursor-not-allowed bg-white/20 text-white/70"
                  : listening
                  ? "bg-[oklch(62%_0.17_36)] text-white shadow-[0_14px_28px_-12px_rgba(239,80,80,0.95)]"
                  : "bg-[var(--color-indigo-950)] text-indigo-800 hover:-translate-y-0.5"
              }`}
            >
              {listening ? <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" /> : <Mic className="h-4 w-4" aria-hidden="true" />}
              {listening ? "Done" : "Talk"}
            </button>
          ) : null}
          {mode === "speaking" && canSpeak ? (
            <button
              type="button"
              onClick={onStopSpeaking}
              className="rounded-full bg-white/15 px-5 py-3 text-sm font-semibold text-[var(--color-indigo-950)] transition-colors hover:bg-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Stop
            </button>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
