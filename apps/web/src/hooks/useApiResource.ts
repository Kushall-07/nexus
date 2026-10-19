import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../api/client";

export type ResourceState<T> =
  | { status: "loading" }
  | { status: "error"; error: ApiError }
  | { status: "success"; data: T };

// Loads one API resource and exposes a retry. A stale response from a previous
// path or attempt can never overwrite the current one.
export function useApiResource<T>(load: () => Promise<T>, deps: readonly unknown[]) {
  const [state, setState] = useState<ResourceState<T>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    setState({ status: "loading" });

    load().then(
      (data) => {
        if (current) setState({ status: "success", data });
      },
      (error: unknown) => {
        if (current) {
          setState({
            status: "error",
            error: error instanceof ApiError ? error : new ApiError(0, "UNKNOWN_ERROR", "The request failed."),
          });
        }
      },
    );

    return () => {
      current = false;
    };
  }, [...deps, attempt]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);

  return { state, reload };
}
