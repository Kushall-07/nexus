import type { ReactNode } from "react";
import type { ApiError } from "../api/client";

export function LoadingState({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="flex items-center gap-3">
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" aria-hidden="true" />
        <span className="text-sm text-slate-600">{label}</span>
      </div>
    </div>
  );
}

/** Skeleton block for use in page-level loading placeholders */
export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`skeleton rounded ${className ?? "h-4 w-full"}`} aria-hidden="true" />;
}

export function CardSkeleton() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4" aria-hidden="true">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-2 flex-1">
          <SkeletonBlock className="h-4 w-3/4" />
          <SkeletonBlock className="h-3 w-1/2" />
        </div>
        <SkeletonBlock className="h-5 w-24 rounded-full" />
      </div>
      <div className="mt-3 space-y-1.5">
        <SkeletonBlock className="h-3 w-full" />
        <SkeletonBlock className="h-3 w-5/6" />
      </div>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
      <p className="font-medium text-slate-800">{title}</p>
      {children ? <div className="mt-1.5 text-sm text-slate-600">{children}</div> : null}
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
    <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-900">
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
