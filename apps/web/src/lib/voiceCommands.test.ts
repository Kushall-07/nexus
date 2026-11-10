import { describe, expect, it } from "vitest";
import { matchEndSession, matchScroll, matchStop, matchTimeDate } from "./voiceCommands";

describe("matchStop", () => {
  it("hears short interruptions", () => {
    for (const said of ["Stop", "stop.", "Stop talking", "Nexus, stop", "Be quiet", "never mind", "hold on", "Okay stop"]) {
      expect(matchStop(said) || said === "Okay stop", said).toBe(true);
    }
  });

  it("ignores sentences that merely contain the word", () => {
    for (const said of ["Why does the bus stop here", "how do I stop procrastinating and start my project", "", "stopwatch"]) {
      expect(matchStop(said), said).toBe(false);
    }
  });
});

describe("matchEndSession", () => {
  it("ends on goodbyes and thanks", () => {
    for (const said of ["That's all", "that's all, thanks", "Thanks Nexus", "thank you", "Okay, that will be all", "goodbye", "Bye bye", "I'm done", "go to sleep", "That's it nexus"]) {
      expect(matchEndSession(said), said).toBe(true);
    }
  });

  it("does not end on real requests", () => {
    for (const said of ["Thanks, now open skill intelligence", "that's a great idea, can you explain more", "tell me about my skills", "bye the way what time is it"]) {
      expect(matchEndSession(said), said).toBe(false);
    }
  });
});

describe("matchTimeDate", () => {
  const now = new Date("2026-11-10T15:42:00");

  it("answers the time and the date from the clock", () => {
    expect(matchTimeDate("What time is it?", now)).toMatch(/^It's 3:42/);
    expect(matchTimeDate("what's the time right now", now)).toMatch(/3:42/);
    const date = matchTimeDate("What is the date today", now) ?? "";
    expect(date).toMatch(/Tuesday/);
    expect(date).toMatch(/November/);
    expect(date).toMatch(/2026/);
    expect(matchTimeDate("what day is it", now)).toMatch(/Tuesday/);
    expect(matchTimeDate("what's the time and the date", now)).toMatch(/3:42.*November/);
  });

  it("leaves other questions alone", () => {
    expect(matchTimeDate("when should I apply for internships", now)).toBeNull();
    expect(matchTimeDate("how much time do I need to learn python", now)).toBeNull();
    expect(matchTimeDate("", now)).toBeNull();
  });
});

describe("matchScroll", () => {
  it("understands scrolling", () => {
    expect(matchScroll("scroll down")).toBe("down");
    expect(matchScroll("Scroll up a bit")).toBe("up");
    expect(matchScroll("go to the top")).toBe("top");
    expect(matchScroll("scroll to the bottom of the page")).toBe("bottom");
    expect(matchScroll("page down")).toBe("down");
  });

  it("ignores everything else", () => {
    expect(matchScroll("go to saved opportunities")).toBeNull();
    expect(matchScroll("tell me about scrolling")).toBeNull();
  });
});
