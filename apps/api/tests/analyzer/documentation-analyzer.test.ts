import { describe, expect, it } from "vitest";
import { analyzeDocumentation } from "../../src/analyzer/documentation-analyzer.js";
import { loadTechnologyConfig } from "../../src/analyzer/technology-config.js";

const config = loadTechnologyConfig();

describe("analyzeDocumentation", () => {
  it("readmePresent=1, skillMention=1 => documentation=1", () => {
    const result = analyzeDocumentation(
      { path: "README.md", size: 100, content: "This project uses React extensively." },
      ["react"],
      config,
    );
    expect(result.perTechnology[0]).toMatchObject({ skillMention: true, documentationSignal: 1 });
  });

  it("readmePresent=1, skillMention=0 => documentation=0.5", () => {
    const result = analyzeDocumentation(
      { path: "README.md", size: 100, content: "This project has no mentions of anything relevant." },
      ["react"],
      config,
    );
    expect(result.perTechnology[0]).toMatchObject({ skillMention: false, documentationSignal: 0.5 });
  });

  it("readmePresent=0, skillMention=0 => documentation=0", () => {
    const result = analyzeDocumentation({ path: null, size: null, content: null }, ["react"], config);
    expect(result.readmePresent).toBe(false);
    expect(result.perTechnology[0]).toMatchObject({ skillMention: false, documentationSignal: 0 });
  });

  it("readmePresent=0 but content somehow available => skillMention can still be 0 (no readme => documentation=0.5 ceiling)", () => {
    // Defensive case: no readme path, but mention check still only credits
    // 0.5 max since readmePresence is the other half of the formula.
    const result = analyzeDocumentation(
      { path: null, size: null, content: "mentions react anyway" },
      ["react"],
      config,
    );
    expect(result.perTechnology[0].documentationSignal).toBe(0.5);
  });

  it("detects README presence and path", () => {
    const result = analyzeDocumentation({ path: "README.md", size: 200, content: "hello" }, [], config);
    expect(result.readmePresent).toBe(true);
    expect(result.readmePath).toBe("README.md");
    expect(result.readmeSize).toBe(200);
  });

  it("is case-insensitive when matching technology mentions", () => {
    const result = analyzeDocumentation(
      { path: "README.md", size: 10, content: "Built with REACT and Express." },
      ["react", "express"],
      config,
    );

    const react = result.perTechnology.find((t) => t.technology === "react");
    const express = result.perTechnology.find((t) => t.technology === "express");
    expect(react?.skillMention).toBe(true);
    expect(express?.skillMention).toBe(true);
  });
});
