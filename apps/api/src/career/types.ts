import { z } from "zod";

// Shared Phase 11-13 contracts. These are deliberately separate from the
// frozen Evidence/Scoring/Role engines: they only consume their outputs.

export const EMPLOYMENT_TYPES = ["internship", "full-time", "part-time", "contract", "other"] as const;
export const WORK_MODES = ["remote", "hybrid", "on-site"] as const;
export const EXPERIENCE_LEVELS = ["intern", "entry", "mid", "senior", "lead"] as const;
export const APPLICATION_STATUSES = [
  "saved",
  "planning",
  "applied",
  "interviewing",
  "offer",
  "rejected",
  "withdrawn",
] as const;
export const TASK_STATUSES = ["planned", "in_progress", "completed", "skipped"] as const;

export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];
export type WorkMode = (typeof WORK_MODES)[number];
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];

export type JobProviderId = "demo" | "remotive" | "adzuna" | "jsearch" | "arbeitnow" | "himalayas";

// Normalized listing. Every field a source may omit is optional: nothing is
// fabricated when a provider does not supply it.
export interface NormalizedJob {
  id: string; // `${provider}:${providerJobId}`
  provider: JobProviderId;
  providerJobId: string;
  isDemo: boolean;
  title: string;
  company?: string;
  description: string; // plain text, already sanitized
  location?: string;
  workMode?: WorkMode;
  employmentType?: EmploymentType;
  experienceLevel?: ExperienceLevel;
  salary?: { min?: number; max?: number; currency?: string; period?: "year" | "month" | "hour" | "week" | "day" };
  requiredSkills: string[]; // canonical skill ids or lowercase free text
  preferredSkills: string[];
  qualifications: string[];
  studentOnly?: boolean;
  postedAt?: string;
  url: string;
  sourceName: string;
  retrievedAt: string;
  stale: boolean;
}

export interface JobSearchQuery {
  keywords?: string;
  location?: string;
  workMode?: WorkMode;
  employmentType?: EmploymentType;
  experienceLevel?: ExperienceLevel;
  limit: number;
  page: number;
}

export const jobSearchQuerySchema = z
  .object({
    keywords: z.string().trim().max(120).optional(),
    location: z.string().trim().max(120).optional(),
    workMode: z.enum(WORK_MODES).optional(),
    employmentType: z.enum(EMPLOYMENT_TYPES).optional(),
    experienceLevel: z.enum(EXPERIENCE_LEVELS).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    page: z.coerce.number().int().min(1).max(10).default(1),
    source: z.enum(["live", "demo"]).default("live"),
  })
  .strict();

// ----- Profile -----

export type SkillSource = "resume" | "user-corrected" | "user-confirmed";

const short = (max: number) => z.string().trim().min(1).max(max);

export const resumeProfileSchema = z
  .object({
    name: short(120).optional(),
    email: short(200).optional(),
    phone: short(40).optional(),
    links: z.array(short(300)).max(10).default([]),
    education: z
      .array(
        z
          .object({
            institution: short(200).optional(),
            degree: short(200).optional(),
            field: short(200).optional(),
            endYear: z.number().int().min(1950).max(2100).optional(),
          })
          .strict(),
      )
      .max(10)
      .default([]),
    experience: z
      .array(
        z
          .object({
            title: short(200).optional(),
            company: short(200).optional(),
            startDate: short(40).optional(),
            endDate: short(40).optional(),
            summary: short(1000).optional(),
            isInternship: z.boolean().default(false),
          })
          .strict(),
      )
      .max(20)
      .default([]),
    projects: z.array(z.object({ name: short(200), description: short(1000).optional() }).strict()).max(20).default([]),
    skills: z
      .array(
        z
          .object({
            name: short(60),
            source: z.enum(["resume", "user-corrected", "user-confirmed"]).default("resume"),
          })
          .strict(),
      )
      .max(80)
      .default([]),
    certifications: z.array(short(200)).max(20).default([]),
  })
  .strict();

export type ResumeProfile = z.infer<typeof resumeProfileSchema>;

export const preferencesSchema = z
  .object({
    directions: z.array(z.string().min(1).max(64)).max(5).default([]),
    employmentTypes: z.array(z.enum(EMPLOYMENT_TYPES)).max(5).default([]),
    workModes: z.array(z.enum(WORK_MODES)).max(3).default([]),
    locations: z.array(short(120)).max(5).default([]),
    experienceLevel: z.enum(EXPERIENCE_LEVELS).optional(),
    minSalary: z.number().min(0).max(10_000_000).optional(),
    salaryCurrency: z.string().trim().length(3).optional(),
    isStudent: z.boolean().optional(),
  })
  .strict();

export type CareerPreferences = z.infer<typeof preferencesSchema>;
