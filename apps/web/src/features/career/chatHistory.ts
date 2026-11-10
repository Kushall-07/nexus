/**
 * Copilot conversations and their local history.
 *
 * History lives only in this browser (localStorage), under a key for the signed-in account, so
 * one person's conversations never show up for another on a shared computer. Job results inside
 * a saved conversation are a snapshot from when the question was asked.
 */
import type { CopilotAction, CopilotCard } from "../../api/career-types";

export type Message =
  | { id: number; role: "user"; text: string }
  | { id: number; role: "assistant"; text: string; cards: CopilotCard[]; actions: CopilotAction[]; suggestions: string[]; note?: string; memo?: string };

export interface StoredSession {
  id: string;
  title: string;
  updatedAt: number;
  messages: Message[];
  /** Short facts Nexus kept about the person's goals and plans in this conversation. */
  notes?: string[];
}

const KEY_PREFIX = "nexus:copilot-history:v1:";
const MAX_SESSIONS = 25;
const MAX_MESSAGES = 60;

export function newSessionId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function titleFor(messages: Message[]): string {
  const first = messages.find((message) => message.role === "user");
  const text = first?.text.trim() ?? "New chat";
  return text.length > 60 ? `${text.slice(0, 57)}…` : text;
}

function isSession(value: unknown): value is StoredSession {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Partial<StoredSession>;
  return typeof v.id === "string" && typeof v.title === "string" && typeof v.updatedAt === "number" && Array.isArray(v.messages);
}

export function loadSessions(userKey: string): StoredSession[] {
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + userKey);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isSession).sort((a, b) => b.updatedAt - a.updatedAt) : [];
  } catch {
    return [];
  }
}

/** Saves the history. If the browser's storage is full, the oldest conversations are dropped. */
export function saveSessions(userKey: string, sessions: StoredSession[]): void {
  let keep = sessions.slice(0, MAX_SESSIONS).map((session) => ({ ...session, messages: session.messages.slice(-MAX_MESSAGES) }));
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      if (keep.length === 0) window.localStorage.removeItem(KEY_PREFIX + userKey);
      else window.localStorage.setItem(KEY_PREFIX + userKey, JSON.stringify(keep));
      return;
    } catch {
      keep = keep.slice(0, Math.floor(keep.length / 2));
    }
  }
}

/** Adds or updates one conversation and returns the list newest first. */
export function upsertSession(sessions: StoredSession[], session: StoredSession): StoredSession[] {
  return [session, ...sessions.filter((existing) => existing.id !== session.id)].slice(0, MAX_SESSIONS);
}

export function highestMessageId(messages: Message[]): number {
  let highest = 0;
  for (const message of messages) if (message.id > highest) highest = message.id;
  return highest;
}
