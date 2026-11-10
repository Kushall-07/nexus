// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { capturePage, clickPageElement, needsPage } from "./pageContext";

beforeEach(() => {
  // jsdom has no layout, so give every element a size to count as visible, and a scroll that does nothing.
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ x: 0, y: 0, top: 10, left: 0, bottom: 40, right: 100, width: 100, height: 30, toJSON: () => ({}) } as DOMRect);
  Element.prototype.scrollIntoView = vi.fn();
  document.body.innerHTML = `
    <main>
      <h1>Skill Intelligence</h1>
      <section aria-labelledby="programming">
        <h2 id="programming">Programming</h2>
        <a href="/skills/python">Python 57</a>
        <a href="/skills/javascript">JavaScript 19</a>
        <span class="sr-only">screen reader only</span>
      </section>
      <section aria-labelledby="databases">
        <h2 id="databases">Databases</h2>
        <button type="button">MongoDB 57</button>
      </section>
      <button type="button">Delete account</button>
      <button type="button">Sign out</button>
      <a href="https://github.com/octocat/app">Open on GitHub</a>
      <button type="button" disabled>Not available</button>
      <div data-nexus-ignore><button type="button">Talk to Nexus</button><p>Nexus is listening</p></div>
    </main>`;
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("capturePage", () => {
  it("reads the page text and lists what can be pressed, with the section it is in", () => {
    const page = capturePage();

    expect(page.title).toBe("Skill Intelligence");
    expect(page.text).toContain("Programming");
    expect(page.text).toContain("Python 57");
    expect(page.text).not.toContain("screen reader only");
    expect(page.text).not.toContain("Nexus is listening");
    expect(page.elements.map((e) => [e.name, e.section])).toEqual([
      ["Python 57", "Programming"],
      ["JavaScript 19", "Programming"],
      ["MongoDB 57", "Databases"],
    ]);
    expect(page.elements.map((e) => e.id)).toEqual([1, 2, 3]);
  });

  it("never offers sign-in, sign-out, deleting, links that leave NEXUS, disabled buttons or its own controls", () => {
    const names = capturePage().elements.map((e) => e.name);
    for (const hidden of ["Delete account", "Sign out", "Open on GitHub", "Not available", "Talk to Nexus"]) expect(names).not.toContain(hidden);
  });
});

describe("clickPageElement", () => {
  it("presses exactly the element that was numbered", () => {
    const clicked: string[] = [];
    document.querySelectorAll("a, button").forEach((element) => element.addEventListener("click", (event) => { event.preventDefault(); clicked.push(element.textContent ?? ""); }));
    const page = capturePage();
    const target = page.elements.find((e) => e.name === "JavaScript 19")!;

    expect(clickPageElement(target.id)).toEqual({ ok: true, label: "JavaScript 19" });
    expect(clicked).toEqual(["JavaScript 19"]);
  });

  it("says so when the element is gone or was never offered", () => {
    const page = capturePage();
    document.body.innerHTML = "";

    expect(clickPageElement(page.elements[0]!.id)).toMatchObject({ ok: false });
    expect(clickPageElement(99)).toMatchObject({ ok: false });
  });
});

describe("needsPage", () => {
  it("reads the page only when the question is about it", () => {
    for (const asked of ["summarize this page", "click on Python in the programming section", "what's on the screen", "explain this", "open the first tab"]) {
      expect(needsPage(asked), asked).toBe(true);
    }
    for (const asked of ["what time is it", "find me backend internships", "tell me a joke", "I'm feeling stuck"]) {
      expect(needsPage(asked), asked).toBe(false);
    }
  });
});
