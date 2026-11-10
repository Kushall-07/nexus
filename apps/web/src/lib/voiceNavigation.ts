/**
 * Understands spoken or typed requests to go somewhere in the app ("go to GitHub evidence", "open job discovery",
 * "take me back"), so Nexus can take people there instantly, without waiting for the AI model.
 *
 * It is deliberately strict. "Show me remote internships" is a job search, not a trip to a page, so only clear
 * "go / open / take me" requests count, and the looser verbs ("show me") count only for a page's proper name.
 */

export interface NavigationTarget {
  to: string;
  label: string;
}

export type NavigationMatch = ({ back?: false } & NavigationTarget) | { back: true };

interface Page extends NavigationTarget {
  /** Proper names of the page. These work with any "go to / open / show me" request. */
  names: string[];
  /** Everyday words for the page. These work only with a clear "go to / open / take me to" request. */
  loose?: string[];
}

export const PAGES: Page[] = [
  { to: "/dashboard", label: "Overview", names: ["overview", "dashboard", "home page", "home screen"], loose: ["home"] },
  { to: "/opportunities", label: "Job Discovery", names: ["job discovery", "job search page", "job search"], loose: ["jobs", "job listings", "job openings", "opportunities", "internships"] },
  { to: "/saved", label: "Saved Opportunities", names: ["saved opportunities", "saved jobs", "my saved jobs", "bookmarks", "saved listings"] },
  { to: "/applications", label: "Applications", names: ["applications", "my applications", "application tracker"] },
  { to: "/repositories", label: "GitHub Evidence", names: ["github evidence", "git hub evidence", "github", "git hub", "my repositories", "repositories", "my repos"], loose: ["repos"] },
  { to: "/development", label: "Role & Gap Analysis", names: ["role and gap analysis", "role gap analysis", "gap analysis", "skill development", "development plan", "skill gaps"] },
  { to: "/skills", label: "Skill Intelligence", names: ["skill intelligence", "skills page", "my skills"], loose: ["skills"] },
  { to: "/copilot", label: "Career Copilot", names: ["career copilot", "copilot", "the chat", "chat page"], loose: ["chat"] },
  { to: "/resume", label: "My Career Profile", names: ["my career profile", "career profile", "my resume", "resume", "my cv"] },
  { to: "/preferences", label: "Career Preferences", names: ["career preferences", "job preferences", "my preferences"] },
  { to: "/settings", label: "Settings", names: ["settings"] },
];

const STRONG_VERBS = "(?:go|take me|bring me|navigate|switch|jump|head|open|launch|move|get me)";
const WEAK_VERBS = "(?:show me|show|display|pull up|bring up|see|view|visit)";
const LEAD_IN = "(?:(?:hey |ok |okay )?(?:nexus )?)?(?:(?:please|kindly) )?(?:(?:can|could|would|will) you (?:please )?|i (?:want|need|would like) to |i'd like to |let's |lets )?";
const STRONG_CONNECTOR = "(?:(?:over |back )?to |into |on |up )?(?:the |my )?";
const WEAK_CONNECTOR = "(?:the |my )?";
const TRAILING = "(?: (?:page|tab|section|screen|view|please|now))*";

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const anyOf = (words: string[]) => `(?:${[...words].sort((a, b) => b.length - a.length).map(escape).join("|")})`;

export function matchNavigation(text: string): NavigationMatch | null {
  const said = normalize(text);
  if (!said || said.split(" ").length > 12) return null;

  if (new RegExp(`^${LEAD_IN}(?:go|take me|head|get me|navigate) back(?: please)?$`).test(said)) return { back: true };

  for (const page of PAGES) {
    const strongName = new RegExp(`^${LEAD_IN}${STRONG_VERBS} ${STRONG_CONNECTOR}${anyOf([...page.names, ...(page.loose ?? [])])}${TRAILING}$`);
    const weakName = new RegExp(`^${LEAD_IN}${WEAK_VERBS} ${WEAK_CONNECTOR}${anyOf(page.names)}${TRAILING}$`);
    if (strongName.test(said) || weakName.test(said)) return { to: page.to, label: page.label };
  }
  return null;
}
