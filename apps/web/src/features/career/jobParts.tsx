import type { ApplicationStatus, Job, JobMatch, MatchLabel, OpportunityItem } from "../../api/career-types";
import { APPLICATION_STATUS_LABELS } from "../../api/career-types";

export const focusRing = "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 focus-visible:ring-offset-1";

export const buttonClass = [
  "rounded-xl border border-slate-200 bg-white px-3.5 py-1.5",
  "text-sm font-medium text-slate-700",
  "hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 hover:shadow-sm",
  "active:scale-[0.98]",
  "disabled:cursor-not-allowed disabled:opacity-50",
  "transition-all duration-150",
  focusRing,
].join(" ");

export const primaryButtonClass = [
  "rounded-xl bg-indigo-700 px-3.5 py-1.5",
  "text-sm font-semibold",
  "hover:bg-indigo-600 hover:shadow-[0_4px_14px_oklch(30%_0.065_192_/_0.22)]",
  "active:scale-[0.98]",
  "disabled:cursor-not-allowed disabled:opacity-50",
  "transition-all duration-150",
  focusRing,
].join(" ");

export const inputClass = [
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2",
  "text-sm text-slate-800 placeholder:text-slate-400",
  "focus:border-indigo-400 focus:shadow-[0_0_0_3px_oklch(30%_0.065_192_/_0.10)] focus:outline-none",
  "transition-all duration-150",
  focusRing,
].join(" ");

export function skillLabel(skill: string): string {
  return skill.replace(/-/g, " ");
}

const LABELS: Record<MatchLabel, { text: string; className: string }> = {
  strong: {
    text: "Strong match",
    className: "bg-emerald-100 text-emerald-900 border-emerald-200",
  },
  potential: {
    text: "Potential match",
    className: "bg-indigo-100 text-indigo-900 border-indigo-200",
  },
  stretch: {
    text: "Stretch",
    className: "bg-amber-100 text-amber-900 border-amber-200",
  },
  blocked: {
    text: "Eligibility blocker",
    className: "bg-red-100 text-red-900 border-red-200",
  },
  "insufficient-evidence": {
    text: "Not enough evidence to score",
    className: "bg-slate-100 text-slate-700 border-slate-200",
  },
};

// The label is always text, never color alone.
export function MatchBadge({ match }: { match: JobMatch }) {
  const meta = LABELS[match.label];
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${meta.className}`}>
      {match.score !== null ? `${meta.text} · ${match.score}/100` : meta.text}
    </span>
  );
}

export function SourceBadge({ job }: { job: Job }) {
  return job.isDemo ? (
    <span className="rounded-full border border-violet-300 bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-900">
      Demo example — not a real vacancy
    </span>
  ) : (
    <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
      Source: {job.sourceName}
    </span>
  );
}

export function formatSalary(salary: Job["salary"]): string | null {
  if (!salary || (salary.min === undefined && salary.max === undefined)) return null;
  const range =
    salary.min !== undefined && salary.max !== undefined
      ? `${salary.min.toLocaleString()}–${salary.max.toLocaleString()}`
      : (salary.max ?? salary.min)!.toLocaleString();
  return `${salary.currency ?? ""} ${range}${salary.period ? ` / ${salary.period}` : ""}`.trim();
}

export function JobMeta({ job }: { job: Job }) {
  const parts = [
    job.location,
    job.workMode,
    job.employmentType,
    job.experienceLevel && `${job.experienceLevel} level`,
    formatSalary(job.salary),
  ].filter(Boolean);
  return (
    <p className="text-sm text-slate-600">
      {parts.length ? parts.join(" · ") : "Location, type and pay not provided by the source."}
    </p>
  );
}

export function ExternalLink({ job }: { job: Job }) {
  // URLs were validated as http(s) by the API; the link never carries the opener.
  return (
    <a
      href={job.url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className={`${buttonClass} inline-block`}
    >
      {job.isDemo ? "Open example page" : "Open original listing"}
      {" "}<span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

interface CardProps {
  item: OpportunityItem;
  onDetails?: (item: OpportunityItem) => void;
  onToggleSave?: (item: OpportunityItem) => void;
  onDismiss?: (item: OpportunityItem) => void;
  busy?: boolean;
}

export function JobCard({ item, onDetails, onToggleSave, onDismiss, busy }: CardProps) {
  const { job, match } = item;
  const supported = match.skills.filter(
    (skill) => skill.requirement === "required" && skill.status === "github",
  );
  const required = match.skills.filter((skill) => skill.requirement === "required");

  // Panel accent bar color based on match label
  const accentClass =
    match.label === "strong"
      ? "nx-panel-success"
      : match.label === "blocked"
        ? "nx-panel-danger"
        : match.label === "stretch"
          ? "nx-panel-warning"
          : "nx-panel";

  return (
    <article
      className={`nx-card rounded-2xl border border-slate-200 bg-white px-4 py-4 transition-all hover:shadow-md ${accentClass}`}
      aria-labelledby={`job-${job.id}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 id={`job-${job.id}`} className="font-semibold text-slate-900 leading-snug">
            {job.title}
          </h3>
          <p className="text-sm text-slate-500 mt-0.5">{job.company ?? "Company not provided"}</p>
        </div>
        <MatchBadge match={match} />
      </div>

      <div className="mt-2">
        <JobMeta job={job} />
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <SourceBadge job={job} />
        {job.stale ? (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs text-amber-800">
            Older listing
          </span>
        ) : null}
        {item.saved ? (
          <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs text-indigo-800 font-medium">
            {APPLICATION_STATUS_LABELS[item.saved.status]}
          </span>
        ) : null}
      </div>

      {required.length > 0 ? (
        <p className="mt-2.5 text-xs text-slate-500">
          <span className="font-semibold tabular-nums text-slate-700">{supported.length}</span>
          {" of "}
          <span className="font-semibold tabular-nums text-slate-700">{required.length}</span>
          {" required skills supported by GitHub evidence."}
        </p>
      ) : null}

      {match.hardBlockers.length > 0 ? (
        <p className="mt-2 text-xs font-semibold text-red-700">
          Blocker: {match.hardBlockers[0]}
        </p>
      ) : null}

      <div className="mt-3.5 flex flex-wrap gap-2">
        {onDetails ? (
          <button
            type="button"
            className={primaryButtonClass}
            onClick={() => onDetails(item)}
            style={{ color: "var(--color-indigo-950)" }}
          >
            View details
            <span className="sr-only"> for {job.title}</span>
          </button>
        ) : null}
        {onToggleSave ? (
          <button
            type="button"
            aria-label={`${item.saved ? "Unsave" : "Save"} ${job.title}`}
            className={buttonClass}
            disabled={busy}
            onClick={() => onToggleSave(item)}
          >
            {item.saved ? "Unsave" : "Save"}
          </button>
        ) : null}
        {onDismiss ? (
          <button
            type="button"
            aria-label={`Not interested in ${job.title}`}
            className={buttonClass}
            disabled={busy}
            onClick={() => onDismiss(item)}
          >
            Not interested
          </button>
        ) : null}
        <ExternalLink job={job} />
      </div>
    </article>
  );
}

const STATUS_TEXT: Record<string, string> = {
  github: "Supported by GitHub evidence",
  "resume-only": "Claimed in resume only (unverified)",
  missing: "Missing or unverified",
};

export function MatchDetail({ item }: { item: OpportunityItem }) {
  const { job, match } = item;
  return (
    <div className="space-y-5 text-sm text-slate-700">
      <section aria-label="How this score was derived">
        <h4 className="font-semibold text-slate-900">Why this score</h4>
        <ul className="mt-2 space-y-1 list-disc pl-5">
          {match.explanation.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="mt-2 text-slate-500">
          Evidence quality: <span className="font-semibold text-slate-700">{match.confidence}</span>
          {" · "}matching model v{match.matchingVersion}
        </p>
        <table className="mt-3 w-full text-left text-xs">
          <caption className="sr-only">Score components</caption>
          <thead>
            <tr className="border-b border-slate-200 text-slate-600">
              <th scope="col" className="py-1.5 font-semibold">Component</th>
              <th scope="col" className="py-1.5 font-semibold">Weight</th>
              <th scope="col" className="py-1.5 font-semibold">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {match.components.map((component) => (
              <tr key={component.key} className="align-top">
                <th scope="row" className="py-1.5 pr-2 font-normal text-slate-700 capitalize">
                  {component.key.replace(/([A-Z])/g, " $1").toLowerCase()}
                </th>
                <td className="py-1.5 pr-2 tabular-nums">{Math.round(component.weight * 100)}%</td>
                <td className="py-1.5 text-slate-600">
                  {component.value === null ? "Not computed. " : `${Math.round(component.value * 100)}%. `}
                  {component.note}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {match.hardBlockers.length > 0 ? (
        <section
          aria-label="Eligibility blockers"
          className="rounded-lg border border-red-300 bg-red-100 px-4 py-3 text-red-900"
        >
          <h4 className="font-semibold">Eligibility blockers</h4>
          <ul className="mt-1 list-disc pl-5">
            {match.hardBlockers.map((line) => <li key={line}>{line}</li>)}
          </ul>
        </section>
      ) : null}

      {match.unresolvedEligibility.length > 0 ? (
        <section aria-label="Unresolved eligibility questions">
          <h4 className="font-semibold text-slate-900">To confirm</h4>
          <ul className="mt-1 list-disc pl-5">
            {match.unresolvedEligibility.map((line) => <li key={line}>{line}</li>)}
          </ul>
        </section>
      ) : null}

      <section aria-label="Skills">
        <h4 className="font-semibold text-slate-900">Skills</h4>
        {match.skills.length === 0 ? (
          <p className="mt-1 text-slate-500">The listing does not state recognisable skills.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {match.skills.map((skill) => (
              <li key={skill.skill}>
                <span className="font-medium text-slate-800 capitalize">{skillLabel(skill.skill)}</span>
                <span className="text-slate-500"> ({skill.requirement})</span>
                {" — "}{STATUS_TEXT[skill.status]}
                {skill.githubScore !== null ? (
                  <span className="tabular-nums text-slate-500">
                    {" · "}Score {skill.githubScore.toFixed(1)}
                  </span>
                ) : null}
                {skill.projects.length > 0 ? (
                  <span className="text-slate-500">
                    {" · "}
                    {skill.projects.map((project, index) => (
                      <span key={project.fullName}>
                        {index > 0 ? ", " : ""}
                        {project.url ? (
                          <a href={project.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-indigo-700">
                            {project.fullName}
                          </a>
                        ) : project.fullName}
                      </span>
                    ))}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Preferences">
        <h4 className="font-semibold text-slate-900">Your preferences</h4>
        <dl className="mt-1 space-y-0.5 text-sm">
          <div><dt className="inline text-slate-500">Matching: </dt><dd className="inline">{match.preferenceMatches.matched.join(", ") || "none"}</dd></div>
          <div><dt className="inline text-slate-500">Not matching: </dt><dd className="inline">{match.preferenceMatches.mismatched.join(", ") || "none"}</dd></div>
          <div><dt className="inline text-slate-500">Cannot compare: </dt><dd className="inline">{match.preferenceMatches.unknown.join(", ") || "none"}</dd></div>
        </dl>
      </section>

      {match.unavailableInformation.length > 0 ? (
        <section aria-label="Unavailable information">
          <h4 className="font-semibold text-slate-900">Not provided by the source</h4>
          <ul className="mt-1 list-disc pl-5">
            {match.unavailableInformation.map((line) => <li key={line}>{line}</li>)}
          </ul>
        </section>
      ) : null}

      <section aria-label="Description">
        <h4 className="font-semibold text-slate-900">Description</h4>
        <p className="mt-1.5 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
          {job.description || "No description provided."}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Retrieved {new Date(job.retrievedAt).toLocaleString()} from {job.sourceName}.
          NEXUS cannot confirm the listing is still open.
        </p>
      </section>
    </div>
  );
}

export function StatusSelect({
  value,
  onChange,
  disabled,
  id,
}: {
  value: ApplicationStatus;
  onChange: (value: ApplicationStatus) => void;
  disabled?: boolean;
  id: string;
}) {
  return (
    <select
      id={id}
      className={inputClass}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value as ApplicationStatus)}
    >
      {(Object.keys(APPLICATION_STATUS_LABELS) as ApplicationStatus[]).map((status) => (
        <option key={status} value={status}>
          {APPLICATION_STATUS_LABELS[status]}
        </option>
      ))}
    </select>
  );
}
