import { useState, type FormEvent } from "react";
import { ApiError, apiGet, apiPut } from "../../api/client";
import type { CareerPreferences, CareerProfileResponse, EmploymentType, ExperienceLevel, WorkMode } from "../../api/career-types";
import { ErrorState, LoadingState, describeError } from "../../components/StateViews";
import { useApiResource } from "../../hooks/useApiResource";
import { inputClass, primaryButtonClass } from "./jobParts";

const EMPLOYMENT: Array<[EmploymentType, string]> = [["internship", "Internship"], ["full-time", "Full-time"], ["part-time", "Part-time"], ["contract", "Contract"]];
const MODES: Array<[WorkMode, string]> = [["remote", "Remote"], ["hybrid", "Hybrid"], ["on-site", "On-site"]];

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
}

function PreferencesForm({ profile }: { profile: CareerProfileResponse }) {
  const [prefs, setPrefs] = useState<CareerPreferences>(profile.preferences);
  const [locations, setLocations] = useState(profile.preferences.locations.join(", "));
  const [salary, setSalary] = useState(profile.preferences.minSalary?.toString() ?? "");
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);

    const minSalary = salary.trim() === "" ? undefined : Number(salary);
    if (minSalary !== undefined && (!Number.isFinite(minSalary) || minSalary < 0)) {
      setMessage({ kind: "error", text: "Minimum pay must be a positive number." });
      setBusy(false);
      return;
    }

    const body: CareerPreferences = {
      ...prefs,
      locations: locations.split(",").map((value) => value.trim()).filter(Boolean).slice(0, 5),
      minSalary,
      salaryCurrency: minSalary === undefined ? undefined : prefs.salaryCurrency?.toUpperCase(),
    };
    try {
      await apiPut<CareerPreferences>("/api/career/preferences", body);
      setMessage({ kind: "ok", text: "Preferences saved." });
    } catch (error) {
      setMessage({ kind: "error", text: describeError(error instanceof ApiError ? error : new ApiError(0, "UNKNOWN_ERROR", "The request failed.")) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5 rounded-lg border border-slate-200 bg-white p-4">
      <fieldset>
        <legend className="font-medium text-slate-900">Career directions (optional)</legend>
        <p className="text-sm text-slate-600">A direction guides recommendations and your skill plan. It is a preference, never a filter or a label.</p>
        <div className="mt-2 flex flex-wrap gap-3">
          {profile.directions.map((direction) => (
            <label key={direction.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={prefs.directions.includes(direction.id)} onChange={() => setPrefs({ ...prefs, directions: toggle(prefs.directions, direction.id).slice(0, 5) })} />
              {direction.displayName}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="font-medium text-slate-900">Employment type</legend>
        <div className="mt-2 flex flex-wrap gap-3">
          {EMPLOYMENT.map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={prefs.employmentTypes.includes(value)} onChange={() => setPrefs({ ...prefs, employmentTypes: toggle(prefs.employmentTypes, value) })} />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="font-medium text-slate-900">Work mode</legend>
        <div className="mt-2 flex flex-wrap gap-3">
          {MODES.map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={prefs.workModes.includes(value)} onChange={() => setPrefs({ ...prefs, workModes: toggle(prefs.workModes, value) })} />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="p-locations" className="block text-sm font-medium text-slate-800">Preferred locations (comma-separated)</label>
          <input id="p-locations" className={inputClass} value={locations} onChange={(event) => setLocations(event.target.value)} />
        </div>
        <div>
          <label htmlFor="p-level" className="block text-sm font-medium text-slate-800">Your experience level</label>
          <select id="p-level" className={inputClass} value={prefs.experienceLevel ?? ""} onChange={(event) => setPrefs({ ...prefs, experienceLevel: (event.target.value || undefined) as ExperienceLevel | undefined })}>
            <option value="">Not specified</option>
            <option value="intern">Intern</option>
            <option value="entry">Entry</option>
            <option value="mid">Mid</option>
            <option value="senior">Senior</option>
            <option value="lead">Lead</option>
          </select>
        </div>
        <div>
          <label htmlFor="p-salary" className="block text-sm font-medium text-slate-800">Minimum yearly pay (optional)</label>
          <input id="p-salary" inputMode="numeric" className={inputClass} value={salary} onChange={(event) => setSalary(event.target.value)} />
        </div>
        <div>
          <label htmlFor="p-currency" className="block text-sm font-medium text-slate-800">Currency (3-letter code)</label>
          <input id="p-currency" className={inputClass} maxLength={3} value={prefs.salaryCurrency ?? ""} onChange={(event) => setPrefs({ ...prefs, salaryCurrency: event.target.value || undefined })} />
        </div>
        <div>
          <label htmlFor="p-student" className="block text-sm font-medium text-slate-800">Are you currently a student?</label>
          <select id="p-student" className={inputClass} value={prefs.isStudent === undefined ? "" : String(prefs.isStudent)} onChange={(event) => setPrefs({ ...prefs, isStudent: event.target.value === "" ? undefined : event.target.value === "true" })}>
            <option value="">Not specified</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>
      </div>
      <p className="text-xs text-slate-600">Listings that do not state salary, location or level are never penalised for it.</p>

      <div className="flex items-center gap-3">
        <button type="submit" className={primaryButtonClass} disabled={busy}>{busy ? "Saving..." : "Save preferences"}</button>
        {message ? (
          <p role={message.kind === "error" ? "alert" : "status"} className={`text-sm ${message.kind === "error" ? "text-red-800" : "text-emerald-800"}`}>{message.text}</p>
        ) : null}
      </div>
    </form>
  );
}

export function PreferencesPage() {
  const { state, reload } = useApiResource(() => apiGet<CareerProfileResponse>("/api/career/profile"), []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Career preferences</h1>
      {state.status === "loading" ? <LoadingState label="Loading your preferences..." /> : null}
      {state.status === "error" ? <ErrorState error={state.error} onRetry={reload} /> : null}
      {state.status === "success" ? <PreferencesForm profile={state.data} /> : null}
    </div>
  );
}
