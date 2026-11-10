import { describe, expect, it } from "vitest";
import { cleanTranscript } from "./localRecognizer";
import { cleanForSpeech, describeNetworkError, splitForSpeech } from "./speech";

describe("cleanTranscript", () => {
  it("drops Whisper's sound labels and keeps the words", () => {
    expect(cleanTranscript(" [BLANK_AUDIO] ")).toBe("");
    expect(cleanTranscript("(music) Show me remote internships. [noise]")).toBe("Show me remote internships.");
    expect(cleanTranscript("Find jobs in Berlin (laughs)")).toBe("Find jobs in Berlin");
  });
});

describe("describeNetworkError", () => {
  it("names the likely cause", () => {
    expect(describeNetworkError(false, false)).toContain("offline");
    expect(describeNetworkError(true, true)).toContain("Brave");
    expect(describeNetworkError(true, false)).toContain("VPN");
  });
});

describe("cleanForSpeech", () => {
  it("spells out scores, drops markdown and replaces links", () => {
    expect(cleanForSpeech("**Score** 78/100 — see https://example.com/a now")).toBe("Score 78 out of 100 — see a link now");
    expect(cleanForSpeech("Rate 36.5 / 100")).toBe("Rate 36.5 out of 100");
  });
});

describe("splitForSpeech", () => {
  it("returns nothing for empty text", () => {
    expect(splitForSpeech("   ")).toEqual([]);
  });

  it("keeps short text as one chunk", () => {
    expect(splitForSpeech("Here are your jobs. Pick one.")).toEqual(["Here are your jobs. Pick one."]);
  });

  it("splits long text at sentence boundaries without losing words", () => {
    const text = Array.from({ length: 12 }, (_, i) => `This is sentence number ${i + 1} of the reply.`).join(" ");
    const chunks = splitForSpeech(text, 100);

    expect(chunks.length).toBeGreaterThan(3);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(100);
    expect(chunks.join(" ")).toBe(text);
  });

  it("breaks a single very long sentence at spaces", () => {
    const text = "word ".repeat(80).trim();
    const chunks = splitForSpeech(text, 60);

    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(60);
    expect(chunks.join(" ")).toBe(text);
  });
});
