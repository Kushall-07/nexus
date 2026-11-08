import { useState } from "react";
import { ApiError, apiDelete, apiGet } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { ErrorState, LoadingState, describeError } from "../../components/StateViews";
import { useApiResource } from "../../hooks/useApiResource";
import { getStoredTheme, setTheme, type Theme } from "../../lib/theme";
import { buttonClass, inputClass } from "../career/jobParts";

interface ProviderInfo {
  id: string;
  label: string;
  configured: boolean;
  hint?: string;
}

interface IntegrationStatus {
  providers: ProviderInfo[];
  llm: { configured: boolean };
}

const CONFIRMATION = "DELETE MY DATA";

function StatusBadge({ on, onLabel, offLabel }: { on: boolean; onLabel: string; offLabel: string }) {
  // Text plus a symbol — state is never conveyed by colour alone.
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
        on
          ? "border-emerald-300 bg-emerald-50 text-emerald-900"
          : "border-slate-300 bg-slate-100 text-slate-600"
      }`}
    >
      {on ? `✓ ${onLabel}` : `– ${offLabel}`}
    </span>
  );
}

function Integrations() {
  const { state, reload } = useApiResource(() => apiGet<IntegrationStatus>("/api/opportunities/providers"), []);

  if (state.status === "loading") return <LoadingState label="Loading integration status…" />;
  if (state.status === "error") return <ErrorState error={state.error} onRetry={reload} />;

  const { providers, llm } = state.data;

  return (
    <section aria-labelledby="integrations-heading" className="rounded-xl border border-slate-200 bg-white px-5 py-4">
      <h2 id="integrations-heading" className="text-sm font-semibold text-slate-900">Integrations</h2>
      <p className="mt-0.5 mb-4 text-xs text-slate-500">
        Shows whether the server has each optional integration configured. Credentials are kept server-side and
        never sent to your browser.
      </p>
      <ul className="divide-y divide-slate-100">
        {providers.map((provider) => (
          <li key={provider.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <div>
              <p className="text-sm font-medium text-slate-900">{provider.label}</p>
              {!provider.configured && provider.hint ? (
                <p className="text-xs text-slate-500">{provider.hint}</p>
              ) : null}
            </div>
            <StatusBadge on={provider.configured} onLabel="Configured" offLabel="Not configured" />
          </li>
        ))}
        <li className="flex flex-wrap items-center justify-between gap-2 py-3">
          <div>
            <p className="text-sm font-medium text-slate-900">AI-assisted Copilot</p>
            <p className="text-xs text-slate-500">Optional. The Copilot works without it using built-in rules.</p>
          </div>
          <StatusBadge on={llm.configured} onLabel="Configured" offLabel="Not configured" />
        </li>
      </ul>
      {providers.every((provider) => !provider.configured) ? (
        <p className="mt-3 text-xs text-amber-700 border border-amber-200 bg-amber-50 rounded-lg px-3 py-2">
          No live job provider is configured. Opportunities will only show clearly labelled demo listings.
        </p>
      ) : null}
    </section>
  );
}

function DeleteData() {
  const { refresh } = useAuth();
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function remove() {
    if (busy || phrase !== CONFIRMATION) return;
    setBusy(true);
    setError(null);
    try {
      await apiDelete("/api/auth/account", { confirmation: CONFIRMATION });
      refresh();
    } catch (failure) {
      setError(failure instanceof ApiError ? failure : new ApiError(0, "UNKNOWN_ERROR", "The request failed."));
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="delete-heading" className="rounded-xl border border-red-300 bg-white px-5 py-4">
      <h2 id="delete-heading" className="font-semibold text-slate-900">Delete my NEXUS data</h2>
      <p className="mt-1.5 text-sm text-slate-600">
        Permanently removes your GitHub connection, analyses and evidence, selected repositories, resume profile,
        preferences, saved and tracked jobs, and learning progress from NEXUS, then signs you out. This cannot be
        undone. It does not revoke NEXUS&apos;s access in your GitHub settings (Settings → Applications), and it
        does not affect anything held by job providers or by GitHub.
      </p>
      {!open ? (
        <button type="button" className={`${buttonClass} mt-4`} onClick={() => setOpen(true)}>
          Delete my data…
        </button>
      ) : (
        <div className="mt-4 space-y-3" role="group" aria-label="Confirm data deletion">
          <label className="block text-sm text-slate-800" htmlFor="delete-confirmation">
            Type <strong className="font-mono">{CONFIRMATION}</strong> to confirm
          </label>
          <input
            id="delete-confirmation"
            value={phrase}
            onChange={(event) => setPhrase(event.target.value)}
            autoComplete="off"
            className={`${inputClass} max-w-sm`}
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy || phrase !== CONFIRMATION}
              onClick={() => void remove()}
              className="rounded-lg bg-red-800 px-3 py-1.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-900 focus-visible:ring-offset-2 hover:bg-red-700"
            >
              {busy ? "Deleting…" : "Permanently delete"}
            </button>
            <button
              type="button"
              disabled={busy}
              className={buttonClass}
              onClick={() => { setOpen(false); setPhrase(""); setError(null); }}
            >
              Cancel
            </button>
          </div>
          {error ? (
            <p role="alert" className="text-sm text-red-800">{describeError(error)}</p>
          ) : null}
        </div>
      )}
    </section>
  );
}

function AppearanceSection() {
  const [theme, setLocalTheme] = useState<Theme>(() => getStoredTheme());

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    setLocalTheme(next);
  }

  return (
    <section aria-labelledby="appearance-heading" className="rounded-xl border border-slate-200 bg-white px-5 py-4">
      <h2 id="appearance-heading" className="text-sm font-semibold text-slate-900">Appearance</h2>
      <p className="mt-0.5 mb-4 text-xs text-slate-500">
        Choose your preferred colour scheme. Your selection is saved in this browser.
      </p>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-900">
            {theme === "dark" ? "Gold Signal (dark)" : "Cream & Teal (light)"}
          </p>
          <p className="text-xs text-slate-500">
            {theme === "dark"
              ? "Midnight Black background, Vibrant Gold accents"
              : "Cream background, Deep Teal accents"}
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          aria-pressed={theme === "light"}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          className="shrink-0 rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 transition-colors"
        >
          {theme === "dark" ? "Switch to light" : "Switch to dark"}
        </button>
      </div>
    </section>
  );
}

export function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-slate-900" style={{ fontSize: "1.75rem", lineHeight: 1, letterSpacing: "-0.02em" }}>Settings</h1>
        <p className="mt-0.5 text-sm text-slate-500">Integration status, provider configuration, and account management.</p>
      </div>
      <AppearanceSection />
      <Integrations />
      <DeleteData />
    </div>
  );
}
