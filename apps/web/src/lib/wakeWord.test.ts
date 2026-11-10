import { describe, expect, it } from "vitest";
import { matchWakeWord } from "./wakeWord";

describe("matchWakeWord", () => {
  it("wakes on the plain phrase, however it is punctuated or cased", () => {
    for (const heard of ["Hey Nexus", "hey nexus.", "Hey, Nexus!", "HEY NEXUS", "Hi Nexus", "Okay Nexus.", "Hello there, Nexus"]) {
      expect(matchWakeWord(heard), heard).toEqual({ matched: true, command: "" });
    }
  });

  it("accepts the ways a speech model tends to mishear the name after a greeting", () => {
    for (const heard of ["Hey next us", "Hey, nex us.", "Hey necks us", "hay nexis", "Hey Nexas"]) {
      expect(matchWakeWord(heard).matched, heard).toBe(true);
    }
  });

  it("hands over what was asked in the same breath", () => {
    expect(matchWakeWord("Hey Nexus, find me remote backend internships.")).toEqual({ matched: true, command: "find me remote backend internships." });
    expect(matchWakeWord("Hey Nexus what skills am I missing?").command).toBe("what skills am I missing?");
    expect(matchWakeWord("Um, hey Nexus, which course should I take?").command).toBe("which course should I take?");
  });

  it("does not treat a goodbye or a stray word as a command", () => {
    expect(matchWakeWord("Hey Nexus, ok")).toEqual({ matched: true, command: "" });
    expect(matchWakeWord("Hey Nexus, hi").command).toBe("");
  });

  it("allows the name on its own at the start of a sentence", () => {
    expect(matchWakeWord("Nexus, are you there?")).toMatchObject({ matched: true, command: "are you there?" });
  });

  it("stays asleep for ordinary speech", () => {
    for (const heard of [
      "",
      "Thank you.",
      "The nexus of the problem is the database",
      "What happens next us",
      "I told him hey next week",
      "This is a nexus point",
      "hey there how are you",
      "Let's meet next, us two",
    ]) {
      expect(matchWakeWord(heard).matched, heard).toBe(false);
    }
  });
});
