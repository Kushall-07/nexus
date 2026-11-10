/**
 * "Skill profile" panel: a dark radar card that sits beside the heatmap.
 * It only plots Evidence Scores the backend already produced - no scoring happens here.
 */
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import type { SkillOverview } from "../../api/types";
import { formatScore } from "../../lib/format";
import { HeroGlow, heroShell, prefersReducedMotion } from "../career/spotlight";

export interface RadarItem {
  id: string;
  label: string;
  /** Backend Evidence Score, or null when the skill / category has no evidence. */
  value: number | null;
}

const SIZE = 220;
const CENTER = SIZE / 2;
const RADIUS = 78;

function point(index: number, count: number, radius: number): [number, number] {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count;
  return [CENTER + radius * Math.cos(angle), CENTER + radius * Math.sin(angle)];
}

function toPoints(coords: Array<[number, number]>): string {
  return coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
}

/** Highest backend score in a category (a pick, not a calculation), or null if none. */
export function strongestScore(skills: SkillOverview["categories"][number]["skills"]): number | null {
  let best: number | null = null;
  for (const skill of skills) {
    if (skill.status === "scored" && skill.score !== null && (best === null || skill.score > best)) best = skill.score;
  }
  return best;
}

function Radar({ items }: { items: RadarItem[] }) {
  const count = items.length;
  const rings = [0.25, 0.5, 0.75, 1];
  const shape: Array<[number, number]> = items.map((item, index) =>
    point(index, count, (RADIUS * Math.min(Math.max(item.value ?? 0, 0), 100)) / 100),
  );
  const motionProps = prefersReducedMotion()
    ? {}
    : { initial: { opacity: 0, scale: 0.55 }, animate: { opacity: 1, scale: 1 }, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const } };

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="mx-auto h-auto w-full max-w-[15rem]" role="img"
      aria-label={`Radar chart of ${items.map((i) => `${i.label} ${i.value === null ? "no evidence" : formatScore(i.value)}`).join(", ")}`}>
      {rings.map((ring) => (
        <polygon
          key={ring}
          points={toPoints(items.map((_, index) => point(index, count, RADIUS * ring)))}
          fill={ring === 1 ? "rgba(255,255,255,0.04)" : "none"}
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="1"
        />
      ))}
      {items.map((_, index) => {
        const [x, y] = point(index, count, RADIUS);
        return <line key={index} x1={CENTER} y1={CENTER} x2={x} y2={y} stroke="rgba(255,255,255,0.14)" strokeWidth="1" />;
      })}
      <motion.g style={{ transformOrigin: `${CENTER}px ${CENTER}px` }} {...motionProps}>
        <polygon points={toPoints(shape)} fill="oklch(70% 0.148 36 / 0.32)" stroke="oklch(76% 0.13 36)" strokeWidth="2.5" strokeLinejoin="round" />
        {shape.map(([x, y], index) =>
          items[index].value === null ? null : (
            <circle key={items[index].id} cx={x} cy={y} r="4" fill="oklch(70% 0.148 36)" stroke="#FBF8F4" strokeWidth="2" />
          ),
        )}
      </motion.g>
      {items.map((item, index) => {
        const [x, y] = point(index, count, RADIUS + 17);
        return (
          <g key={item.id} aria-hidden="true">
            <circle cx={x} cy={y} r="8.5" fill={item.value === null ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.92)"} />
            <text x={x} y={y + 3.6} textAnchor="middle" fontSize="10" fontWeight="700" fill={item.value === null ? "#9CCBC2" : "#0A3A36"}>
              {index + 1}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

interface Props {
  /** "all" shows the categories; otherwise the id of the category being shown. */
  view: string;
  onViewChange: (view: string) => void;
  categories: SkillOverview["categories"];
  analyzed: boolean;
}

export function SkillRadar({ view, onViewChange, categories, analyzed }: Props) {
  const category = categories.find((c) => c.id === view) ?? null;

  const scoredItems: RadarItem[] = [];
  const unscoredItems: RadarItem[] = [];
  if (category) {
    for (const skill of category.skills) {
      const item = { id: skill.id, label: skill.displayName, value: skill.status === "scored" ? skill.score : null };
      (item.value === null ? unscoredItems : scoredItems).push(item);
    }
  } else {
    for (const c of categories) scoredItems.push({ id: c.id, label: c.displayName, value: strongestScore(c.skills) });
  }
  // Category view plots only scored skills; the category overview plots every category.
  const axes = scoredItems;
  const hasScores = scoredItems.some((item) => item.value !== null);

  return (
    <aside className={`${heroShell} p-5 lg:sticky lg:top-6`} aria-labelledby="profile-heading">
      <HeroGlow />
      <div className="relative">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[#9CCBC2]">Skill profile</p>
        <h2 id="profile-heading" className="font-display mt-1 text-2xl leading-none text-[var(--color-indigo-950)]">
          {category ? category.displayName : "Across categories"}
        </h2>

        <div role="group" aria-label="Radar view" className="mt-4 flex flex-wrap gap-1.5">
          {[{ id: "all", name: "All" }, ...categories.map((c) => ({ id: c.id, name: c.displayName }))].map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-pressed={view === tab.id}
              onClick={() => onViewChange(tab.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[oklch(70%_0.148_36)] ${
                view === tab.id
                  ? "bg-[var(--color-indigo-950)] text-indigo-800"
                  : "bg-white/10 text-[var(--color-indigo-950)] hover:bg-white/20"
              }`}
            >
              {tab.name}
            </button>
          ))}
        </div>

        {!analyzed || !hasScores ? (
          <p className="mt-6 text-sm leading-relaxed text-[#CFE5E0]">
            {analyzed ? "No evidence has been scored here yet, so there is no profile to draw." : "Run an analysis to see your skill profile."}
          </p>
        ) : (
          <div className="mt-5">
            {axes.length >= 3 ? (
              <Radar key={view} items={axes} />
            ) : (
              <p className="mb-2 text-xs text-[#9CCBC2]">A radar needs at least three scored skills, so bars are shown instead.</p>
            )}
          </div>
        )}

        {analyzed ? (
          <ul className="mt-5 space-y-1.5">
            {[...scoredItems, ...unscoredItems].map((item, index) => {
              const dim = item.value === null;
              const rowNumber = category && dim ? null : index + 1;
              const rowClass = `grid w-full grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-2 rounded-xl px-2 py-1.5 text-left text-xs transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[oklch(70%_0.148_36)] ${dim ? "opacity-60" : ""}`;
              const rowBody = (
                <>
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-white/15 text-[0.65rem] font-bold text-[var(--color-indigo-950)]">
                    {rowNumber ?? "–"}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-[var(--color-indigo-950)]">{item.label}</span>
                    <span className="mt-1 block h-1 overflow-hidden rounded-full bg-white/15">
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${Math.min(Math.max(item.value ?? 0, 0), 100)}%`, background: "oklch(70% 0.148 36)" }}
                      />
                    </span>
                  </span>
                  <span className="tabular-nums font-semibold text-[var(--color-indigo-950)]">
                    {item.value === null ? "—" : item.value.toFixed(0)}
                  </span>
                </>
              );
              return (
                <li key={item.id}>
                  {category ? (
                    <Link to={`/skills/${item.id}`} className={rowClass}>
                      {rowBody}
                    </Link>
                  ) : (
                    <button type="button" onClick={() => onViewChange(item.id)} className={rowClass}>
                      {rowBody}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        ) : null}

        <p className="mt-4 text-[0.7rem] leading-relaxed text-[#9CCBC2]">
          {category
            ? "Scores are the backend Evidence Scores. A smaller shape means less observed evidence, not less skill."
            : "Each point is the strongest Evidence Score in that category. Pick one to look closer."}
        </p>
      </div>
    </aside>
  );
}
