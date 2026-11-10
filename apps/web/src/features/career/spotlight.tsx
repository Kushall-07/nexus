/**
 * Shared pieces for the "spotlight" look used on the Overview and Job Discovery:
 * the deep-teal hero shell, the animated score ring, a count-up number and a light
 * score ring for list rows.
 */
import { useEffect, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import type { MatchLabel } from "../../api/career-types";

export const RING_C = 2 * Math.PI * 44; // circumference of the r=44 ring

export const heroShell =
  "relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 via-indigo-800 to-indigo-900 text-[var(--color-indigo-950)] shadow-[0_28px_60px_-30px_rgba(14,79,74,0.7)]";

export function prefersReducedMotion() {
  return typeof window !== "undefined" && (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
}

/** Counts up to `value` once on mount (instant for reduced-motion users). */
export function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? value : 0));
  useEffect(() => {
    if (prefersReducedMotion()) {
      setShown(value);
      return undefined;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 900);
      const left = 1 - t; // ease-out cubic
      setShown(Math.round(value * (1 - left * left * left)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{shown}</>;
}

/** Animated ring on the dark hero: `progress` is 0..1. */
export function Ring({ progress, children, size = 132 }: { progress: number; children: ReactNode; size?: number }) {
  const offset = RING_C * (1 - Math.min(Math.max(progress, 0), 1));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="9" />
        <motion.circle
          cx="50"
          cy="50"
          r="44"
          fill="none"
          stroke="oklch(70% 0.148 36)"
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={RING_C}
          initial={{ strokeDashoffset: RING_C }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

export function HeroGlow() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute -bottom-24 -left-10 h-80 w-80 rounded-full"
      style={{ background: "radial-gradient(circle, oklch(70% 0.148 36 / 0.38), transparent 70%)" }}
    />
  );
}

export const SKILL_STATUS: Record<string, { text: string; dot: string }> = {
  github: { text: "Supported by GitHub", dot: "bg-emerald-400" },
  "resume-only": { text: "Resume only", dot: "bg-amber-300" },
  missing: { text: "Missing", dot: "bg-[oklch(70%_0.148_36)]" },
};

const TONE: Record<MatchLabel, string> = {
  strong: "oklch(30% 0.065 192)",
  potential: "oklch(46% 0.075 190)",
  stretch: "oklch(55% 0.130 60)",
  blocked: "oklch(52% 0.190 26)",
  "insufficient-evidence": "oklch(60% 0.010 200)",
};

/** Small light ring for list rows. Shows a dash when the job could not be scored. */
export function ScoreRing({ score, label, size = 52 }: { score: number | null; label: MatchLabel; size?: number }) {
  const pct = score === null ? 0 : Math.min(Math.max(score, 0), 100);
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center rounded-full"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(${TONE[label]} ${pct}%, oklch(88% 0.015 72) 0)`,
      }}
    >
      <span
        className="font-display grid place-items-center rounded-full bg-white text-slate-900"
        style={{ width: size - 10, height: size - 10, fontSize: size * 0.4, lineHeight: 1 }}
      >
        {score === null ? "—" : score}
      </span>
    </span>
  );
}
