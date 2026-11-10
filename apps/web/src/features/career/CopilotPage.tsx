import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Clock, MessageSquarePlus, Sparkles, Trash2, X } from "lucide-react";
import type { CopilotCard, OpportunityItem } from "../../api/career-types";
import { ChatText } from "../../components/ChatText";
import { describeError } from "../../components/StateViews";
import { NATURAL_VOICES } from "../../lib/speech";
import { useNexus } from "../nexus/NexusProvider";
import { type StoredSession } from "./chatHistory";
import { GapList } from "./DevelopmentPage";
import { ExternalLink, JobCard, MatchDetail, buttonClass, primaryButtonClass } from "./jobParts";
import { prefersReducedMotion } from "./spotlight";
import { ListenButton, MicButton, VoiceSettings } from "./VoiceControls";
import { VoiceAgentPanel } from "./VoiceAgentPanel";

function CardView({ card, onExplain, saved, onToggleSave }: { card: CopilotCard; onExplain: (item: OpportunityItem) => void; saved: Record<string, boolean>; onToggleSave: (item: OpportunityItem) => void }) {
  if (card.type === "jobs") {
    return (
      <div className="space-y-2">
        {card.source === "demo" ? (
          <p className="rounded-full border border-violet-300 bg-violet-100 px-3 py-0.5 text-xs font-medium text-violet-900 inline-block">
            Demo examples — not real vacancies.
          </p>
        ) : null}
        <ul className="space-y-2" aria-label="Job results">
          {card.items.map((item) => {
            const shown = { ...item, saved: saved[item.job.id] === undefined ? item.saved : saved[item.job.id] ? (item.saved ?? { status: "saved" as const, note: "", statusDate: null }) : null };
            return (
              <li key={item.job.id}>
                <JobCard item={shown} onToggleSave={onToggleSave} />
                <button type="button" className={`${buttonClass} mt-1.5`} onClick={() => onExplain(item)}>
                  Why this match?{" "}<span className="sr-only">for {item.job.title}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }
  if (card.type === "match") {
    return (
      <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
        <h4 className="font-semibold text-slate-900">{card.job.title}</h4>
        <ExternalLink job={card.job} />
        <MatchDetail item={{ job: card.job, match: card.match, saved: null }} />
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <h4 className="font-semibold text-slate-900">{card.analysis.direction.displayName}: top skill gaps</h4>
      <p className="text-xs text-slate-500">
        {card.analysis.demand.source === "demo" ? "Employer-demand figures use demo fixtures. " : card.analysis.demand.source === "none" ? "No listings sampled; based on the role benchmark. " : ""}
        {card.analysis.caveats[0]}
      </p>
      <GapList analysis={{ ...card.analysis, gaps: card.analysis.gaps.slice(0, 3) }} />
      <Link to="/development" className="text-sm font-medium text-indigo-700 underline">Open the full plan and track tasks</Link>
    </div>
  );
}

function formatWhen(timestamp: number): string {
  return new Date(timestamp).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** The list of earlier conversations, sliding in over the chat. */
function HistoryPanel({
  sessions,
  activeId,
  onOpen,
  onDelete,
  onClear,
  onNew,
  onClose,
}: {
  sessions: StoredSession[];
  activeId: string;
  onOpen: (session: StoredSession) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  onNew: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 z-10 bg-slate-900/25"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.aside
        aria-label="Conversation history"
        className="absolute inset-y-0 left-0 z-20 flex w-[min(19rem,88%)] flex-col border-r border-slate-200 bg-white shadow-[24px_0_50px_-30px_rgba(10,42,39,0.5)]"
        initial={prefersReducedMotion() ? false : { x: "-100%" }}
        animate={{ x: 0 }}
        exit={{ x: "-100%" }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-4">
          <h2 className="font-display text-2xl leading-none text-slate-900">History</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close history"
            className="grid h-8 w-8 place-items-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="px-4 pb-3">
          <button type="button" onClick={onNew} className="nx-btn nx-btn-primary nx-btn-sm w-full justify-center">
            <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden="true" />
            New chat
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {sessions.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-slate-500">No saved conversations yet. They appear here as you chat.</p>
          ) : (
            <ul className="space-y-1">
              {sessions.map((session) => (
                <li key={session.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => onOpen(session)}
                    aria-current={session.id === activeId ? "true" : undefined}
                    className={`w-full rounded-xl px-3 py-2.5 pr-10 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 ${
                      session.id === activeId ? "bg-[oklch(93%_0.04_178)]" : "hover:bg-slate-100"
                    }`}
                  >
                    <span className="block truncate text-sm font-semibold text-slate-900">{session.title}</span>
                    <span className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      {formatWhen(session.updatedAt)}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(session.id)}
                    aria-label={`Delete conversation: ${session.title}`}
                    className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-slate-400 opacity-0 transition-all hover:bg-white hover:text-red-600 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="space-y-2 border-t border-slate-200 px-4 py-3">
          <p className="text-[0.7rem] leading-relaxed text-slate-500">Saved only in this browser. Job results are a snapshot from when you asked.</p>
          {sessions.length > 0 ? (
            <button type="button" onClick={onClear} className="text-xs font-semibold text-red-700 underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700">
              Clear all history
            </button>
          ) : null}
        </div>
      </motion.aside>
    </>
  );
}

export function CopilotPage() {
  const nexus = useNexus();
  const {
    messages, inputValue, setInputValue, sending, error, prompts, loadPrompts, saved, sessions, sessionId, restored, title,
    voicePrefs, setVoicePrefs, speaker, recognizer, wake, handsFreeAvailable, orbMode, voiceStatus, levelRef,
    spokenMessage, send, toggleMic, toggleSave, runAction, deleteSession, clearHistory, sessionActive,
  } = nexus;
  const [historyOpen, setHistoryOpen] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  // Nexus itself lives above the pages and keeps going while you move around; this page is just the chat view.
  useEffect(() => {
    loadPrompts();
  }, [loadPrompts]);

  useEffect(() => {
    end.current?.scrollIntoView?.({ block: "end" });
  }, [messages, sending]);

  const startNewChat = () => {
    nexus.startNewChat();
    setHistoryOpen(false);
  };
  const openSession = (session: StoredSession) => {
    nexus.openSession(session);
    setHistoryOpen(false);
  };

  function submit(event: FormEvent) {
    event.preventDefault();
    const text = inputValue;
    setInputValue("");
    void send(text);
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div>
        <h1 className="font-display text-slate-900" style={{ fontSize: "2rem", lineHeight: 1, letterSpacing: "-0.025em" }}>
          Career Copilot
        </h1>
        <p className="mt-2 text-sm text-slate-500 max-w-2xl" style={{ lineHeight: 1.65 }}>
          Chat with Nexus like you would with a friend: internships, courses, which role suits you, interview nerves, or anything else on your mind. When it is about your own skills or job listings, I use your real NEXUS data, so nothing is made up.
        </p>
      </div>

      <div className="grid gap-5 lg:h-[calc(100vh-11.5rem)] lg:min-h-[34rem] lg:grid-cols-[minmax(0,13fr)_minmax(0,7fr)]">
        {/* ── Chat ─────────────────────────────────────────────────────────── */}
        <section aria-label="Chat" className="nx-card relative flex min-h-[34rem] min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white lg:min-h-0">
          <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2.5">
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              aria-expanded={historyOpen}
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700"
            >
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              History
              {sessions.length > 0 ? <span className="rounded-full bg-white px-1.5 text-[0.65rem] tabular-nums text-slate-600">{sessions.length}</span> : null}
            </button>
            <p className="min-w-0 flex-1 truncate text-center text-sm font-semibold text-slate-700">{title}</p>
            <button
              type="button"
              onClick={startNewChat}
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-700 hover:text-[var(--color-indigo-950)] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700"
            >
              <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden="true" />
              New chat
            </button>
          </div>

          <div role="log" aria-live="polite" aria-label="Conversation" className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
            {restored ? (
              <p className="rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-600">
                Earlier conversation. Job results are a snapshot from when you asked; ask again for fresh listings.
              </p>
            ) : null}

            {messages.length === 0 ? (
              <div className="mx-auto max-w-xl space-y-5 py-4">
                <div className="space-y-2 text-center">
                  <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[oklch(93%_0.04_178)] text-indigo-700">
                    <Sparkles className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <h2 className="font-display text-3xl leading-none text-indigo-700">Hi, I'm Nexus. What's on your mind?</h2>
                  <p className="text-sm text-slate-500">I'm your career guide. Ask me anything, type or talk, or start with one of these.</p>
                </div>
                <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-slate-500">Get started</p>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {prompts.map((prompt, index) => (
                    <li key={prompt} className={index === prompts.length - 1 && prompts.length % 2 === 1 ? "sm:col-span-2" : ""}>
                      <button
                        type="button"
                        className="group flex h-full w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-medium text-slate-800 transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-700 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 disabled:opacity-60"
                        onClick={() => void send(prompt)}
                        disabled={sending}
                      >
                        {prompt}
                        <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-indigo-700" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {messages.map((message) =>
              message.role === "user" ? (
                <div key={message.id} className="flex justify-end">
                  <div
                    className="max-w-[85%] rounded-2xl rounded-tr-sm px-4 py-3 text-sm"
                    style={{ background: "var(--color-indigo-700)", color: "var(--color-indigo-950)" }}
                  >
                    <p className="sr-only">You said:</p>
                    <p className="font-medium">{message.text}</p>
                  </div>
                </div>
              ) : (
                <div key={message.id} className="max-w-full space-y-3">
                  <p className="sr-only">Nexus said:</p>
                  <div className="flex items-start gap-2.5">
                    <span aria-hidden="true" className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-[oklch(93%_0.04_178)] text-indigo-700">
                      <Sparkles className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="rounded-2xl rounded-tl-sm border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-900">
                        <ChatText text={message.text} />
                        {message.note ? <p className="mt-1.5 text-xs text-slate-500 italic">{message.note}</p> : null}
                        {speaker.supported && message.text ? (
                          <div className="mt-2.5">
                            <ListenButton
                              speaking={speaker.speakingId === String(message.id)}
                              onClick={() =>
                                speaker.speakingId === String(message.id)
                                  ? speaker.cancel()
                                  : speaker.speak(String(message.id), message.text, voicePrefs.rate)
                              }
                            />
                          </div>
                        ) : null}
                      </div>
                      {message.cards.map((card, index) => (
                        <CardView
                          key={index}
                          card={card}
                          saved={saved}
                          onToggleSave={toggleSave}
                          onExplain={(item) => void send("Why is this job a good or poor match?", item.job.id)}
                        />
                      ))}
                      {/* "click" and "remember" are things Nexus does by itself; only the rest are buttons. */}
                      {message.actions.some((action) => action.kind !== "click" && action.kind !== "remember") ? (
                        <div className="flex flex-wrap gap-2">
                          {message.actions.map((action) =>
                            action.kind === "click" || action.kind === "remember" ? null : action.kind === "navigate" ? (
                              <Link key={action.label} to={action.to} className="nx-btn nx-btn-primary nx-btn-sm">
                                {action.label}
                              </Link>
                            ) : action.kind === "search-demo" ? (
                              <Link key={action.label} to="/opportunities?source=demo" className="nx-btn nx-btn-primary nx-btn-sm">
                                {action.label}
                              </Link>
                            ) : (
                              <button key={action.label} type="button" className="nx-btn nx-btn-primary nx-btn-sm" onClick={() => void runAction(action)}>
                                {action.label}
                              </button>
                            ),
                          )}
                        </div>
                      ) : null}
                      {message.suggestions.length > 0 ? (
                        <ul className="flex flex-wrap gap-2" aria-label="Suggested follow-ups">
                          {message.suggestions.map((suggestion) => (
                            <li key={suggestion}>
                              <button type="button" className={buttonClass} onClick={() => void send(suggestion)} disabled={sending}>
                                {suggestion}
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </div>
                </div>
              ),
            )}

            {sending ? (
              <div className="flex items-center gap-2 px-1">
                <div className="flex items-center gap-1" aria-hidden="true">
                  <span className="nx-typing-dot inline-block h-1.5 w-1.5 rounded-full bg-indigo-700" />
                  <span className="nx-typing-dot inline-block h-1.5 w-1.5 rounded-full bg-indigo-700" />
                  <span className="nx-typing-dot inline-block h-1.5 w-1.5 rounded-full bg-indigo-700" />
                </div>
                <p role="status" className="text-sm text-slate-500">Thinking…</p>
              </div>
            ) : null}
            <div ref={end} />
          </div>

          {recognizer.error ? (
            <div role="alert" className="mx-4 mb-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
              {recognizer.error}
            </div>
          ) : null}

          {error ? (
            <div role="alert" className="mx-4 mb-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-900">
              {describeError(error)}
            </div>
          ) : null}

          {/* Input */}
          <div className="border-t border-slate-200 bg-slate-50/60 p-3">
            <form onSubmit={submit} aria-label="Message Nexus" className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm transition-all duration-150 focus-within:border-indigo-300 focus-within:shadow-[0_0_0_3px_oklch(30%_0.065_192_/_0.08)]">
              <label htmlFor="copilot-input" className="sr-only">Your message</label>
              <input
                id="copilot-input"
                className="min-w-0 flex-1 bg-transparent px-2 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none"
                maxLength={1500}
                autoComplete="off"
                placeholder={recognizer.listening ? "Listening…" : recognizer.supported ? "Type, or tap the microphone and speak" : "Ask me anything about your career"}
                value={recognizer.listening ? recognizer.interim : inputValue}
                readOnly={recognizer.listening}
                onChange={(event) => setInputValue(event.target.value)}
              />
              {recognizer.supported || speaker.supported ? (
                <VoiceSettings prefs={voicePrefs} onChange={setVoicePrefs} canListen={recognizer.supported} canSpeak={speaker.supported} listenNote={recognizer.unsupportedNote} engine={recognizer.engine} handsFree={handsFreeAvailable ? { status: wake.status, progress: wake.modelProgress, error: wake.error } : undefined} natural={speaker.natural} voices={NATURAL_VOICES} onPreview={() => speaker.speak("preview", "Hi! I'm your career guide. It's lovely to meet you. How can I help today?", voicePrefs.rate)} />
              ) : null}
              {recognizer.supported ? <MicButton listening={recognizer.listening} disabled={sending || recognizer.transcribing} onClick={toggleMic} /> : null}
              <button
                type="submit"
                className={`${primaryButtonClass} flex items-center gap-1.5 shrink-0`}
                disabled={sending || inputValue.trim() === ""}
                style={{ color: "var(--color-indigo-950)" }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M1 7h12M7 1l6 6-6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Send
              </button>
            </form>
          </div>

          <AnimatePresence>
            {historyOpen ? (
              <HistoryPanel
                sessions={sessions}
                activeId={sessionId}
                onOpen={openSession}
                onDelete={deleteSession}
                onClear={clearHistory}
                onNew={startNewChat}
                onClose={() => setHistoryOpen(false)}
              />
            ) : null}
          </AnimatePresence>
        </section>

        {/* ── Voice agent ──────────────────────────────────────────────────── */}
        <VoiceAgentPanel
          className="min-h-[28rem] lg:min-h-0"
          mode={orbMode}
          heard={recognizer.interim}
          said={spokenMessage?.role === "assistant" ? spokenMessage.text : ""}
          canListen={recognizer.supported}
          canSpeak={speaker.supported}
          listenNote={recognizer.unsupportedNote}
          status={voiceStatus}
          heyNexus={voicePrefs.heyNexus && (wake.status === "listening" || wake.status === "checking")}
          sessionActive={sessionActive}
          micDisabled={recognizer.transcribing}
          levelRef={levelRef}
          onToggleMic={toggleMic}
          onStopSpeaking={speaker.cancel}
        />
      </div>
    </div>
  );
}
