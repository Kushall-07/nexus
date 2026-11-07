import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { ErrorState, LoadingState } from "./components/StateViews";

/**
 * AuthGate — protects all authenticated routes.
 *
 * Loading  → shows loading state.
 * Error    → shows error state with retry.
 * Unauthenticated → redirects to / (public landing page) which has the sign-in CTA.
 * Authenticated → renders children.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { state, refresh } = useAuth();

  if (state.status === "loading") return <LoadingState label="Checking your session…" />;
  if (state.status === "error") return <ErrorState error={state.error} onRetry={refresh} />;
  if (state.status === "unauthenticated") return <Navigate to="/" replace />;
  return <>{children}</>;
}
