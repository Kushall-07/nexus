/**
 * NEXUS Public Landing Page
 *
 * Design: Gold Signal dark (default) + Cream/Teal/Coral light — dual theme.
 * Visual centerpiece: Three.js particle-network hero (lazy-loaded).
 * Mobile: static CSS constellation fallback.
 * Reduced motion: static fallback, no scroll animations.
 *
 * Section order:
 *   1. Navigation
 *   2. Hero
 *   3. Product positioning (evidence vs keywords)
 *   4. How NEXUS works (4 steps)
 *   5. GitHub evidence intelligence
 *   6. Skill intelligence + gap analysis
 *   7. Final CTA
 *   8. Footer
 */

import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { IconNexus } from "../../components/Icons";
import { getStoredTheme, toggleTheme, type Theme } from "../../lib/theme";
import { StaticHeroBackground } from "../../three/StaticHeroBackground";
import type { HeroTheme } from "../../three/HeroScene";

// Lazy-load Three.js scene — stays out of the initial bundle
const HeroScene = lazy(() =>
  import("../../three/HeroScene").then((m) => ({ default: m.HeroScene }))
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function GitHubMark({ size = 18 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

/** Scroll-reveal hook — adds `is-visible` class when element enters viewport. */
function useScrollReveal() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Skip when user prefers reduced motion
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.classList.remove("landing-section-reveal");
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.08 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return ref;
}

/** Theme toggle button. */
function ThemeToggle({
  theme,
  onToggle,
}: {
  theme: Theme;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      className="flex items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700"
    >
      {theme === "dark" ? (
        // Sun icon
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="8" cy="8" r="3" />
          <line x1="8" y1="1" x2="8" y2="2.5" />
          <line x1="8" y1="13.5" x2="8" y2="15" />
          <line x1="1" y1="8" x2="2.5" y2="8" />
          <line x1="13.5" y1="8" x2="15" y2="8" />
          <line x1="3.05" y1="3.05" x2="4.1" y2="4.1" />
          <line x1="11.9" y1="11.9" x2="12.95" y2="12.95" />
          <line x1="12.95" y1="3.05" x2="11.9" y2="4.1" />
          <line x1="4.1" y1="11.9" x2="3.05" y2="12.95" />
        </svg>
      ) : (
        // Moon icon
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13.5 10A6 6 0 0 1 6 2.5a6 6 0 1 0 7.5 7.5z" />
        </svg>
      )}
    </button>
  );
}

// ─── Navigation ───────────────────────────────────────────────────────────────

function LandingNav({
  theme,
  onThemeToggle,
}: {
  theme: Theme;
  onThemeToggle: () => void;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { state } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isAuthenticated = state.status === "authenticated";

  return (
    <header
      className={[
        "fixed top-0 left-0 right-0 z-40 transition-all duration-300",
        scrolled
          ? "border-b border-slate-200 bg-slate-50/92 backdrop-blur-md shadow-sm"
          : "bg-transparent",
      ].join(" ")}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 sm:px-8">
        {/* Brand */}
        <a
          href="/"
          className="flex items-center gap-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 rounded-md"
          aria-label="NEXUS home"
        >
          <span className="text-indigo-700">
            <IconNexus className="h-6 w-6" />
          </span>
          <span
            className="font-display text-slate-900"
            style={{ fontSize: "1.15rem", letterSpacing: "-0.025em" }}
          >
            NEXUS
          </span>
        </a>

        {/* Desktop nav */}
        <nav aria-label="Site" className="hidden items-center gap-1 md:flex">
          <a
            href="#how-it-works"
            className="rounded-lg px-3 py-1.5 text-sm text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700"
          >
            How it works
          </a>
          <a
            href="#evidence"
            className="rounded-lg px-3 py-1.5 text-sm text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700"
          >
            Evidence
          </a>
          <a
            href="#skill-intelligence"
            className="rounded-lg px-3 py-1.5 text-sm text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700"
          >
            Skills
          </a>
        </nav>

        {/* Actions */}
        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggle theme={theme} onToggle={onThemeToggle} />
          {isAuthenticated ? (
            <a
              href="/dashboard"
              className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700"
              style={{ color: "var(--color-indigo-950)" }}
            >
              Go to workspace
            </a>
          ) : (
            <>
              <a
                href="/api/auth/github"
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700"
              >
                Sign in
              </a>
              <a
                href="/api/auth/github"
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700"
                style={{ color: "var(--color-indigo-950)" }}
              >
                <GitHubMark size={15} />
                Get started
              </a>
            </>
          )}
        </div>

        {/* Mobile actions */}
        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle theme={theme} onToggle={onThemeToggle} />
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700"
          >
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              {menuOpen ? (
                <>
                  <line x1="3" y1="3" x2="15" y2="15" />
                  <line x1="15" y1="3" x2="3" y2="15" />
                </>
              ) : (
                <>
                  <line x1="2" y1="5" x2="16" y2="5" />
                  <line x1="2" y1="9" x2="16" y2="9" />
                  <line x1="2" y1="13" x2="16" y2="13" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="border-t border-slate-200 bg-slate-50/97 backdrop-blur-md px-5 py-4 md:hidden">
          <nav aria-label="Mobile site" className="flex flex-col gap-1">
            <a
              href="#how-it-works"
              onClick={() => setMenuOpen(false)}
              className="rounded-lg px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-100"
            >
              How it works
            </a>
            <a
              href="#evidence"
              onClick={() => setMenuOpen(false)}
              className="rounded-lg px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-100"
            >
              Evidence
            </a>
            <a
              href="#skill-intelligence"
              onClick={() => setMenuOpen(false)}
              className="rounded-lg px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-100"
            >
              Skills
            </a>
          </nav>
          <div className="mt-4 flex flex-col gap-2 border-t border-slate-200 pt-4">
            {isAuthenticated ? (
              <a
                href="/dashboard"
                className="w-full rounded-lg bg-indigo-700 px-4 py-3 text-center text-sm font-semibold"
                style={{ color: "var(--color-indigo-950)" }}
              >
                Go to workspace
              </a>
            ) : (
              <>
                <a
                  href="/api/auth/github"
                  className="w-full rounded-lg border border-slate-200 px-4 py-3 text-center text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  Sign in
                </a>
                <a
                  href="/api/auth/github"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-700 px-4 py-3 text-sm font-semibold"
                  style={{ color: "var(--color-indigo-950)" }}
                >
                  <GitHubMark size={16} />
                  Get started with GitHub
                </a>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function HeroSection({ theme }: { theme: HeroTheme }) {
  const { state } = useAuth();
  const isAuthenticated = state.status === "authenticated";

  // Desktop + non-reduced-motion: load Three.js
  // Mobile or reduced-motion: static CSS fallback
  const [useThreeJs] = useState(() => {
    if (typeof window === "undefined") return false;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    if (window.matchMedia("(pointer: coarse)").matches) return false;
    if (window.innerWidth < 1024) return false;
    return true;
  });

  return (
    <section
      aria-label="NEXUS career intelligence platform"
      style={{
        position: "relative",
        minHeight: "100svh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {/* Background — Three.js or CSS static */}
      {useThreeJs ? (
        <Suspense fallback={<StaticHeroBackground theme={theme} />}>
          <HeroScene theme={theme} />
        </Suspense>
      ) : (
        <StaticHeroBackground theme={theme} />
      )}

      {/* Gradient scrim — ensures text readability over the scene */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background:
            theme === "dark"
              ? "radial-gradient(ellipse 60% 70% at 50% 50%, oklch(5.5% 0.009 265 / 0.65) 0%, oklch(5.5% 0.009 265 / 0.30) 60%, transparent 100%)"
              : "radial-gradient(ellipse 60% 70% at 50% 50%, oklch(93% 0.014 72 / 0.75) 0%, oklch(93% 0.014 72 / 0.35) 60%, transparent 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Content */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          maxWidth: "56rem",
          margin: "0 auto",
          padding: "7rem 1.25rem 4rem",
          textAlign: "center",
        }}
      >
        {/* Headline */}
        <h1
          className="landing-reveal font-display text-slate-900"
          style={{
            fontSize: "clamp(3.5rem, 10vw, 7.5rem)",
            lineHeight: 0.90,
            letterSpacing: "-0.025em",
            animationDelay: "0.05s",
          }}
        >
          YOUR CODE<br />
          <span className="nx-gradient-text">IS EVIDENCE.</span>
        </h1>

        <p
          className="landing-reveal mx-auto mt-7 max-w-xl text-slate-700"
          style={{
            fontSize: "clamp(1rem, 2.5vw, 1.2rem)",
            lineHeight: 1.6,
            animationDelay: "0.18s",
          }}
        >
          NEXUS analyzes your GitHub repositories and builds a verifiable
          skill profile — connecting what you have built to the roles and
          opportunities that actually fit.
        </p>

        {/* CTAs */}
        <div
          className="landing-reveal mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
          style={{ animationDelay: "0.30s" }}
        >
          {isAuthenticated ? (
            <a
              href="/dashboard"
              className="nx-cta-shimmer inline-flex items-center gap-2.5 rounded-xl bg-indigo-700 px-7 py-4 text-base font-semibold transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50"
              style={{ color: "var(--color-indigo-950)" }}
            >
              Open your workspace
            </a>
          ) : (
            <a
              href="/api/auth/github"
              className="nx-cta-shimmer inline-flex items-center gap-2.5 rounded-xl bg-indigo-700 px-7 py-4 text-base font-semibold transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50"
              style={{ color: "var(--color-indigo-950)" }}
            >
              <GitHubMark size={18} />
              Connect GitHub — it's free
            </a>
          )}
          <a
            href="#how-it-works"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-7 py-4 text-base font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700"
          >
            See how it works
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="7" y1="2" x2="7" y2="12" />
              <polyline points="4,9 7,12 10,9" />
            </svg>
          </a>
        </div>

        {/* Trust signals */}
        <div
          className="landing-reveal mt-8 flex flex-wrap justify-center gap-6 text-xs text-slate-500"
          style={{ animationDelay: "0.42s" }}
        >
          <span>Only reads public repositories</span>
          <span>No keyword matching — real evidence</span>
          <span>Deterministic, transparent scoring</span>
        </div>
      </div>

      {/* Scroll indicator */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          bottom: "2rem",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 10,
          opacity: 0.4,
        }}
      >
        <svg width="20" height="28" viewBox="0 0 20 28" fill="none" stroke="currentColor" className="text-slate-600" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="1" width="18" height="26" rx="9" />
          <line x1="10" y1="6" x2="10" y2="11" />
        </svg>
      </div>
    </section>
  );
}

// ─── Positioning section ──────────────────────────────────────────────────────

function PositioningSection() {
  const ref = useScrollReveal();

  return (
    <section
      id="positioning"
      ref={ref as React.RefObject<HTMLElement>}
      className="landing-section-reveal border-t border-slate-200 px-5 py-20 sm:py-28 sm:px-8"
    >
      <div className="mx-auto max-w-4xl">
        <div className="text-center mb-14">
          <h2
            className="font-display text-slate-900"
            style={{
              fontSize: "clamp(2rem, 5vw, 3.5rem)",
              lineHeight: 0.93,
              letterSpacing: "-0.025em",
            }}
          >
            JOB HUNTING<br />
            <span className="nx-gradient-text">SHOULDN'T BE GUESSING.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-base text-slate-600 sm:text-lg" style={{ lineHeight: 1.65 }}>
            Most platforms match you on the keywords you wrote.
            NEXUS reads your actual work — repositories, frameworks, testing
            patterns, project depth — and produces a skill profile you can
            point at.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Without evidence */}
          <div
            className="rounded-2xl border border-slate-200 px-6 py-7"
            style={{ background: "var(--color-slate-100, oklch(8.5% 0.008 265))" }}
          >
            <p className="mb-5 pb-3 border-b border-slate-200 text-xs font-semibold text-slate-500 tracking-wide">
              Without evidence
            </p>
            <ul className="space-y-3.5">
              {[
                "Keywords copied from job descriptions",
                "Self-reported skill levels",
                "No depth or history",
                "Unverifiable claims",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-slate-600">
                  <span className="mt-0.5 shrink-0 text-slate-400">—</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* With NEXUS */}
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-6 py-7">
            <p className="mb-5 pb-3 border-b border-indigo-200 text-xs font-semibold text-indigo-500 tracking-wide">
              With NEXUS
            </p>
            <ul className="space-y-3.5">
              {[
                "Repository-sourced skill evidence",
                "Verifiable depth across projects",
                "Explainable job match scores",
                "Prioritized gap-closing plan",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-slate-700">
                  <span className="mt-0.5 shrink-0 text-indigo-700 font-bold">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── How it works ─────────────────────────────────────────────────────────────

const STEPS = [
  {
    num: "01",
    title: "Connect GitHub",
    body: "Sign in with GitHub. NEXUS reads your public repositories — it never accesses private code, secrets, or account data.",
  },
  {
    num: "02",
    title: "Build your evidence profile",
    body: "Languages, frameworks, testing patterns, project structure, and activity are detected and scored across every repository you select.",
  },
  {
    num: "03",
    title: "Find matched opportunities",
    body: "Jobs are scored against your actual evidence. See exactly which of your skills support or limit each match — no black boxes.",
  },
  {
    num: "04",
    title: "Plan your career direction",
    body: "Choose a target role and get a prioritized skill-gap plan with concrete tasks and milestones.",
  },
];

function HowItWorksSection() {
  const ref = useScrollReveal();

  return (
    <section
      id="how-it-works"
      ref={ref as React.RefObject<HTMLElement>}
      className="landing-section-reveal border-t border-slate-200 px-5 py-20 sm:py-28 sm:px-8"
      style={{ background: "var(--color-white, oklch(8% 0.008 265))" }}
    >
      <div className="mx-auto max-w-3xl">
        <div className="text-center mb-14">
          <h2
            className="font-display text-slate-900"
            style={{
              fontSize: "clamp(1.8rem, 4.5vw, 3.2rem)",
              lineHeight: 0.93,
              letterSpacing: "-0.025em",
            }}
          >
            FROM REPOSITORIES<br />
            <span className="nx-gradient-text">TO CAREER CLARITY.</span>
          </h2>
        </div>

        <div className="space-y-0">
          {STEPS.map(({ num, title, body }, i) => (
            <div
              key={num}
              className="flex gap-6 py-7 border-t border-slate-200"
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <div className="shrink-0 pt-0.5 w-10">
                <span
                  className="font-display text-indigo-700"
                  style={{ fontSize: "2rem", lineHeight: 1, letterSpacing: "-0.02em" }}
                  aria-hidden="true"
                >
                  {num}
                </span>
              </div>
              <div>
                <p className="text-base font-semibold text-slate-900">{title}</p>
                <p className="mt-1.5 text-sm text-slate-600 max-w-md" style={{ lineHeight: 1.6 }}>{body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Evidence section ─────────────────────────────────────────────────────────

const SIGNALS = [
  {
    label: "Dependencies",
    weight: "0.20",
    desc: "Declared libraries and packages in package.json, requirements.txt, pom.xml, and similar.",
  },
  {
    label: "Framework usage",
    weight: "0.20",
    desc: "Direct imports and usage of frameworks within source files, not just declarations.",
  },
  {
    label: "Source usage",
    weight: "0.25",
    desc: "How the technology appears in your actual code — API calls, components, patterns.",
  },
  {
    label: "Project structure",
    weight: "0.10",
    desc: "Directory conventions and architectural patterns that indicate established usage.",
  },
  {
    label: "Test coverage",
    weight: "0.10",
    desc: "Testing frameworks, test files, and coverage patterns in the repository.",
  },
  {
    label: "Documentation",
    weight: "0.05",
    desc: "README quality, inline comments, and documentation indicating maintained projects.",
  },
  {
    label: "Activity",
    weight: "0.10",
    desc: "Recent commit activity, recency, and project lifecycle signals.",
  },
];

function EvidenceSection() {
  const ref = useScrollReveal();

  return (
    <section
      id="evidence"
      ref={ref as React.RefObject<HTMLElement>}
      className="landing-section-reveal border-t border-slate-200 px-5 py-20 sm:py-28 sm:px-8"
    >
      <div className="mx-auto max-w-5xl">
        <div className="grid items-start gap-16 lg:grid-cols-2">
          {/* Left — explanation */}
          <div>
            <h2
              className="font-display text-slate-900"
              style={{
                fontSize: "clamp(1.8rem, 4vw, 3rem)",
                lineHeight: 0.93,
                letterSpacing: "-0.025em",
              }}
            >
              EVIDENCE,<br />
              <span className="nx-gradient-text">NOT KEYWORDS.</span>
            </h2>
            <p className="mt-6 text-base text-slate-600 max-w-md" style={{ lineHeight: 1.65 }}>
              Every skill score in NEXUS is built from observable signals
              across your selected repositories. Each signal has a defined
              weight — the scoring is deterministic, not a black box.
            </p>
            <p className="mt-4 text-sm text-slate-500 max-w-md" style={{ lineHeight: 1.65 }}>
              NEXUS only reads public repositories. No code is stored —
              only the extracted evidence observations and computed scores.
            </p>
            <div className="mt-8">
              <a
                href="/api/auth/github"
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-700 px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700"
                style={{ color: "var(--color-indigo-950)" }}
              >
                <GitHubMark size={15} />
                Analyze your repositories
              </a>
            </div>
          </div>

          {/* Right — signal breakdown */}
          <div>
            <p
              className="mb-4 text-xs font-semibold text-slate-500 tracking-wide pb-3 border-b border-slate-200"
            >
              Scoring signals — illustrative weights
            </p>
            <div className="space-y-3">
              {SIGNALS.map(({ label, weight, desc }) => (
                <div key={label} className="group">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-800">{label}</span>
                    <span className="font-mono text-xs text-indigo-700 tabular-nums">
                      {weight}
                    </span>
                  </div>
                  <div
                    className="h-1 rounded-full overflow-hidden"
                    style={{ background: "var(--color-slate-200, oklch(13% 0.007 265))" }}
                  >
                    <div
                      className="h-full rounded-full nx-score-fill"
                      style={{ width: `${parseFloat(weight) * 100 * 4}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Skill intelligence + gap section ────────────────────────────────────────

const ILLUSTRATIVE_SKILLS = [
  { name: "TypeScript", score: 82, status: "demonstrated" },
  { name: "React", score: 76, status: "demonstrated" },
  { name: "Node.js", score: 64, status: "demonstrated" },
  { name: "PostgreSQL", score: 48, status: "partial" },
  { name: "Docker", score: 31, status: "partial" },
  { name: "Kubernetes", score: 0, status: "missing" },
  { name: "GraphQL", score: 55, status: "demonstrated" },
  { name: "Python", score: 22, status: "partial" },
];

function SkillIntelligenceSection() {
  const ref = useScrollReveal();

  function statusColor(status: string) {
    if (status === "demonstrated") return "var(--color-emerald-500, oklch(61% 0.158 162))";
    if (status === "partial") return "var(--color-amber-500, oklch(66% 0.178 65))";
    return "var(--color-red-500, oklch(59% 0.210 26))";
  }

  function statusLabel(status: string) {
    if (status === "demonstrated") return "Demonstrated";
    if (status === "partial") return "Partial";
    return "Missing";
  }

  return (
    <section
      id="skill-intelligence"
      ref={ref as React.RefObject<HTMLElement>}
      className="landing-section-reveal border-t border-slate-200 px-5 py-20 sm:py-28 sm:px-8"
      style={{ background: "var(--color-white, oklch(8% 0.008 265))" }}
    >
      <div className="mx-auto max-w-5xl">
        <div className="grid items-center gap-16 lg:grid-cols-2">
          {/* Left — illustrative skill cards */}
          <div>
            <p className="mb-4 text-xs font-semibold text-slate-500 tracking-wide pb-3 border-b border-slate-200">
              Illustrative skill profile — not real user data
            </p>
            <div className="space-y-2.5">
              {ILLUSTRATIVE_SKILLS.map(({ name, score, status }) => (
                <div
                  key={name}
                  className="flex items-center gap-4 rounded-xl border border-slate-200 px-4 py-3"
                  style={{ background: "var(--color-slate-50, oklch(5.5% 0.009 265))" }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-slate-800">{name}</span>
                      <span
                        className="text-xs font-medium tabular-nums"
                        style={{ color: statusColor(status), fontFamily: "var(--font-mono)" }}
                      >
                        {score > 0 ? `${score}/100` : "—"}
                      </span>
                    </div>
                    <div
                      className="h-1.5 rounded-full overflow-hidden"
                      style={{ background: "var(--color-slate-200, oklch(13% 0.007 265))" }}
                    >
                      {score > 0 && (
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${score}%`,
                            background: statusColor(status),
                          }}
                        />
                      )}
                    </div>
                  </div>
                  <span
                    className="shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold"
                    style={{
                      color: statusColor(status),
                      background: `${statusColor(status)}22`,
                    }}
                  >
                    {statusLabel(status)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right — explanation */}
          <div>
            <h2
              className="font-display text-slate-900"
              style={{
                fontSize: "clamp(1.8rem, 4vw, 3rem)",
                lineHeight: 0.93,
                letterSpacing: "-0.025em",
              }}
            >
              YOUR SKILLS,<br />
              <span className="nx-gradient-text">SCORED BY EVIDENCE.</span>
            </h2>
            <p className="mt-6 text-base text-slate-600 max-w-md" style={{ lineHeight: 1.65 }}>
              Every skill in your profile is scored from real repository
              signals. Scores reflect what your code demonstrates — not what
              you declared on a resume.
            </p>
            <div className="mt-7 space-y-4">
              {[
                { label: "Demonstrated", desc: "Score meets or exceeds the threshold for meaningful evidence across repositories.", color: "emerald" },
                { label: "Partial", desc: "Some evidence exists but not enough to call it a confident demonstration.", color: "amber" },
                { label: "Missing", desc: "Required for your target role, with no detectable evidence in your repositories.", color: "red" },
              ].map(({ label, desc, color }) => (
                <div key={label} className="flex gap-3">
                  <div
                    className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: `var(--color-${color}-500)` }}
                  />
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{label}</p>
                    <p className="text-sm text-slate-500 mt-0.5" style={{ lineHeight: 1.55 }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8">
              <a
                href="/api/auth/github"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700"
              >
                See your skill profile
                <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="4,2 8,6 4,10" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Transparency section ─────────────────────────────────────────────────────

const TRUST_ITEMS = [
  {
    title: "Only reads public repositories",
    body: "NEXUS uses the GitHub public API with read-only scope. Private repositories and account data are never accessed.",
  },
  {
    title: "Deterministic scoring",
    body: "Scores are computed by a fixed algorithm with defined signal weights. No ML models or opaque AI produce your skill scores.",
  },
  {
    title: "No code stored",
    body: "NEXUS extracts evidence observations and scores — not your source code. Your repositories stay on GitHub.",
  },
  {
    title: "Transparent weights",
    body: "Signal weights are fixed and visible in the product configuration. You can see exactly how every score component is calculated.",
  },
];

function TrustSection() {
  const ref = useScrollReveal();

  return (
    <section
      ref={ref as React.RefObject<HTMLElement>}
      className="landing-section-reveal border-t border-slate-200 px-5 py-16 sm:py-24 sm:px-8"
    >
      <div className="mx-auto max-w-4xl">
        <div className="text-center mb-12">
          <h2
            className="font-display text-slate-900"
            style={{
              fontSize: "clamp(1.6rem, 3.5vw, 2.5rem)",
              lineHeight: 0.93,
              letterSpacing: "-0.025em",
            }}
          >
            TRANSPARENT BY DESIGN.
          </h2>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          {TRUST_ITEMS.map(({ title, body }) => (
            <div
              key={title}
              className="rounded-xl border border-slate-200 px-5 py-5"
              style={{ background: "var(--color-white, oklch(8% 0.008 265))" }}
            >
              <p className="text-sm font-semibold text-slate-900 mb-1.5">{title}</p>
              <p className="text-sm text-slate-500" style={{ lineHeight: 1.6 }}>{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Final CTA ────────────────────────────────────────────────────────────────

function FinalCTASection() {
  const ref = useScrollReveal();
  const { state } = useAuth();
  const isAuthenticated = state.status === "authenticated";

  return (
    <section
      ref={ref as React.RefObject<HTMLElement>}
      className="landing-section-reveal border-t border-slate-200 px-5 py-24 sm:py-32 text-center sm:px-8"
    >
      <div className="mx-auto max-w-xl">
        <h2
          className="font-display text-slate-900"
          style={{
            fontSize: "clamp(2.5rem, 7vw, 5rem)",
            lineHeight: 0.90,
            letterSpacing: "-0.025em",
          }}
        >
          BUILD YOUR<br />
          NEXT MOVE ON<br />
          <span className="nx-gradient-text">EVIDENCE.</span>
        </h2>
        <p className="mt-6 text-base text-slate-600" style={{ lineHeight: 1.65 }}>
          Your GitHub history is already telling a story. Connect once
          and NEXUS will read it.
        </p>
        <div className="mt-9">
          {isAuthenticated ? (
            <a
              href="/dashboard"
              className="nx-cta-shimmer inline-flex items-center gap-2.5 rounded-xl bg-indigo-700 px-8 py-4 text-lg font-semibold transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50"
              style={{ color: "var(--color-indigo-950)" }}
            >
              Open your workspace
            </a>
          ) : (
            <a
              href="/api/auth/github"
              className="nx-cta-shimmer inline-flex items-center gap-2.5 rounded-xl bg-indigo-700 px-8 py-4 text-lg font-semibold transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50"
              style={{ color: "var(--color-indigo-950)" }}
            >
              <GitHubMark size={20} />
              Sign in with GitHub
            </a>
          )}
          <p className="mt-4 text-xs text-slate-500">
            Free. Only reads public repositories. No code stored.
          </p>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function LandingFooter() {
  return (
    <footer className="border-t border-slate-200 px-5 py-8 sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="flex items-center gap-2.5">
          <span className="text-indigo-700">
            <IconNexus className="h-5 w-5" />
          </span>
          <span
            className="font-display text-slate-900 text-sm"
            style={{ letterSpacing: "-0.02em" }}
          >
            NEXUS
          </span>
          <span className="text-slate-400 text-xs">Career Intelligence</span>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap justify-center gap-5">
          <a href="#how-it-works" className="text-xs text-slate-500 hover:text-slate-700 transition-colors">How it works</a>
          <a href="#evidence" className="text-xs text-slate-500 hover:text-slate-700 transition-colors">Evidence</a>
          <a href="/api/auth/github" className="text-xs text-slate-500 hover:text-slate-700 transition-colors">Sign in</a>
        </nav>
        <p className="text-xs text-slate-500">
          Evidence-backed. No fabricated scores.
        </p>
      </div>
    </footer>
  );
}

// ─── Auth notice (cancelled sign-in) ─────────────────────────────────────────

function AuthNotice() {
  const { notice } = useAuth();
  if (!notice) return null;
  return (
    <p
      role="status"
      className="bg-slate-100 border-b border-slate-200 px-5 py-2.5 text-center text-sm text-slate-700"
    >
      {notice}
    </p>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function LandingPage() {
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme());

  const handleThemeToggle = () => {
    const next = toggleTheme();
    setTheme(next);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <a href="#hero-content" className="skip-to-main">Skip to main content</a>

      <LandingNav theme={theme} onThemeToggle={handleThemeToggle} />
      <AuthNotice />

      <main id="hero-content">
        <HeroSection theme={theme as HeroTheme} />
        <PositioningSection />
        <HowItWorksSection />
        <EvidenceSection />
        <SkillIntelligenceSection />
        <TrustSection />
        <FinalCTASection />
      </main>

      <LandingFooter />
    </div>
  );
}
