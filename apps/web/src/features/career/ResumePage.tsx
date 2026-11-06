import { useRef, useState, type ChangeEvent } from "react";
import { ApiError, apiDelete, apiGet, apiPut, apiUpload } from "../../api/client";
import type { ResumeDraft, ResumeProfile, SkillSource, StoredResume } from "../../api/career-types";
import { EmptyState, ErrorState, LoadingState, describeError } from "../../components/StateViews";
import { useApiResource } from "../../hooks/useApiResource";
import { buttonClass, inputClass, primaryButtonClass } from "./jobParts";

interface ResumeResponse {
  resume: StoredResume | null;
  maxBytes: number;
}

export function validateResumeFile(file: File, maxBytes: number): string | null {
  const extension = file.name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  if (extension !== "pdf" && extension !== "docx") return "Only PDF and DOCX files are supported.";
  if (file.size === 0) return "That file is empty.";
  if (file.size > maxBytes) return `That file is larger than ${(maxBytes / 1_000_000).toFixed(0)} MB.`;
  return null;
}

type SkillRow = { name: string; source: SkillSource; confirmed: boolean };

function toError(error: unknown): ApiError {
  return error instanceof ApiError ? error : new ApiError(0, "UNKNOWN_ERROR", "The request failed.");
}

function Summary({ resume }: { resume: StoredResume }) {
  const { profile } = resume;
  return (
    <section aria-label="Active resume" className="rounded-xl border border-slate-200 bg-white px-5 py-4 nx-panel-success">
      <h2 className="font-semibold text-slate-900">Active resume (version {resume.version})</h2>
      <p className="mt-0.5 text-sm text-slate-500">
        {resume.fileName ?? "Unnamed file"} · saved {new Date(resume.savedAt).toLocaleString()}
      </p>
      <p className="mt-1.5 text-sm text-slate-700">
        <span className="tabular-nums font-semibold">{profile.skills.length}</span> skills ·{" "}
        <span className="tabular-nums font-semibold">{profile.experience.length}</span> experience entries ·{" "}
        <span className="tabular-nums font-semibold">{profile.education.length}</span> education entries ·{" "}
        <span className="tabular-nums font-semibold">{profile.projects.length}</span> projects
      </p>
      <p className="mt-1 text-xs text-slate-500">
        Skills from your resume count as claims in job matching. Only GitHub analysis is treated as verified evidence.
      </p>
      {profile.skills.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Resume skills">
          {profile.skills.map((skill) => (
            <li
              key={skill.name}
              className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700"
            >
              {skill.name}
              {skill.source !== "resume" ? (
                <span className="ml-1 text-slate-400">({skill.source.replace("-", " ")})</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function ReviewForm({ draft, hasActive, onCancel, onSaved }: {
  draft: ResumeDraft;
  hasActive: boolean;
  onCancel: () => void;
  onSaved: (resume: StoredResume) => void;
}) {
  const initial = draft.profile;
  const [name, setName] = useState(initial.name ?? "");
  const [email, setEmail] = useState(initial.email ?? "");
  const [phone, setPhone] = useState(initial.phone ?? "");
  const [skills, setSkills] = useState<SkillRow[]>(initial.skills.map((skill) => ({ ...skill, confirmed: skill.source !== "resume" })));
  const [newSkill, setNewSkill] = useState("");
  const [education, setEducation] = useState(initial.education);
  const [experience, setExperience] = useState(initial.experience);
  const [projects, setProjects] = useState(initial.projects);
  const [certifications, setCertifications] = useState(initial.certifications.join("\n"));
  const [links, setLinks] = useState(initial.links.join("\n"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const lines = (value: string) => value.split("\n").map((line) => line.trim()).filter(Boolean);
  const clean = <T extends Record<string, unknown>>(entry: T): T =>
    Object.fromEntries(Object.entries(entry).filter(([, value]) => value !== "" && value !== undefined)) as T;

  async function save() {
    setBusy(true);
    setError(null);
    const profile: ResumeProfile = {
      name: name.trim() || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      links: lines(links),
      education: education.map(clean),
      experience: experience.map(clean),
      projects: projects.filter((project) => project.name.trim()).map(clean),
      skills: skills.map((skill) => ({ name: skill.name, source: skill.confirmed && skill.source === "resume" ? "user-confirmed" : skill.source })),
      certifications: lines(certifications),
    };
    try {
      onSaved(await apiPut<StoredResume>("/api/resume", { profile, fileName: draft.fileName, fileType: draft.fileType }));
    } catch (failure) {
      setError(toError(failure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Review extracted resume" className="space-y-5 rounded-xl border border-indigo-200 bg-white px-5 py-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Review what was extracted</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Extraction is automatic and can be wrong or incomplete. Correct anything, tick skills you confirm, and remove what is not yours.{" "}
          {hasActive ? "Your current resume stays active until you save." : "Nothing is saved until you confirm."}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="r-name" className="block text-sm font-medium text-slate-800 mb-1">Name</label>
          <input id="r-name" className={inputClass} value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div>
          <label htmlFor="r-email" className="block text-sm font-medium text-slate-800 mb-1">Email</label>
          <input id="r-email" className={inputClass} value={email} onChange={(event) => setEmail(event.target.value)} />
        </div>
        <div>
          <label htmlFor="r-phone" className="block text-sm font-medium text-slate-800 mb-1">Phone</label>
          <input id="r-phone" className={inputClass} value={phone} onChange={(event) => setPhone(event.target.value)} />
        </div>
      </div>

      <fieldset>
        <legend className="font-semibold text-slate-900">Skills ({skills.length})</legend>
        {skills.length === 0 ? <p className="mt-1 text-sm text-slate-500">No skills were found.</p> : null}
        <ul className="mt-2 space-y-1.5">
          {skills.map((skill, index) => (
            <li key={`${skill.name}-${index}`} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="min-w-32 font-medium text-slate-800">{skill.name}</span>
              <label className="flex items-center gap-1 text-slate-600">
                <input
                  type="checkbox"
                  checked={skill.confirmed}
                  onChange={() => setSkills(skills.map((row, i) => (i === index ? { ...row, confirmed: !row.confirmed } : row)))}
                />
                Confirmed{" "}<span className="sr-only">{skill.name}</span>
              </label>
              <button type="button" className={buttonClass} onClick={() => setSkills(skills.filter((_, i) => i !== index))}>
                Remove{" "}<span className="sr-only">{skill.name}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex gap-2">
          <label htmlFor="r-new-skill" className="sr-only">Add a skill</label>
          <input
            id="r-new-skill"
            className={inputClass}
            placeholder="Add a skill"
            maxLength={60}
            value={newSkill}
            onChange={(event) => setNewSkill(event.target.value)}
          />
          <button
            type="button"
            className={buttonClass}
            onClick={() => {
              const value = newSkill.trim();
              if (value && !skills.some((skill) => skill.name.toLowerCase() === value.toLowerCase())) {
                setSkills([...skills, { name: value, source: "user-corrected", confirmed: true }]);
              }
              setNewSkill("");
            }}
          >
            Add skill
          </button>
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="font-semibold text-slate-900">Education ({education.length})</legend>
        {education.length === 0 ? <p className="mt-1 text-sm text-slate-500">No education entries were found.</p> : null}
        {education.map((entry, index) => (
          <div key={index} className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[1fr_1fr_6rem_auto]">
            <div>
              <label htmlFor={`e-deg-${index}`} className="block text-xs font-medium text-slate-600 mb-1">Degree</label>
              <input id={`e-deg-${index}`} className={inputClass} value={entry.degree ?? ""} onChange={(event) => setEducation(education.map((row, i) => (i === index ? { ...row, degree: event.target.value } : row)))} />
            </div>
            <div>
              <label htmlFor={`e-inst-${index}`} className="block text-xs font-medium text-slate-600 mb-1">Institution</label>
              <input id={`e-inst-${index}`} className={inputClass} value={entry.institution ?? ""} onChange={(event) => setEducation(education.map((row, i) => (i === index ? { ...row, institution: event.target.value } : row)))} />
            </div>
            <div>
              <label htmlFor={`e-year-${index}`} className="block text-xs font-medium text-slate-600 mb-1">Year</label>
              <input id={`e-year-${index}`} inputMode="numeric" className={inputClass} value={entry.endYear ?? ""} onChange={(event) => setEducation(education.map((row, i) => (i === index ? { ...row, endYear: /^\d{4}$/.test(event.target.value) ? Number(event.target.value) : undefined } : row)))} />
            </div>
            <button type="button" className={`${buttonClass} self-end`} onClick={() => setEducation(education.filter((_, i) => i !== index))}>
              Remove{" "}<span className="sr-only">education entry {index + 1}</span>
            </button>
          </div>
        ))}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="font-semibold text-slate-900">Experience ({experience.length})</legend>
        {experience.length === 0 ? <p className="mt-1 text-sm text-slate-500">No experience entries were found.</p> : null}
        {experience.map((entry, index) => (
          <div key={index} className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="sm:col-span-3">
                <label htmlFor={`x-title-${index}`} className="block text-xs font-medium text-slate-600 mb-1">Title / employer</label>
                <input id={`x-title-${index}`} className={inputClass} value={entry.title ?? ""} onChange={(event) => setExperience(experience.map((row, i) => (i === index ? { ...row, title: event.target.value } : row)))} />
              </div>
              <div>
                <label htmlFor={`x-start-${index}`} className="block text-xs font-medium text-slate-600 mb-1">Start</label>
                <input id={`x-start-${index}`} className={inputClass} value={entry.startDate ?? ""} onChange={(event) => setExperience(experience.map((row, i) => (i === index ? { ...row, startDate: event.target.value } : row)))} />
              </div>
              <div>
                <label htmlFor={`x-end-${index}`} className="block text-xs font-medium text-slate-600 mb-1">End</label>
                <input id={`x-end-${index}`} className={inputClass} value={entry.endDate ?? ""} onChange={(event) => setExperience(experience.map((row, i) => (i === index ? { ...row, endDate: event.target.value } : row)))} />
              </div>
              <label className="flex items-end gap-2 pb-1 text-sm text-slate-700">
                <input type="checkbox" checked={entry.isInternship} onChange={() => setExperience(experience.map((row, i) => (i === index ? { ...row, isInternship: !row.isInternship } : row)))} />
                Internship
              </label>
            </div>
            <div>
              <label htmlFor={`x-sum-${index}`} className="block text-xs font-medium text-slate-600 mb-1">Summary</label>
              <textarea id={`x-sum-${index}`} rows={2} className={inputClass} value={entry.summary ?? ""} onChange={(event) => setExperience(experience.map((row, i) => (i === index ? { ...row, summary: event.target.value } : row)))} />
            </div>
            <button type="button" className={buttonClass} onClick={() => setExperience(experience.filter((_, i) => i !== index))}>
              Remove{" "}<span className="sr-only">experience entry {index + 1}</span>
            </button>
          </div>
        ))}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="font-semibold text-slate-900">Projects ({projects.length})</legend>
        {projects.map((project, index) => (
          <div key={index} className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="grow">
              <label htmlFor={`p-name-${index}`} className="block text-xs font-medium text-slate-600 mb-1">Project name</label>
              <input id={`p-name-${index}`} className={inputClass} value={project.name} onChange={(event) => setProjects(projects.map((row, i) => (i === index ? { ...row, name: event.target.value } : row)))} />
            </div>
            <button type="button" className={buttonClass} onClick={() => setProjects(projects.filter((_, i) => i !== index))}>
              Remove{" "}<span className="sr-only">project {project.name}</span>
            </button>
          </div>
        ))}
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="r-certs" className="block text-sm font-medium text-slate-800 mb-1">Certifications (one per line)</label>
          <textarea id="r-certs" rows={3} className={inputClass} value={certifications} onChange={(event) => setCertifications(event.target.value)} />
        </div>
        <div>
          <label htmlFor="r-links" className="block text-sm font-medium text-slate-800 mb-1">Links (one per line)</label>
          <textarea id="r-links" rows={3} className={inputClass} value={links} onChange={(event) => setLinks(event.target.value)} />
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-xl border border-red-300 bg-red-100 px-4 py-3 text-sm text-red-900">
          {describeError(error)}
        </p>
      ) : null}

      <div className="flex gap-2">
        <button type="button" className={primaryButtonClass} disabled={busy} onClick={save}>
          {busy ? "Saving…" : hasActive ? "Confirm and replace my resume" : "Confirm and save"}
        </button>
        <button type="button" className={buttonClass} disabled={busy} onClick={onCancel}>Cancel</button>
      </div>
    </section>
  );
}

export function ResumePage() {
  const { state, reload } = useApiResource(() => apiGet<ResumeResponse>("/api/resume"), []);
  const [draft, setDraft] = useState<ResumeDraft | null>(null);
  const [reading, setReading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<ApiError | null>(null);
  const [override, setOverride] = useState<{ resume: StoredResume | null } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  if (state.status === "loading") return <LoadingState label="Loading your resume…" />;
  if (state.status === "error") return <ErrorState error={state.error} onRetry={reload} />;

  const resume = override ? override.resume : state.data.resume;

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setNotice(null);
    const problem = validateResumeFile(file, (state as { data: ResumeResponse }).data.maxBytes);
    if (problem) {
      setFileError(problem);
      return;
    }
    setFileError(null);
    setReading(true);
    try {
      setDraft(await apiUpload<ResumeDraft>("/api/resume/extract", file, { "X-File-Name": encodeURIComponent(file.name) }));
    } catch (failure) {
      setDraft(null);
      setFileError(describeError(toError(failure)));
    } finally {
      setReading(false);
    }
  }

  async function remove() {
    setDeleteError(null);
    try {
      await apiDelete("/api/resume");
      setOverride({ resume: null });
      setConfirmingDelete(false);
      setNotice("Your resume was deleted. Your GitHub evidence, saved jobs, preferences and learning progress were not affected.");
    } catch (failure) {
      setDeleteError(toError(failure));
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="font-display text-slate-900" style={{ fontSize: "1.75rem", lineHeight: 1, letterSpacing: "-0.02em" }}>Resume</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Upload a text-based PDF or DOCX. NEXUS extracts fields for you to review; the file itself is not stored —
          only the reviewed fields are, and you can delete them at any time.
        </p>
      </div>

      {notice ? (
        <p role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {notice}
        </p>
      ) : null}

      {resume ? <Summary resume={resume} /> : !draft ? (
        <EmptyState title="No resume yet">
          Upload your resume to add experience and claimed skills to job matching.
          Without one, matching uses GitHub evidence only.
        </EmptyState>
      ) : null}

      {!draft ? (
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
          <label htmlFor="resume-file" className="block text-sm font-semibold text-slate-900 mb-2">
            {resume ? "Upload a new resume to replace the active one" : "Upload a resume (PDF or DOCX)"}
          </label>
          <input
            ref={input}
            id="resume-file"
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="block text-sm text-slate-700 file:mr-3 file:rounded-lg file:border file:border-slate-300 file:bg-white file:px-3 file:py-1 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-100"
            onChange={onFile}
            disabled={reading}
          />
          <p className="mt-2 text-xs text-slate-500">
            Maximum {(state.data.maxBytes / 1_000_000).toFixed(0)} MB. Scanned or image-only documents cannot be read (no OCR).
          </p>
          {reading ? (
            <p role="status" className="mt-2 text-sm text-slate-700">
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-700 mr-1.5 align-middle" aria-hidden="true" />
              Reading your document…
            </p>
          ) : null}
          {fileError ? <p role="alert" className="mt-2 text-sm text-red-800">{fileError}</p> : null}
        </div>
      ) : (
        <ReviewForm
          draft={draft}
          hasActive={resume !== null}
          onCancel={() => { setDraft(null); setNotice("Upload cancelled. Your active resume was not changed."); }}
          onSaved={(saved) => { setOverride({ resume: saved }); setDraft(null); setNotice("Resume saved. Job matches now use it."); }}
        />
      )}

      {resume && !draft ? (
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
          {confirmingDelete ? (
            <div role="alertdialog" aria-labelledby="delete-title" className="space-y-3">
              <p id="delete-title" className="font-semibold text-slate-900">Delete your resume?</p>
              <p className="text-sm text-slate-600">
                The reviewed resume fields will be permanently removed. GitHub evidence, saved jobs,
                preferences and learning progress are kept.
              </p>
              {deleteError ? (
                <p role="alert" className="text-sm text-red-800">{describeError(deleteError)}</p>
              ) : null}
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-red-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-900"
                  onClick={remove}
                >
                  Delete resume
                </button>
                <button type="button" className={buttonClass} onClick={() => setConfirmingDelete(false)}>Keep it</button>
              </div>
            </div>
          ) : (
            <button type="button" className={buttonClass} onClick={() => setConfirmingDelete(true)}>
              Delete resume…
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
