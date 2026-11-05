import type { JobProvider } from "./provider.js";
import type { EmploymentType, ExperienceLevel, JobSearchQuery, NormalizedJob, WorkMode } from "../types.js";
import { extractSkills } from "./text.js";

// Fixture listings for development and demo mode. They are INVENTED examples
// from fictional employers, point at the reserved example.com domain, and are
// always flagged isDemo=true. They are never mixed with live provider results.

interface Fixture {
  id: string;
  title: string;
  company: string;
  description: string;
  location?: string;
  workMode?: WorkMode;
  employmentType?: EmploymentType;
  experienceLevel?: ExperienceLevel;
  salary?: NormalizedJob["salary"];
  studentOnly?: boolean;
  postedAt: string;
}

const FIXTURES: Fixture[] = [
  {
    id: "backend-intern",
    title: "Backend Engineering Intern",
    company: "Example Labs (demo)",
    description:
      "Build REST APIs with Node.js and Express backed by PostgreSQL. You will write unit testing and integration tests. Nice to have: Docker and GitHub Actions.",
    location: "Bengaluru, India",
    workMode: "hybrid",
    employmentType: "internship",
    experienceLevel: "intern",
    salary: { min: 20000, max: 30000, currency: "INR", period: "month" },
    studentOnly: true,
    postedAt: "2026-10-01T00:00:00.000Z",
  },
  {
    id: "fullstack-junior",
    title: "Junior Full-Stack Developer",
    company: "Sample Systems (demo)",
    description:
      "Work across a React and TypeScript frontend and a Node.js REST API with MongoDB. Experience with software testing is expected. Preferred: Docker.",
    location: "Remote - India",
    workMode: "remote",
    employmentType: "full-time",
    experienceLevel: "entry",
    postedAt: "2026-10-05T00:00:00.000Z",
  },
  {
    id: "ml-engineer",
    title: "Machine Learning Engineer",
    company: "Placeholder AI (demo)",
    description:
      "Train and evaluate deep learning models in Python using PyTorch. Deploy model services with Docker. Familiarity with SQL is a plus.",
    location: "Pune, India",
    workMode: "on-site",
    employmentType: "full-time",
    experienceLevel: "mid",
    salary: { min: 1800000, max: 2600000, currency: "INR", period: "year" },
    postedAt: "2026-09-20T00:00:00.000Z",
  },
  {
    id: "senior-backend",
    title: "Senior Backend Engineer",
    company: "Example Labs (demo)",
    description:
      "Own backend services in Go and PostgreSQL, design REST APIs, run CI/CD pipelines and containerization with Docker.",
    location: "Remote",
    workMode: "remote",
    employmentType: "full-time",
    experienceLevel: "senior",
    postedAt: "2026-10-10T00:00:00.000Z",
  },
  {
    id: "llm-app-intern",
    title: "LLM Applications Intern",
    company: "Sample Systems (demo)",
    description:
      "Prototype retrieval-augmented generation features and LLM applications using Python and the OpenAI API. Nice to have: FastAPI.",
    location: "Hyderabad, India",
    workMode: "hybrid",
    employmentType: "internship",
    experienceLevel: "intern",
    postedAt: "2026-10-12T00:00:00.000Z",
  },
  {
    id: "frontend-contract",
    title: "Frontend Developer (Contract)",
    company: "Placeholder AI (demo)",
    description: "Build accessible UI development with React, TypeScript and Next.js for a short-term contract.",
    workMode: "remote",
    employmentType: "contract",
    postedAt: "2026-07-01T00:00:00.000Z",
  },
  {
    id: "qa-parttime",
    title: "Software Test Automation Engineer",
    company: "Example Labs (demo)",
    description: "Write integration tests and test automation in JavaScript using Jest. Part time, flexible hours.",
    location: "Chennai, India",
    employmentType: "part-time",
    postedAt: "2026-10-08T00:00:00.000Z",
  },
];

export function createDemoProvider(): JobProvider {
  return {
    id: "demo",
    label: "Demo fixtures",
    status: () => ({ id: "demo", label: "Demo fixtures (not real vacancies)", configured: true }),
    async search(query: JobSearchQuery, now: Date): Promise<NormalizedJob[]> {
      const terms = (query.keywords ?? "").toLowerCase().split(/\s+/).filter(Boolean);

      return FIXTURES.filter((fixture) => {
        const haystack = `${fixture.title} ${fixture.company} ${fixture.description}`.toLowerCase();
        if (!terms.every((term) => haystack.includes(term))) return false;
        if (query.location && !(fixture.location ?? "").toLowerCase().includes(query.location.toLowerCase())) return false;
        if (query.workMode && fixture.workMode !== query.workMode) return false;
        if (query.employmentType && fixture.employmentType !== query.employmentType) return false;
        if (query.experienceLevel && fixture.experienceLevel !== query.experienceLevel) return false;
        return true;
      })
        .slice(0, query.limit)
        .map((fixture) => {
          const skills = extractSkills(fixture.description);
          return {
            id: `demo:${fixture.id}`,
            provider: "demo" as const,
            providerJobId: fixture.id,
            isDemo: true,
            title: fixture.title,
            company: fixture.company,
            description: fixture.description,
            location: fixture.location,
            workMode: fixture.workMode,
            employmentType: fixture.employmentType,
            experienceLevel: fixture.experienceLevel,
            salary: fixture.salary,
            requiredSkills: skills.required,
            preferredSkills: skills.preferred,
            qualifications: [],
            studentOnly: fixture.studentOnly,
            postedAt: fixture.postedAt,
            url: `https://example.com/demo-jobs/${fixture.id}`,
            sourceName: "Demo fixture (not a real vacancy)",
            retrievedAt: now.toISOString(),
            // Fixtures are static examples; "stale" does not apply.
            stale: false,
          };
        });
    },
  };
}
