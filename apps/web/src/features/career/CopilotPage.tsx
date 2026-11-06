import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ApiError, apiDelete, apiGet, apiPost, apiPut } from "../../api/client";
import type { CopilotAction, CopilotCard, CopilotResponse, OpportunityItem, RefreshResult, SavedJobRecord } from "../../api/career-types";
import { describeError } from "../../components/StateViews";
import { GapList } from "./DevelopmentPage";
import { ExternalLink, JobCard, MatchDetail, buttonClass, inputClass, primaryButtonClass } from "./jobParts";

type Message =
  | { id: number; role: "user"; text: string }
  | { id: number; role: "assistant"; text: string; cards: CopilotCard[]; actions: CopilotAction[]; suggestions: string[]; note?: string };

type Draft = Omit<Extract<Message, { role: "user" }>, "id"> | Omit<Extract<Message, { role: "assistant" }>, "id">;

let nextId = 1;

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

export function CopilotPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [prompts, setPrompts] = useState<string[]>([]);
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiGet<{ prompts: string[] }>("/api/copilot/prompts").then((data) => setPrompts(data.prompts), () => undefined);
  }, []);

  useEffect(() => {
    end.current?.scrollIntoView?.({ block: "end" });
  }, [messages]);

  const push = (message: Draft) => setMessages((all) => [...all, { ...message, id: nextId++ } as Message]);

  async function send(text: string, jobId?: string) {
    const message = text.trim();
    if (!message || sending) return;
    setSending(true);
    setError(null);
    push({ role: "user", text: message });
    try {
      const reply = await apiPost<CopilotResponse>("/api/copilot/message", jobId ? { message, jobId } : { message });
      push({
        role: "assistant",
        text: reply.text,
        cards: reply.cards,
        actions: reply.actions,
        suggestions: reply.suggestions,
        note: reply.interpretedBy === "llm" ? "Request interpreted with the optional AI model; results come from NEXUS services." : undefined,
      });
    } catch (failure) {
      setError(failure instanceof ApiError ? failure : new ApiError(0, "UNKNOWN_ERROR", "The request failed."));
    } finally {
      setSending(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const text = inputValue;
    setInputValue("");
    void send(text);
  }

  async function toggleSave(item: OpportunityItem) {
    const isSaved = saved[item.job.id] ?? item.saved !== null;
    try {
      if (isSaved) await apiDelete(`/api/saved-jobs/${encodeURIComponent(item.job.id)}`);
      else await apiPut<SavedJobRecord>(`/api/saved-jobs/${encodeURIComponent(item.job.id)}`, { status: "saved" });
      setSaved((all) => ({ ...all, [item.job.id]: !isSaved }));
    } catch (failure) {
      setError(failure instanceof ApiError ? failure : new ApiError(0, "UNKNOWN_ERROR", "The request failed."));
    }
  }

  async function runAction(action: CopilotAction) {
    setError(null);
    try {
      if (action.kind === "refresh-profile") {
        const result = await apiPost<RefreshResult>("/api/career/refresh");
        push({ role: "assistant", text: result.message, cards: [], actions: [], suggestions: result.status === "succeeded" ? ["Show me jobs for which I already meet most of the requirements"] : [] });
      } else if (action.kind === "set-direction") {
        await apiPut("/api/career/direction", { directionId: action.directionId });
        push({ role: "assistant", text: `Career direction set to ${action.label}. You can change or clear it any time.`, cards: [], actions: [], suggestions: ["What are the most important skills I am missing?"] });
      }
    } catch (failure) {
      setError(failure instanceof ApiError ? failure : new ApiError(0, "UNKNOWN_ERROR", "The request failed."));
    }
  }

  return (
    <div className="flex h-full flex-col space-y-4">
      {/* Header */}
      <div>
        <h1 className="font-display text-slate-900" style={{ fontSize: "1.75rem", lineHeight: 1, letterSpacing: "-0.02em" }}>Career Copilot</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Ask in plain language. Answers come from your real NEXUS data — the Copilot never invents listings, scores or skills.
        </p>
      </div>

      {/* Chat log */}
      <div
        role="log"
        aria-live="polite"
        aria-label="Conversation"
        className="flex-1 min-h-64 space-y-3 rounded-xl border border-slate-200 bg-white p-4 overflow-y-auto"
      >
        {messages.length === 0 ? (
          <div>
            <p className="text-sm font-medium text-slate-700">Try one of these to get started:</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {prompts.map((prompt) => (
                <li key={prompt}>
                  <button
                    type="button"
                    className={buttonClass}
                    onClick={() => void send(prompt)}
                    disabled={sending}
                  >
                    {prompt}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {messages.map((message) =>
          message.role === "user" ? (
            <div key={message.id} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-indigo-700 px-4 py-2.5 text-sm text-white">
                <p className="sr-only">You said:</p>
                {message.text}
              </div>
            </div>
          ) : (
            <div key={message.id} className="max-w-full space-y-3">
              <p className="sr-only">Copilot said:</p>
              <div className="rounded-2xl rounded-tl-sm border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900">
                <p>{message.text}</p>
                {message.note ? (
                  <p className="mt-1 text-xs text-slate-500">{message.note}</p>
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
              {message.actions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {message.actions.map((action) =>
                    action.kind === "navigate" ? (
                      <Link key={action.label} to={action.to} className={`${primaryButtonClass} inline-block`}>
                        {action.label}
                      </Link>
                    ) : action.kind === "search-demo" ? (
                      <Link key={action.label} to="/opportunities?source=demo" className={`${primaryButtonClass} inline-block`}>
                        {action.label}
                      </Link>
                    ) : (
                      <button key={action.label} type="button" className={primaryButtonClass} onClick={() => void runAction(action)}>
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
                      <button
                        type="button"
                        className={buttonClass}
                        onClick={() => void send(suggestion)}
                        disabled={sending}
                      >
                        {suggestion}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
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

      {error ? (
        <p role="alert" className="rounded-xl border border-red-300 bg-red-100 px-4 py-3 text-sm text-red-900">
          {describeError(error)}
        </p>
      ) : null}

      {/* Input */}
      <form onSubmit={submit} className="flex gap-2" aria-label="Message the Copilot">
        <div className="grow">
          <label htmlFor="copilot-input" className="sr-only">Your message</label>
          <input
            id="copilot-input"
            className={inputClass}
            maxLength={500}
            autoComplete="off"
            placeholder="e.g. Find remote backend internships"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
          />
        </div>
        <button
          type="submit"
          className={primaryButtonClass}
          disabled={sending || inputValue.trim() === ""}
        >
          Send
        </button>
      </form>
    </div>
  );
}
