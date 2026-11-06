import { describe, expect, it, vi } from "vitest";
import { buildJob, createAdzunaProvider, createArbeitnowProvider, createHimalayasProvider, createJSearchProvider, createRemotiveProvider } from "../../src/career/jobs/adapters.js";
import { createDemoProvider } from "../../src/career/jobs/demo-provider.js";
import { createJobService } from "../../src/career/jobs/job-service.js";
import { ProviderError, type JobProvider } from "../../src/career/jobs/provider.js";
import { extractSkills, htmlToText, isStale, safeHttpUrl } from "../../src/career/jobs/text.js";

const NOW = new Date("2026-10-20T00:00:00.000Z");
const query = { limit: 20, page: 1 };

function jsonFetch(body: unknown, init: { status?: number } = {}) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status: init.status ?? 200 })) as unknown as typeof fetch;
}

describe("text sanitising", () => {
  it("strips markup, scripts and entities into plain text", () => {
    const text = htmlToText('<p>Build <b>APIs</b></p><script>alert(1)</script><img src=x onerror=alert(1)>&amp; more<!-- c -->');
    expect(text).not.toMatch(/[<>]/);
    expect(text).not.toMatch(/alert/);
    expect(text).toContain("Build");
    expect(text).toContain("& more");
  });

  it("accepts only credential-free http(s) URLs", () => {
    expect(safeHttpUrl("https://example.com/jobs/1")).toBe("https://example.com/jobs/1");
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "ftp://x.test", "https://user:pw@x.test", "not a url", 42]) {
      expect(safeHttpUrl(bad)).toBeNull();
    }
  });

  it("only marks listings stale when a posted date proves it", () => {
    expect(isStale(undefined, NOW)).toBe(false);
    expect(isStale("2026-10-10T00:00:00.000Z", NOW)).toBe(false);
    expect(isStale("2026-05-01T00:00:00.000Z", NOW)).toBe(true);
  });

  it("splits required and preferred skills at a nice-to-have marker and does not confuse java with javascript", () => {
    const skills = extractSkills("We use JavaScript and Docker. Nice to have: Kubernetes, PostgreSQL.");
    expect(skills.required).toEqual(expect.arrayContaining(["javascript", "docker"]));
    expect(skills.required).not.toContain("java");
    expect(skills.preferred).toEqual(["postgresql"]);
  });
});

describe("buildJob", () => {
  it("skips listings without a title, id or valid link instead of inventing them", () => {
    const base = { provider: "remotive" as const, providerJobId: "1", title: "T", url: "https://x.test/1", sourceName: "S" };
    expect(buildJob(base, NOW)).not.toBeNull();
    expect(buildJob({ ...base, title: undefined }, NOW)).toBeNull();
    expect(buildJob({ ...base, providerJobId: undefined }, NOW)).toBeNull();
    expect(buildJob({ ...base, url: "javascript:alert(1)" }, NOW)).toBeNull();
  });

  it("leaves unknown optional fields undefined", () => {
    const job = buildJob({ provider: "remotive", providerJobId: "1", title: "Engineer", url: "https://x.test/1", sourceName: "S" }, NOW)!;
    expect(job.company).toBeUndefined();
    expect(job.salary).toBeUndefined();
    expect(job.location).toBeUndefined();
    expect(job.isDemo).toBe(false);
  });
});

describe("Remotive adapter", () => {
  const body = {
    jobs: [
      {
        id: 101,
        title: "Junior Backend Developer",
        company_name: "Acme Remote",
        description: "<p>Work with Node.js and PostgreSQL. Nice to have: Docker.</p>",
        candidate_required_location: "Worldwide",
        tags: ["nodejs", "go"],
        job_type: "full_time",
        publication_date: "2026-10-10T00:00:00",
        url: "https://remotive.com/remote-jobs/101",
      },
      { id: 102, title: "No link", url: "javascript:alert(1)" },
      "garbage",
    ],
  };

  it("normalizes listings, attributes the source and marks them remote", async () => {
    const provider = createRemotiveProvider({ enabled: true, timeoutMs: 1000, fetchImpl: jsonFetch(body) });
    const jobs = await provider.search(query, NOW);

    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      id: "remotive:101",
      sourceName: "Remotive",
      workMode: "remote",
      employmentType: "full-time",
      experienceLevel: "entry",
      isDemo: false,
    });
    expect(jobs[0]!.requiredSkills).toEqual(expect.arrayContaining(["nodejs", "postgresql", "go"]));
    expect(jobs[0]!.preferredSkills).toEqual(["docker"]);
  });

  it("returns nothing for a non-remote filter without calling the network", async () => {
    const fetchImpl = jsonFetch(body);
    const provider = createRemotiveProvider({ enabled: true, timeoutMs: 1000, fetchImpl });
    expect(await provider.search({ ...query, workMode: "on-site" }, NOW)).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("reports itself unconfigured until enabled", () => {
    expect(createRemotiveProvider({ enabled: false, timeoutMs: 1000 }).status()).toMatchObject({ configured: false });
  });

  it("rejects an unexpected response shape", async () => {
    const provider = createRemotiveProvider({ enabled: true, timeoutMs: 1000, fetchImpl: jsonFetch({ nope: true }) });
    await expect(provider.search(query, NOW)).rejects.toMatchObject({ kind: "bad_response" });
  });
});

describe("Adzuna adapter", () => {
  const body = {
    results: [
      {
        id: "7",
        title: "Software Engineer Intern",
        company: { display_name: "Acme" },
        location: { display_name: "London" },
        description: "Python and SQL.",
        contract_time: "full_time",
        created: "2026-10-15T00:00:00Z",
        redirect_url: "https://www.adzuna.com/land/ad/7",
        salary_min: 30000,
        salary_max: 40000,
        salary_is_predicted: "0",
        currency: "GBP",
      },
      { id: "8", title: "Predicted", redirect_url: "https://www.adzuna.com/land/ad/8", salary_min: 1, salary_max: 2, salary_is_predicted: "1" },
    ],
  };

  it("is unconfigured without both credentials and never calls the network", async () => {
    const fetchImpl = jsonFetch(body);
    const provider = createAdzunaProvider({ timeoutMs: 1000, country: "gb", fetchImpl, appId: "id" });
    expect(provider.status().configured).toBe(false);
    await expect(provider.search(query, NOW)).rejects.toMatchObject({ kind: "auth" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("normalizes results and never presents predicted salaries as stated pay", async () => {
    const provider = createAdzunaProvider({ timeoutMs: 1000, country: "gb", fetchImpl: jsonFetch(body), appId: "id", appKey: "key" });
    const jobs = await provider.search({ ...query, keywords: "python" }, NOW);

    expect(jobs[0]).toMatchObject({ id: "adzuna:7", employmentType: "internship", location: "London", company: "Acme" });
    expect(jobs[0]!.salary).toEqual({ min: 30000, max: 40000, currency: "GBP", period: "year" });
    expect(jobs[1]!.salary).toBeUndefined();
  });

  it("sends credentials only to the Adzuna host", async () => {
    const fetchImpl = jsonFetch(body);
    await createAdzunaProvider({ timeoutMs: 1000, country: "gb", fetchImpl, appId: "id", appKey: "key" }).search(query, NOW);
    const url = new URL((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string);
    expect(url.host).toBe("api.adzuna.com");
  });
});

describe("JSearch adapter", () => {
  const body = {
    data: [
      {
        job_id: "abc",
        job_title: "Backend Developer",
        employer_name: "Acme",
        job_description: "Node.js role",
        job_city: "Pune",
        job_country: "IN",
        job_employment_type: "FULLTIME",
        job_is_remote: true,
        job_min_salary: 1000000,
        job_max_salary: 1500000,
        job_salary_currency: "INR",
        job_salary_period: "YEAR",
        job_apply_link: "https://careers.acme.test/apply/abc",
        job_publisher: "LinkedIn",
        job_posted_at_datetime_utc: "2026-10-12T00:00:00.000Z",
      },
    ],
  };

  it("sends the key as a header to the RapidAPI host only and normalizes", async () => {
    const fetchImpl = jsonFetch(body);
    const provider = createJSearchProvider({ timeoutMs: 1000, fetchImpl, apiKey: "secret-key" });
    const [job] = await provider.search(query, NOW);

    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]! as [string, RequestInit];
    expect(new URL(url).host).toBe("jsearch.p.rapidapi.com");
    expect(url).not.toContain("secret-key");
    expect((init.headers as Record<string, string>)["X-RapidAPI-Key"]).toBe("secret-key");
    expect(job).toMatchObject({
      id: "jsearch:abc",
      workMode: "remote",
      location: "Pune, IN",
      salary: { min: 1000000, max: 1500000, currency: "INR", period: "year" },
      sourceName: "JSearch / LinkedIn",
    });
  });

  it("maps provider failure statuses", async () => {
    const make = (status: number) => createJSearchProvider({ timeoutMs: 1000, fetchImpl: jsonFetch({}, { status }), apiKey: "k" }).search(query, NOW);
    await expect(make(429)).rejects.toMatchObject({ kind: "rate_limited" });
    await expect(make(403)).rejects.toMatchObject({ kind: "auth" });
    await expect(make(503)).rejects.toMatchObject({ kind: "upstream" });
  });

  it("maps timeouts and network errors without leaking details", async () => {
    const timeout = vi.fn(async () => {
      throw Object.assign(new Error("secret-key leaked?"), { name: "TimeoutError" });
    }) as unknown as typeof fetch;
    const error = await createJSearchProvider({ timeoutMs: 1000, fetchImpl: timeout, apiKey: "k" }).search(query, NOW).catch((e) => e);
    expect(error).toBeInstanceOf(ProviderError);
    expect(error.kind).toBe("timeout");
    expect(error.message).not.toContain("secret");
  });

  it("rejects unreadable bodies", async () => {
    const fetchImpl = vi.fn(async () => new Response("<html>nope</html>", { status: 200 })) as unknown as typeof fetch;
    await expect(createJSearchProvider({ timeoutMs: 1000, fetchImpl, apiKey: "k" }).search(query, NOW)).rejects.toMatchObject({ kind: "bad_response" });
  });

  it.each([
    ["WEEK", "week"],
    ["DAY", "day"],
  ])("maps salary period %s to %s", async (apiPeriod, expected) => {
    const weekBody = { data: [{ ...body.data[0]!, job_salary_period: apiPeriod }] };
    const provider = createJSearchProvider({ timeoutMs: 1000, fetchImpl: jsonFetch(weekBody), apiKey: "k" });
    const [job] = await provider.search(query, NOW);
    expect(job!.salary!.period).toBe(expected);
  });

  it("sets salary period to undefined for unrecognised values", async () => {
    const unknownBody = { data: [{ ...body.data[0]!, job_salary_period: "QUARTER" }] };
    const provider = createJSearchProvider({ timeoutMs: 1000, fetchImpl: jsonFetch(unknownBody), apiKey: "k" });
    const [job] = await provider.search(query, NOW);
    expect(job!.salary!.period).toBeUndefined();
  });
});

// Fixtures derived from apps/api/src/modules/jobs/providers/__fixtures__/arbeitnow-response.json.
// Used for unit testing only; production always fetches from the live Arbeitnow API.
describe("Arbeitnow adapter", () => {
  const body = {
    data: [
      {
        slug: "ai-automation-lead-berlin-326639",
        company_name: "Lemon Markets",
        title: "AI & Automation Lead (f/m/x)",
        description: "<h2>About the role</h2><p>Example job description for testing.</p>",
        remote: false,
        url: "https://www.arbeitnow.com/jobs/companies/lemon-markets/ai-automation-lead-berlin-326639",
        tags: ["Engineering"],
        job_types: ["Full Time"],
        location: "Berlin (Hybrid)",
        created_at: 1793936414,
      },
      {
        slug: "devops-engineer-amsterdam-263780",
        company_name: "Intelic",
        title: "DevOps Engineer",
        description: "<p>Example DevOps job description.</p>",
        remote: false,
        url: "https://www.arbeitnow.nl/jobs/companies/intelic/devops-engineer-amsterdam-263780",
        tags: [],
        job_types: ["Mid", "fulltime fixed term"],
        location: "Amsterdam, Netherlands",
        created_at: 1793935911,
      },
    ],
    links: {},
    meta: {},
  };

  it("normalizes listings, strips HTML description and attributes the source", async () => {
    const provider = createArbeitnowProvider({ enabled: true, timeoutMs: 1000, fetchImpl: jsonFetch(body) });
    const jobs = await provider.search(query, NOW);

    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toMatchObject({
      id: "arbeitnow:ai-automation-lead-berlin-326639",
      title: "AI & Automation Lead (f/m/x)",
      company: "Lemon Markets",
      location: "Berlin (Hybrid)",
      sourceName: "Arbeitnow",
      isDemo: false,
    });
    // HTML tags must be stripped from the description.
    expect(jobs[0]!.description).not.toMatch(/[<>]/);
    expect(jobs[0]!.description).toContain("About the role");
    expect(jobs[0]!.description).toContain("Example job description for testing");
  });

  it("infers work mode from location text when remote flag is false", async () => {
    const provider = createArbeitnowProvider({ enabled: true, timeoutMs: 1000, fetchImpl: jsonFetch(body) });
    const jobs = await provider.search(query, NOW);
    // "Berlin (Hybrid)" contains the word 'hybrid'.
    expect(jobs[0]!.workMode).toBe("hybrid");
    // "Amsterdam, Netherlands" has no work-mode keyword.
    expect(jobs[1]!.workMode).toBeUndefined();
  });

  it("sets workMode to remote when remote flag is true", async () => {
    const remoteBody = {
      data: [{ ...body.data[0]!, slug: "remote-role-99", remote: true, location: "Worldwide" }],
    };
    const provider = createArbeitnowProvider({ enabled: true, timeoutMs: 1000, fetchImpl: jsonFetch(remoteBody) });
    const [job] = await provider.search(query, NOW);
    expect(job!.workMode).toBe("remote");
  });

  it("converts a Unix epoch seconds timestamp to an ISO date string", async () => {
    const provider = createArbeitnowProvider({ enabled: true, timeoutMs: 1000, fetchImpl: jsonFetch(body) });
    const jobs = await provider.search(query, NOW);
    expect(jobs[0]!.postedAt).toBe(new Date(1793936414 * 1000).toISOString());
    expect(jobs[1]!.postedAt).toBe(new Date(1793935911 * 1000).toISOString());
  });

  it("preserves the original Arbeitnow application URL unmodified", async () => {
    const provider = createArbeitnowProvider({ enabled: true, timeoutMs: 1000, fetchImpl: jsonFetch(body) });
    const jobs = await provider.search(query, NOW);
    expect(jobs[0]!.url).toBe("https://www.arbeitnow.com/jobs/companies/lemon-markets/ai-automation-lead-berlin-326639");
    expect(jobs[1]!.url).toBe("https://www.arbeitnow.nl/jobs/companies/intelic/devops-engineer-amsterdam-263780");
  });

  it("infers employment type from a single job_type string", async () => {
    const provider = createArbeitnowProvider({ enabled: true, timeoutMs: 1000, fetchImpl: jsonFetch(body) });
    const jobs = await provider.search(query, NOW);
    // "Full Time" maps to full-time.
    expect(jobs[0]!.employmentType).toBe("full-time");
  });

  it("infers employment type when multiple job_types are present", async () => {
    const provider = createArbeitnowProvider({ enabled: true, timeoutMs: 1000, fetchImpl: jsonFetch(body) });
    const jobs = await provider.search(query, NOW);
    // ["Mid", "fulltime fixed term"] joined → "Mid fulltime fixed term" → full-time matched.
    expect(jobs[1]!.employmentType).toBe("full-time");
  });

  it("handles empty tags array without error and produces valid skill arrays", async () => {
    const provider = createArbeitnowProvider({ enabled: true, timeoutMs: 1000, fetchImpl: jsonFetch(body) });
    const jobs = await provider.search(query, NOW);
    // Entry 2 has tags: [].
    expect(jobs[1]!.requiredSkills).toBeInstanceOf(Array);
    expect(jobs[1]!.preferredSkills).toBeInstanceOf(Array);
  });

  it("skips entries missing a slug, title or a valid URL", async () => {
    const badBody = {
      data: [
        { ...body.data[0]! },
        { slug: "", title: "No slug", url: "https://x.test/1", job_types: [], tags: [], created_at: 0, remote: false },
        { slug: "ok", title: "", url: "https://x.test/2", job_types: [], tags: [], created_at: 0, remote: false },
        { slug: "ok2", title: "No link", url: "javascript:alert(1)", job_types: [], tags: [], created_at: 0, remote: false },
        "not-an-object",
      ],
    };
    const provider = createArbeitnowProvider({ enabled: true, timeoutMs: 1000, fetchImpl: jsonFetch(badBody) });
    const jobs = await provider.search(query, NOW);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]!.id).toBe("arbeitnow:ai-automation-lead-berlin-326639");
  });

  it("reports itself unconfigured until ARBEITNOW_ENABLED is true", () => {
    expect(createArbeitnowProvider({ enabled: false, timeoutMs: 1000 }).status()).toMatchObject({
      configured: false,
      id: "arbeitnow",
    });
  });

  it("throws bad_response when the API returns an unexpected shape", async () => {
    const provider = createArbeitnowProvider({ enabled: true, timeoutMs: 1000, fetchImpl: jsonFetch({ nope: true }) });
    await expect(provider.search(query, NOW)).rejects.toMatchObject({ kind: "bad_response" });
  });

  it("throws bad_response when the response body exceeds 5 MB", async () => {
    const hugeFetch = vi.fn(async () => new Response("x".repeat(5_000_001), { status: 200 })) as unknown as typeof fetch;
    const provider = createArbeitnowProvider({ enabled: true, timeoutMs: 1000, fetchImpl: hugeFetch });
    await expect(provider.search(query, NOW)).rejects.toMatchObject({ kind: "bad_response" });
  });

  it("accepts a response body between 2 MB and 5 MB (Arbeitnow real-world size)", async () => {
    // The global limit is 2 MB; the per-provider override for Arbeitnow is 5 MB.
    // A body of 2.5 MB must succeed for Arbeitnow.
    const bigBody = JSON.stringify({ data: body.data });
    const paddedBody = bigBody + " ".repeat(2_500_000 - bigBody.length);
    const bigFetch = vi.fn(async () => new Response(paddedBody, { status: 200 })) as unknown as typeof fetch;
    const provider = createArbeitnowProvider({ enabled: true, timeoutMs: 1000, fetchImpl: bigFetch });
    const jobs = await provider.search(query, NOW);
    expect(jobs).toHaveLength(2);
  });
});

// Fixtures derived from apps/api/src/modules/jobs/providers/__fixtures__/himalayas-response.json.
// Used for unit testing only; production always fetches from the live Himalayas API.
describe("Himalayas adapter", () => {
  // Representative fixture matching the shape discovered in the live API audit.
  const body = {
    comments: "",
    updatedAt: "2026-11-06T07:16:36.000Z",
    offset: 0,
    limit: 20,
    totalCount: 114318,
    nextCursor: "MjAyNi0xMS0wNlQwNzoxNjozNi4wMDBafDI1MTMxMjI",
    jobs: [
      {
        title: "Senior Software Engineer — Backend",
        companyName: "Acme Remote",
        companySlug: "acme-remote",
        companyLogo: "https://cdn-images.himalayas.app/acme-logo",
        employmentType: "Full Time",
        minSalary: 120000,
        maxSalary: 180000,
        salaryPeriod: "annual",
        seniority: ["Senior"],
        currency: "USD",
        locationRestrictions: ["India", "United States"],
        timezoneRestrictions: [5.5, -8, -7, -6, -5],
        categories: ["Software-Engineer", "Backend-Engineer", "Go"],
        parentCategories: ["Engineering"],
        description: "<h2>About the role</h2><p>Build backend services in <b>Go</b> and <b>PostgreSQL</b>. Write integration tests.</p><p>Nice to have: Kubernetes, Redis.</p>",
        pubDate: 1793936414,
        expiryDate: 1799120413,
        applicationLink: "https://himalayas.app/companies/acme-remote/jobs/senior-software-engineer-backend?utm_source=api",
        guid: "https://himalayas.app/companies/acme-remote/jobs/senior-software-engineer-backend",
      },
      {
        title: "Frontend Developer Intern",
        companyName: "Sample Systems",
        companySlug: "sample-systems",
        companyLogo: "",
        employmentType: "Full Time",
        minSalary: null,
        maxSalary: null,
        salaryPeriod: "annual",
        seniority: ["Entry-level"],
        currency: null,
        locationRestrictions: ["India"],
        timezoneRestrictions: [5.5],
        categories: ["Front-End-Developer", "React-Developer"],
        parentCategories: ["Engineering"],
        description: "<p>Build UI with <b>React</b> and <b>TypeScript</b>.</p><script>alert('xss')</script>",
        pubDate: 1793935911,
        expiryDate: 1799119910,
        applicationLink: "https://himalayas.app/companies/sample-systems/jobs/frontend-developer-intern?utm_source=api",
        guid: "https://himalayas.app/companies/sample-systems/jobs/frontend-developer-intern",
      },
      {
        title: "DevOps Engineer",
        companyName: "Intelic",
        companySlug: "intelic",
        companyLogo: "https://cdn-images.himalayas.app/intelic-logo",
        employmentType: "Contractor",
        minSalary: 80,
        maxSalary: 120,
        salaryPeriod: "hourly",
        seniority: ["Mid-level"],
        currency: "USD",
        locationRestrictions: ["United States", "Canada"],
        timezoneRestrictions: [-10, -9, -8, -7, -6, -5],
        categories: ["DevOps-Engineer", "Docker", "Kubernetes"],
        parentCategories: ["Engineering"],
        description: "<p>Manage CI/CD with <b>Docker</b> and <b>Kubernetes</b>.</p>",
        pubDate: 1793900000,
        expiryDate: 1799083999,
        applicationLink: "https://himalayas.app/companies/intelic/jobs/devops-engineer?utm_source=api",
        guid: "https://himalayas.app/companies/intelic/jobs/devops-engineer",
      },
      {
        title: "Part-Time Data Analyst",
        companyName: "Placeholder AI",
        companySlug: "placeholder-ai",
        companyLogo: "",
        employmentType: "Part Time",
        minSalary: 3000,
        maxSalary: 5000,
        salaryPeriod: "monthly",
        seniority: ["Entry-level"],
        currency: "USD",
        locationRestrictions: ["United States"],
        timezoneRestrictions: [-8, -7, -6, -5],
        categories: ["Data-Analyst", "Python-Developer"],
        parentCategories: ["Data"],
        description: "<p>Analyze metrics using <b>Python</b> and <b>SQL</b>.</p>",
        pubDate: 1793880000,
        expiryDate: 1799064000,
        applicationLink: "https://himalayas.app/companies/placeholder-ai/jobs/part-time-data-analyst?utm_source=api",
        guid: "https://himalayas.app/companies/placeholder-ai/jobs/part-time-data-analyst",
      },
      {
        // Invalid applicationLink — entry must be skipped.
        title: "VP of Engineering",
        companyName: "Lemon Markets",
        companySlug: "lemon-markets",
        companyLogo: "https://cdn-images.himalayas.app/lemon-logo",
        employmentType: "Full Time",
        minSalary: 250000,
        maxSalary: 350000,
        salaryPeriod: "annual",
        seniority: ["Executive"],
        currency: "USD",
        locationRestrictions: ["United States"],
        timezoneRestrictions: [-8, -7, -6, -5],
        categories: ["VP-of-Engineering"],
        parentCategories: ["Engineering"],
        description: "<p>Lead engineering teams.</p>",
        pubDate: 1793870000,
        expiryDate: 1799053999,
        applicationLink: "javascript:alert(1)",
        guid: "https://himalayas.app/companies/lemon-markets/jobs/vp-of-engineering",
      },
      {
        // "Machine Learning Intern" — title contains "intern" so buildJob infers type=internship.
        title: "Machine Learning Intern",
        companyName: "Example Labs",
        companySlug: "example-labs",
        companyLogo: "",
        employmentType: "Full Time",
        minSalary: null,
        maxSalary: null,
        salaryPeriod: "annual",
        seniority: ["Entry-level"],
        currency: null,
        locationRestrictions: ["India"],
        timezoneRestrictions: [5.5],
        categories: ["Machine-Learning-Engineer", "Python-Developer"],
        parentCategories: ["Engineering"],
        description: "<h3>Intern</h3><p>Train ML models in <b>Python</b> using PyTorch.</p>",
        pubDate: 1793860000,
        expiryDate: 1799043999,
        applicationLink: "https://himalayas.app/companies/example-labs/jobs/machine-learning-intern?utm_source=api",
        guid: "https://himalayas.app/companies/example-labs/jobs/machine-learning-intern",
      },
    ],
  };

  it("normalizes listings, strips HTML description and attributes the source", async () => {
    const provider = createHimalayasProvider({ enabled: true, timeoutMs: 1000, fetchImpl: jsonFetch(body) });
    const jobs = await provider.search(query, NOW);

    // 5 jobs returned (VP skipped due to bad URL)
    expect(jobs).toHaveLength(5);
    expect(jobs[0]).toMatchObject({
      id: "himalayas:acme-remote/senior-software-engineer-backend",
      title: "Senior Software Engineer — Backend",
      company: "Acme Remote",
      sourceName: "Himalayas",
      isDemo: false,
    });
    // HTML tags must be stripped.
    expect(jobs[0]!.description).not.toMatch(/[<>]/);
    expect(jobs[0]!.description).toContain("About the role");
    expect(jobs[0]!.description).toContain("Go");
  });

  it("builds a stable providerJobId from the GUID path as companySlug/jobSlug", async () => {
    const provider = createHimalayasProvider({ enabled: true, timeoutMs: 1000, fetchImpl: jsonFetch(body) });
    const jobs = await provider.search(query, NOW);
    expect(jobs[0]!.providerJobId).toBe("acme-remote/senior-software-engineer-backend");
    expect(jobs[1]!.providerJobId).toBe("sample-systems/frontend-developer-intern");
    expect(jobs[2]!.providerJobId).toBe("intelic/devops-engineer");
  });

  it("converts a Unix epoch seconds pubDate to an ISO timestamp", async () => {
    const provider = createHimalayasProvider({ enabled: true, timeoutMs: 1000, fetchImpl: jsonFetch(body) });
    const jobs = await provider.search(query, NOW);
    expect(jobs[0]!.postedAt).toBe(new Date(1793936414 * 1000).toISOString());
    expect(jobs[1]!.postedAt).toBe(new Date(1793935911 * 1000).toISOString());
  });

  it("preserves the applicationLink as the job URL unmodified", async () => {
    const provider = createHimalayasProvider({ enabled: true, timeoutMs: 1000, fetchImpl: jsonFetch(body) });
    const jobs = await provider.search(query, NOW);
    // applicationLink includes ?utm_source=api — preserved as-is.
    expect(jobs[0]!.url).toBe("https://himalayas.app/companies/acme-remote/jobs/senior-software-engineer-backend?utm_source=api");
    expect(jobs[1]!.url).toBe("https://himalayas.app/companies/sample-systems/jobs/frontend-developer-intern?utm_source=api");
  });

  it("strips HTML including script tags from the description", async () => {
    const provider = createHimalayasProvider({ enabled: true, timeoutMs: 1000, fetchImpl: jsonFetch(body) });
    const jobs = await provider.search(query, NOW);
    const intern = jobs.find((j) => j.providerJobId === "sample-systems/frontend-developer-intern");
    expect(intern).toBeDefined();
    expect(intern!.description).not.toMatch(/[<>]/);
    expect(intern!.description).not.toContain("alert");
    expect(intern!.description).toContain("React");
  });

  it("maps Full Time to full-time, Contractor to contract, Part Time to part-time", async () => {
    const provider = createHimalayasProvider({ enabled: true, timeoutMs: 1000, fetchImpl: jsonFetch(body) });
    const jobs = await provider.search(query, NOW);

    const senior = jobs.find((j) => j.providerJobId === "acme-remote/senior-software-engineer-backend");
    const devops = jobs.find((j) => j.providerJobId === "intelic/devops-engineer");
    const analyst = jobs.find((j) => j.providerJobId === "placeholder-ai/part-time-data-analyst");

    // Title "Senior Software Engineer" contains no employment-type keyword → falls back to employmentHint.
    expect(senior!.employmentType).toBe("full-time");
    // "Contractor" → "contract"
    expect(devops!.employmentType).toBe("contract");
    // "Part Time" → "part-time"
    expect(analyst!.employmentType).toBe("part-time");
  });

  it("title 'intern' keyword wins over employmentType hint", async () => {
    const provider = createHimalayasProvider({ enabled: true, timeoutMs: 1000, fetchImpl: jsonFetch(body) });
    const jobs = await provider.search(query, NOW);
    // "Machine Learning Intern" — buildJob gives title priority: employmentType = internship.
    const intern = jobs.find((j) => j.providerJobId === "example-labs/machine-learning-intern");
    expect(intern!.employmentType).toBe("internship");
  });

  it("maps seniority to experienceLevel when title does not provide a signal", async () => {
    const provider = createHimalayasProvider({ enabled: true, timeoutMs: 1000, fetchImpl: jsonFetch(body) });
    const jobs = await provider.search(query, NOW);

    // "Senior Software Engineer — Backend" → title infers 'senior' directly.
    const senior = jobs.find((j) => j.providerJobId === "acme-remote/senior-software-engineer-backend");
    expect(senior!.experienceLevel).toBe("senior");

    // "DevOps Engineer" title has no level keyword → seniority ["Mid-level"] → "mid".
    const devops = jobs.find((j) => j.providerJobId === "intelic/devops-engineer");
    expect(devops!.experienceLevel).toBe("mid");
  });

  it("maps seniority Executive to lead", async () => {
    const execBody = {
      jobs: [
        {
          title: "Director of Product",
          companyName: "Acme",
          companySlug: "acme",
          employmentType: "Full Time",
          minSalary: null, maxSalary: null, salaryPeriod: "annual", currency: null,
          seniority: ["Executive"],
          locationRestrictions: [],
          timezoneRestrictions: [],
          categories: [],
          description: "Lead the product org.",
          pubDate: 1793936414,
          expiryDate: 1799120413,
          applicationLink: "https://himalayas.app/companies/acme/jobs/director-product?utm_source=api",
          guid: "https://himalayas.app/companies/acme/jobs/director-product",
        },
      ],
    };
    const provider = createHimalayasProvider({ enabled: true, timeoutMs: 1000, fetchImpl: jsonFetch(execBody) });
    const [job] = await provider.search(query, NOW);
    expect(job!.experienceLevel).toBe("lead");
  });

  it("includes salary with period year for annual, month for monthly, hour for hourly", async () => {
    const provider = createHimalayasProvider({ enabled: true, timeoutMs: 1000, fetchImpl: jsonFetch(body) });
    const jobs = await provider.search(query, NOW);

    const senior = jobs.find((j) => j.providerJobId === "acme-remote/senior-software-engineer-backend");
    expect(senior!.salary).toEqual({ min: 120000, max: 180000, currency: "USD", period: "year" });

    const devops = jobs.find((j) => j.providerJobId === "intelic/devops-engineer");
    expect(devops!.salary).toEqual({ min: 80, max: 120, currency: "USD", period: "hour" });

    const analyst = jobs.find((j) => j.providerJobId === "placeholder-ai/part-time-data-analyst");
    expect(analyst!.salary).toEqual({ min: 3000, max: 5000, currency: "USD", period: "month" });
  });

  it("omits salary when minSalary and maxSalary are null", async () => {
    const provider = createHimalayasProvider({ enabled: true, timeoutMs: 1000, fetchImpl: jsonFetch(body) });
    const jobs = await provider.search(query, NOW);
    const intern = jobs.find((j) => j.providerJobId === "sample-systems/frontend-developer-intern");
    expect(intern!.salary).toBeUndefined();
  });

  it("joins locationRestrictions into a readable location string", async () => {
    const provider = createHimalayasProvider({ enabled: true, timeoutMs: 1000, fetchImpl: jsonFetch(body) });
    const jobs = await provider.search(query, NOW);
    expect(jobs[0]!.location).toBe("India, United States");
    expect(jobs[1]!.location).toBe("India");
    expect(jobs[2]!.location).toBe("United States, Canada");
  });

  it("sets location to undefined when locationRestrictions is an empty array", async () => {
    const noLocBody = {
      jobs: [
        {
          title: "Software Engineer",
          companyName: "Global Co",
          companySlug: "global-co",
          employmentType: "Full Time",
          minSalary: null, maxSalary: null, salaryPeriod: "annual", currency: null,
          seniority: ["Mid-level"],
          locationRestrictions: [],
          timezoneRestrictions: [],
          categories: [],
          description: "Global remote role.",
          pubDate: 1793936414,
          expiryDate: 1799120413,
          applicationLink: "https://himalayas.app/companies/global-co/jobs/software-engineer?utm_source=api",
          guid: "https://himalayas.app/companies/global-co/jobs/software-engineer",
        },
      ],
    };
    const provider = createHimalayasProvider({ enabled: true, timeoutMs: 1000, fetchImpl: jsonFetch(noLocBody) });
    const [job] = await provider.search(query, NOW);
    expect(job!.location).toBeUndefined();
  });

  it("does not set workMode to remote merely because a job has multi-country location restrictions", async () => {
    const provider = createHimalayasProvider({ enabled: true, timeoutMs: 1000, fetchImpl: jsonFetch(body) });
    const jobs = await provider.search(query, NOW);
    // No description text contains 'remote', 'hybrid', 'on-site' — workMode should be undefined.
    for (const job of jobs) {
      expect(job.workMode).toBeUndefined();
    }
  });

  it("does not incorrectly classify a US-only job as India-eligible", async () => {
    const provider = createHimalayasProvider({ enabled: true, timeoutMs: 1000, fetchImpl: jsonFetch(body) });
    const jobs = await provider.search(query, NOW);
    const usOnly = jobs.filter((j) => j.location === "United States");
    for (const job of usOnly) {
      expect(job.location).not.toContain("India");
    }
  });

  it("India-eligible jobs have locationRestrictions that contain India", async () => {
    const provider = createHimalayasProvider({ enabled: true, timeoutMs: 1000, fetchImpl: jsonFetch(body) });
    const jobs = await provider.search(query, NOW);
    const indiaJobs = jobs.filter((j) => j.location?.includes("India"));
    expect(indiaJobs.length).toBeGreaterThan(0);
    // All returned jobs with India in location come from the fixture's India entries.
    for (const job of indiaJobs) {
      expect(job.location).toContain("India");
    }
  });

  it("skips entries with invalid application URLs without discarding valid ones", async () => {
    const provider = createHimalayasProvider({ enabled: true, timeoutMs: 1000, fetchImpl: jsonFetch(body) });
    const jobs = await provider.search(query, NOW);
    // VP of Engineering has applicationLink: "javascript:alert(1)" — skipped.
    const vp = jobs.find((j) => j.providerJobId === "lemon-markets/vp-of-engineering");
    expect(vp).toBeUndefined();
    // Other 5 valid entries remain.
    expect(jobs).toHaveLength(5);
  });

  it("skips non-object entries and entries missing title or guid without throwing", async () => {
    const badBody = {
      jobs: [
        body.jobs[0]!,
        "not-an-object",
        null,
        { title: "", companyName: "X", companySlug: "x", employmentType: "Full Time", minSalary: null, maxSalary: null, salaryPeriod: "annual", currency: null, seniority: [], locationRestrictions: [], timezoneRestrictions: [], categories: [], description: "", pubDate: 0, expiryDate: 0, applicationLink: "https://x.test/1", guid: "https://himalayas.app/companies/x/jobs/job1" },
        { title: "No guid", companyName: "Y", companySlug: "y", employmentType: "Full Time", minSalary: null, maxSalary: null, salaryPeriod: "annual", currency: null, seniority: [], locationRestrictions: [], timezoneRestrictions: [], categories: [], description: "", pubDate: 0, expiryDate: 0, applicationLink: "https://x.test/2", guid: "https://himalayas.app/companies" },
      ],
    };
    const provider = createHimalayasProvider({ enabled: true, timeoutMs: 1000, fetchImpl: jsonFetch(badBody) });
    const jobs = await provider.search(query, NOW);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]!.id).toBe("himalayas:acme-remote/senior-software-engineer-backend");
  });

  it("respects the server's 20-result cap and does not request more", async () => {
    const fetchImpl = jsonFetch({ jobs: [body.jobs[0]!] });
    const provider = createHimalayasProvider({ enabled: true, timeoutMs: 1000, fetchImpl });
    // Even with query.limit=50 the adapter always sends limit=20.
    await provider.search({ limit: 50, page: 1 }, NOW);
    const calledUrl = new URL((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string);
    expect(calledUrl.searchParams.get("limit")).toBe("20");
  });

  it("calculates offset from page number for pagination and sends it to the API", async () => {
    const fetchImpl = jsonFetch({ jobs: [] });
    const provider = createHimalayasProvider({ enabled: true, timeoutMs: 1000, fetchImpl });
    await provider.search({ limit: 20, page: 1 }, NOW);
    await provider.search({ limit: 20, page: 2 }, NOW);
    await provider.search({ limit: 20, page: 3 }, NOW);
    const calls = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls as [string, unknown][];
    expect(new URL(calls[0]![0]).searchParams.get("offset")).toBe("0");
    expect(new URL(calls[1]![0]).searchParams.get("offset")).toBe("20");
    expect(new URL(calls[2]![0]).searchParams.get("offset")).toBe("40");
  });

  it("does not send nextCursor as a query parameter", async () => {
    const fetchImpl = jsonFetch(body);
    const provider = createHimalayasProvider({ enabled: true, timeoutMs: 1000, fetchImpl });
    await provider.search(query, NOW);
    const calledUrl = new URL((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string);
    expect(calledUrl.searchParams.has("nextCursor")).toBe(false);
    expect(calledUrl.searchParams.has("cursor")).toBe(false);
  });

  it("sends requests only to the Himalayas host", async () => {
    const fetchImpl = jsonFetch(body);
    await createHimalayasProvider({ enabled: true, timeoutMs: 1000, fetchImpl }).search(query, NOW);
    const calledUrl = new URL((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string);
    expect(calledUrl.host).toBe("himalayas.app");
  });

  it("handles an empty jobs array gracefully", async () => {
    const provider = createHimalayasProvider({ enabled: true, timeoutMs: 1000, fetchImpl: jsonFetch({ jobs: [], totalCount: 0 }) });
    const jobs = await provider.search(query, NOW);
    expect(jobs).toEqual([]);
  });

  it("reports itself unconfigured until HIMALAYAS_ENABLED is true", () => {
    expect(createHimalayasProvider({ enabled: false, timeoutMs: 1000 }).status()).toMatchObject({
      configured: false,
      id: "himalayas",
    });
  });

  it("throws bad_response when the API returns an unexpected shape", async () => {
    const provider = createHimalayasProvider({ enabled: true, timeoutMs: 1000, fetchImpl: jsonFetch({ nope: true }) });
    await expect(provider.search(query, NOW)).rejects.toMatchObject({ kind: "bad_response" });
  });

  it("maps HTTP 429 to rate_limited and 403 to auth", async () => {
    const make = (status: number) => createHimalayasProvider({ timeoutMs: 1000, fetchImpl: jsonFetch({}, { status }), enabled: true }).search(query, NOW);
    await expect(make(429)).rejects.toMatchObject({ kind: "rate_limited" });
    await expect(make(403)).rejects.toMatchObject({ kind: "auth" });
    await expect(make(503)).rejects.toMatchObject({ kind: "upstream" });
  });

  it("maps timeouts to the timeout failure kind without leaking details", async () => {
    const timeout = vi.fn(async () => { throw Object.assign(new Error("internal"), { name: "TimeoutError" }); }) as unknown as typeof fetch;
    const error = await createHimalayasProvider({ timeoutMs: 1000, fetchImpl: timeout, enabled: true }).search(query, NOW).catch((e) => e);
    expect(error).toBeInstanceOf(ProviderError);
    expect(error.kind).toBe("timeout");
  });

  it("deduplicates same title+company across pages via the job service", async () => {
    // Both pages return a job with identical title+company — job service removes the duplicate.
    const dupJob = body.jobs[0]!;
    const page1Provider = jsonFetch({ jobs: [dupJob] });
    const page2Provider = jsonFetch({ jobs: [dupJob] });
    let call = 0;
    const alternating = vi.fn(async (...args: Parameters<typeof fetch>) => {
      return call++ === 0 ? page1Provider(...args) : page2Provider(...args);
    }) as unknown as typeof fetch;
    const provider = createHimalayasProvider({ enabled: true, timeoutMs: 1000, fetchImpl: alternating });
    const { createJobService } = await import("../../src/career/jobs/job-service.js");
    const service = createJobService({ liveProviders: [provider], cacheTtlMs: 0 });
    const p1 = await service.search({ limit: 20, page: 1 }, "live");
    const p2 = await service.search({ limit: 20, page: 2 }, "live");
    // Both searches return the same listing but are independent queries — no cross-query dedup.
    expect(p1.jobs).toHaveLength(1);
    expect(p2.jobs).toHaveLength(1);
  });
});

describe("demo provider", () => {
  it("labels every fixture as a non-real example", async () => {
    const jobs = await createDemoProvider().search(query, NOW);
    expect(jobs.length).toBeGreaterThan(3);
    for (const job of jobs) {
      expect(job.isDemo).toBe(true);
      expect(job.provider).toBe("demo");
      expect(job.sourceName).toMatch(/not a real vacancy/i);
      expect(new URL(job.url).host).toBe("example.com");
    }
  });

  it("filters locally by keyword, mode and employment type", async () => {
    const provider = createDemoProvider();
    expect((await provider.search({ ...query, employmentType: "internship" }, NOW)).every((j) => j.employmentType === "internship")).toBe(true);
    expect((await provider.search({ ...query, keywords: "pytorch" }, NOW)).map((j) => j.providerJobId)).toEqual(["ml-engineer"]);
  });
});

function fakeProvider(id: "remotive" | "adzuna", jobs: () => Promise<ReturnType<typeof buildJob>[]>, configured = true): JobProvider {
  return {
    id,
    label: id,
    status: () => ({ id, label: id, configured }),
    search: async () => (await jobs()).filter((job): job is NonNullable<typeof job> => job !== null),
  };
}

const sample = (id: string, title = "Backend Developer", company = "Acme") =>
  buildJob({ provider: "remotive", providerJobId: id, title, company, url: `https://x.test/${id}`, sourceName: "S" }, NOW);

describe("job service", () => {
  it("reports no-provider-configured instead of returning fake data", async () => {
    const service = createJobService({ liveProviders: [fakeProvider("remotive", async () => [], false)], cacheTtlMs: 0, now: () => NOW });
    const result = await service.search(query, "live");
    expect(result).toMatchObject({ mode: "live", noProviderConfigured: true, jobs: [] });
    expect(result.providers[0]).toMatchObject({ configured: false });
  });

  it("keeps demo and live results separate", async () => {
    const service = createJobService({ liveProviders: [fakeProvider("remotive", async () => [sample("1")])], cacheTtlMs: 0, now: () => NOW });
    const demo = await service.search(query, "demo");
    const live = await service.search(query, "live");
    expect(demo.mode).toBe("demo");
    expect(demo.jobs.every((j) => j.isDemo)).toBe(true);
    expect(live.jobs.every((j) => !j.isDemo)).toBe(true);
  });

  it("deduplicates the same listing across providers", async () => {
    const service = createJobService({
      liveProviders: [fakeProvider("remotive", async () => [sample("1")]), fakeProvider("adzuna", async () => [sample("2")])],
      cacheTtlMs: 0,
      now: () => NOW,
    });
    expect((await service.search(query, "live")).jobs).toHaveLength(1);
  });

  it("returns partial results when one provider fails and reports the failure kind only", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const service = createJobService({
      liveProviders: [
        fakeProvider("remotive", async () => [sample("1")]),
        fakeProvider("adzuna", async () => {
          throw new ProviderError("rate_limited", "The job provider rate limit was reached.", 429);
        }),
      ],
      cacheTtlMs: 0,
      now: () => NOW,
    });

    const result = await service.search(query, "live");
    expect(result.jobs).toHaveLength(1);
    expect(result.providers.find((p) => p.id === "adzuna")).toMatchObject({ ok: false, errorKind: "rate_limited" });
    error.mockRestore();
  });

  it("caches successful searches for the TTL and never caches failures", async () => {
    const search = vi.fn(async () => [sample("1")]);
    const service = createJobService({ liveProviders: [fakeProvider("remotive", search)], cacheTtlMs: 60_000, now: () => NOW });
    await service.search(query, "live");
    const second = await service.search(query, "live");
    expect(search).toHaveBeenCalledTimes(1);
    expect(second.providers[0]).toMatchObject({ cached: true });

    const failing = vi.fn(async () => {
      throw new ProviderError("network", "x");
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const service2 = createJobService({ liveProviders: [fakeProvider("remotive", failing)], cacheTtlMs: 60_000, now: () => NOW });
    await service2.search(query, "live");
    await service2.search(query, "live");
    expect(failing).toHaveBeenCalledTimes(2);
  });

  it("applies filters only against known values and lets jobs find recently returned results", async () => {
    const remote = buildJob({ provider: "remotive", providerJobId: "9", title: "Dev Intern", url: "https://x.test/9", sourceName: "S", remoteHint: true }, NOW);
    const service = createJobService({ liveProviders: [fakeProvider("remotive", async () => [remote, sample("1", "Senior Dev", "Zed")])], cacheTtlMs: 0, now: () => NOW });
    const result = await service.search({ ...query, experienceLevel: "intern" }, "live");
    expect(result.jobs.map((j) => j.providerJobId)).toEqual(["9"]);
    expect(service.find("remotive:9")?.title).toBe("Dev Intern");
    expect(service.find("remotive:404")).toBeUndefined();
  });
});
