import type { ReactNode } from "react";
import type { ApiError } from "../api/client";

export function LoadingState({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="rounded-lg border border-slate-200 bg-white p-6 text-slate-600">
      {label}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6">
      <p className="font-medium text-slate-800">{title}</p>
      {children ? <div className="mt-1 text-sm text-slate-600">{children}</div> : null}
    </div>
  );
}

export function describeError(error: ApiError): string {
  if (error.code === "NETWORK_ERROR") {
    return "The NEXUS API could not be reached. Check your connection and try again.";
  }
  if (error.status === 401) return "Your session has expired. Please sign in again.";
  return error.message;
}

export function ErrorState({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-6 text-red-900">
      <p className="font-medium">Something went wrong</p>
      <p className="mt-1 text-sm">{describeError(error)}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-md bg-red-800 px-3 py-1.5 text-sm font-medium text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-red-900 focus-visible:ring-offset-2"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}
