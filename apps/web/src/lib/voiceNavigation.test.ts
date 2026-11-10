import { describe, expect, it } from "vitest";
import { matchNavigation } from "./voiceNavigation";

const target = (text: string) => {
  const match = matchNavigation(text);
  return match && !match.back ? match.to : match ? "back" : null;
};

describe("matchNavigation", () => {
  it("opens the page that was named", () => {
    expect(target("Go to GitHub evidence")).toBe("/repositories");
    expect(target("can you go to role and gap analysis?")).toBe("/development");
    expect(target("Open Role & Gap Analysis")).toBe("/development");
    expect(target("Take me to the overview")).toBe("/dashboard");
    expect(target("please open job discovery")).toBe("/opportunities");
    expect(target("Go to saved opportunities.")).toBe("/saved");
    expect(target("navigate to skill intelligence")).toBe("/skills");
    expect(target("open my applications")).toBe("/applications");
    expect(target("Hey Nexus, go to settings")).toBe("/settings");
    expect(target("go to the career copilot page")).toBe("/copilot");
    expect(target("I want to go to my career profile")).toBe("/resume");
  });

  it("accepts a gentler verb for a page's proper name", () => {
    expect(target("show me the overview")).toBe("/dashboard");
    expect(target("pull up GitHub evidence")).toBe("/repositories");
    expect(target("show me role and gap analysis")).toBe("/development");
  });

  it("goes back", () => {
    expect(target("go back")).toBe("back");
    expect(target("take me back please")).toBe("back");
  });

  it("leaves real questions and job searches to the AI", () => {
    for (const said of [
      "Show me remote internships",
      "show me jobs",
      "find me backend jobs",
      "What are the most important skills I am missing?",
      "go to the gym and tell me about my skills",
      "Which courses should I take next?",
      "open a conversation about interviews",
      "tell me about my GitHub",
      "I want to transition from AI to full stack",
      "",
    ]) {
      expect(matchNavigation(said), said).toBeNull();
    }
  });
});
