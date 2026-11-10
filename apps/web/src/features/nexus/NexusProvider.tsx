/**
 * Nexus, the career guide and hands-free assistant, for the whole app.
 *
 * Everything about the conversation (the messages, the notes, the voice, the hands-free session, the orb) lives here,
 * above the pages, so it keeps going while the person moves around.
 *
 * Hands-free works as a conversation. Saying "Hey Nexus" starts a session: from then on Nexus listens for each
 * request, answers or acts, and goes back to listening, with no need to say its name again. A session ends when the
 * person says "stop" (while it talks) or "that's all", or after a stretch of silence, and then Nexus waits for
 * "Hey Nexus" again.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, apiDelete, apiGet, apiPost, apiPut } from "../../api/client";
import type { CopilotAction, CopilotResponse, OpportunityItem, RefreshResult, SavedJobRecord } from "../../api/career-types";
import { useAuth } from "../../auth/AuthContext";
import { useHandsFree, type HandsFree, type Utterance } from "../../lib/handsFree";
import { localRecognitionSupported } from "../../lib/localRecognizer";
import { capturePage, clickPageElement, needsPage, scrollPage } from "../../lib/pageContext";
import { useVoicePrefs, type VoicePrefs } from "../../lib/speech";
import { matchEndSession, matchScroll, matchStop, matchTimeDate } from "../../lib/voiceCommands";
import { useVoiceInput, type VoiceInput } from "../../lib/voiceInput";
import { matchNavigation } from "../../lib/voiceNavigation";
import { useVoiceOutput, type VoiceOutput } from "../../lib/voiceOutput";
import { matchWakeWord, playChime } from "../../lib/wakeWord";
import {
  highestMessageId,
  loadSessions,
  newSessionId,
  saveSessions,
  titleFor,
  upsertSession,
  type Message,
  type StoredSession,
} from "../career/chatHistory";

type Draft = Omit<Extract<Message, { role: "user" }>, "id"> | Omit<Extract<Message, { role: "assistant" }>, "id">;

let nextId = 1;

/** How long a hands-free session waits in silence before it lets go and waits for "Hey Nexus" again. */
const SESSION_IDLE_MS = 25_000;
const MAX_NOTES = 14;
/** Sounds a speech model makes up from noise. They are not requests. */
const NOT_A_REQUEST = /^(?:you|uh+|um+|hm+|mm+|ah+|oh+|the|a|and)\W*$/i;

export type OrbState = "idle" | "listening" | "speaking" | "thinking";

export interface NexusValue {
  messages: Message[];
  inputValue: string;
  setInputValue: (value: string) => void;
  sending: boolean;
  error: ApiError | null;
  prompts: string[];
  loadPrompts: () => void;
  saved: Record<string, boolean>;
  sessions: StoredSession[];
  sessionId: string;
  restored: boolean;
  title: string;
  /** Short facts Nexus has kept about the person's goals and plans for this session. */
  notes: string[];

  voicePrefs: VoicePrefs;
  setVoicePrefs: (patch: Partial<VoicePrefs>) => void;
  speaker: VoiceOutput;
  recognizer: VoiceInput;
  wake: HandsFree;
  handsFreeAvailable: boolean;
  /** "Hey Nexus" is on and the microphone is being watched. */
  heyNexusListening: boolean;
  /** A hands-free conversation is under way: Nexus is listening for the next request without being called. */
  sessionActive: boolean;
  /**
   * The browser is holding sound back because nobody has clicked on this page yet (common right after a reload with
   * "Hey Nexus" on). Nexus keeps listening and answers in text until the page is clicked once.
   */
  audioLocked: boolean;
  orbMode: OrbState;
  voiceStatus: string;
  levelRef: { current: number };
  /** The reply being read aloud right now, if any. */
  spokenMessage: Message | undefined;
  lastReply: Message | undefined;

  send: (text: string, jobId?: string, viaVoice?: boolean) => Promise<void>;
  toggleMic: () => void;
  toggleSave: (item: OpportunityItem) => Promise<void>;
  runAction: (action: CopilotAction) => Promise<void>;
  startNewChat: () => void;
  openSession: (session: StoredSession) => void;
  deleteSession: (id: string) => void;
  clearHistory: () => void;
}

const NexusContext = createContext<NexusValue | null>(null);

export function useNexus(): NexusValue {
  const value = useContext(NexusContext);
  if (!value) throw new Error("useNexus must be used inside <NexusProvider>.");
  return value;
}

const asError = (failure: unknown) => (failure instanceof ApiError ? failure : new ApiError(0, "UNKNOWN_ERROR", "The request failed."));

export function NexusProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { state: authState } = useAuth();
  const userKey = authState.status === "authenticated" ? (authState.user.githubId ?? authState.user.username ?? "user") : "anonymous";

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [prompts, setPrompts] = useState<string[]>([]);
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<string[]>([]);
  // The latest conversation and notes, for what is sent along with each question.
  const messagesRef = useRef<Message[]>([]);
  messagesRef.current = messages;
  const notesRef = useRef<string[]>([]);
  notesRef.current = notes;
  const [sessions, setSessions] = useState<StoredSession[]>(() => loadSessions(userKey));
  const [sessionId, setSessionId] = useState(newSessionId);
  const [restored, setRestored] = useState(false);
  const promptsRequested = useRef(false);

  const [voicePrefs, setVoicePrefs] = useVoicePrefs();
  // Loudness shared with the orb: the microphone level while listening, a kick on each spoken word.
  const levelRef = useRef(0);
  // The natural voice (on this device) when it is ready, the browser voice otherwise.
  const speaker = useVoiceOutput(voicePrefs, levelRef, () => {
    levelRef.current = Math.max(levelRef.current, 0.9);
  });
  // Latest values for callbacks that must not be recreated on every render.
  const voiceRef = useRef({ prefs: voicePrefs, sending: false });
  voiceRef.current = { prefs: voicePrefs, sending };
  const recognizer = useVoiceInput((transcript) => {
    if (voiceRef.current.prefs.autoSend && !voiceRef.current.sending) {
      setInputValue("");
      void send(transcript, undefined, true);
    } else {
      setInputValue(transcript);
    }
  }, levelRef);

  /* ───────────── the hands-free conversation ───────────── */

  const [sessionActive, setSessionActive] = useState(false);
  const sessionRef = useRef(false);
  const [activity, setActivity] = useState(0);
  const speakingRef = useRef(false);
  const speakingEndedAt = useRef(0);
  const sendingRef = useRef(false);

  // Browsers only allow sound after the person has clicked or pressed a key on the page. With "Hey Nexus" starting by
  // itself after a reload there may have been no click yet. Then speaking would never finish, so skip it, and say so.
  const [audioLocked, setAudioLocked] = useState(() => {
    const activation = typeof navigator === "undefined" ? undefined : (navigator as unknown as { userActivation?: { hasBeenActive: boolean } }).userActivation;
    return activation ? !activation.hasBeenActive : false;
  });
  const audioLockedRef = useRef(audioLocked);
  audioLockedRef.current = audioLocked;
  useEffect(() => {
    if (!audioLocked) return undefined;
    const unlock = () => {
      audioLockedRef.current = false;
      setAudioLocked(false);
      speaker.prime();
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [audioLocked]);
  sendingRef.current = sending;

  // Remember when Nexus last stopped talking, so its own voice fading out is not mistaken for the person.
  useEffect(() => {
    const speaking = speaker.speakingId !== null;
    if (speakingRef.current && !speaking) speakingEndedAt.current = performance.now();
    speakingRef.current = speaking;
  }, [speaker.speakingId]);

  function startSession() {
    sessionRef.current = true;
    setSessionActive(true);
    setActivity((n) => n + 1);
  }

  function endSession(how: "silent" | "farewell", spokenBy?: string) {
    sessionRef.current = false;
    setSessionActive(false);
    if (how === "farewell") exchange(spokenBy ?? "That's all", "Okay, I'm here if you need me.", true);
  }

  /** What was said while hands-free: a wake phrase, a command, "stop", or "that's all". */
  function handleHeard(heard: Utterance) {
    const text = heard.text;
    if (text.length < 2 || NOT_A_REQUEST.test(text)) return;
    setActivity((n) => n + 1);

    const wake = matchWakeWord(text);
    // Nexus is talking or thinking, or has only just stopped: what the microphone caught may be its own voice.
    const overlapsSpeech = speakingRef.current || sendingRef.current || heard.startedAt < speakingEndedAt.current + 900;

    if (matchStop(text)) {
      if (overlapsSpeech) speaker.cancel();
      else if (sessionRef.current) endSession("silent");
      return;
    }

    if (overlapsSpeech) {
      // Only an explicit "Hey Nexus ..." cuts in while it is busy.
      if (wake.matched && /^\W*(?:hey|hay|hi|hello|ok|okay)/i.test(text)) {
        speaker.cancel();
        playChime();
        startSession();
        if (wake.command) void send(wake.command, undefined, true);
      }
      return;
    }

    if (!sessionRef.current) {
      // Waiting to be called.
      if (!wake.matched) return;
      playChime();
      speaker.prepare();
      startSession();
      if (wake.command) void send(wake.command, undefined, true);
      return;
    }

    // In a conversation: everything said is for Nexus.
    if (wake.matched && !wake.command) return; // just its name again: still listening
    const request = wake.matched ? wake.command : text;
    if (matchEndSession(request)) {
      endSession("farewell", request);
      return;
    }
    void send(request, undefined, true);
  }

  const wake = useHandsFree({
    enabled: voicePrefs.heyNexus && localRecognitionSupported(),
    paused: recognizer.listening || recognizer.transcribing,
    onUtterance: handleHeard,
  });
  const handsFreeAvailable = localRecognitionSupported();

  // If the microphone cannot be used, switch the feature off rather than leave it pretending to listen.
  useEffect(() => {
    if (wake.error) setVoicePrefs({ heyNexus: false });
  }, [wake.error, setVoicePrefs]);

  // Turning "Hey Nexus" off ends any conversation.
  useEffect(() => {
    if (!voicePrefs.heyNexus && sessionRef.current) {
      sessionRef.current = false;
      setSessionActive(false);
    }
  }, [voicePrefs.heyNexus]);

  // A conversation that goes quiet lets go by itself, so the microphone never stays "on duty" without the person.
  const busy = speaker.speakingId !== null || sending || recognizer.listening || recognizer.transcribing;
  useEffect(() => {
    if (!sessionActive || busy) return undefined;
    const timer = window.setTimeout(() => endSession("silent"), SESSION_IDLE_MS);
    return () => window.clearTimeout(timer);
    // endSession only touches refs and stable setters.
  }, [sessionActive, busy, activity]);

  /* ───────────── history ───────────── */

  // Keep the history up to date as the conversation grows.
  useEffect(() => {
    if (messages.length === 0) return;
    setSessions((all) => upsertSession(all, { id: sessionId, title: titleFor(messages), updatedAt: Date.now(), messages, notes }));
  }, [messages, sessionId, notes]);

  useEffect(() => {
    saveSessions(userKey, sessions);
  }, [sessions, userKey]);

  const push = (message: Draft): number => {
    const id = nextId++;
    setMessages((all) => [...all, { ...message, id } as Message]);
    return id;
  };

  /** A question and its answer that Nexus works out itself, without the AI. It is spoken if the person is talking. */
  function exchange(userText: string, replyText: string, viaVoice: boolean) {
    push({ role: "user", text: userText });
    const id = push({ role: "assistant", text: replyText, cards: [], actions: [], suggestions: [] });
    if (speaker.supported && !audioLockedRef.current && (viaVoice || voiceRef.current.prefs.readAloud)) speaker.speak(String(id), replyText, voiceRef.current.prefs.rate);
  }

  const addNote = (note: string) => {
    setNotes((all) => (all.includes(note) ? all : [...all, note].slice(-MAX_NOTES)));
  };

  const loadPrompts = useCallback(() => {
    if (promptsRequested.current) return;
    promptsRequested.current = true;
    apiGet<{ prompts: string[] }>("/api/copilot/prompts").then(
      (data) => setPrompts(data.prompts),
      () => {
        promptsRequested.current = false;
      },
    );
  }, []);

  function toggleMic() {
    if (sessionRef.current) {
      // Tapping the orb during a hands-free conversation ends it.
      speaker.cancel();
      endSession("silent");
      return;
    }
    if (recognizer.listening) {
      recognizer.stop();
      return;
    }
    speaker.prepare();
    speaker.cancel();
    setInputValue("");
    recognizer.clearError();
    recognizer.start();
  }

  function startNewChat() {
    speaker.cancel();
    recognizer.cancel();
    setMessages([]);
    setNotes([]);
    setSessionId(newSessionId());
    setRestored(false);
    setError(null);
    setInputValue("");
  }

  function openSession(session: StoredSession) {
    speaker.cancel();
    recognizer.cancel();
    nextId = Math.max(nextId, highestMessageId(session.messages) + 1);
    setMessages(session.messages);
    setNotes(session.notes ?? []);
    setSessionId(session.id);
    setRestored(true);
    setError(null);
  }

  function deleteSession(id: string) {
    setSessions((all) => all.filter((session) => session.id !== id));
    if (id === sessionId) startNewChat();
  }

  function clearHistory() {
    setSessions([]);
    startNewChat();
  }

  /* ───────────── asking Nexus ───────────── */

  async function send(text: string, jobId?: string, viaVoice = false) {
    const message = text.trim();
    if (!message || sending) return;
    speaker.prime();
    speaker.cancel();
    setError(null);
    setRestored(false);

    // Things Nexus can do on the spot, without the AI: instant, and they cost nothing.
    if (matchStop(message)) return;
    const scroll = matchScroll(message);
    if (scroll) {
      scrollPage(scroll);
      return;
    }
    const clock = matchTimeDate(message, new Date());
    if (clock) {
      exchange(message, clock, viaVoice);
      return;
    }
    const trip = matchNavigation(message);
    if (trip) {
      push({ role: "user", text: message });
      const reply = trip.back ? "Going back." : `Opening ${trip.label}.`;
      const id = push({ role: "assistant", text: reply, cards: [], actions: [], suggestions: [] });
      if (trip.back) navigate(-1);
      else navigate(trip.to);
      if (speaker.supported && !audioLockedRef.current && (viaVoice || voiceRef.current.prefs.readAloud)) speaker.speak(String(id), reply, voiceRef.current.prefs.rate);
      return;
    }

    setSending(true);
    // Nexus follows the conversation, so send the recent turns (text only) along with the question.
    const history = messagesRef.current.slice(-10).map((entry) =>
      entry.role === "assistant" ? { role: "assistant" as const, text: entry.text, ...(entry.memo ? { memo: entry.memo } : {}) } : { role: "user" as const, text: entry.text },
    );
    // A question about the page in front of the person comes with a reading of that page.
    const snapshot = needsPage(message) ? capturePage() : null;
    const now = new Date();
    push({ role: "user", text: message });
    try {
      const reply = await apiPost<CopilotResponse>("/api/copilot/message", {
        message,
        ...(jobId ? { jobId } : {}),
        ...(history.length > 0 ? { history } : {}),
        ...(notesRef.current.length > 0 ? { notes: notesRef.current } : {}),
        // Talking out loud means short, quiet answers; typing gets the full friendly chat.
        style: viaVoice ? "voice" : "text",
        clientTime: {
          iso: now.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          local: now.toLocaleString([], { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }),
        },
        ...(snapshot ? { page: snapshot } : {}),
      });
      // What the person was looking at travels with the answer, so the conversation can carry on about it in the chat.
      const pageMemo = snapshot ? `The person was on "${snapshot.title}" (${snapshot.path}). Page content: ${snapshot.text.slice(0, 1100)}` : "";
      const memo = [reply.memo, pageMemo].filter(Boolean).join(" ").slice(0, 2000) || undefined;
      const id = push({
        role: "assistant",
        text: reply.text,
        cards: reply.cards,
        actions: reply.actions,
        suggestions: reply.suggestions,
        memo,
        note: reply.interpretedBy === "llm" ? "Request interpreted with the optional AI model; results come from NEXUS services." : undefined,
      });
      // Talk back when the question was spoken, or when the person asked for every reply to be read.
      if (speaker.supported && !audioLockedRef.current && (viaVoice || voiceRef.current.prefs.readAloud)) {
        speaker.speak(String(id), reply.text, voiceRef.current.prefs.rate);
      }

      for (const action of reply.actions) {
        if (action.kind === "remember") addNote(action.note);
        if (action.kind === "click") {
          // Give the page a moment to settle, then press it. A failed press is said out loud, not hidden.
          window.setTimeout(() => {
            const result = clickPageElement(action.elementId);
            if (!result.ok) push({ role: "assistant", text: result.reason ?? "I couldn't press that.", cards: [], actions: [], suggestions: [] });
          }, 350);
        }
      }
      // When the person asked to be taken somewhere, go there now. Nexus keeps talking on the new page.
      const destination = reply.actions.find((action) => action.kind === "navigate" && action.auto);
      if (destination && destination.kind === "navigate") navigate(destination.to);
    } catch (failure) {
      setError(asError(failure));
    } finally {
      setSending(false);
    }
  }

  async function toggleSave(item: OpportunityItem) {
    const isSaved = saved[item.job.id] ?? item.saved !== null;
    try {
      if (isSaved) await apiDelete(`/api/saved-jobs/${encodeURIComponent(item.job.id)}`);
      else await apiPut<SavedJobRecord>(`/api/saved-jobs/${encodeURIComponent(item.job.id)}`, { status: "saved" });
      setSaved((all) => ({ ...all, [item.job.id]: !isSaved }));
    } catch (failure) {
      setError(asError(failure));
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
      setError(asError(failure));
    }
  }

  /* ───────────── what the orb and the pages show ───────────── */

  const thinking = sending || recognizer.transcribing;
  const orbMode: OrbState =
    speaker.speakingId !== null ? "speaking" : recognizer.listening || (sessionActive && !thinking) ? "listening" : thinking ? "thinking" : "idle";
  const voiceStatus =
    recognizer.modelProgress !== null
      ? `Downloading the voice model… ${Math.round(recognizer.modelProgress * 100)}% (one time only, about 40 MB)`
      : recognizer.transcribing
        ? "Turning your voice into text…"
        : wake.modelProgress !== null && voicePrefs.heyNexus
          ? `Getting “Hey Nexus” ready… ${Math.round(wake.modelProgress * 100)}% (one time only)`
          : speaker.natural.progress !== null
            ? `Getting the natural voice ready… ${Math.round(speaker.natural.progress * 100)}% (one time only)`
            : "";
  const spokenMessage = messages.find((message) => String(message.id) === speaker.speakingId);
  let lastReply: Message | undefined;
  for (const message of messages) if (message.role === "assistant") lastReply = message;

  const value: NexusValue = {
    messages,
    inputValue,
    setInputValue,
    sending,
    error,
    prompts,
    loadPrompts,
    saved,
    sessions,
    sessionId,
    restored,
    title: messages.length > 0 ? titleFor(messages) : "New chat",
    notes,
    voicePrefs,
    setVoicePrefs,
    speaker,
    recognizer,
    wake,
    handsFreeAvailable,
    heyNexusListening: voicePrefs.heyNexus && (wake.status === "listening" || wake.status === "checking"),
    sessionActive,
    audioLocked,
    orbMode,
    voiceStatus,
    levelRef,
    spokenMessage,
    lastReply,
    send,
    toggleMic,
    toggleSave,
    runAction,
    startNewChat,
    openSession,
    deleteSession,
    clearHistory,
  };

  return <NexusContext.Provider value={value}>{children}</NexusContext.Provider>;
}
