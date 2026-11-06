import type { ReactNode } from "react";
import type { ApiError } from "../api/client";

export function LoadingState({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4">
      {/* Gold spinner */}
      <span
        className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-700"
        aria-hidden="true"
      />
      <span className="text-sm text-slate-600">{label}</span>
    </div>
  );
}

export function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={`skeleton rounded ${className ?? "h-4 w-full"}`}
      aria-hidden="true"
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4" aria-hidden="true">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 flex flex-col gap-2">
          <SkeletonBlock className="h-4 w-3/4" />
          <SkeletonBlock className="h-3 w-1/2" />
        </div>
        <SkeletonBlock className="h-5 w-24 rounded-full" />
      </div>
      <div className="mt-3 flex flex-col gap-1.5">
        <SkeletonBlock className="h-3 w-full" />
        <SkeletonBlock className="h-3 w-5/6" />
      </div>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 px-6 py-10 text-center">
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {children ? (
        <div className="mt-2 text-sm text-slate-500">{children}</div>
      ) : null}
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
    <div role="alert" className="rounded-xl border border-red-300 bg-red-100 px-5 py-4">
      <p className="text-sm font-semibold text-red-900">Something went wrong</p>
      <p className="mt-1 text-sm text-red-800">{describeError(error)}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-lg border border-red-300 bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}
