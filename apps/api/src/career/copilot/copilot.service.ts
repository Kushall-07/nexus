import { getLlmProvider } from "../../llm/provider.js";
import { getCareerProfile } from "../career-store.js";
import { explainJobMatch, searchOpportunities, type OpportunityItem } from "../opportunities.service.js";
import { listDirections, buildTransitionPlan, changeDirection, requireDirection } from "../transition/transition.service.js";
import type { TransitionAnalysis } from "../transition/transition-analysis.js";
import type { JobMatch } from "../matching/job-matcher.js";
import type { NormalizedJob } from "../types.js";
import { copilotIntentSchema, interpretMessage, type CopilotIntent } from "./intent.js";

// Phase 12 orchestration layer. It maps a message to a validated intent, then
// calls the same deterministic services the UI uses. It never invents jobs,
// scores or profile data, and it never performs a destructive action: those
// are returned as UI actions that the user must confirm.

export type CopilotAction =
  | { kind: "navigate"; label: string; to: string }
  | { kind: "refresh-profile"; label: string }
  | { kind: "set-direction"; label: string; directionId: string }
  | { kind: "search-demo"; label: string };

export type CopilotCard =
  | { type: "jobs"; source: "live" | "demo"; items: OpportunityItem[] }
  | { type: "transition"; analysis: TransitionAnalysis }
  | { type: "match"; job: NormalizedJob; match: JobMatch };

export interface CopilotResponse {
  text: string;
  interpretedBy: "rules" | "llm";
  intent: CopilotIntent["type"];
  cards: CopilotCard[];
  actions: CopilotAction[];
  suggestions: string[];
}

export const SUGGESTED_PROMPTS = [
  "Find backend internships based on my projects",
  "Show me remote internships",
  "What are the most important skills I am missing?",
  "I want to transition from AI/ML to full-stack development",
  "Reanalyze my profile",
];

const MAX_CARD_ITEMS = 5;

async function interpret(message: string): Promise<{ intent: CopilotIntent; by: "rules" | "llm" }> {
  const intent = interpretMessage(message);
  if (intent.type !== "unknown") return { intent, by: "rules" };

  const provider = getLlmProvider();
  if (!provider?.extractCopilotIntent) return { intent, by: "rules" };

  try {
    const candidate = copilotIntentSchema.safeParse(await provider.extractCopilotIntent(message));
    if (!candidate.success || candidate.data.type === "unknown") return { intent, by: "rules" };

    // A model-supplied direction must be in the controlled vocabulary or it is dropped.
    const safe = { ...candidate.data };
    for (const key of ["directionId", "fromDirectionId"] as const) {
      if (safe[key]) {
        try {
          safe[key] = requireDirection(safe[key]!);
        } catch {
          delete safe[key];
        }
      }
    }
    return { intent: safe, by: "llm" };
  } catch {
    // Model failure or timeout: fall back to the deterministic "unknown" reply.
    return { intent, by: "rules" };
  }
}

const directionActions = (): CopilotAction[] =>
  listDirections().map((direction) => ({
    kind: "set-direction" as const,
    label: direction.displayName,
    directionId: direction.id,
  }));

function qualifiedEnough(item: OpportunityItem): boolean {
  const required = item.match.skills.filter((skill) => skill.requirement === "required");
  return required.length > 0 && required.filter((skill) => skill.status !== "missing").length / required.length >= 0.6;
}

export async function handleCopilotMessage(
  userId: string,
  input: { message: string; jobId?: string },
): Promise<CopilotResponse> {
  const { intent, by } = await interpret(input.message);
  const reply = (partial: Partial<CopilotResponse> & { text: string }): CopilotResponse => ({
    interpretedBy: by,
    intent: intent.type,
    cards: [],
    actions: [],
    suggestions: [],
    ...partial,
  });

  switch (intent.type) {
    case "search_jobs": {
      const result = await searchOpportunities(
        userId,
        {
          keywords: intent.keywords,
          location: intent.location,
          workMode: intent.workMode,
          employmentType: intent.employmentType,
          experienceLevel: intent.experienceLevel,
          limit: 30,
          page: 1,
        },
        "live",
      );

      if (result.noProviderConfigured) {
        return reply({
          text: "No live job provider is configured on this server, so I cannot search real listings. You can explore clearly labelled demo listings, or ask the owner to add a provider key (see the Opportunities page).",
          actions: [
            { kind: "search-demo", label: "Explore demo listings" },
            { kind: "navigate", label: "Open Opportunities", to: "/opportunities" },
          ],
        });
      }

      let items = result.items;
      if (intent.mostlyQualified) items = items.filter(qualifiedEnough);
      const top = items.slice(0, MAX_CARD_ITEMS);

      const failed = result.providers.filter((provider) => provider.configured && !provider.ok);
      const notes = [
        !result.profile.hasGithubAnalysis && !result.profile.hasResume
          ? "Add GitHub evidence or a resume so I can rank these fairly."
          : null,
        failed.length > 0 ? `${failed.map((provider) => provider.label).join(", ")} could not be reached; results may be partial.` : null,
      ].filter(Boolean);

      return reply({
        text:
          top.length === 0
            ? `I found no listings${intent.mostlyQualified ? " where most requirements are supported by your profile" : ""} for that request.${notes.length ? ` ${notes.join(" ")}` : ""}`
            : `Here are the top ${top.length} of ${items.length} live listings, ranked by an explainable match with your evidence. Match scores are similarity heuristics, not hiring odds.${notes.length ? ` ${notes.join(" ")}` : ""}`,
        cards: top.length ? [{ type: "jobs", source: result.mode, items: top }] : [],
        actions: [{ kind: "navigate", label: "Open all opportunities", to: "/opportunities" }],
        suggestions: ["Why is the first job a good or poor match?", "What are the most important skills I am missing?"],
      });
    }

    case "set_direction": {
      if (!intent.directionId) {
        return reply({ text: "Which career direction would you like to set? It is only a preference — you can change or remove it at any time.", actions: directionActions() });
      }
      const id = await changeDirection(userId, intent.directionId);
      const name = listDirections().find((direction) => direction.id === id)?.displayName ?? id;
      return reply({
        text: `Your career direction is now ${name}. It only guides recommendations; it does not filter jobs or change your evidence.`,
        actions: [{ kind: "navigate", label: "View skill plan", to: "/development" }],
      });
    }

    case "transition":
    case "skill_gaps":
    case "project_suggestion": {
      const career = await getCareerProfile(userId);
      const directionId = intent.directionId ?? career.learning.direction ?? career.preferences.directions[0];

      if (!directionId) {
        return reply({ text: "Which career direction should I analyse?", actions: directionActions() });
      }

      const analysis = await buildTransitionPlan(userId, { directionId });
      // A transition request states intent, so it records the direction; comparisons do not.
      if (intent.type === "transition" && !intent.compare && intent.directionId) {
        await changeDirection(userId, intent.directionId);
      }

      const top = analysis.gaps.slice(0, 3);
      const text =
        intent.type === "project_suggestion"
          ? top[0]
            ? `For ${analysis.direction.displayName}, the best next project targets ${top[0].skillName}: ${top[0].task.milestone} It would be verified by: ${top[0].task.verification}`
            : `Your current evidence already meets the ${analysis.direction.displayName} benchmark, so no gap-closing project is suggested.`
          : top.length
            ? `For ${analysis.direction.displayName}, your top gaps are ${top.map((gap) => gap.skillName).join(", ")}. ${analysis.nextAction}`
            : `Your evidence already meets the ${analysis.direction.displayName} benchmark.`;

      return reply({
        text,
        cards: [{ type: "transition", analysis }],
        actions: [{ kind: "navigate", label: "Open skill development", to: "/development" }],
        suggestions: ["Which project should I build to improve my profile?"],
      });
    }

    case "explain_match": {
      if (!input.jobId) {
        return reply({
          text: "Open a job (or ask from a job card) and I can explain its match. Search for jobs first if you have not yet.",
          actions: [{ kind: "navigate", label: "Open Opportunities", to: "/opportunities" }],
        });
      }
      const { job, match } = await explainJobMatch(userId, input.jobId);
      return reply({ text: match.explanation.join(" "), cards: [{ type: "match", job, match }] });
    }

    case "refresh_profile":
      return reply({
        text: "Refreshing re-analyses your selected public GitHub repositories and then recomputes your scores. Your current profile stays in place if it fails. Confirm to start.",
        actions: [{ kind: "refresh-profile", label: "Refresh my GitHub profile" }],
      });

    case "resume_replace":
      return reply({
        text: "Upload the new resume on the Resume page. You will review the extracted fields first, and your current resume stays active until you confirm the replacement.",
        actions: [{ kind: "navigate", label: "Open Resume", to: "/resume" }],
      });

    case "resume_delete":
      return reply({
        text: "I cannot delete data from chat. Deleting your resume needs an explicit confirmation on the Resume page. It does not affect your GitHub evidence, saved jobs or learning progress.",
        actions: [{ kind: "navigate", label: "Open Resume", to: "/resume" }],
      });

    case "help":
    default:
      return reply({
        text:
          intent.type === "help"
            ? "I can search jobs, explain a match, show your skill gaps, suggest a project, set or compare a career direction, and start a GitHub refresh. I work from your actual evidence and never invent listings."
            : "I did not understand that. I can search jobs, explain a match, show your skill gaps, suggest a project, set or compare a career direction, or refresh your GitHub profile. Try one of the suggestions.",
        suggestions: SUGGESTED_PROMPTS,
      });
  }
}
