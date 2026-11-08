import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { SIGN_IN_URL, useAuth } from "../auth/AuthContext";

const focusRing = "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700";
const menuItemClass = `block w-full rounded-md px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`;

export function AccountMenu({ compact = false }: { compact?: boolean }) {
  const { state, actionError, pending, signOut, switchAccount } = useAuth();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  const authenticated = state.status === "authenticated";

  useEffect(() => {
    if (!authenticated) setOpen(false);
  }, [authenticated]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) root.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open]);

  if (state.status === "loading") {
    if (compact) return <div className="h-6 w-6 rounded-full bg-slate-200 skeleton" />;
    return <p className="text-sm text-slate-600">Checking session...</p>;
  }

  if (state.status !== "authenticated") {
    if (compact) return null;
    return (
      <a
        href={SIGN_IN_URL}
        className={`rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white ${focusRing}`}
      >
        Sign in
      </a>
    );
  }

  const { username, githubId } = state.user;
  const label = username ?? "GitHub account";

  const avatar = githubId ? (
    <img
      src={`https://avatars.githubusercontent.com/u/${encodeURIComponent(githubId)}?s=48`}
      alt=""
      width={24}
      height={24}
      className="h-6 w-6 shrink-0 rounded-full bg-slate-200"
    />
  ) : (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
      {label.charAt(0).toUpperCase()}
    </span>
  );

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const items = Array.from(root.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? []);
    if (items.length === 0) return;
    event.preventDefault();
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next = event.key === "ArrowDown" ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
    items[next]?.focus();
  };

  return (
    <div ref={root} className={`relative ${compact ? "" : "w-full"}`} onKeyDown={onKeyDown}>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="account-menu"
        aria-label={`Account menu for ${label}`}
        onClick={() => setOpen((value) => !value)}
        className={
          compact
            ? `flex items-center justify-center rounded-lg p-1 hover:bg-slate-100 ${focusRing}`
            : `flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 ${focusRing}`
        }
      >
        {avatar}
        {!compact && <span className="min-w-0 flex-1 truncate text-left">{label}</span>}
      </button>
      {open ? (
        <div
          id="account-menu"
          role="menu"
          aria-label="Account"
          className={[
            "absolute z-50 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg",
            compact
              ? "bottom-full left-0 mb-2 min-w-[200px]"
              : "bottom-full left-0 mb-2 w-full min-w-[200px]",
          ].join(" ")}
        >
          <div className="px-2.5 py-2 border-b border-slate-100 mb-1">
            <p className="truncate text-sm font-medium text-slate-900">{label}</p>
            <p className="text-xs text-slate-500">Connected through GitHub</p>
          </div>
          <button
            type="button"
            role="menuitem"
            disabled={pending}
            onClick={() => void switchAccount()}
            className={menuItemClass}
          >
            Switch GitHub account
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={pending}
            onClick={() => void signOut()}
            className={menuItemClass}
          >
            {pending ? "Signing out..." : "Sign out"}
          </button>
          {actionError ? (
            <p role="alert" className="px-3 py-2 text-xs text-red-800">
              {actionError}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
