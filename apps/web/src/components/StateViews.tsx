import type { ReactNode } from "react";
import type { ApiError } from "../api/client";

export function LoadingState({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-3.5 rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
      {/* Spinner */}
      <span
        className="inline-block h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-700"
        aria-hidden="true"
      />
      <span className="text-sm text-slate-600 font-medium">{label}</span>
    </div>
  );
}

export function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={`skeleton rounded-lg ${className ?? "h-4 w-full"}`}
      aria-hidden="true"
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-hidden="true">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 flex flex-col gap-2.5">
          <SkeletonBlock className="h-4 w-3/4" />
          <SkeletonBlock className="h-3 w-1/2" />
        </div>
        <SkeletonBlock className="h-6 w-20 rounded-full" />
      </div>
      <div className="mt-4 flex flex-col gap-2">
        <SkeletonBlock className="h-3 w-full" />
        <SkeletonBlock className="h-3 w-5/6" />
        <SkeletonBlock className="h-3 w-3/4" />
      </div>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 px-6 py-12 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 border border-slate-200">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <circle cx="9" cy="9" r="7.5" stroke="oklch(55% 0.010 200)" strokeWidth="1.5" strokeDasharray="3 2" />
          <line x1="9" y1="6" x2="9" y2="9.5" stroke="oklch(55% 0.010 200)" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="9" cy="11.5" r="0.75" fill="oklch(55% 0.010 200)" />
        </svg>
      </div>
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
    <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-5 py-5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-red-100 border border-red-200">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <line x1="3" y1="3" x2="7" y2="7" stroke="oklch(47% 0.185 27)" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="7" y1="3" x2="3" y2="7" stroke="oklch(47% 0.185 27)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-red-900">Something went wrong</p>
          <p className="mt-1 text-sm text-red-700">{describeError(error)}</p>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition-all hover:bg-red-50 hover:border-red-300 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                <path d="M1.5 5A3.5 3.5 0 1 0 5 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                <polyline points="1.5,1.5 1.5,5 5,5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Retry
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
