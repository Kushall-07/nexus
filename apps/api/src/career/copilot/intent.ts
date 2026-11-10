import { z } from "zod";
import { EMPLOYMENT_TYPES, EXPERIENCE_LEVELS, WORK_MODES } from "../types.js";
import { findSkillIdsInText, resolveDirection } from "../skill-vocabulary.js";
import { loadMatchingConfig } from "../matching/matching-config.js";

// Structured Copilot intent. Whether it comes from the deterministic rules
// below or from an optional LLM, it is validated against this closed schema
// before use: free-form model text is never an instruction.

export const INTENT_TYPES = [
  "search_jobs",
  "set_direction",
  "transition",
  "skill_gaps",
  "project_suggestion",
  "explain_match",
  "refresh_profile",
  "resume_replace",
  "resume_delete",
  "help",
  "unknown",
] as const;

export const copilotIntentSchema = z
  .object({
    type: z.enum(INTENT_TYPES),
    keywords: z.string().trim().max(120).optional(),
    directionId: z.string().max(64).optional(),
    fromDirectionId: z.string().max(64).optional(),
    compare: z.boolean().optional(),
    employmentType: z.enum(EMPLOYMENT_TYPES).optional(),
    workMode: z.enum(WORK_MODES).optional(),
    experienceLevel: z.enum(EXPERIENCE_LEVELS).optional(),
    location: z.string().trim().max(80).optional(),
    mostlyQualified: z.boolean().optional(),
  })
  .strict();

export type CopilotIntent = z.infer<typeof copilotIntentSchema>;

export const copilotRequestSchema = z
  .object({
    message: z.string().trim().min(1).max(1500),
    // The job card the user is looking at; resolved server-side, never trusted as content.
    jobId: z.string().min(1).max(300).optional(),
    // Earlier turns of this conversation, so the Copilot can follow what was said. Untrusted; capped.
    history: z
      .array(
        z
          .object({
            role: z.enum(["user", "assistant"]),
            text: z.string().trim().min(1).max(2500),
            memo: z.string().max(2000).optional(),
          })
          .strict(),
      )
      .max(24)
      .optional(),
    // What is on the person's screen right now. Sent only when the question is about it. Untrusted data.
    page: z
      .object({
        path: z.string().max(120),
        title: z.string().max(120),
        text: z.string().max(4000),
        elements: z
          .array(
            z
              .object({
                id: z.number().int().min(1).max(200),
                role: z.string().max(20),
                name: z.string().max(80),
                section: z.string().max(60).optional(),
              })
              .strict(),
          )
          .max(60),
      })
      .strict()
      .optional(),
    // Short facts Nexus saved earlier in this session (goals, deadlines, plans).
    notes: z.array(z.string().trim().min(1).max(260)).max(14).optional(),
    // How the person is talking to Nexus: out loud and hands-free (short, quiet answers) or typing.
    style: z.enum(["voice", "text"]).optional(),
    // The device's clock, so "what day is it" and "in two weeks" are answered from the right moment.
    clientTime: z
      .object({ iso: z.string().max(40), timeZone: z.string().max(60), local: z.string().max(90) })
      .strict()
      .optional(),
  })
  .strict();

function findLocation(message: string): string | undefined {
  const match = message.match(/\b(?:in|near|around)\s+([A-Z][A-Za-z.]*(?:[ ,]+[A-Z][A-Za-z.]*){0,2})/);
  const value = match?.[1]?.trim().replace(/[,.]+$/, "");
  return value && !/^(My|The|A|An|India Remote)$/.test(value) ? value : undefined;
}

// Direction named after "to"/"into"/"as", falling back to the first mention.
function findDirections(lowered: string): { target?: string; source?: string } {
  const target = lowered.match(/.*\b(?:to|into|as|become(?: an?)?)\s+(.+)$/)?.[1];
  const source = lowered.match(/\bfrom\s+(.+?)\s+(?:to|into)\b/)?.[1];
  const targetId = target ? resolveDirection(target) : null;
  const sourceId = source ? resolveDirection(source) : null;
  return { target: targetId ?? undefined, source: sourceId ?? undefined };
}

export function interpretMessage(message: string): CopilotIntent {
  const lowered = message.toLowerCase();
  const has = (pattern: RegExp) => pattern.test(lowered);

  if (has(/\b(what can you do|help|how do (i|you)|commands)\b/)) return { type: "help" };

  if (has(/\bresume|\bcv\b/)) {
    if (has(/\b(delete|remove|erase)\b/)) return { type: "resume_delete" };
    if (has(/\b(replace|upload|update|new|change|swap)\b/)) return { type: "resume_replace" };
  }

  if (has(/\b(re-?analy[sz]e|re-?scan)\b/) || has(/\brefresh\b.*\b(github|profile)\b/) || has(/\bupdate my (github )?(profile|evidence)\b/)) {
    return { type: "refresh_profile" };
  }

  if (has(/\bwhy\b.*\b(match|job|fit)\b/) || has(/\bexplain\b.*\b(match|job|fit)\b/)) return { type: "explain_match" };

  if (has(/\bwhich project\b|\bproject (should|could|to) (i )?build\b|\bwhat should i build\b/)) {
    return { type: "project_suggestion", directionId: findDirections(lowered).target ?? resolveDirection(lowered) ?? undefined };
  }

  const directions = findDirections(lowered);

  if (has(/\b(transition|switch|move|pivot|change careers?)\b/) || has(/\bcompare\b/) || has(/\bbecome\b/)) {
    return {
      type: "transition",
      directionId: directions.target ?? resolveDirection(lowered) ?? undefined,
      fromDirectionId: directions.source,
      compare: has(/\bcompare\b/) || undefined,
    };
  }

  if (has(/\b(missing|lack|gaps?|improve|weak(est)?)\b/)) {
    return { type: "skill_gaps", directionId: directions.target ?? resolveDirection(lowered) ?? undefined };
  }

  if (has(/\b(set|choose|pick|select|target)\b.*\b(role|direction|path)\b/) || has(/\bmy (target|career) (role|direction)\b/)) {
    return { type: "set_direction", directionId: directions.target ?? resolveDirection(lowered) ?? undefined };
  }

  if (has(/\b(find|show|search|recommend|suggest|looking for|opportunit|jobs?|internships?|openings?|roles?)\b/)) {
    const skillWords = findSkillIdsInText(message).filter((id) => id !== "backend-development");
    const directionId = resolveDirection(lowered);
    const directionKeyword = directionId ? loadMatchingConfig().directionKeywords[directionId]?.[0] : undefined;

    return {
      type: "search_jobs",
      keywords: [directionKeyword, ...skillWords].filter(Boolean).join(" ") || undefined,
      employmentType: has(/\binterns(hips?)?\b/)
        ? "internship"
        : has(/\bpart[- ]?time\b/)
          ? "part-time"
          : has(/\bcontract\b/)
            ? "contract"
            : has(/\bfull[- ]?time\b/)
              ? "full-time"
              : undefined,
      workMode: has(/\bremote\b/) ? "remote" : has(/\bhybrid\b/) ? "hybrid" : has(/\bon-?site\b/) ? "on-site" : undefined,
      experienceLevel: has(/\b(entry|junior|graduate|fresher)\b/) ? "entry" : has(/\bsenior\b/) ? "senior" : undefined,
      location: findLocation(message),
      mostlyQualified: has(/\b(meet|qualif)\w*\b.*\b(most|requirements)\b|\bmost of the requirements\b/) || undefined,
    };
  }

  return { type: "unknown" };
}
