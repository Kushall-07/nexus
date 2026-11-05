import type { ReactNode } from "react";
import { useAuth } from "./auth/AuthContext";
import { IconNexus } from "./components/Icons";
import { ErrorState, LoadingState } from "./components/StateViews";

function GitHubMark() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

export function SignInPrompt() {
  const { notice } = useAuth();

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <span className="text-indigo-700">
            <IconNexus className="h-14 w-14" />
          </span>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">NEXUS</h1>
            <p className="text-sm text-slate-500">Career Copilot · GitHub Evidence Engine</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Sign in to get started</h2>
          <p className="mt-1 text-sm text-slate-600">
            NEXUS connects to GitHub to analyze your public repositories and build evidence-based career insights.
          </p>

          {notice ? (
            <p role="status" className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {notice}
            </p>
          ) : null}

          <a
            href="/api/auth/github"
            className="mt-4 flex items-center justify-center gap-2.5 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
          >
            <GitHubMark />
            Sign in with GitHub
          </a>

          <p className="mt-4 text-xs text-slate-500">
            NEXUS only reads public repositories. No code or private data is accessed.
          </p>
        </div>
      </div>
    </div>
  );
}

// Protected content renders only for a confirmed authenticated session.
export function AuthGate({ children }: { children: ReactNode }) {
  const { state, refresh } = useAuth();

  if (state.status === "loading") return <LoadingState label="Checking your session..." />;
  if (state.status === "error") return <ErrorState error={state.error} onRetry={refresh} />;
  if (state.status === "unauthenticated") return <SignInPrompt />;
  return <>{children}</>;
}
