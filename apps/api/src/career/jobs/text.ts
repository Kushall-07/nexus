import type { EmploymentType, ExperienceLevel, WorkMode } from "../types.js";
import { canonicalSkillId, findSkillIdsInText } from "../skill-vocabulary.js";

// Provider text is untrusted. Everything here produces plain text (never
// markup) and never follows instructions found inside it.

const MAX_DESCRIPTION_CHARS = 6000;

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

export function htmlToText(input: string, maxChars = MAX_DESCRIPTION_CHARS): string {
  const withoutBlocks = input
    .replace(/<(script|style|iframe|object|embed)[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\s*(br|\/p|\/div|\/li|\/h[1-6])\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, " ");

  const decoded = withoutBlocks.replace(/&(amp|lt|gt|quot|nbsp|apos|#39);/g, (match) => ENTITIES[match] ?? match);

  return decoded
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim()
    .slice(0, maxChars);
}

// Only absolute http(s) URLs without embedded credentials are accepted.
export function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2000) return null;

  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function safeIsoDate(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function isStale(postedAt: string | undefined, now: Date, maxAgeDays = 60): boolean {
  if (!postedAt) return false; // unknown freshness is not asserted either way
  return now.getTime() - new Date(postedAt).getTime() > maxAgeDays * 86_400_000;
}

const PREFERRED_MARKER = /\b(nice[- ]to[- ]have|preferred|bonus|good to have|a plus|is a plus)\b/i;

// Required skills come from the part of the text before a "nice to have"
// marker; skills only mentioned after it (or only as tags) are preferred.
export function extractSkills(description: string, tags: string[] = []): { required: string[]; preferred: string[] } {
  const marker = description.search(PREFERRED_MARKER);
  const head = marker >= 0 ? description.slice(0, marker) : description;
  const tail = marker >= 0 ? description.slice(marker) : "";

  const required = new Set(findSkillIdsInText(head));
  for (const tag of tags) {
    const id = canonicalSkillId(tag, { allowTagOnly: true });
    if (id) required.add(id);
  }
  const preferred = findSkillIdsInText(tail).filter((id) => !required.has(id));

  return { required: [...required], preferred };
}

export function inferWorkMode(text: string): WorkMode | undefined {
  if (/\bhybrid\b/i.test(text)) return "hybrid";
  if (/\b(remote|work from home|anywhere)\b/i.test(text)) return "remote";
  if (/\b(on-?site|in[- ]office)\b/i.test(text)) return "on-site";
  return undefined;
}

export function inferEmploymentType(text: string): EmploymentType | undefined {
  const lowered = text.toLowerCase();
  if (/\bintern(ship)?\b/.test(lowered)) return "internship";
  if (/\bpart[- ]?time\b/.test(lowered)) return "part-time";
  if (/\b(contract|freelance|temporary)\b/.test(lowered)) return "contract";
  if (/\bfull[- ]?time\b/.test(lowered)) return "full-time";
  return undefined;
}

export function inferExperienceLevel(title: string): ExperienceLevel | undefined {
  const lowered = title.toLowerCase();
  if (/\bintern(ship)?\b/.test(lowered)) return "intern";
  if (/\b(principal|staff|lead|head of|director)\b/.test(lowered)) return "lead";
  if (/\b(senior|sr\.?)\b/.test(lowered)) return "senior";
  if (/\b(junior|jr\.?|entry|graduate|new grad|associate)\b/.test(lowered)) return "entry";
  return undefined;
}

export function inferStudentOnly(text: string): boolean | undefined {
  return /\b(currently enrolled|must be (a )?student|students? only|pursuing (a|an) (bachelor|master|degree))/i.test(text)
    ? true
    : undefined;
}

// Cross-source duplicate key: same title + company + location, case/space-insensitive.
export function dedupeKey(job: { title: string; company?: string; location?: string }): string {
  const norm = (value: string | undefined) => (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return `${norm(job.title)}|${norm(job.company)}|${norm(job.location)}`;
}
