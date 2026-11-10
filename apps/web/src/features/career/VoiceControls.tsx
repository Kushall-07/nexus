/**
 * Voice pieces for the Career Copilot chat: the animated sound bars, the microphone button in the
 * composer, the per-reply listen button and the voice settings menu. The big voice agent with the
 * orb lives in VoiceAgentPanel.
 */
import { Mic, Settings2, Square, Volume2 } from "lucide-react";
import type { VoicePrefs } from "../../lib/speech";

/** A row of bars that dance while `active`. */
export function Wave({ active, bars = 5, className = "" }: { active: boolean; bars?: number; className?: string }) {
  return (
    <span aria-hidden="true" className={`nx-wave inline-flex h-5 items-center gap-[3px] ${active ? "nx-wave-on" : ""} ${className}`}>
      {Array.from({ length: bars }, (_, index) => (
        <span key={index} className="nx-wave-bar block w-[3px] rounded-full bg-current" style={{ animationDelay: `${index * 0.11}s` }} />
      ))}
    </span>
  );
}

/** Round microphone button that pulses while listening. */
export function MicButton({ listening, disabled, onClick }: { listening: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={listening}
      aria-label={listening ? "Stop listening" : "Start voice input"}
      title={listening ? "Stop listening" : "Speak your question"}
      className={`relative grid h-10 w-10 shrink-0 place-items-center rounded-full transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
        listening
          ? "bg-[oklch(62%_0.17_36)] text-white shadow-[0_10px_22px_-10px_rgba(200,80,50,0.95)]"
          : "bg-slate-100 text-indigo-700 hover:bg-indigo-700 hover:text-[var(--color-indigo-950)]"
      }`}
    >
      {listening ? (
        <>
          <span aria-hidden="true" className="nx-mic-ring absolute inset-0 rounded-full" />
          <span aria-hidden="true" className="nx-mic-ring absolute inset-0 rounded-full" style={{ animationDelay: "0.7s" }} />
          <Square className="relative h-3.5 w-3.5 fill-current" aria-hidden="true" />
        </>
      ) : (
        <Mic className="h-[1.15rem] w-[1.15rem]" aria-hidden="true" />
      )}
    </button>
  );
}

/** Reads one reply aloud, or stops it. */
export function ListenButton({ speaking, onClick }: { speaking: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={speaking}
      aria-label={speaking ? "Stop reading this reply" : "Listen to this reply"}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 ${
        speaking ? "bg-indigo-700 text-[var(--color-indigo-950)]" : "bg-white/70 text-indigo-700 hover:bg-white"
      }`}
    >
      {speaking ? <Wave active bars={4} className="h-3.5" /> : <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />}
      {speaking ? "Stop" : "Listen"}
    </button>
  );
}

const RATES = [
  { label: "Slower", value: 0.85 },
  { label: "Normal", value: 1 },
  { label: "Faster", value: 1.2 },
];

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 rounded-xl px-2 py-2 hover:bg-slate-100">
      <span>
        <span className="block text-sm font-semibold text-slate-900">{label}</span>
        <span className="block text-xs text-slate-500">{hint}</span>
      </span>
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span
        aria-hidden="true"
        className="relative mt-0.5 h-5 w-9 shrink-0 rounded-full bg-slate-300 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-indigo-700 peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-700 peer-focus-visible:ring-offset-2"
      />
    </label>
  );
}

/** Small menu for how the Copilot listens and speaks. */
export function VoiceSettings({
  prefs,
  onChange,
  canListen,
  canSpeak,
  listenNote,
  engine = "browser",
  natural,
  voices = [],
  onPreview,
  handsFree,
}: {
  /** The hands-free "Hey Nexus" listener. Omitted when this browser cannot do it. */
  handsFree?: { status: "off" | "starting" | "listening" | "checking"; progress: number | null; error: string | null };
  engine?: "browser" | "device";
  /** State of the natural voice that runs on this device. */
  natural?: { supported: boolean; status: "idle" | "loading" | "ready" | "error" | "unsupported"; progress: number | null; active: boolean };
  voices?: ReadonlyArray<{ id: string; label: string; note: string }>;
  onPreview?: () => void;
  prefs: VoicePrefs;
  onChange: (patch: Partial<VoicePrefs>) => void;
  canListen: boolean;
  canSpeak: boolean;
  /** Why voice input is unavailable, shown in place of its settings. */
  listenNote?: string | null;
}) {
  return (
    <details className="group relative">
      <summary
        aria-label="Voice settings"
        title="Voice settings"
        className="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 [&::-webkit-details-marker]:hidden"
      >
        <Settings2 className="h-[1.1rem] w-[1.1rem]" aria-hidden="true" />
      </summary>
      <div className="absolute bottom-12 right-0 z-20 max-h-[min(30rem,calc(100vh-20rem))] w-[min(20rem,calc(100vw-2rem))] space-y-1 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_24px_50px_-20px_rgba(10,42,39,0.5)]">
        <p className="px-2 pb-1 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-500">Voice</p>
        {handsFree ? (
          <>
            <Toggle
              label="Hey Nexus (hands-free)"
              hint="Say “Hey Nexus” and it answers, no clicking. Works only while this page is open. Your voice is checked on this device, never sent or saved."
              checked={prefs.heyNexus}
              onChange={(heyNexus) => onChange({ heyNexus })}
            />
            {prefs.heyNexus ? (
              <p role="status" className="px-2 pb-1 text-xs text-slate-500">
                {handsFree.error
                  ? handsFree.error
                  : handsFree.progress !== null
                    ? `Getting ready… ${Math.round(handsFree.progress * 100)}%`
                    : handsFree.status === "listening" || handsFree.status === "checking"
                      ? "Listening for “Hey Nexus”."
                      : "Getting ready…"}
              </p>
            ) : null}
          </>
        ) : null}
        {canSpeak ? (
          <>
            {natural?.supported ? (
              <>
                <Toggle
                  label="Natural voice"
                  hint="A warmer, human-sounding voice that runs on this device. Needs a computer with a graphics card (WebGPU). It downloads about 330 MB once, then works offline. Until it is ready, the browser voice speaks."
                  checked={prefs.naturalVoice}
                  onChange={(naturalVoice) => onChange({ naturalVoice })}
                />
                {prefs.naturalVoice ? (
                  <div className="space-y-2 px-2 pb-1">
                    <p role="status" className="text-xs text-slate-500">
                      {natural.status === "unsupported"
                        ? "This device cannot run the natural voice smoothly (it needs a graphics card with WebGPU), so the browser voice is used."
                        : natural.status === "ready"
                        ? "Natural voice is ready."
                        : natural.status === "error"
                          ? "The natural voice could not be loaded, so the browser voice is used."
                          : natural.progress !== null
                            ? `Getting the voice ready… ${Math.round(natural.progress * 100)}%`
                            : "Getting the voice ready…"}
                    </p>
                    <div role="group" aria-label="Natural voice" className="flex flex-wrap gap-1.5">
                      {voices.map((voice) => (
                        <button
                          key={voice.id}
                          type="button"
                          title={voice.note}
                          aria-pressed={prefs.voice === voice.id}
                          onClick={() => onChange({ voice: voice.id })}
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 ${
                            prefs.voice === voice.id ? "bg-indigo-700 text-[var(--color-indigo-950)]" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          }`}
                        >
                          {voice.label}
                        </button>
                      ))}
                    </div>
                    {onPreview ? (
                      <button type="button" onClick={onPreview} className="text-xs font-semibold text-indigo-700 underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700">
                        Hear this voice
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : null}
            <Toggle label="Read every reply aloud" hint="Replies to spoken questions are always read aloud." checked={prefs.readAloud} onChange={(readAloud) => onChange({ readAloud })} />
            <div className="px-2 py-1.5">
              <p className="mb-1.5 text-xs font-semibold text-slate-700">Speaking speed</p>
              <div role="group" aria-label="Speaking speed" className="flex gap-1.5">
                {RATES.map((rate) => (
                  <button
                    key={rate.value}
                    type="button"
                    aria-pressed={prefs.rate === rate.value}
                    onClick={() => onChange({ rate: rate.value })}
                    className={`flex-1 rounded-full px-2 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 ${
                      prefs.rate === rate.value ? "bg-indigo-700 text-[var(--color-indigo-950)]" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {rate.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <p className="px-2 text-xs text-slate-500">This browser cannot read replies aloud.</p>
        )}
        {canListen ? (
          <Toggle label="Send when I stop talking" hint="Turn off to review what was heard before sending." checked={prefs.autoSend} onChange={(autoSend) => onChange({ autoSend })} />
        ) : (
          <p className="px-2 pt-1 text-xs text-slate-500">{listenNote ?? "Voice input is not supported in this browser. Try Chrome, Edge or Safari."}</p>
        )}
        {canListen ? (
          <p className="px-2 pt-1 text-[0.7rem] leading-relaxed text-slate-500">
            {engine === "device"
              ? "Voice input runs on this computer. Your audio is not sent anywhere. The first use downloads a small speech model (about 40 MB), then it works offline."
              : "Voice input uses your browser's speech service, which may process your audio. NEXUS does not record or store it."}
          </p>
        ) : null}
      </div>
    </details>
  );
}
