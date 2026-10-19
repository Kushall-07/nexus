import { Link } from "react-router-dom";
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
import { ScoreMeter, unavailableLabel } from "../../components/ScoreMeter";
import { formatFactor, formatPercent, formatScore, signalLabel } from "../../lib/format";

interface Props {
  detail: ResourceState<SkillDetail>;
  evidence: ResourceState<SkillEvidenceResponse>;
  onRetryDetail: () => void;
  onRetryEvidence: () => void;
}

function BackLink() {
  return (
    <Link
      to="/"
      className="text-sm font-medium text-indigo-800 underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700"
    >
      Back to skill overview
    </Link>
  );
}

function SignalTable({ signals }: { signals: SignalBreakdown[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Signal-level score breakdown</caption>
        <thead>
          <tr className="border-b border-slate-200 text-slate-600">
            <th scope="col" className="py-1 pr-3 font-medium">Signal</th>
            <th scope="col" className="py-1 pr-3 font-medium">Weight</th>
            <th scope="col" className="py-1 pr-3 font-medium">Applies to this skill</th>
            <th scope="col" className="py-1 pr-3 font-medium">Strength</th>
            <th scope="col" className="py-1 pr-3 font-medium">Meaningful</th>
            <th scope="col" className="py-1 font-medium">Evidence items</th>
          </tr>
        </thead>
        <tbody>
          {signals.map((signal) => (
            <tr key={signal.signal} className="border-b border-slate-100">
              <th scope="row" className="py-1 pr-3 font-normal text-slate-900">{signalLabel(signal.signal)}</th>
              <td className="py-1 pr-3 tabular-nums">{formatFactor(signal.weight)}</td>
              <td className="py-1 pr-3">{signal.applicable ? "Yes" : "No (not counted)"}</td>
              <td className="py-1 pr-3 tabular-nums">{formatPercent(signal.strength)}</td>
              <td className="py-1 pr-3">{signal.meaningful ? "Yes" : "No"}</td>
              <td className="py-1 tabular-nums">{signal.evidenceCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EvidenceList({ items }: { items: EvidenceItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-600">No evidence items for this repository.</p>;
  }

  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li key={`${item.evidenceType}-${item.sourcePath ?? ""}-${index}`} className="rounded-md bg-slate-50 p-2 text-sm">
          <p className="text-slate-900">{item.explanation}</p>
          <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs text-slate-600">
            <dt>Type</dt>
            <dd>{item.evidenceType}</dd>
            <dt>Signal</dt>
            <dd>{signalLabel(item.signal)}</dd>
            <dt>Normalized strength</dt>
            <dd>{formatPercent(item.normalizedStrength)}</dd>
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

function ContributionCard({ entry, evidence }: { entry: ContributionDetail; evidence: EvidenceItem[] }) {
  return (
    <li className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-base">
        <span className="mr-2 text-sm text-slate-600">Rank {entry.rank}</span>
        <RepositoryLink repository={entry.repository} />
      </h3>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
        <div><dt className="text-slate-600">Repository skill score</dt><dd className="tabular-nums">{formatScore(entry.repositorySkillScore)}/100</dd></div>
        <div><dt className="text-slate-600">Base score</dt><dd className="tabular-nums">{formatScore(entry.baseScore)}</dd></div>
        <div><dt className="text-slate-600">Breadth factor</dt><dd className="tabular-nums">{formatFactor(entry.breadthFactor)}</dd></div>
        <div><dt className="text-slate-600">Repository substance</dt><dd className="tabular-nums">{formatFactor(entry.repositorySubstance)}</dd></div>
        <div><dt className="text-slate-600">Rank multiplier</dt><dd className="tabular-nums">{formatFactor(entry.rankMultiplier)}</dd></div>
        <div><dt className="text-slate-600">Contribution weight</dt><dd className="tabular-nums">{formatFactor(entry.contributionWeight)}</dd></div>
      </dl>
      <h4 className="mt-3 text-sm font-medium text-slate-900">Signals</h4>
      <SignalTable signals={entry.signals} />
      <h4 className="mt-3 text-sm font-medium text-slate-900">Evidence</h4>
      <EvidenceList items={evidence} />
    </li>
  );
}

function ExcludedCard({ entry, evidence }: { entry: RepositoryScoreDetail; evidence: EvidenceItem[] }) {
  return (
    <li className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-base">
        <RepositoryLink repository={entry.repository} />
      </h3>
      <p className="mt-1 text-sm text-slate-700">
        Repository skill score {formatScore(entry.repositorySkillScore)}/100, ranked below the top-repository cutoff and
        not counted in the final score.
      </p>
      <h4 className="mt-3 text-sm font-medium text-slate-900">Evidence</h4>
      <EvidenceList items={evidence} />
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
    <li className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-base"><RepositoryLink repository={reference} /></h3>
      <EvidenceList items={items} />
    </li>
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

  const data = detail.data;
  const evidenceByRepository = evidence.status === "success" ? groupByRepository(evidence.data.evidence) : new Map();
  const shown = new Set([
    ...data.contributions.map((entry) => entry.repository.id),
    ...data.excludedRepositories.map((entry) => entry.repository.id),
  ]);
  const unlisted = [...evidenceByRepository.entries()].filter(([repositoryId]) => !shown.has(repositoryId));

  return (
    <div className="space-y-6">
      <BackLink />
      <header>
        <p className="text-sm text-slate-600">{data.skill.categoryName}</p>
        <h1 className="text-2xl font-semibold text-slate-900">{data.skill.displayName}</h1>
        <div className="mt-2">
          <ScoreMeter score={data.score} unavailableLabel={unavailableLabel(data.status)} />
        </div>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          The Evidence Score (0&ndash;100) summarises what NEXUS observed in your analyzed public repositories. It is
          not proof of expertise, certification or job readiness, and it can only reflect what the analyzer is able to
          detect.
        </p>
      </header>

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
        <section aria-labelledby="contributions-heading" className="space-y-3">
          <h2 id="contributions-heading" className="text-lg font-semibold text-slate-900">Contributing repositories</h2>
          <p className="max-w-3xl text-sm text-slate-600">
            The final score is the contribution-weighted average of the repository scores below (total contribution
            weight {formatFactor(data.contributionWeightSum ?? 0)}).
          </p>
          <ul className="space-y-3">
            {data.contributions.map((entry) => (
              <ContributionCard
                key={entry.repository.id}
                entry={entry}
                evidence={evidenceByRepository.get(entry.repository.id) ?? []}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {data.excludedRepositories.length > 0 ? (
        <section aria-labelledby="excluded-heading" className="space-y-3">
          <h2 id="excluded-heading" className="text-lg font-semibold text-slate-900">Not counted in the score</h2>
          <ul className="space-y-3">
            {data.excludedRepositories.map((entry) => (
              <ExcludedCard
                key={entry.repository.id}
                entry={entry}
                evidence={evidenceByRepository.get(entry.repository.id) ?? []}
              />
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="evidence-heading" className="space-y-3">
        <h2 id="evidence-heading" className="text-lg font-semibold text-slate-900">Evidence</h2>
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
