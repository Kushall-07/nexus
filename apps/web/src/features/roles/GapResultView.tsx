import type { GapAnalysisResponse, RoleRequirementResult } from "../../api/types";
import { formatPercent, formatScore, formatSigned } from "../../lib/format";

function CriticalGapCard({ gap }: { gap: RoleRequirementResult }) {
  return (
    <li className="rounded-lg border-2 border-red-700 bg-red-50 p-4">
      <h3 className="font-semibold text-red-900">{gap.skillName}</h3>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
        <div><dt className="text-slate-700">Evidence Score</dt><dd className="tabular-nums">{formatScore(gap.evidenceScore)}</dd></div>
        <div><dt className="text-slate-700">Minimum Required</dt><dd className="tabular-nums">{formatScore(gap.minimumScore)}</dd></div>
        <div><dt className="text-slate-700">Gap</dt><dd className="tabular-nums">{formatSigned(gap.gap)}</dd></div>
        <div><dt className="text-slate-700">Deficit</dt><dd className="tabular-nums">{formatScore(gap.deficit)}</dd></div>
      </dl>
      <p className="mt-2 text-sm font-medium text-red-900">Status: Critical Gap</p>
      <p className="mt-1 text-sm text-slate-800">
        {gap.evidenceAvailable
          ? `The Evidence Score of ${formatScore(gap.evidenceScore)} is ${formatScore(gap.deficit)} below the configured minimum of ${formatScore(gap.minimumScore)}.`
          : `No evidence was found for this skill, so it is counted as 0 against the configured minimum of ${formatScore(gap.minimumScore)}. This does not show you lack the skill.`}
      </p>
    </li>
  );
}

export function GapResultView({ result }: { result: GapAnalysisResponse }) {
  return (
    <section aria-labelledby="result-heading" className="space-y-6">
      <div>
        <h2 id="result-heading" className="text-xl font-semibold text-slate-900">
          {result.roleName}: Role Match
        </h2>
        <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-900">
          {formatScore(result.roleMatch)}
          <span className="text-base font-normal text-slate-600">/100</span>
        </p>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Role Match is the weighted sum of your Evidence Scores for the skills this benchmark requires. Skills without
          evidence count as 0. It compares observable GitHub evidence with a manually curated v1 benchmark; it is not a
          hiring assessment. Based on scoring v{result.scoringVersion}.
        </p>
      </div>

      <section aria-labelledby="critical-heading" className="space-y-3">
        <h3 id="critical-heading" className="text-lg font-semibold text-slate-900">
          Critical gaps ({result.criticalGaps.length})
        </h3>
        {result.criticalGaps.length === 0 ? (
          <p className="rounded-lg border border-green-700 bg-green-50 p-4 text-sm text-green-900">
            All configured minimum evidence thresholds are met for this role.
          </p>
        ) : (
          <ul className="space-y-3">
            {result.criticalGaps.map((gap) => (
              <CriticalGapCard key={gap.skillId} gap={gap} />
            ))}
          </ul>
        )}
        <p className="text-xs text-slate-600">
          A critical gap means an Evidence Score is below its configured minimum. It is evaluated per skill, regardless
          of the overall Role Match.
        </p>
      </section>

      <section aria-labelledby="requirements-heading" className="space-y-3">
        <h3 id="requirements-heading" className="text-lg font-semibold text-slate-900">All requirements</h3>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Requirement-by-requirement breakdown for {result.roleName}</caption>
            <thead>
              <tr className="border-b border-slate-200 text-slate-700">
                <th scope="col" className="p-2 font-medium">Skill</th>
                <th scope="col" className="p-2 font-medium">Evidence Score</th>
                <th scope="col" className="p-2 font-medium">Minimum</th>
                <th scope="col" className="p-2 font-medium">Gap</th>
                <th scope="col" className="p-2 font-medium">Deficit</th>
                <th scope="col" className="p-2 font-medium">Weight</th>
                <th scope="col" className="p-2 font-medium">Critical Gap</th>
              </tr>
            </thead>
            <tbody>
              {result.requirements.map((requirement) => (
                <tr key={requirement.skillId} className={requirement.criticalGap ? "bg-red-50" : undefined}>
                  <th scope="row" className="p-2 font-normal text-slate-900">
                    {requirement.skillName}
                    {!requirement.evidenceAvailable ? (
                      <span className="block text-xs text-slate-600">No evidence available</span>
                    ) : null}
                  </th>
                  <td className="p-2 tabular-nums">{formatScore(requirement.evidenceScore)}</td>
                  <td className="p-2 tabular-nums">{formatScore(requirement.minimumScore)}</td>
                  <td className="p-2 tabular-nums">{formatSigned(requirement.gap)}</td>
                  <td className="p-2 tabular-nums">{formatScore(requirement.deficit)}</td>
                  <td className="p-2 tabular-nums">{formatPercent(requirement.weight)}</td>
                  <td className="p-2 font-medium">{requirement.criticalGap ? "Critical Gap" : "Threshold met"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
