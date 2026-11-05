import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ApiError, apiGet, apiPost, onUnauthorized } from "../api/client";
import { redirectTo } from "../lib/navigation";

export interface AuthUser {
  githubId?: string;
  username?: string;
}

export type AuthState =
  | { status: "loading" }
  | { status: "authenticated"; user: AuthUser }
  | { status: "unauthenticated" }
  | { status: "error"; error: ApiError };

interface AuthContextValue {
  state: AuthState;
  // Set when the last sign-in attempt was cancelled on GitHub.
  notice: string | null;
  // Set when sign-out or account switching failed; the session is unchanged.
  actionError: string | null;
  pending: boolean;
  refresh: () => void;
  signOut: () => Promise<void>;
  switchAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const SIGN_IN_URL = "/api/auth/github";
export const SWITCH_ACCOUNT_URL = "/api/auth/github?switch=1";

// Reads and strips the ?auth_error=cancelled marker set by the OAuth callback.
function consumeCancelledNotice(): string | null {
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get("auth_error") !== "cancelled") return null;
    url.searchParams.delete("auth_error");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    return "GitHub sign-in was cancelled. You are not signed in.";
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const busy = useRef(false);

  useEffect(() => {
    setNotice(consumeCancelledNotice());
  }, []);

  useEffect(() => {
    let current = true;
    setState({ status: "loading" });

    apiGet<AuthUser>("/api/auth/me").then(
      (user) => {
        if (current) setState({ status: "authenticated", user });
      },
      (error: unknown) => {
        if (!current) return;
        const apiError = error instanceof ApiError ? error : new ApiError(0, "UNKNOWN_ERROR", "The request failed.");
        // Only a confirmed 401 means signed out; anything else is a failed check.
        setState(apiError.status === 401 ? { status: "unauthenticated" } : { status: "error", error: apiError });
      },
    );

    return () => {
      current = false;
    };
  }, [attempt]);

  useEffect(
    () =>
      onUnauthorized(() => {
        setState((previous) => (previous.status === "authenticated" ? { status: "unauthenticated" } : previous));
      }),
    [],
  );

  const refresh = useCallback(() => setAttempt((value) => value + 1), []);

  // The session counts as ended only once the backend confirms the logout.
  const confirmLogout = useCallback(async (): Promise<boolean> => {
    if (busy.current) return false;
    busy.current = true;
    setPending(true);
    setActionError(null);

    try {
      await apiPost("/api/auth/logout");
      setState({ status: "unauthenticated" });
      return true;
    } catch {
      setActionError("Could not sign out. Your session is still active. Please try again.");
      busy.current = false;
      setPending(false);
      return false;
    }
  }, []);

  const signOut = useCallback(async () => {
    if (await confirmLogout()) {
      busy.current = false;
      setPending(false);
    }
  }, [confirmLogout]);

  const switchAccount = useCallback(async () => {
    // Stays pending: the page is about to navigate away to GitHub.
    if (await confirmLogout()) redirectTo(SWITCH_ACCOUNT_URL);
  }, [confirmLogout]);

  const value = useMemo(
    () => ({ state, notice, actionError, pending, refresh, signOut, switchAccount }),
    [state, notice, actionError, pending, refresh, signOut, switchAccount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>.");
  return value;
}
