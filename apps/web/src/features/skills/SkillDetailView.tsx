import { useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ChevronDown } from "lucide-react";
import type {
  ContributionDetail,
  EvidenceItem,
  RepositoryReference,
  RepositoryScoreDetail,
  SignalBreakdown,
  SkillDetail,
  SkillEvidenceResponse,
} from "../../api/types";
import type { ResourceState } from "../../hooks/useApiResource";
import { EmptyState, ErrorState, LoadingState } from "../../components/StateViews";
import { RepositoryLink } from "../../components/RepositoryLink";
import { unavailableLabel } from "../../components/ScoreMeter";
import { formatFactor, formatPercent, formatScore, signalLabel } from "../../lib/format";
import { CountUp, HeroGlow, Ring, heroShell, prefersReducedMotion } from "../career/spotlight";

interface Props {
  detail: ResourceState<SkillDetail>;
  evidence: ResourceState<SkillEvidenceResponse>;
  onRetryDetail: () => void;
  onRetryEvidence: () => void;
}

/** One colour per rank, shared by the weight bar in the hero and the rank chips below it. */
const TONES = [
  "oklch(70% 0.148 36)",
  "oklch(84% 0.11 85)",
  "oklch(82% 0.07 175)",
  "oklch(74% 0.08 200)",
  "oklch(78% 0.07 300)",
  "oklch(92% 0.02 80)",
];
const tone = (index: number) => TONES[index % TONES.length];

const EASE = [0.22, 1, 0.36, 1] as const;
const HATCH = "repeating-linear-gradient(135deg, oklch(90% 0.014 72) 0 6px, oklch(93% 0.012 72) 6px 12px)";

function shortName(repository: RepositoryReference): string {
  if (repository.fullName) return repository.fullName.split("/").pop() ?? repository.fullName;
  return `Repository ${repository.id.slice(-6)}`;
}

function BackLink() {
  return (
    <Link
      to="/skills"
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-700 transition-colors hover:text-indigo-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Back to skill overview
    </Link>
  );
}

/** A bar that grows to `percent` on mount. */
function Fill({ percent, delay = 0, className = "", style }: { percent: number; delay?: number; className?: string; style?: React.CSSProperties }) {
  const width = `${Math.min(Math.max(percent, 0), 100)}%`;
  return (
    <motion.div
      className={`h-full rounded-full ${className}`}
      style={style}
      initial={prefersReducedMotion() ? false : { width: 0 }}
      animate={{ width }}
      transition={{ duration: 0.85, delay, ease: EASE }}
    />
  );
}

export function EvidenceList({ items }: { items: EvidenceItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-600">No evidence items for this repository.</p>;
  }

  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li key={`${item.evidenceType}-${item.sourcePath ?? ""}-${index}`} className="rounded-xl bg-slate-100 p-3 text-sm">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <span title="Evidence type" className="rounded-md bg-white px-2 py-0.5 text-[0.65rem] font-bold tracking-wide text-indigo-700">{item.evidenceType}</span>
            <span title="Signal" className="rounded-md bg-white px-2 py-0.5 text-[0.65rem] font-semibold text-slate-600">{signalLabel(item.signal)}</span>
            <span title="Normalized strength" className="rounded-md bg-white px-2 py-0.5 text-[0.65rem] font-semibold tabular-nums text-slate-600">{formatPercent(item.normalizedStrength)}</span>
          </div>
          <p className="text-slate-900">{item.explanation}</p>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs text-slate-600">
            <dt>Observed value</dt>
            <dd>{String(item.value)}</dd>
            {item.sourcePath ? (
              <>
                <dt>Source path</dt>
                <dd className="break-all font-mono">{item.sourcePath}</dd>
              </>
            ) : null}
            {item.sourceReference ? (
              <>
                <dt>Source reference</dt>
                <dd className="break-all font-mono">{item.sourceReference}</dd>
              </>
            ) : null}
          </dl>
        </li>
      ))}
    </ul>
  );
}

function EvidenceFold({ items, loading }: { items: EvidenceItem[]; loading: boolean }) {
  return (
    <details className="group rounded-xl border border-slate-200 bg-white" open={items.length > 0 && items.length <= 2}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 [&::-webkit-details-marker]:hidden">
        <span>
          Evidence <span className="font-normal text-slate-500">· {loading ? "loading" : `${items.length} ${items.length === 1 ? "item" : "items"}`}</span>
        </span>
        <ChevronDown className="h-4 w-4 text-slate-500 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="px-4 pb-4">{loading ? <p className="text-sm text-slate-600">Loading evidence…</p> : <EvidenceList items={items} />}</div>
    </details>
  );
}

function Factor({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl px-3.5 py-2.5 ${accent ? "bg-[oklch(93%_0.04_178)] text-indigo-800" : "bg-slate-100 text-slate-900"}`}>
      <dt className="text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</dt>
      <dd className="font-display mt-0.5 text-2xl leading-none tabular-nums">{value}</dd>
    </div>
  );
}

function Operator({ children }: { children: string }) {
  return (
    <span aria-hidden="true" className="font-display self-center text-xl text-slate-400">
      {children}
    </span>
  );
}

function SignalRows({ signals }: { signals: SignalBreakdown[] }) {
  const applicable = signals.filter((signal) => signal.applicable);
  const skipped = signals.filter((signal) => !signal.applicable);

  return (
    <div>
      {applicable.length > 0 ? (
        <ul className="space-y-2.5">
          {applicable.map((signal, index) => (
            <li key={signal.signal} className="grid grid-cols-[minmax(7rem,9rem)_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 text-sm">
              <span className="font-medium text-slate-900">{signalLabel(signal.signal)}</span>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                <Fill percent={signal.strength * 100} delay={0.1 + index * 0.07} className="nx-score-fill" />
              </div>
              <span className="w-12 text-right font-semibold tabular-nums text-slate-900">{formatPercent(signal.strength)}</span>
              <span className="col-span-3 flex flex-wrap gap-x-3 text-xs text-slate-500 sm:col-start-2 sm:col-span-2">
                <span>weight {formatFactor(signal.weight)}</span>
                <span>{signal.meaningful ? "Meaningful" : "Not meaningful"}</span>
                <span>
                  {signal.evidenceCount} evidence {signal.evidenceCount === 1 ? "item" : "items"}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-600">No signal applies to this skill in this repository.</p>
      )}

      {skipped.length > 0 ? (
        <details className="group mt-3 rounded-xl bg-slate-100">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3.5 py-2.5 text-xs font-semibold text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 [&::-webkit-details-marker]:hidden">
            <span>
              {skipped.length} {skipped.length === 1 ? "signal does" : "signals do"} not apply to this skill
            </span>
            <ChevronDown className="h-4 w-4 text-slate-500 transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <ul className="space-y-1.5 px-3.5 pb-3 text-xs text-slate-600">
            {skipped.map((signal) => (
              <li key={signal.signal} className="flex flex-wrap items-center justify-between gap-x-3">
                <span className="font-medium text-slate-800">{signalLabel(signal.signal)}</span>
                <span className="tabular-nums">weight {formatFactor(signal.weight)}</span>
                <span>No (not counted)</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function ContributionPanel({ entry, evidence, loading }: { entry: ContributionDetail; evidence: EvidenceItem[]; loading: boolean }) {
  return (
    <div className="nx-card space-y-5 rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-lg">
        <span className="rounded-full bg-indigo-700 px-3 py-0.5 text-xs font-bold text-[var(--color-indigo-950)]">Rank {entry.rank}</span>
        <RepositoryLink repository={entry.repository} />
      </h3>

      <div className="space-y-2">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-slate-500">How this repository scored</p>
        <dl className="flex flex-wrap gap-2">
          <Factor label="Base score" value={formatScore(entry.baseScore)} />
          <Operator>×</Operator>
          <Factor label="Breadth factor" value={formatFactor(entry.breadthFactor)} />
          <Operator>=</Operator>
          <Factor label="Repository skill score" value={`${formatScore(entry.repositorySkillScore)}/100`} accent />
        </dl>
        <p className="text-xs text-slate-500">The base score comes from the signals below. The breadth factor adjusts it for how many signal types supported the skill.</p>
      </div>

      <div className="space-y-2">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-slate-500">How much it counts</p>
        <dl className="flex flex-wrap gap-2">
          <Factor label="Rank multiplier" value={formatFactor(entry.rankMultiplier)} />
          <Operator>×</Operator>
          <Factor label="Repository substance" value={formatFactor(entry.repositorySubstance)} />
          <Operator>=</Operator>
          <Factor label="Contribution weight" value={formatFactor(entry.contributionWeight)} accent />
        </dl>
        <p className="text-xs text-slate-500">Lower ranks and less substantial repositories pull the final average less.</p>
      </div>

      <div className="space-y-2">
        <h4 className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-slate-500">Signals</h4>
        <SignalRows signals={entry.signals} />
      </div>

      <EvidenceFold items={evidence} loading={loading} />
    </div>
  );
}

function ExcludedCard({ entry, evidence, loading }: { entry: RepositoryScoreDetail; evidence: EvidenceItem[]; loading: boolean }) {
  return (
    <li className="rounded-2xl border border-dashed border-slate-300 bg-transparent p-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2">
        <h3 className="min-w-0 truncate text-base">
          <RepositoryLink repository={entry.repository} />
        </h3>
        <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-slate-700">{formatScore(entry.repositorySkillScore)}</span>
        <div className="col-span-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
          <Fill percent={entry.repositorySkillScore} className="bg-slate-400" />
        </div>
      </div>
      <p className="mt-2 text-sm text-slate-700">
        Repository skill score {formatScore(entry.repositorySkillScore)}/100, ranked below the top-repository cutoff and
        not counted in the final score.
      </p>
      <div className="mt-3">
        <EvidenceFold items={evidence} loading={loading} />
      </div>
    </li>
  );
}

function groupByRepository(items: EvidenceItem[]): Map<string, EvidenceItem[]> {
  const grouped = new Map<string, EvidenceItem[]>();

  for (const item of items) {
    grouped.set(item.repositoryId, [...(grouped.get(item.repositoryId) ?? []), item]);
  }

  return grouped;
}

function EvidenceOnlySection({ repositoryId, items }: { repositoryId: string; items: EvidenceItem[] }) {
  const reference: RepositoryReference = { id: repositoryId, fullName: null, url: null };

  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="mb-2 text-base"><RepositoryLink repository={reference} /></h3>
      <EvidenceList items={items} />
    </li>
  );
}

function Hero({
  data,
  activeId,
  onActive,
  onSelect,
}: {
  data: SkillDetail;
  activeId: string | null;
  onActive: (id: string | null) => void;
  onSelect: (id: string) => void;
}) {
  const scored = data.status === "scored" && data.score !== null;
  const active = data.contributions.find((entry) => entry.repository.id === activeId) ?? null;
  const reduced = prefersReducedMotion();

  return (
    <header className={`${heroShell} p-6 sm:p-7`}>
      <HeroGlow />
      <div className="relative space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-5">
          <div className="flex min-w-0 items-center gap-5">
            <Ring progress={scored ? (data.score as number) / 100 : 0} size={112}>
              <span className="font-display text-4xl leading-none text-[var(--color-indigo-950)] tabular-nums">
                {scored ? <CountUp value={Math.round(data.score as number)} /> : "—"}
              </span>
            </Ring>
            <div className="min-w-0">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[#9CCBC2]">{data.skill.categoryName}</p>
              <h1 className="font-display mt-1 text-[var(--color-indigo-950)]" style={{ fontSize: "3rem", lineHeight: 0.9, letterSpacing: "-0.02em" }}>
                {data.skill.displayName}
              </h1>
              <p className="mt-2 text-sm font-semibold tabular-nums text-[#CFE5E0]">
                {scored ? <span>{formatScore(data.score as number)}/100</span> : <span>{unavailableLabel(data.status)}</span>}
                {scored ? (
                  <span className="font-normal text-[#9CCBC2]">
                    {" "}
                    · from {data.contributions.length} {data.contributions.length === 1 ? "repository" : "repositories"}
                  </span>
                ) : null}
              </p>
            </div>
          </div>

          {scored ? (
            <div className="text-right">
              <p className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[#9CCBC2]">Total contribution weight</p>
              <p className="font-display text-5xl leading-none text-[var(--color-indigo-950)] tabular-nums">{formatFactor(data.contributionWeightSum ?? 0)}</p>
            </div>
          ) : null}
        </div>

        {scored && data.contributions.length > 0 ? (
          <div>
            <p className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-[#9CCBC2]">Who pulled on the score · share of contribution weight</p>
            <div className="flex h-10 gap-1" onMouseLeave={() => onActive(null)}>
              {data.contributions.map((entry, index) => {
                const dimmed = activeId !== null && activeId !== entry.repository.id;
                return (
                  <motion.button
                    key={entry.repository.id}
                    type="button"
                    aria-label={`Rank ${entry.rank}, ${shortName(entry.repository)}, contribution weight ${formatFactor(entry.contributionWeight)}`}
                    onMouseEnter={() => onActive(entry.repository.id)}
                    onFocus={() => onActive(entry.repository.id)}
                    onBlur={() => onActive(null)}
                    onClick={() => onSelect(entry.repository.id)}
                    className="font-display grid origin-left place-items-center rounded-lg text-base text-[#0A2A27] transition-[opacity,transform] duration-200 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    style={{ flex: `${Math.max(entry.contributionWeight, 0.001)} 1 0`, minWidth: "1.5rem", background: tone(index), opacity: dimmed ? 0.45 : 1 }}
                    initial={reduced ? false : { scaleX: 0, opacity: 0 }}
                    animate={{ scaleX: 1, opacity: dimmed ? 0.45 : 1 }}
                    transition={{ duration: 0.7, delay: 0.15 + index * 0.09, ease: EASE }}
                  >
                    {entry.rank}
                  </motion.button>
                );
              })}
            </div>
            <p className="mt-2 min-h-[1.25rem] text-xs text-[#CFE5E0]" aria-hidden="true">
              {active
                ? `#${active.rank} ${shortName(active.repository)} · weight ${formatFactor(active.contributionWeight)} · repository score ${formatScore(active.repositorySkillScore)}`
                : "Hover a segment to see which repository it is."}
            </p>
          </div>
        ) : null}

        <p className="max-w-3xl text-sm text-[#CFE5E0]" style={{ lineHeight: 1.65 }}>
          The Evidence Score (0&ndash;100) summarises what NEXUS observed in your analyzed public repositories. It is
          not proof of expertise, certification or job readiness, and it can only reflect what the analyzer is able to
          detect.
        </p>
      </div>
    </header>
  );
}

function RaceRow({
  entry,
  index,
  selected,
  active,
  onSelect,
  onActive,
}: {
  entry: ContributionDetail;
  index: number;
  selected: boolean;
  active: boolean;
  onSelect: () => void;
  onActive: (id: string | null) => void;
}) {
  return (
    <li>
      <button
        type="button"
        aria-pressed={selected}
        aria-label={`Rank ${entry.rank}, ${shortName(entry.repository)}, repository skill score ${formatScore(entry.repositorySkillScore)}, contribution weight ${formatFactor(entry.contributionWeight)}`}
        onClick={onSelect}
        onMouseEnter={() => onActive(entry.repository.id)}
        onMouseLeave={() => onActive(null)}
        onFocus={() => onActive(entry.repository.id)}
        onBlur={() => onActive(null)}
        className={`grid w-full grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-2xl border bg-white px-4 py-3 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 sm:grid-cols-[2rem_minmax(8rem,12rem)_minmax(0,1fr)_auto] ${
          selected
            ? "border-indigo-700 shadow-[0_0_0_3px_rgba(14,79,74,0.12)]"
            : active
              ? "border-slate-300 shadow-md"
              : "border-slate-200 hover:-translate-y-px hover:border-slate-300"
        }`}
      >
        <span
          aria-hidden="true"
          className="font-display grid h-8 w-8 place-items-center rounded-full text-base text-[#0A2A27] ring-1 ring-inset ring-black/10"
          style={{ background: tone(index) }}
        >
          {entry.rank}
        </span>
        <span className="min-w-0" aria-hidden="true">
          <span className="block truncate text-sm font-semibold text-slate-900">{shortName(entry.repository)}</span>
          <span className="block text-xs text-slate-500">weight {formatFactor(entry.contributionWeight)}</span>
        </span>
        <span className="col-span-3 h-5 overflow-hidden rounded-md bg-slate-200 sm:order-3 sm:col-span-1 sm:col-start-3" aria-hidden="true">
          <Fill percent={entry.repositorySkillScore} delay={0.1 + index * 0.08} className="rounded-md" style={{ background: "linear-gradient(90deg, var(--color-indigo-700), oklch(46% 0.075 190))" }} />
        </span>
        <span className="font-display text-2xl leading-none text-slate-900 tabular-nums sm:order-4" aria-hidden="true">
          {entry.repositorySkillScore.toFixed(0)}
        </span>
      </button>
    </li>
  );
}

function DetailBody({ data, evidence, onRetryEvidence }: { data: SkillDetail; evidence: ResourceState<SkillEvidenceResponse>; onRetryEvidence: () => void }) {
  const firstId = data.contributions[0]?.repository.id ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const evidenceByRepository = evidence.status === "success" ? groupByRepository(evidence.data.evidence) : new Map<string, EvidenceItem[]>();
  const evidenceLoading = evidence.status === "loading";
  const shown = new Set([
    ...data.contributions.map((entry) => entry.repository.id),
    ...data.excludedRepositories.map((entry) => entry.repository.id),
  ]);
  const unlisted = [...evidenceByRepository.entries()].filter(([repositoryId]) => !shown.has(repositoryId));

  const currentId = data.contributions.some((entry) => entry.repository.id === selectedId) ? selectedId : firstId;
  const selected = data.contributions.find((entry) => entry.repository.id === currentId) ?? null;

  // Arrow keys move the selection through the ranked list.
  function onListKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const buttons = Array.from(event.currentTarget.querySelectorAll("button"));
    const at = buttons.findIndex((button) => button === document.activeElement);
    const next = buttons[at + (event.key === "ArrowDown" ? 1 : -1)];
    if (!next) return;
    event.preventDefault();
    next.focus();
    next.click();
  }

  return (
    <div className="space-y-6">
      <BackLink />
      <Hero data={data} activeId={activeId} onActive={setActiveId} onSelect={setSelectedId} />

      {data.status === "not-analyzed" ? (
        <EmptyState title="Not yet analyzed">
          Evidence score unavailable: no scoring run exists yet. Score your collected evidence from the overview.
        </EmptyState>
      ) : null}
      {data.status === "no-evidence" ? (
        <EmptyState title="No evidence available">
          The latest analysis found no scoreable evidence for this skill. That does not show you lack the skill; it was
          simply not observed in the analyzed repositories.
        </EmptyState>
      ) : null}

      {data.status === "scored" ? (
        <section aria-labelledby="contributions-heading" className="space-y-4">
          <div>
            <h2 id="contributions-heading" className="font-display text-2xl leading-none text-slate-900">Contributing repositories</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              The final score is the contribution-weighted average of the repository scores below (total contribution
              weight {formatFactor(data.contributionWeightSum ?? 0)}). Bar length is the repository skill score.
            </p>
          </div>
          <ul className="space-y-2" onKeyDown={onListKeyDown}>
            {data.contributions.map((entry, index) => (
              <RaceRow
                key={entry.repository.id}
                entry={entry}
                index={index}
                selected={entry.repository.id === currentId}
                active={entry.repository.id === activeId}
                onSelect={() => setSelectedId(entry.repository.id)}
                onActive={setActiveId}
              />
            ))}
          </ul>
          <AnimatePresence mode="wait" initial={false}>
            {selected ? (
              <motion.div
                key={selected.repository.id}
                initial={prefersReducedMotion() ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22 }}
              >
                <ContributionPanel entry={selected} evidence={evidenceByRepository.get(selected.repository.id) ?? []} loading={evidenceLoading} />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </section>
      ) : null}

      {data.excludedRepositories.length > 0 ? (
        <section aria-labelledby="excluded-heading" className="space-y-3">
          <h2 id="excluded-heading" className="font-display text-2xl leading-none text-slate-900">Not counted in the score</h2>
          <ul className="space-y-3">
            {data.excludedRepositories.map((entry) => (
              <ExcludedCard
                key={entry.repository.id}
                entry={entry}
                evidence={evidenceByRepository.get(entry.repository.id) ?? []}
                loading={evidenceLoading}
              />
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="evidence-heading" className="space-y-3">
        <h2 id="evidence-heading" className="font-display text-2xl leading-none text-slate-900">Evidence</h2>
        {evidence.status === "loading" ? <LoadingState label="Loading evidence..." /> : null}
        {evidence.status === "error" ? <ErrorState error={evidence.error} onRetry={onRetryEvidence} /> : null}
        {evidence.status === "success" && evidence.data.evidence.length === 0 ? (
          <EmptyState title="No evidence available">No evidence items were recorded for this skill.</EmptyState>
        ) : null}
        {unlisted.length > 0 ? (
          <>
            <p className="text-sm text-slate-600">
              Evidence from repositories that did not contribute to the score:
            </p>
            <ul className="space-y-3">
              {unlisted.map(([repositoryId, items]) => (
                <EvidenceOnlySection key={repositoryId} repositoryId={repositoryId} items={items} />
              ))}
            </ul>
          </>
        ) : null}
        {evidence.status === "success" && evidence.data.evidence.length > 0 && unlisted.length === 0 ? (
          <p className="text-sm text-slate-600">
            {evidence.data.evidence.length} evidence {evidence.data.evidence.length === 1 ? "item is" : "items are"} shown
            with the repositories above.
          </p>
        ) : null}
      </section>
    </div>
  );
}

export function SkillDetailView({ detail, evidence, onRetryDetail, onRetryEvidence }: Props) {
  if (detail.status === "loading") {
    return <LoadingState label="Loading skill..." />;
  }
  if (detail.status === "error") {
    return (
      <div className="space-y-4">
        <BackLink />
        {detail.error.code === "SKILL_NOT_FOUND" ? (
          <EmptyState title="Skill not found">This skill does not exist in the NEXUS taxonomy.</EmptyState>
        ) : (
          <ErrorState error={detail.error} onRetry={onRetryDetail} />
        )}
      </div>
    );
  }

  return <DetailBody data={detail.data} evidence={evidence} onRetryEvidence={onRetryEvidence} />;
}
