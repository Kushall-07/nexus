import { describe, expect, it, vi } from "vitest";
import { buildJob, createAdzunaProvider, createJSearchProvider, createRemotiveProvider } from "../../src/career/jobs/adapters.js";
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
    expect(jobs[0]!.salary).toEqual({ min: 30000, max: 40000, period: "year" });
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
