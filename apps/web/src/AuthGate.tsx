import type { ReactNode } from "react";
import { useAuth } from "./auth/AuthContext";
import { IconNexus } from "./components/Icons";
import { ErrorState, LoadingState } from "./components/StateViews";

/* ─────────────────────────────────────────────────────────────────────────── */
/* GitHub mark                                                                  */
/* ─────────────────────────────────────────────────────────────────────────── */

function GitHubMark() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Animated product visualization                                               */
/* SVG constellation: GitHub repos → Tech evidence → Skills → Role match       */
/* ─────────────────────────────────────────────────────────────────────────── */

function ProductViz() {
  return (
    <div
      aria-hidden="true"
      className="relative w-full max-w-sm mx-auto select-none"
      style={{ height: 280 }}
    >
      <svg
        viewBox="0 0 320 280"
        className="w-full h-full"
        style={{ overflow: "visible" }}
      >
        <defs>
          <style>{`
            @keyframes viz-pulse {
              0%, 100% { opacity: 0.6; r: 5; }
              50%       { opacity: 1;   r: 7; }
            }
            @keyframes viz-line {
              from { stroke-dashoffset: 1; opacity: 0; }
              to   { stroke-dashoffset: 0; opacity: 0.4; }
            }
            @keyframes viz-gold-pulse {
              0%, 100% { opacity: 1; r: 7; }
              50%       { opacity: 0.75; r: 9; }
            }
            @keyframes viz-label-in {
              from { opacity: 0; transform: translateX(-6px); }
              to   { opacity: 0.7; transform: translateX(0); }
            }
            @keyframes viz-score-fill {
              from { width: 0px; }
              to   { width: var(--tw, 60px); }
            }
            @media (prefers-reduced-motion: reduce) {
              .viz-animated { animation: none !important; opacity: 0.9 !important; }
            }
          `}</style>
        </defs>

        {/* ── Connecting lines (repos → skills) ───────────── */}
        {[
          { x1: 42, y1: 68, x2: 148, y2: 88 },
          { x1: 42, y1: 118, x2: 148, y2: 118 },
          { x1: 42, y1: 168, x2: 148, y2: 148 },
          { x1: 42, y1: 68, x2: 148, y2: 118 },
          { x1: 42, y1: 118, x2: 148, y2: 88 },
        ].map((line, i) => (
          <line
            key={i}
            x1={line.x1} y1={line.y1}
            x2={line.x2} y2={line.y2}
            stroke="oklch(81% 0.195 86)"
            strokeWidth="1"
            strokeDasharray="1"
            strokeDashoffset="1"
            pathLength="1"
            vectorEffect="non-scaling-stroke"
            className="viz-animated"
            style={{
              animation: `viz-line 0.6s ease-out ${0.3 + i * 0.08}s both`,
              opacity: 0,
            }}
          />
        ))}

        {/* ── Connecting lines (skills → role) ────────────── */}
        {[
          { x1: 160, y1: 88, x2: 232, y2: 108 },
          { x1: 160, y1: 118, x2: 232, y2: 118 },
          { x1: 160, y1: 148, x2: 232, y2: 128 },
        ].map((line, i) => (
          <line
            key={i}
            x1={line.x1} y1={line.y1}
            x2={line.x2} y2={line.y2}
            stroke="oklch(81% 0.195 86)"
            strokeWidth="1"
            strokeDasharray="1"
            strokeDashoffset="1"
            pathLength="1"
            vectorEffect="non-scaling-stroke"
            className="viz-animated"
            style={{
              animation: `viz-line 0.6s ease-out ${0.7 + i * 0.08}s both`,
              opacity: 0,
            }}
          />
        ))}

        {/* ── GitHub repo nodes ──────────────────────────── */}
        {[68, 118, 168].map((cy, i) => (
          <g key={i}>
            <circle
              cx="42" cy={cy} r="5"
              fill="oklch(13% 0.055 86)"
              stroke="oklch(81% 0.195 86)"
              strokeWidth="1.5"
              className="viz-animated"
              style={{
                animation: `viz-pulse 2.8s ease-in-out ${i * 0.4}s infinite`,
              }}
            />
          </g>
        ))}

        {/* ── Repo labels ──────────────────────────────────── */}
        {["react-portfolio", "api-gateway", "ml-pipeline"].map((label, i) => (
          <text
            key={label}
            x="10" y={68 + i * 50 + 4}
            fill="oklch(60% 0.008 90)"
            fontSize="8"
            fontFamily="'JetBrains Mono', monospace"
            className="viz-animated"
            style={{
              animation: `viz-label-in 0.5s ease-out ${0.1 + i * 0.1}s both`,
              opacity: 0,
            }}
          >
            {label}
          </text>
        ))}

        {/* ── Skill nodes ──────────────────────────────────── */}
        {[88, 118, 148].map((cy, i) => (
          <circle
            key={i}
            cx="160" cy={cy} r="6"
            fill="oklch(21% 0.090 86)"
            stroke="oklch(68% 0.190 86)"
            strokeWidth="1.5"
            className="viz-animated"
            style={{
              animation: `viz-pulse 3.0s ease-in-out ${0.2 + i * 0.3}s infinite`,
            }}
          />
        ))}

        {/* ── Skill labels ─────────────────────────────────── */}
        {["TypeScript", "React", "Node.js"].map((label, i) => (
          <text
            key={label}
            x="171" y={88 + i * 30 + 4}
            fill="oklch(74% 0.010 90)"
            fontSize="8.5"
            fontFamily="'Inter', sans-serif"
            className="viz-animated"
            style={{
              animation: `viz-label-in 0.5s ease-out ${0.5 + i * 0.1}s both`,
              opacity: 0,
            }}
          >
            {label}
          </text>
        ))}

        {/* ── Role match node (gold — the peak) ────────────── */}
        <circle
          cx="232" cy="118" r="11"
          fill="oklch(81% 0.195 86)"
          className="viz-animated"
          style={{ animation: "viz-gold-pulse 2.0s ease-in-out 1.0s infinite" }}
        />
        <text
          x="232" y="121.5"
          textAnchor="middle"
          fill="oklch(5.5% 0.009 265)"
          fontSize="7"
          fontFamily="'JetBrains Mono', monospace"
          fontWeight="700"
          className="viz-animated"
          style={{ animation: "viz-label-in 0.5s ease-out 1.0s both", opacity: 0 }}
        >
          87%
        </text>

        {/* ── Role match label ─────────────────────────────── */}
        <text
          x="250" y="115"
          fill="oklch(74% 0.010 90)"
          fontSize="8.5"
          fontFamily="'Inter', sans-serif"
          className="viz-animated"
          style={{ animation: "viz-label-in 0.5s ease-out 1.1s both", opacity: 0 }}
        >
          Frontend
        </text>
        <text
          x="250" y="126"
          fill="oklch(60% 0.008 90)"
          fontSize="7.5"
          fontFamily="'Inter', sans-serif"
          className="viz-animated"
          style={{ animation: "viz-label-in 0.5s ease-out 1.2s both", opacity: 0 }}
        >
          Engineer
        </text>

        {/* ── Bottom caption row ───────────────────────────── */}
        {[
          { x: 42, label: "Repos" },
          { x: 160, label: "Evidence" },
          { x: 232, label: "Match" },
        ].map(({ x, label }) => (
          <text
            key={label}
            x={x} y="202"
            textAnchor="middle"
            fill="oklch(46% 0.004 255)"
            fontSize="7.5"
            fontFamily="'Inter', sans-serif"
          >
            {label}
          </text>
        ))}

        {/* ── Opportunity cards (bottom) ───────────────────── */}
        {[
          { y: 220, title: "Senior Frontend", co: "Stripe", score: "91" },
          { y: 248, title: "Full-Stack Eng.", co: "Vercel", score: "84" },
        ].map((card, i) => (
          <g key={i}>
            <rect
              x="12" y={card.y}
              width="296" height="22"
              rx="4"
              fill="oklch(8% 0.008 265)"
              stroke="oklch(13% 0.007 265)"
              className="viz-animated"
              style={{
                animation: `viz-label-in 0.5s ease-out ${1.4 + i * 0.15}s both`,
                opacity: 0,
              }}
            />
            <text
              x="22" y={card.y + 14}
              fill="oklch(85% 0.011 90)"
              fontSize="8"
              fontFamily="'Inter', sans-serif"
              className="viz-animated"
              style={{
                animation: `viz-label-in 0.5s ease-out ${1.5 + i * 0.15}s both`,
                opacity: 0,
              }}
            >
              {card.title}
            </text>
            <text
              x="130" y={card.y + 14}
              fill="oklch(60% 0.008 90)"
              fontSize="7.5"
              fontFamily="'Inter', sans-serif"
              className="viz-animated"
              style={{
                animation: `viz-label-in 0.5s ease-out ${1.5 + i * 0.15}s both`,
                opacity: 0,
              }}
            >
              {card.co}
            </text>
            <text
              x="286" y={card.y + 14}
              textAnchor="end"
              fill="oklch(81% 0.195 86)"
              fontSize="8"
              fontFamily="'JetBrains Mono', monospace"
              fontWeight="600"
              className="viz-animated"
              style={{
                animation: `viz-label-in 0.5s ease-out ${1.5 + i * 0.15}s both`,
                opacity: 0,
              }}
            >
              {card.score}/100
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Landing page navigation                                                      */
/* ─────────────────────────────────────────────────────────────────────────── */

function LandingNav() {
  return (
    <header className="sticky top-0 z-30 w-full border-b border-slate-200 bg-slate-50/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="text-indigo-700">
            <IconNexus className="h-6 w-6" />
          </span>
          <span className="font-display text-xl text-slate-900 tracking-tight" style={{ letterSpacing: "-0.02em" }}>
            NEXUS
          </span>
        </div>
        <a
          href="/api/auth/github"
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50"
        >
          <GitHubMark />
          Sign in
        </a>
      </div>
    </header>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* Full landing page — public, unauthenticated                                  */
/* ─────────────────────────────────────────────────────────────────────────── */

export function SignInPrompt() {
  const { notice } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <LandingNav />

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-5 pt-16 pb-20 sm:pt-24">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* Left: headline + CTA */}
          <div>
            <div
              className="landing-reveal"
              style={{ animationDelay: "0.05s" }}
            >
              <h1
                className="font-display text-slate-900"
                style={{
                  fontSize: "clamp(3.2rem, 8vw, 6rem)",
                  lineHeight: 0.92,
                  letterSpacing: "-0.025em",
                }}
              >
                {/* sr-only gives screenreaders & tests a recognisable brand anchor */}
                <span className="sr-only">NEXUS — </span>
                YOUR CODE<br />
                <span className="nx-gradient-text">TELLS A</span><br />
                STORY.
              </h1>
            </div>

            <p
              className="landing-reveal mt-6 max-w-md text-base text-slate-700 sm:text-lg"
              style={{ animationDelay: "0.18s" }}
            >
              Turn it into your next opportunity. NEXUS reads your GitHub
              repositories and produces evidence-backed career intelligence —
              not keyword matching.
            </p>

            <div
              className="landing-reveal mt-8"
              style={{ animationDelay: "0.28s" }}
            >
              {notice ? (
                <p
                  role="status"
                  className="mb-4 rounded-lg border border-amber-300 bg-amber-100 px-4 py-2.5 text-sm text-amber-900"
                >
                  {notice}
                </p>
              ) : null}

              <a
                href="/api/auth/github"
                className="nx-cta-shimmer inline-flex items-center gap-2.5 rounded-xl bg-indigo-700 px-6 py-3.5 text-base font-semibold text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50"
                style={{ color: "oklch(5.5% 0.009 265)" }}
              >
                <GitHubMark />
                Sign in with GitHub
              </a>

              <p className="mt-3 text-xs text-slate-500">
                Only reads public repositories. No code or private data is accessed.
              </p>
            </div>
          </div>

          {/* Right: animated product visualization */}
          <div
            className="landing-reveal"
            style={{ animationDelay: "0.38s" }}
          >
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <p className="mb-4 text-xs font-medium text-slate-500 text-center tracking-wide">
                GitHub evidence → skill graph → matched roles
              </p>
              <ProductViz />
            </div>
          </div>
        </div>
      </section>

      {/* ── Problem ────────────────────────────────────────────────────── */}
      <section className="border-t border-slate-200 bg-white px-5 py-16 sm:py-20">
        <div className="mx-auto max-w-3xl text-center">
          <div className="landing-reveal">
            <h2
              className="font-display text-slate-900"
              style={{
                fontSize: "clamp(2rem, 5vw, 3.2rem)",
                lineHeight: 0.95,
                letterSpacing: "-0.025em",
              }}
            >
              JOB APPLICATIONS<br />
              <span className="nx-gradient-text">SHOULDN'T BE GUESSWORK.</span>
            </h2>
          </div>
          <p className="landing-reveal landing-reveal-delay-1 mx-auto mt-6 max-w-xl text-base text-slate-600 sm:text-lg">
            Most platforms match you on keywords. NEXUS reads your actual
            repository history — languages, frameworks, test coverage, project
            patterns — and builds a verifiable skill profile from real evidence.
          </p>
          <div className="landing-reveal landing-reveal-delay-2 mt-10 grid gap-4 sm:grid-cols-3 text-left">
            {[
              { label: "Before", value: "Keyword match", dim: true },
              { label: "With NEXUS", value: "Evidence score", dim: false },
              { label: "Result", value: "Explainable fit", dim: false },
            ].map(({ label, value, dim }) => (
              <div
                key={label}
                className={`rounded-xl border px-5 py-4 ${
                  dim
                    ? "border-slate-200 bg-slate-100 opacity-60"
                    : "border-indigo-200 bg-indigo-50"
                }`}
              >
                <p className="text-xs font-medium text-slate-500">{label}</p>
                <p
                  className={`mt-1 font-display text-2xl ${
                    dim ? "text-slate-700" : "text-indigo-900"
                  }`}
                  style={{ letterSpacing: "-0.02em" }}
                >
                  {value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────────────── */}
      <section className="border-t border-slate-200 px-5 py-16 sm:py-20">
        <div className="mx-auto max-w-3xl">
          <div className="landing-reveal text-center">
            <h2
              className="font-display text-slate-900"
              style={{
                fontSize: "clamp(1.8rem, 4.5vw, 3rem)",
                lineHeight: 0.95,
                letterSpacing: "-0.025em",
              }}
            >
              FOUR STEPS TO CLARITY.
            </h2>
          </div>

          <div className="mt-10 space-y-0">
            {[
              {
                step: "Connect",
                title: "Sign in with GitHub",
                body: "NEXUS reads your public repositories. It never accesses private code, secrets, or account data.",
              },
              {
                step: "Analyze",
                title: "Build your evidence profile",
                body: "Languages, frameworks, testing patterns, and project depth are detected and scored across every selected repository.",
              },
              {
                step: "Discover",
                title: "Find matched opportunities",
                body: "Jobs are scored against your actual evidence. See exactly which of your skills support or limit each match — no guessing.",
              },
              {
                step: "Grow",
                title: "Plan your career direction",
                body: "Choose a direction and get a prioritized skill-gap plan with concrete tasks, milestones, and verification criteria.",
              },
            ].map(({ step, title, body }, i) => (
              <div
                key={step}
                className={`landing-reveal flex gap-5 py-6 border-t border-slate-200`}
                style={{ animationDelay: `${0.1 + i * 0.1}s` }}
              >
                <div className="shrink-0 pt-0.5">
                  <span
                    className="inline-block font-display text-indigo-700"
                    style={{ fontSize: "1.75rem", lineHeight: 1, letterSpacing: "-0.02em" }}
                  >
                    {step}
                  </span>
                </div>
                <div>
                  <p className="text-base font-semibold text-slate-900">{title}</p>
                  <p className="mt-1 text-sm text-slate-600">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Capabilities ───────────────────────────────────────────────── */}
      <section className="border-t border-slate-200 bg-white px-5 py-14">
        <div className="mx-auto max-w-3xl">
          <div className="landing-reveal text-center">
            <h2
              className="font-display text-slate-900"
              style={{
                fontSize: "clamp(1.6rem, 4vw, 2.6rem)",
                lineHeight: 0.95,
                letterSpacing: "-0.025em",
              }}
            >
              EVERYTHING IN ONE PLACE.
            </h2>
          </div>
          <div className="landing-reveal landing-reveal-delay-1 mt-8 flex flex-wrap justify-center gap-2.5">
            {[
              "GitHub evidence analysis",
              "Explainable job matching",
              "Skill graph",
              "Role benchmarking",
              "Skill gap plans",
              "Resume upload",
              "Application tracking",
              "Career Copilot",
              "Development tasks",
              "Preference filtering",
            ].map((feature) => (
              <span
                key={feature}
                className="rounded-full border border-slate-300 bg-slate-100 px-3.5 py-1.5 text-sm font-medium text-slate-700"
              >
                {feature}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────────────── */}
      <section className="border-t border-slate-200 px-5 py-20 text-center">
        <div className="mx-auto max-w-xl">
          <div className="landing-reveal">
            <h2
              className="font-display text-slate-900"
              style={{
                fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
                lineHeight: 0.93,
                letterSpacing: "-0.025em",
              }}
            >
              START WITH<br />
              <span className="nx-gradient-text">WHAT YOU HAVE.</span>
            </h2>
          </div>
          <p className="landing-reveal landing-reveal-delay-1 mt-5 text-base text-slate-600">
            Your GitHub history is already telling a story. Connect once and
            NEXUS will read it.
          </p>
          <div className="landing-reveal landing-reveal-delay-2 mt-8">
            <a
              href="/api/auth/github"
              className="nx-cta-shimmer inline-flex items-center gap-2.5 rounded-xl bg-indigo-700 px-7 py-4 text-lg font-semibold transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50"
              style={{ color: "oklch(5.5% 0.009 265)" }}
            >
              <GitHubMark />
              Sign in with GitHub
            </a>
            <p className="mt-3 text-xs text-slate-500">
              Free. Only reads public repositories.
            </p>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-200 px-5 py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="text-indigo-700">
              <IconNexus className="h-5 w-5" />
            </span>
            <span
              className="font-display text-slate-900 text-sm"
              style={{ letterSpacing: "-0.01em" }}
            >
              NEXUS
            </span>
            <span className="text-slate-400 text-xs">Career Intelligence</span>
          </div>
          <p className="text-xs text-slate-500">
            Evidence-backed. No fabricated scores. No invented listings.
          </p>
        </div>
      </footer>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/* AuthGate — protects all authenticated routes                                 */
/* ─────────────────────────────────────────────────────────────────────────── */

export function AuthGate({ children }: { children: ReactNode }) {
  const { state, refresh } = useAuth();

  if (state.status === "loading") return <LoadingState label="Checking your session…" />;
  if (state.status === "error") return <ErrorState error={state.error} onRetry={refresh} />;
  if (state.status === "unauthenticated") return <SignInPrompt />;
  return <>{children}</>;
}
