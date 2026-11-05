import { findSkillIdsInText } from "../skill-vocabulary.js";
import { resumeProfileSchema, type ResumeProfile } from "../types.js";

// Deterministic, best-effort extraction. It records only what the text
// contains: no degree, date, employer or proficiency is ever inferred. The
// result is a DRAFT the user must review before anything is saved.

const SECTION_ALIASES: Record<string, string[]> = {
  education: ["education", "academics", "academic background", "qualifications"],
  experience: ["experience", "work experience", "professional experience", "employment", "internships", "internship experience"],
  projects: ["projects", "personal projects", "academic projects", "selected projects"],
  skills: ["skills", "technical skills", "core skills", "technologies", "tech stack"],
  certifications: ["certifications", "certificates", "licenses", "licenses & certifications"],
};

function headingOf(line: string): string | null {
  const normalized = line.trim().toLowerCase().replace(/[:\-–—_*#]+$/g, "").trim();
  if (normalized.length === 0 || normalized.length > 40) return null;
  for (const [section, names] of Object.entries(SECTION_ALIASES)) {
    if (names.includes(normalized)) return section;
  }
  return null;
}

function splitSections(text: string): { header: string[]; sections: Record<string, string[]> } {
  const header: string[] = [];
  const sections: Record<string, string[]> = {};
  let current: string | null = null;

  for (const line of text.split("\n")) {
    const heading = headingOf(line);
    if (heading) {
      current = heading;
      sections[heading] ??= [];
    } else if (current) {
      sections[current]!.push(line);
    } else {
      header.push(line);
    }
  }
  return { header, sections };
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE = /(?<!\d)(\+?\d[\d\s().-]{8,16}\d)(?!\d)/;
const URL_PATTERN = /\bhttps?:\/\/[^\s)>\]]+|\b(?:www\.|github\.com\/|linkedin\.com\/in\/)[^\s)>\]]+/gi;
const DEGREE = /\b(b\.?\s?tech|m\.?\s?tech|b\.?\s?e\b|b\.?\s?sc|m\.?\s?sc|b\.?\s?s\b|m\.?\s?s\b|bca|mca|ph\.?d|bachelor[^,\n]*|master[^,\n]*|diploma[^,\n]*|associate degree)\b/i;
const YEAR = /\b(19[5-9]\d|20\d{2})\b/g;
const DATE_RANGE = /((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{4}|\d{1,2}\/\d{4}|\b(?:19|20)\d{2}\b)\s*(?:-|–|—|to)\s*((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{4}|\d{1,2}\/\d{4}|\b(?:19|20)\d{2}\b|present|current|ongoing)/i;

const clean = (value: string) => value.replace(/^[\s•·▪●○◦*\-–—]+/, "").trim();

function blocks(lines: string[]): string[][] {
  const out: string[][] = [];
  let current: string[] = [];
  for (const raw of lines) {
    if (raw.trim() === "") {
      if (current.length) out.push(current);
      current = [];
    } else {
      current.push(raw);
    }
  }
  if (current.length) out.push(current);
  return out;
}

function extractSkillTokens(lines: string[]): string[] {
  const tokens: string[] = [];
  for (const line of lines) {
    // "Languages: Python, Go" -> drop the category label
    const body = line.includes(":") ? line.slice(line.indexOf(":") + 1) : line;
    for (const token of body.split(/[,;|•·●▪]/)) {
      const value = clean(token);
      if (value.length >= 1 && value.length <= 40 && /[A-Za-z]/.test(value)) tokens.push(value);
    }
  }
  return tokens;
}

export function extractResumeProfile(text: string): ResumeProfile {
  const { header, sections } = splitSections(text);
  const headerText = header.join("\n");

  const links = [...new Set([...text.matchAll(URL_PATTERN)].map((match) => match[0]!.replace(/[.,;]+$/, "")))].slice(0, 10);
  const email = text.match(EMAIL)?.[0];
  const phone = headerText.match(PHONE)?.[1]?.trim();

  // The name is only taken when the first non-empty line looks like one.
  const firstLine = header.find((line) => line.trim() !== "")?.trim();
  const name =
    firstLine && /^[A-Za-z][A-Za-z.'’-]*(?:\s+[A-Za-z][A-Za-z.'’-]*){1,3}$/.test(firstLine) && !headingOf(firstLine) ? firstLine : undefined;

  const education = blocks(sections.education ?? [])
    .flatMap((block) => (block.length > 1 && !block.some((line) => DEGREE.test(line)) ? [block] : block.map((line) => [line])))
    .map((block) => block.join(" "))
    .filter((line) => DEGREE.test(line))
    .slice(0, 10)
    .map((line) => {
      const years = [...line.matchAll(YEAR)].map((match) => Number(match[1]));
      return {
        degree: clean(line.match(DEGREE)?.[0] ?? "") || undefined,
        // The full line is kept so the reviewer sees exactly what was read; structure is not guessed.
        institution: clean(line.replace(YEAR, "").replace(DEGREE, "")).slice(0, 200) || undefined,
        endYear: years.length ? Math.max(...years) : undefined,
      };
    });

  const experience = blocks(sections.experience ?? []).slice(0, 20).map((block) => {
    const range = block.join(" ").match(DATE_RANGE);
    const headline = clean(block[0]!).replace(DATE_RANGE, "").trim();
    const summary = block.slice(1).map(clean).join(" ").slice(0, 1000);
    return {
      title: headline.slice(0, 200) || undefined,
      startDate: range?.[1],
      endDate: range?.[2],
      summary: summary || undefined,
      isInternship: /\bintern(ship)?\b/i.test(block.join(" ")),
    };
  });

  const projects = blocks(sections.projects ?? []).slice(0, 20).map((block) => ({
    name: clean(block[0]!).slice(0, 200),
    description: block.slice(1).map(clean).join(" ").slice(0, 1000) || undefined,
  }));

  // Skills: tokens from the Skills section, plus vocabulary skills that the text actually mentions.
  const skillNames = new Map<string, string>();
  for (const token of extractSkillTokens(sections.skills ?? [])) skillNames.set(token.toLowerCase(), token);
  for (const id of findSkillIdsInText(text)) if (![...skillNames.keys()].includes(id)) skillNames.set(id, id);

  const certifications = (sections.certifications ?? []).map(clean).filter((line) => line.length > 2).slice(0, 20);

  return resumeProfileSchema.parse({
    name,
    email,
    phone,
    links,
    education,
    experience: experience.filter((item) => item.title || item.summary),
    projects: projects.filter((item) => item.name),
    skills: [...skillNames.values()].slice(0, 80).map((value) => ({ name: value, source: "resume" })),
    certifications,
  });
}
