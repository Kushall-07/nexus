/**
 * NEXUS Public Landing Page — Premium Edition
 *
 * Design: Light theme · Cream / Deep Teal / Coral
 * Hero: Three.js particle network (lazy) + CSS mesh fallback
 * Animations: framer-motion + IntersectionObserver scroll reveals
 * Sections:
 *   1. Navigation
 *   2. Hero
 *   3. Product positioning
 *   4. How NEXUS works
 *   5. GitHub evidence intelligence
 *   6. Skill intelligence + gap analysis
 *   7. Trust / transparency
 *   8. Final CTA
 *   9. Footer
 */

import { useEffect, useRef, useState } from "react";
import { motion, useInView, useScroll, useTransform } from "framer-motion";
import { useAuth } from "../../auth/AuthContext";
import {
  IconBriefcase,
  IconChat,
  IconClipboard,
  IconCode,
  IconDashboard,
  IconDocument,
  IconNexus,
  IconTarget,
  IconTrendingUp,
} from "../../components/Icons";
import { OrbitCards, type OrbitItem } from "../../components/OrbitCards/OrbitCards";
import WarpText from "../../components/WarpText/WarpText";
import { GalleryHeading, type GalleryHeadingOverrides } from "../../effects/gallery-heading/GalleryHeading";
import { LiquidBackground } from "../../three/LiquidBackground";

// ─── Reusable animation variants ─────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.08 } },
};

function AnimatedSection({ children, className = "", id, style }: { children: React.ReactNode; className?: string; id?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.section
      ref={ref}
      id={id}
      className={className}
      style={style}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={stagger}
    >
      {children}
    </motion.section>
  );
}

// ─── GitHub Mark SVG ─────────────────────────────────────────────────────────

function GitHubMark({ size = 18 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

// ─── Navigation ───────────────────────────────────────────────────────────────

function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { state } = useAuth();
  const isAuthenticated = state.status === "authenticated";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={[
        "fixed top-0 left-0 right-0 z-40 transition-all duration-300",
        scrolled
          ? "nx-glass shadow-sm"
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
          <span className="font-display text-slate-900" style={{ fontSize: "1.15rem", letterSpacing: "-0.025em" }}>
            NEXUS
          </span>
        </a>

        {/* Desktop nav */}
        <nav aria-label="Site" className="hidden items-center gap-1 md:flex">
          {["How it works", "Evidence", "Skills"].map((label, i) => (
            <a
              key={label}
              href={`#${["how-it-works", "evidence", "skill-intelligence"][i]}`}
              className="rounded-lg px-3 py-1.5 text-sm text-slate-600 transition-all hover:bg-slate-100 hover:text-slate-900 hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700"
            >
              {label}
            </a>
          ))}
        </nav>

        {/* Desktop actions */}
        <div className="hidden items-center gap-2 md:flex">
          {isAuthenticated ? (
            <a
              href="/dashboard"
              className="nx-cta-shimmer inline-flex items-center gap-2 rounded-xl bg-indigo-700 px-4 py-2 text-sm font-semibold transition-all hover:bg-indigo-600 hover:shadow-[0_4px_14px_0_oklch(30%_0.065_192_/_0.25)] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700"
              style={{ color: "var(--color-indigo-950)" }}
            >
              Open workspace
            </a>
          ) : (
            <>
              <a
                href="/signin"
                className="rounded-xl px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700"
              >
                Sign in
              </a>
              <a
                href="/api/auth/github"
                className="nx-cta-shimmer inline-flex items-center gap-2 rounded-xl bg-indigo-700 px-4 py-2 text-sm font-semibold transition-all hover:bg-indigo-600 hover:shadow-[0_4px_14px_0_oklch(30%_0.065_192_/_0.25)] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700"
                style={{ color: "var(--color-indigo-950)" }}
              >
                <GitHubMark size={15} />
                Get started
              </a>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <div className="flex items-center gap-2 md:hidden">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 transition-colors"
          >
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              {menuOpen ? (
                <><line x1="3" y1="3" x2="15" y2="15" /><line x1="15" y1="3" x2="3" y2="15" /></>
              ) : (
                <><line x1="2" y1="5" x2="16" y2="5" /><line x1="2" y1="9" x2="16" y2="9" /><line x1="2" y1="13" x2="16" y2="13" /></>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="nx-glass border-t border-slate-200/60 px-5 py-4 md:hidden"
        >
          <nav aria-label="Mobile site" className="flex flex-col gap-1">
            {[
              { label: "How it works", href: "#how-it-works" },
              { label: "Evidence", href: "#evidence" },
              { label: "Skills", href: "#skill-intelligence" },
            ].map(({ label, href }) => (
              <a
                key={label}
                href={href}
                onClick={() => setMenuOpen(false)}
                className="rounded-xl px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-100 transition-colors"
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="mt-4 flex flex-col gap-2 border-t border-slate-200 pt-4">
            {isAuthenticated ? (
              <a
                href="/dashboard"
                className="w-full rounded-xl bg-indigo-700 px-4 py-3 text-center text-sm font-semibold"
                style={{ color: "var(--color-indigo-950)" }}
              >
                Open workspace
              </a>
            ) : (
              <>
                <a
                  href="/signin"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-center text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  Sign in
                </a>
                <a
                  href="/api/auth/github"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-700 px-4 py-3 text-sm font-semibold"
                  style={{ color: "var(--color-indigo-950)" }}
                >
                  <GitHubMark size={16} />
                  Get started with GitHub
                </a>
              </>
            )}
          </div>
        </motion.div>
      )}
    </motion.header>
  );
}

// ─── Floating UI Preview Card ─────────────────────────────────────────────────

function FloatingSkillCard() {
  return (
    <div
      className="nx-glass rounded-2xl px-4 py-3.5 shadow-xl"
      style={{ minWidth: "200px" }}
    >
      <p className="mb-2.5 text-[10px] font-semibold tracking-widest text-slate-500 uppercase">
        Your skill profile
      </p>
      {[
        { name: "TypeScript", score: 82, color: "oklch(30% 0.065 192)" },
        { name: "React", score: 76, color: "oklch(30% 0.065 192)" },
        { name: "Node.js", score: 64, color: "oklch(49% 0.132 162)" },
        { name: "Docker", score: 31, color: "oklch(66% 0.178 65)" },
      ].map(({ name, score, color }) => (
        <div key={name} className="mb-2 last:mb-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-slate-800">{name}</span>
            <span className="font-mono text-[10px] tabular-nums" style={{ color }}>{score}</span>
          </div>
          <div className="h-1 rounded-full bg-slate-200 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${score}%`, background: color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function FloatingMatchCard() {
  return (
    <div
      className="nx-glass rounded-2xl px-4 py-3.5 shadow-xl"
      style={{ minWidth: "220px" }}
    >
      <p className="mb-2 text-[10px] font-semibold tracking-widest text-slate-500 uppercase">Job match</p>
      <p className="text-sm font-semibold text-slate-900 mb-0.5">Senior Frontend Engineer</p>
      <p className="text-xs text-slate-500 mb-3">Scale-up · Remote</p>
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-1 h-2 rounded-full bg-slate-200 overflow-hidden">
          <div className="h-full rounded-full nx-score-fill" style={{ width: "84%" }} />
        </div>
        <span className="font-mono text-xs font-semibold text-indigo-700 tabular-nums">84</span>
      </div>
      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-800 border border-emerald-200">
        Strong match
      </span>
    </div>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function HeroSection() {
  const { state } = useAuth();
  const isAuthenticated = state.status === "authenticated";
  const { scrollY } = useScroll();
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0]);
  const heroY = useTransform(scrollY, [0, 400], [0, 60]);

  return (
    <section
      aria-label="NEXUS career intelligence platform"
      style={{ position: "relative", minHeight: "100svh", display: "flex", flexDirection: "column", justifyContent: "center", overflow: "hidden" }}
    >
      {/* Liquid warp-gradient background (WebGL, CSS fallback built in) */}
      <LiquidBackground />

      {/* Readability scrim behind the headline */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse 45% 50% at 50% 46%, oklch(93% 0.014 72 / 0.70) 0%, oklch(93% 0.014 72 / 0.25) 65%, transparent 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Blend the hero into the next section */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute", left: 0, right: 0, bottom: 0, height: "7rem",
          background: "linear-gradient(to bottom, transparent, var(--color-slate-50))",
          pointerEvents: "none",
        }}
      />

      {/* Content */}
      <motion.div
        style={{ opacity: heroOpacity, y: heroY, position: "relative", zIndex: 10 }}
      >
        <div
          style={{
            maxWidth: "60rem",
            margin: "0 auto",
            padding: "7.5rem 1.25rem 4rem",
            textAlign: "center",
          }}
        >
          {/* Badge */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            transition={{ duration: 0.6, delay: 0.0, ease: [0.16, 1, 0.3, 1] }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3.5 py-1.5"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-700 nx-node-pulse" />
            <span className="text-xs font-semibold text-indigo-700">Career intelligence built from your GitHub evidence</span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            transition={{ duration: 0.7, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="font-display text-slate-900"
            style={{
              fontSize: "clamp(3.8rem, 11vw, 8rem)",
              lineHeight: 0.88,
              letterSpacing: "-0.025em",
            }}
          >
            YOUR CODE<br />
            <span className="nx-gradient-text">IS EVIDENCE.</span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            transition={{ duration: 0.7, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto mt-7 max-w-2xl text-slate-700"
            style={{ fontSize: "clamp(1rem, 2.5vw, 1.2rem)", lineHeight: 1.65 }}
          >
            NEXUS reads your GitHub repositories, scores your skills from real
            code, matches you to roles with explainable scores, and turns your
            gaps into a development plan — all in one workspace.
          </motion.p>

          {/* CTAs */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            transition={{ duration: 0.6, delay: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
          >
            {isAuthenticated ? (
              <a
                href="/dashboard"
                className="nx-cta-shimmer inline-flex items-center gap-2.5 rounded-2xl bg-indigo-700 px-8 py-4 text-base font-semibold transition-all hover:bg-indigo-600 hover:shadow-[0_8px_24px_0_oklch(30%_0.065_192_/_0.28)] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 focus-visible:ring-offset-2"
                style={{ color: "var(--color-indigo-950)" }}
              >
                Open your workspace
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6,3 11,8 6,13" />
                </svg>
              </a>
            ) : (
              <a
                href="/api/auth/github"
                className="nx-cta-shimmer inline-flex items-center gap-2.5 rounded-2xl bg-indigo-700 px-8 py-4 text-base font-semibold transition-all hover:bg-indigo-600 hover:shadow-[0_8px_24px_0_oklch(30%_0.065_192_/_0.28)] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 focus-visible:ring-offset-2"
                style={{ color: "var(--color-indigo-950)" }}
              >
                <GitHubMark size={18} />
                Connect GitHub — it's free
              </a>
            )}
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white/60 px-8 py-4 text-base font-medium text-slate-700 transition-all hover:bg-white hover:border-slate-400 hover:shadow-sm active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 backdrop-blur-sm"
            >
              See how it works
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="7" y1="2" x2="7" y2="12" />
                <polyline points="4,9 7,12 10,9" />
              </svg>
            </a>
          </motion.div>

          {/* Trust signals */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            transition={{ duration: 0.6, delay: 0.40, ease: [0.16, 1, 0.3, 1] }}
            className="mt-9 flex flex-wrap justify-center gap-6 text-xs text-slate-500"
          >
            {["Only reads public repositories", "No keyword matching — real evidence", "Deterministic, transparent scoring"].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <circle cx="6" cy="6" r="5.5" stroke="oklch(30% 0.065 192)" strokeWidth="1" />
                  <polyline points="3.5,6 5,7.5 8.5,4.5" stroke="oklch(30% 0.065 192)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {t}
              </span>
            ))}
          </motion.div>
        </div>

        {/* Floating UI previews — hidden on small screens */}
        <div className="pointer-events-none hidden lg:block" aria-hidden="true">
          <motion.div
            initial={{ opacity: 0, x: 40, y: 20 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 0.8, delay: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="nx-float-slow"
            style={{ position: "absolute", top: "22%", right: "4%", zIndex: 20 }}
          >
            <FloatingSkillCard />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: -40, y: 20 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 0.8, delay: 0.70, ease: [0.16, 1, 0.3, 1] }}
            className="nx-float-medium"
            style={{ position: "absolute", bottom: "22%", left: "2%", zIndex: 20, animationDelay: "1.5s" }}
          >
            <FloatingMatchCard />
          </motion.div>
        </div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 0.45, y: 0 }}
        transition={{ duration: 0.6, delay: 1.0 }}
        aria-hidden="true"
        style={{ position: "absolute", bottom: "2rem", left: "50%", transform: "translateX(-50%)", zIndex: 10 }}
      >
        <svg width="20" height="28" viewBox="0 0 20 28" fill="none" stroke="currentColor" className="text-slate-600 nx-float-slow" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="1" width="18" height="26" rx="9" />
          <line x1="10" y1="6" x2="10" y2="11" />
        </svg>
      </motion.div>
    </section>
  );
}

// ─── Shared: WarpText section heading ────────────────────────────────────────

/** Page background (slate-50 = oklch(93% 0.014 72)) as sRGB, for the Canvas-2D frame. */
const PAGE_BG = "#EEE7DE";

function WarpHeading({
  text,
  color = "var(--color-indigo-700)",
  height = 200,
  fontSize = "clamp(2.4rem, 6.4vw, 4.6rem)",
}: {
  text: string;
  color?: string;
  height?: number;
  fontSize?: string;
}) {
  return (
    <motion.div variants={fadeUp} className="font-display mx-auto w-full" style={{ maxWidth: "60rem" }}>
      <WarpText
        text={text}
        color={color}
        fontWeight={800}
        letterSpacing="-0.025em"
        lineHeight={0.9}
        fontSize={fontSize}
        warpStrength={0.1}
        warpScale={1.7}
        speed={0.5}
        lens="bulge"
        pointerInfluence={0.38}
        pointerStrength={0.34}
        refraction={0.016}
        chromatic={0.25}
        idleDrift={0.2}
        style={{ height, minHeight: 0 }}
      />
    </motion.div>
  );
}

// ─── Gallery heading (ThreeUI) — "Job hunting shouldn't be guessing." ─────────

/*
 * The ring's twelve plates and headline ink are tuned to the NEXUS palette
 * (cream stock, deep teal, mid teal, coral). Widths are the natural ink widths of
 * each line in the frame's sans stack so letterforms are never squashed.
 * NB: the headline goes into a JS string literal inside the frame, so the
 * apostrophe is typographic (’), not a straight quote.
 */
const GALLERY_OVERRIDES: GalleryHeadingOverrides = {
  title: "Job hunting shouldn’t be guessing",
  headline: ["JOB HUNTING", "SHOULDN’T BE GUESSING."],
  headlineWidths: [1462, 2864],
  phase: 90,
  palette: [
    "#E9E5DD", "#0E4F4A", "#F67F5E", "#1A7A74", "#D6CFC2", "#20232A",
    "#DDA45C", "#14363A", "#A7B3A4", "#F3F1EC", "#5A6670", "#C25A43",
  ],
  ink: { light: ["#1A7A74", "#0B2E2B", "#EEE7DE"] },
  background: PAGE_BG,
};

function GallerySection() {
  return (
    <section id="positioning" aria-labelledby="positioning-title" className="relative">
      <h2 id="positioning-title" className="sr-only">
        Job hunting shouldn’t be guessing.
      </h2>

      <div
        className="relative w-full overflow-hidden"
        style={{ height: "clamp(620px, 100svh, 960px)", background: PAGE_BG }}
      >
        <GalleryHeading
          variant="rising-diagonal"
          mode="light"
          font="sans"
          weight="400"
          headlineSize={0.6}
          overrides={GALLERY_OVERRIDES}
        />

        {/* Fade into the hero above and the content below */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0"
          style={{ height: "9rem", background: `linear-gradient(to bottom, ${PAGE_BG}, transparent)` }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0"
          style={{ height: "7rem", background: `linear-gradient(to top, ${PAGE_BG}, transparent)` }}
        />

        <p
          aria-hidden="true"
          className="pointer-events-none absolute bottom-8 left-1/2 -translate-x-1/2 text-[11px] font-semibold tracking-[0.22em] text-slate-500 uppercase"
        >
          Hover to set the ring in motion
        </p>
      </div>
    </section>
  );
}

// ─── Positioning — without vs. with evidence ─────────────────────────────────

function PositioningSection() {
  return (
    <AnimatedSection className="px-5 pb-20 sm:pb-28 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <motion.p
          variants={fadeUp}
          className="mx-auto mb-14 max-w-xl text-center text-base text-slate-600 sm:text-lg"
          style={{ lineHeight: 1.65 }}
        >
          Most platforms match you on keywords you wrote. NEXUS reads your actual work — repositories,
          frameworks, testing patterns, project depth — and produces a skill profile you can point to.
        </motion.p>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Without evidence */}
          <motion.div
            variants={fadeUp}
            className="rounded-2xl border border-slate-200 px-6 py-7"
            style={{ background: "var(--color-slate-100)" }}
          >
            <p className="mb-5 pb-3 border-b border-slate-200 text-xs font-semibold text-slate-500 tracking-widest uppercase">
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
          </motion.div>

          {/* With NEXUS */}
          <motion.div
            variants={fadeUp}
            className="nx-card-teal relative rounded-2xl bg-indigo-50 px-6 py-7"
            style={{ border: "1px solid var(--color-indigo-200)" }}
          >
            <div className="absolute -top-3 left-6">
              <span className="rounded-full bg-indigo-700 px-3 py-0.5 text-[10px] font-bold tracking-wider uppercase" style={{ color: "var(--color-indigo-950)" }}>
                NEXUS
              </span>
            </div>
            <p className="mb-5 pb-3 border-b border-indigo-200 text-xs font-semibold text-indigo-500 tracking-widest uppercase">
              With evidence
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
          </motion.div>
        </div>
      </div>
    </AnimatedSection>
  );
}

// ─── Features — one workspace (scroll-driven orbit → grid) ───────────────────

const FEATURES = [
  { icon: <IconCode className="h-4 w-4" />,       tag: "Skills",       title: "Skill profile",      body: "Skills scored from your real code, not your resume." },
  { icon: <IconBriefcase className="h-4 w-4" />,  tag: "Matches",      title: "Job matching",       body: "Every match shows which skills help and which hurt." },
  { icon: <IconTarget className="h-4 w-4" />,     tag: "Gaps",         title: "Gap analysis",       body: "Pick a role. See what’s missing, in priority order." },
  { icon: <IconTrendingUp className="h-4 w-4" />, tag: "Plan",         title: "Growth plan",        body: "Turn gaps into clear tasks and milestones." },
  { icon: <IconChat className="h-4 w-4" />,       tag: "Copilot",      title: "Career Copilot",     body: "Ask in plain words. Answers use only your data." },
  { icon: <IconDocument className="h-4 w-4" />,   tag: "Resume",       title: "Resume",             body: "Upload, review, and keep only what you approve." },
  { icon: <IconClipboard className="h-4 w-4" />,  tag: "Applications", title: "Application tracker", body: "Track every application. NEXUS never applies for you." },
  { icon: <IconDashboard className="h-4 w-4" />,  tag: "Repos",        title: "Repositories",       body: "Choose which public repos count. Refresh anytime." },
];

function FeatureCardBody({ icon, tag, title, body }: (typeof FEATURES)[number]) {
  return (
    <div className="group flex h-full flex-col px-5 py-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">{icon}</span>
        <span className="text-[10px] font-semibold tracking-widest text-slate-400 uppercase">{tag}</span>
      </div>
      <p className="mb-1.5 text-base font-semibold text-slate-900">{title}</p>
      <p className="text-sm text-slate-500" style={{ lineHeight: 1.55 }}>{body}</p>
    </div>
  );
}

const FEATURE_ITEMS: OrbitItem[] = FEATURES.map((f) => ({ key: f.title, node: <FeatureCardBody {...f} /> }));

function FeaturesSection() {
  return (
    <div className="border-t border-slate-200">
      <OrbitCards
        id="features"
        srTitle="One workspace, every next step"
        items={FEATURE_ITEMS}
        background="var(--color-white)"
        leftTitle="ONE WORKSPACE,"
        rightTitle="EVERY NEXT STEP."
        centerText="From first repo to final offer."
        columns={4}
        aspect={1.3}
        gridMaxWidth={1160}
        scrollLength={360}
        compactClassName="px-5 py-20 sm:px-8"
        compactGridClassName="mx-auto grid max-w-6xl gap-4 sm:grid-cols-2 xl:grid-cols-4"
        compactHeader={
          <div className="mx-auto mb-12 max-w-6xl">
            <WarpHeading text={"ONE WORKSPACE,\nEVERY NEXT STEP."} />
          </div>
        }
      />
    </div>
  );
}

// ─── How It Works ─────────────────────────────────────────────────────────────

const STEPS = [
  {
    num: "01",
    title: "Connect GitHub",
    body: "Sign in with GitHub. NEXUS reads your public repositories — it never accesses private code, secrets, or account data.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
      </svg>
    ),
  },
  {
    num: "02",
    title: "Build your evidence profile",
    body: "Languages, frameworks, testing patterns, project structure, and activity are detected and scored across every selected repository.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14,2 14,8 20,8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <line x1="10" y1="9" x2="8" y2="9" />
      </svg>
    ),
  },
  {
    num: "03",
    title: "Find matched opportunities",
    body: "Jobs are scored against your actual evidence. See exactly which of your skills support or limit each match — no black boxes.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
  },
  {
    num: "04",
    title: "Plan your career direction",
    body: "Choose a target role and get a prioritized skill-gap plan with concrete tasks and milestones — then tailor your resume and track every application in the same workspace.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
      </svg>
    ),
  },
];

function HowItWorksSection() {
  return (
    <AnimatedSection
      id="how-it-works"
      className="border-t border-slate-200 px-5 py-20 sm:py-28 sm:px-8"
    >
      <div className="mx-auto max-w-3xl">
        <div className="mb-12">
          <WarpHeading text={"FROM REPOSITORIES\nTO CAREER CLARITY."} />
        </div>

        <div className="space-y-0">
          {STEPS.map(({ num, title, body, icon }, i) => (
            <motion.div
              key={num}
              variants={fadeUp}
              transition={{ delay: i * 0.08 }}
              className="group flex gap-6 py-7 border-t border-slate-200 transition-all hover:bg-slate-50/60 rounded-xl -mx-4 px-4"
            >
              <div className="shrink-0 pt-0.5 w-12">
                <span
                  className="font-display text-indigo-700/60 group-hover:text-indigo-700 transition-colors"
                  style={{ fontSize: "2rem", lineHeight: 1, letterSpacing: "-0.02em" }}
                  aria-hidden="true"
                >
                  {num}
                </span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2.5 mb-1.5">
                  <span className="text-indigo-700/70 group-hover:text-indigo-700 transition-colors">{icon}</span>
                  <p className="text-base font-semibold text-slate-900">{title}</p>
                </div>
                <p className="text-sm text-slate-600 max-w-md" style={{ lineHeight: 1.65 }}>{body}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </AnimatedSection>
  );
}

// ─── Evidence Section ─────────────────────────────────────────────────────────

const SIGNALS = [
  { label: "Source usage",      weight: "0.25", desc: "How the technology appears in your actual code — API calls, components, patterns." },
  { label: "Dependencies",      weight: "0.20", desc: "Declared libraries in package.json, requirements.txt, pom.xml, and similar files." },
  { label: "Framework usage",   weight: "0.20", desc: "Direct imports and usage of frameworks within source files." },
  { label: "Activity",          weight: "0.10", desc: "Recent commit activity, recency, and project lifecycle signals." },
  { label: "Test coverage",     weight: "0.10", desc: "Testing frameworks, test files, and coverage patterns in the repository." },
  { label: "Project structure", weight: "0.10", desc: "Directory conventions and architectural patterns indicating established usage." },
  { label: "Documentation",     weight: "0.05", desc: "README quality, inline comments, and documentation indicating maintained projects." },
];

function EvidenceSection() {
  return (
    <AnimatedSection
      id="evidence"
      className="border-t border-slate-200 px-5 py-20 sm:py-28 sm:px-8"
      style={{ background: "var(--color-white)" } as React.CSSProperties}
    >
      <div className="mx-auto max-w-5xl">
        <div className="mb-12">
          <WarpHeading text={"EVIDENCE,\nNOT KEYWORDS."} />
        </div>

        <div className="grid items-start gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left — explanation */}
          <motion.div variants={fadeUp}>
            <p className="text-base text-slate-600 max-w-md" style={{ lineHeight: 1.65 }}>
              Every skill score in NEXUS is built from observable signals
              across your selected repositories. Each signal has a defined
              weight — the scoring is deterministic, not a black box.
            </p>
            <p className="mt-4 text-sm text-slate-500 max-w-md" style={{ lineHeight: 1.65 }}>
              NEXUS only reads public repositories. No code is stored —
              only the extracted evidence observations and computed scores.
            </p>

            <div className="mt-8 grid max-w-md grid-cols-3 gap-3">
              {[
                { k: String(SIGNALS.length), v: "scoring signals" },
                { k: "100%", v: "deterministic" },
                { k: "0", v: "lines of code stored" },
              ].map(({ k, v }) => (
                <div key={v} className="nx-card rounded-xl px-3 py-3.5 text-center">
                  <p className="font-display text-indigo-700" style={{ fontSize: "1.9rem", lineHeight: 1 }}>{k}</p>
                  <p className="mt-1.5 text-[11px] text-slate-500" style={{ lineHeight: 1.35 }}>{v}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 flex items-center gap-3">
              <a
                href="/api/auth/github"
                className="nx-cta-shimmer inline-flex items-center gap-2 rounded-xl bg-indigo-700 px-5 py-2.5 text-sm font-semibold transition-all hover:bg-indigo-600 hover:shadow-[0_4px_14px_oklch(30%_0.065_192_/_0.22)] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700"
                style={{ color: "var(--color-indigo-950)" }}
              >
                <GitHubMark size={15} />
                Analyze your repositories
              </a>
            </div>
          </motion.div>

          {/* Right — signal breakdown */}
          <motion.div variants={fadeUp}>
            <p className="mb-5 text-xs font-semibold text-slate-500 tracking-widest uppercase pb-3 border-b border-slate-200">
              Scoring signals — illustrative weights
            </p>
            <div className="space-y-4">
              {SIGNALS.map(({ label, weight, desc }) => (
                <div key={label} className="group">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-slate-800">{label}</span>
                    <span className="font-mono text-xs text-indigo-700 tabular-nums font-semibold">{weight}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden bg-slate-200">
                    <div
                      className="h-full rounded-full nx-score-fill"
                      style={{ width: `${parseFloat(weight) * 100 * 4}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </AnimatedSection>
  );
}

// ─── Skill Intelligence Section ───────────────────────────────────────────────

const ILLUSTRATIVE_SKILLS = [
  { name: "TypeScript", score: 82, status: "demonstrated" as const },
  { name: "React",      score: 76, status: "demonstrated" as const },
  { name: "Node.js",    score: 64, status: "demonstrated" as const },
  { name: "PostgreSQL", score: 48, status: "partial" as const },
  { name: "Docker",     score: 31, status: "partial" as const },
  { name: "Kubernetes", score: 0,  status: "missing" as const },
  { name: "GraphQL",    score: 55, status: "demonstrated" as const },
  { name: "Python",     score: 22, status: "partial" as const },
];

function SkillIntelligenceSection() {
  function statusColor(status: string) {
    if (status === "demonstrated") return "oklch(49% 0.132 162)";
    if (status === "partial")      return "oklch(66% 0.178 65)";
    return "oklch(59% 0.210 26)";
  }
  function statusLabel(status: string) {
    if (status === "demonstrated") return "Demonstrated";
    if (status === "partial")      return "Partial";
    return "Missing";
  }
  function statusBg(status: string) {
    if (status === "demonstrated") return "oklch(49% 0.132 162 / 0.12)";
    if (status === "partial")      return "oklch(66% 0.178 65  / 0.12)";
    return "oklch(59% 0.210 26  / 0.12)";
  }

  return (
    <AnimatedSection
      id="skill-intelligence"
      className="border-t border-slate-200 px-5 py-20 sm:py-28 sm:px-8"
    >
      <div className="mx-auto max-w-5xl">
        <div className="mb-12">
          <WarpHeading text={"YOUR SKILLS,\nSCORED BY EVIDENCE."} />
        </div>

        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left — illustrative skill cards */}
          <motion.div variants={fadeUp}>
            <p className="mb-4 text-xs font-semibold text-slate-500 tracking-widest uppercase pb-3 border-b border-slate-200">
              Illustrative skill profile — not real user data
            </p>
            <div className="space-y-2">
              {ILLUSTRATIVE_SKILLS.map(({ name, score, status }) => (
                <div
                  key={name}
                  className="nx-card nx-card-hover flex items-center gap-4 rounded-xl border border-slate-200 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-slate-800">{name}</span>
                      <span
                        className="text-xs font-semibold tabular-nums"
                        style={{ color: statusColor(status), fontFamily: "var(--font-mono)" }}
                      >
                        {score > 0 ? `${score}/100` : "—"}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden bg-slate-200">
                      {score > 0 && (
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${score}%`, background: statusColor(status) }}
                        />
                      )}
                    </div>
                  </div>
                  <span
                    className="shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-semibold"
                    style={{ color: statusColor(status), background: statusBg(status) }}
                  >
                    {statusLabel(status)}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right — explanation */}
          <motion.div variants={fadeUp}>
            <p className="text-base text-slate-600 max-w-md" style={{ lineHeight: 1.65 }}>
              Every skill in your profile is scored from real repository
              signals. Scores reflect what your code demonstrates — not
              what you declared on a resume.
            </p>
            <div className="mt-7 space-y-4">
              {[
                { label: "Demonstrated", desc: "Score meets or exceeds the threshold for meaningful evidence across repositories.", color: "emerald" },
                { label: "Partial",      desc: "Some evidence exists but not enough to call it a confident demonstration.",        color: "amber" },
                { label: "Missing",      desc: "Required for your target role, with no detectable evidence in your repositories.", color: "red" },
              ].map(({ label, desc, color }) => (
                <div key={label} className="flex gap-3">
                  <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: `var(--color-${color}-500)` }} />
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
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition-all hover:bg-slate-100 hover:border-slate-400 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700"
              >
                See your skill profile
                <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="4,2 8,6 4,10" />
                </svg>
              </a>
            </div>
          </motion.div>
        </div>
      </div>
    </AnimatedSection>
  );
}

// ─── Explainable match ───────────────────────────────────────────────────────

const MATCH_ROWS = [
  { skill: "TypeScript",       need: "Required",     state: "demonstrated" as const, note: "Source usage across 4 repositories" },
  { skill: "React",            need: "Required",     state: "demonstrated" as const, note: "Framework imports and tests" },
  { skill: "Testing",          need: "Preferred",    state: "partial" as const,      note: "Some test files, low coverage" },
  { skill: "Kubernetes",       need: "Required",     state: "missing" as const,      note: "No evidence detected yet" },
];

function ExplainableMatchSection() {
  const stateColor = (s: string) =>
    s === "demonstrated" ? "oklch(49% 0.132 162)" : s === "partial" ? "oklch(66% 0.178 65)" : "oklch(59% 0.210 26)";
  const stateLabel = (s: string) => (s === "demonstrated" ? "Supports match" : s === "partial" ? "Partial" : "Limits match");

  return (
    <AnimatedSection
      id="matching"
      className="border-t border-slate-200 px-5 py-20 sm:py-28 sm:px-8"
      style={{ background: "var(--color-white)" } as React.CSSProperties}
    >
      <div className="mx-auto max-w-5xl">
        <div className="mb-12">
          <WarpHeading text={"MATCHES YOU\nCAN EXPLAIN."} />
        </div>

        <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
          {/* Illustrative match card */}
          <motion.div variants={fadeUp} className="nx-card rounded-2xl px-6 py-6 shadow-xl">
            <p className="mb-4 text-[10px] font-semibold tracking-widest text-slate-500 uppercase">
              Illustrative match — not real user data
            </p>
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-slate-900">Senior Frontend Engineer</p>
                <p className="text-sm text-slate-500">Scale-up · Remote</p>
              </div>
              <div className="text-right">
                <p className="font-display text-indigo-700" style={{ fontSize: "2.6rem", lineHeight: 0.9 }}>84</p>
                <span className="mt-1 inline-flex rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                  Strong match
                </span>
              </div>
            </div>
            <div className="mb-5 h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full nx-score-fill" style={{ width: "84%" }} />
            </div>
            <ul className="divide-y divide-slate-200">
              {MATCH_ROWS.map(({ skill, need, state, note }) => (
                <li key={skill} className="flex items-center gap-3 py-3">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: stateColor(state) }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800">
                      {skill} <span className="ml-1 text-[10px] font-normal tracking-wider text-slate-400 uppercase">{need}</span>
                    </p>
                    <p className="text-xs text-slate-500">{note}</p>
                  </div>
                  <span className="shrink-0 text-[11px] font-semibold" style={{ color: stateColor(state) }}>
                    {stateLabel(state)}
                  </span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Explanation */}
          <motion.div variants={fadeUp}>
            <p className="text-base text-slate-600 max-w-md" style={{ lineHeight: 1.65 }}>
              A score alone tells you nothing. NEXUS shows the reasoning behind every match — which
              requirements your repositories support, where the evidence is thin, and what’s missing
              entirely.
            </p>
            <ul className="mt-6 space-y-3.5">
              {[
                "Every requirement is checked against your real evidence",
                "Gaps link straight into your development plan",
                "Save promising roles and track applications privately",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-sm text-slate-700">
                  <span className="mt-0.5 shrink-0 font-bold text-indigo-700">✓</span>
                  {t}
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <a
                href="/signin"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition-all hover:bg-slate-100 hover:border-slate-400 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700"
              >
                Find matched opportunities
                <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="4,2 8,6 4,10" />
                </svg>
              </a>
            </div>
          </motion.div>
        </div>
      </div>
    </AnimatedSection>
  );
}

// ─── Trust Section (scroll-driven orbit → grid) ──────────────────────────────

const TRUST_ITEMS = [
  { title: "Public repos only", body: "Read-only access. Private code is never touched." },
  { title: "Deterministic scoring", body: "Fixed weights. No opaque AI behind your scores." },
  { title: "No code stored", body: "Only evidence and scores are kept. Code stays on GitHub." },
  { title: "Visible weights", body: "Every score component is open to inspect." },
];

function TrustCardBody({ title, body }: (typeof TRUST_ITEMS)[number]) {
  return (
    <div className="flex h-full items-start gap-3 px-5 py-5">
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-indigo-50">
        <svg width="11" height="11" viewBox="0 0 10 10" fill="none" aria-hidden="true">
          <polyline points="2,5 4,7.5 8,2.5" stroke="oklch(30% 0.065 192)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div>
        <p className="mb-1 text-sm font-semibold text-slate-900">{title}</p>
        <p className="text-sm text-slate-500" style={{ lineHeight: 1.55 }}>{body}</p>
      </div>
    </div>
  );
}

const TRUST_ORBIT_ITEMS: OrbitItem[] = TRUST_ITEMS.map((t) => ({ key: t.title, node: <TrustCardBody {...t} /> }));

function TrustSection() {
  return (
    <div className="border-t border-slate-200">
      <OrbitCards
        id="trust"
        srTitle="Transparent by design"
        items={TRUST_ORBIT_ITEMS}
        background="var(--color-slate-50)"
        leftTitle="TRANSPARENT"
        rightTitle="BY DESIGN."
        centerText="Open, fixed and checkable."
        columns={2}
        aspect={2.5}
        gridMaxWidth={840}
        arcCardWidth={360}
        scrollLength={280}
        compactClassName="px-5 py-16 sm:py-24 sm:px-8"
        compactGridClassName="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2"
        compactHeader={
          <div className="mx-auto mb-10 max-w-4xl">
            <WarpHeading text="TRANSPARENT BY DESIGN." height={150} fontSize="clamp(2rem, 5.2vw, 3.8rem)" />
          </div>
        }
      />
    </div>
  );
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────

const FAQS = [
  { q: "Does NEXUS read my private repositories?", a: "No. It uses read-only access to your public repositories. Private repositories and account data are never accessed." },
  { q: "Is my source code stored?", a: "No. NEXUS keeps the extracted evidence observations and computed scores — not your source code. Your repositories stay on GitHub." },
  { q: "How are skill scores calculated?", a: "By a fixed, deterministic algorithm with defined signal weights. No opaque ML model produces your skill scores." },
  { q: "Will NEXUS apply to jobs for me?", a: "Never. The Applications page is your private tracker — NEXUS does not submit applications on your behalf." },
  { q: "What happens to the resume I upload?", a: "NEXUS extracts fields from a text-based PDF or DOCX for you to review. The file itself isn’t stored — only the fields you reviewed — and you can delete them any time." },
  { q: "Does choosing a career direction limit my search?", a: "No. A direction is just a preference you can change or clear at any time — it never limits which opportunities you see." },
];

function FAQSection() {
  return (
    <AnimatedSection
      id="faq"
      className="border-t border-slate-200 px-5 py-20 sm:py-28 sm:px-8"
      style={{ background: "var(--color-white)" } as React.CSSProperties}
    >
      <div className="mx-auto max-w-4xl">
        <div className="mb-10">
          <WarpHeading text="QUESTIONS, ANSWERED." height={150} fontSize="clamp(2rem, 5.2vw, 3.8rem)" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {FAQS.map(({ q, a }, i) => (
            <motion.details
              key={q}
              variants={fadeUp}
              transition={{ delay: i * 0.04 }}
              className="nx-card nx-card-hover group rounded-2xl px-5 py-4 open:border-indigo-200"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 rounded-md [&::-webkit-details-marker]:hidden">
                {q}
                <span aria-hidden="true" className="shrink-0 text-indigo-700 transition-transform group-open:rotate-45 text-lg leading-none">+</span>
              </summary>
              <p className="mt-3 text-sm text-slate-500" style={{ lineHeight: 1.65 }}>{a}</p>
            </motion.details>
          ))}
        </div>
      </div>
    </AnimatedSection>
  );
}

// ─── Final CTA ────────────────────────────────────────────────────────────────

function FinalCTASection() {
  const { state } = useAuth();
  const isAuthenticated = state.status === "authenticated";

  return (
    <AnimatedSection
      className="border-t border-slate-200 px-5 py-24 sm:py-32 text-center sm:px-8 relative overflow-hidden"
    >
      {/* Background gradient */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 55% at 50% 45%, oklch(94% 0.025 165 / 0.65), transparent 70%)," +
            "radial-gradient(ellipse 40% 40% at 85% 85%, oklch(70% 0.148 36 / 0.14), transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-3xl">
        <WarpHeading
          text={"BUILD YOUR NEXT\nMOVE ON"}
          height={190}
          fontSize="clamp(2.6rem, 8vw, 5.6rem)"
        />
        <div className="-mt-6">
          <WarpHeading
            text="EVIDENCE."
            color="oklch(62% 0.17 36)"
            height={130}
            fontSize="clamp(2.6rem, 8vw, 5.6rem)"
          />
        </div>
        <motion.p variants={fadeUp} className="mt-4 text-base text-slate-600" style={{ lineHeight: 1.65 }}>
          Your GitHub history is already telling a story. Connect once
          and NEXUS will read it.
        </motion.p>
        <motion.div variants={fadeUp} className="mt-10">
          {isAuthenticated ? (
            <a
              href="/dashboard"
              className="nx-cta-shimmer inline-flex items-center gap-2.5 rounded-2xl bg-indigo-700 px-9 py-4.5 text-lg font-semibold transition-all hover:bg-indigo-600 hover:shadow-[0_12px_30px_0_oklch(30%_0.065_192_/_0.30)] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 focus-visible:ring-offset-2"
              style={{ color: "var(--color-indigo-950)", paddingTop: "1.125rem", paddingBottom: "1.125rem" }}
            >
              Open your workspace
            </a>
          ) : (
            <a
              href="/api/auth/github"
              className="nx-cta-shimmer inline-flex items-center gap-2.5 rounded-2xl bg-indigo-700 px-9 text-lg font-semibold transition-all hover:bg-indigo-600 hover:shadow-[0_12px_30px_0_oklch(30%_0.065_192_/_0.30)] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 focus-visible:ring-offset-2"
              style={{ color: "var(--color-indigo-950)", paddingTop: "1.125rem", paddingBottom: "1.125rem" }}
            >
              <GitHubMark size={22} />
              Sign in with GitHub
            </a>
          )}
          <p className="mt-5 text-xs text-slate-500">
            Free · Only reads public repositories · No code stored
          </p>
        </motion.div>
      </div>
    </AnimatedSection>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function LandingFooter() {
  return (
    <footer className="border-t border-slate-200 px-5 py-8 sm:px-8 bg-white/40">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="flex items-center gap-2.5">
          <span className="text-indigo-700"><IconNexus className="h-5 w-5" /></span>
          <span className="font-display text-slate-900 text-sm" style={{ letterSpacing: "-0.02em" }}>NEXUS</span>
          <span className="text-slate-400 text-xs">Career Intelligence</span>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap justify-center gap-5">
          <a href="#features"     className="text-xs text-slate-500 hover:text-slate-700 transition-colors">Features</a>
          <a href="#how-it-works" className="text-xs text-slate-500 hover:text-slate-700 transition-colors">How it works</a>
          <a href="#evidence"     className="text-xs text-slate-500 hover:text-slate-700 transition-colors">Evidence</a>
          <a href="#faq"          className="text-xs text-slate-500 hover:text-slate-700 transition-colors">FAQ</a>
          <a href="/signin"       className="text-xs text-slate-500 hover:text-slate-700 transition-colors">Sign in</a>
        </nav>
        <p className="text-xs text-slate-500">Your code is the evidence. No fabricated scores.</p>
      </div>
    </footer>
  );
}

// ─── Auth Notice ──────────────────────────────────────────────────────────────

function AuthNotice() {
  const { notice } = useAuth();
  if (!notice) return null;
  return (
    <p role="status" className="bg-slate-100 border-b border-slate-200 px-5 py-2.5 text-center text-sm text-slate-700">
      {notice}
    </p>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <a href="#hero-content" className="skip-to-main">Skip to main content</a>
      <LandingNav />
      <AuthNotice />
      <main id="hero-content">
        <HeroSection />
        <GallerySection />
        <PositioningSection />
        <FeaturesSection />
        <HowItWorksSection />
        <EvidenceSection />
        <SkillIntelligenceSection />
        <ExplainableMatchSection />
        <TrustSection />
        <FAQSection />
        <FinalCTASection />
      </main>
      <LandingFooter />
    </div>
  );
}
