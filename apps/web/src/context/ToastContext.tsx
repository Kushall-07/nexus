import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { IconCheck, IconAlert, IconClose } from "../components/Icons";

// ── Types ──────────────────────────────────────────────────────────────────────

export type ToastVariant = "success" | "error" | "info" | "warning";

export interface ToastMessage {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
}

interface ToastContextValue {
  toasts: ToastMessage[];
  toast: (options: Omit<ToastMessage, "id">) => void;
  dismiss: (id: string) => void;
}

// ── Context ────────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS: Record<ToastVariant, number> = {
  success: 4000,
  info:    4000,
  warning: 5500,
  error:   7000,
};

// ── Provider ───────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (options: Omit<ToastMessage, "id">) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => {
        // Deduplicate: skip if the most recent toast has identical title + variant
        const last = prev[prev.length - 1];
        if (last && last.title === options.title && last.variant === options.variant) {
          return prev;
        }
        // Keep at most 5 toasts at once
        return [...prev.slice(-4), { ...options, id }];
      });
      const delay = AUTO_DISMISS_MS[options.variant];
      const timer = setTimeout(() => dismiss(id), delay);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  // Clean up timers on unmount
  useEffect(() => {
    const map = timers.current;
    return () => { map.forEach(clearTimeout); map.clear(); };
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useToast(): (options: Omit<ToastMessage, "id">) => void {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx.toast;
}

// ── Toast UI ───────────────────────────────────────────────────────────────────

const VARIANT_STYLES: Record<ToastVariant, { bar: string; icon: React.ReactNode; label: string }> = {
  success: {
    bar: "bg-emerald-500",
    icon: <IconCheck className="h-4 w-4 text-emerald-500" />,
    label: "Success",
  },
  error: {
    bar: "bg-red-500",
    icon: <IconAlert className="h-4 w-4 text-red-500" />,
    label: "Error",
  },
  warning: {
    bar: "bg-amber-500",
    icon: <IconAlert className="h-4 w-4 text-amber-500" />,
    label: "Warning",
  },
  info: {
    bar: "bg-indigo-700",
    icon: <IconCheck className="h-4 w-4 text-indigo-700" />,
    label: "Info",
  },
};

function Toast({ toast: t, dismiss }: { toast: ToastMessage; dismiss: (id: string) => void }) {
  const style = VARIANT_STYLES[t.variant];

  return (
    <li
      role="status"
      aria-live={t.variant === "error" ? "assertive" : "polite"}
      aria-atomic="true"
      className="pointer-events-auto flex w-full max-w-sm overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl"
    >
      {/* Accent bar */}
      <div className={`w-1 shrink-0 ${style.bar}`} aria-hidden="true" />
      <div className="flex flex-1 items-start gap-3 p-3.5">
        <span aria-hidden="true" className="mt-0.5 shrink-0">{style.icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">{t.title}</p>
          {t.description ? (
            <p className="mt-0.5 text-xs text-slate-500">{t.description}</p>
          ) : null}
        </div>
        <button
          type="button"
          aria-label={`Dismiss ${style.label} notification: ${t.title}`}
          onClick={() => dismiss(t.id)}
          className="shrink-0 rounded p-0.5 text-slate-400 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700"
        >
          <IconClose className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}

function ToastContainer({ toasts, dismiss }: { toasts: ToastMessage[]; dismiss: (id: string) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div
      className="fixed right-4 top-4 z-[200] flex w-full max-w-sm flex-col gap-2 pointer-events-none"
      aria-label="Notifications"
    >
      <ul className="flex flex-col gap-2">
        {toasts.map((t) => (
          <Toast key={t.id} toast={t} dismiss={dismiss} />
        ))}
      </ul>
    </div>
  );
}
