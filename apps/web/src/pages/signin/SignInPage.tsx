import { Navigate } from "react-router-dom";
import { useAuth, SIGN_IN_URL } from "../../auth/AuthContext";
import AuroraFlow from "../../components/AuroraFlow/AuroraFlow";
import { IconNexus } from "../../components/Icons";
import { CircleExpandButton } from "../../components/CircleExpandButton/CircleExpandButton";
import { LoadingState } from "../../components/StateViews";

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

export function SignInPage() {
  const { state, notice } = useAuth();

  // While checking the session, show nothing to avoid a flash of sign-in UI
  // for users who are already authenticated.
  if (state.status === "loading") {
    return <LoadingState label="Checking your session…" />;
  }

  // Already authenticated — go straight to the dashboard.
  if (state.status === "authenticated") {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 text-slate-900 flex flex-col">
      {/* Skip link */}
      <a href="#signin-main" className="skip-to-main">
        Skip to main content
      </a>

      {/* Aurora ground — cream page, deep-teal and coral ribbons that twist toward the pointer */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0">
        <AuroraFlow
          background="#EEE7DE"
          color1="#F2603F"
          color2="#00A08F"
          speed={38}
          size={120}
          angle={-180}
          hover={100}
          reach={260}
          resolution={50}
        />
        {/* soft cream vignette so the centre stays calm */}
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(ellipse 55% 60% at 50% 50%, oklch(93% 0.014 72 / 0.55), transparent 75%)" }}
        />
      </div>

      {/* Minimal top bar */}
      <header className="nx-glass relative z-10 flex items-center justify-between px-6 py-4 border-b border-slate-200/70">
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
        <span className="text-xs text-slate-500">Career Intelligence</span>
      </header>

      {/* Cancelled sign-in notice */}
      {notice && (
        <p
          role="status"
          className="bg-slate-100 border-b border-slate-200 px-5 py-2.5 text-center text-sm text-slate-700"
        >
          {notice}
        </p>
      )}

      {/* Main content */}
      <main
        id="signin-main"
        className="relative z-10 flex flex-1 items-center justify-center px-5 py-10"
      >
        <div className="nx-glass w-full max-w-md rounded-3xl border border-white/60 px-7 py-9 shadow-[0_24px_70px_-20px_rgba(14,79,74,0.35)] sm:px-10">
          {/* Heading */}
          <div className="mb-2 text-center">
            <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50/80 px-3.5 py-1.5 text-xs font-semibold text-indigo-700">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-700 nx-node-pulse" />
              Career intelligence from your GitHub
            </span>
            <h1
              className="font-display text-slate-900"
              style={{
                fontSize: "clamp(2rem, 6vw, 3rem)",
                lineHeight: 0.95,
                letterSpacing: "-0.025em",
              }}
            >
              WELCOME TO<br />
              <span className="text-indigo-700">NEXUS</span>
            </h1>
            <p className="mt-4 text-sm text-slate-600" style={{ lineHeight: 1.6 }}>
              Connect your GitHub account to build an evidence-backed career
              profile from your real work.
            </p>
          </div>

          {/* Auth options */}
          <div className="mt-8 flex flex-col gap-3">
            {/* Sign Up — primary action */}
            <CircleExpandButton href={SIGN_IN_URL} tone="solid" icon={<GitHubMark size={17} />}>
              Sign up with GitHub
            </CircleExpandButton>

            {/* Sign In — secondary action */}
            <CircleExpandButton href={SIGN_IN_URL} tone="outline" icon={<GitHubMark size={17} />}>
              Sign in with GitHub
            </CircleExpandButton>
          </div>

          {/* Trust note */}
          <p className="mt-6 text-center text-xs text-slate-500" style={{ lineHeight: 1.65 }}>
            Free. Only reads public repositories.{" "}
            <br className="hidden sm:inline" />
            Your code is never stored.
          </p>
        </div>
      </main>
    </div>
  );
}
