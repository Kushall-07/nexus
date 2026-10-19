import type { ReactNode } from "react";
import { apiGet } from "./api/client";
import { ErrorState, LoadingState } from "./components/StateViews";
import { useApiResource, type ResourceState } from "./hooks/useApiResource";

interface Me {
  username?: string;
}

export function SignInPrompt() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <p className="font-medium text-slate-900">Sign in to view your evidence</p>
      <p className="mt-1 text-sm text-slate-600">NEXUS reads only your public GitHub repositories.</p>
      <a
        href="/api/auth/github"
        className="mt-3 inline-block rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
      >
        Sign in with GitHub
      </a>
    </div>
  );
}

export function AuthGateView({
  state,
  onRetry,
  children,
}: {
  state: ResourceState<Me>;
  onRetry: () => void;
  children: ReactNode;
}) {
  if (state.status === "loading") return <LoadingState label="Checking your session..." />;
  if (state.status === "error") {
    return state.error.status === 401 ? <SignInPrompt /> : <ErrorState error={state.error} onRetry={onRetry} />;
  }
  return <>{children}</>;
}

export function AuthGate({ children }: { children: ReactNode }) {
  const { state, reload } = useApiResource(() => apiGet<Me>("/api/auth/me"), []);

  return (
    <AuthGateView state={state} onRetry={reload}>
      {children}
    </AuthGateView>
  );
}
