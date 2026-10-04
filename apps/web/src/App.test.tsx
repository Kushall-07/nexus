import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { App } from "./App";

describe("NEXUS web foundation", () => {
  it("renders the NEXUS application shell", () => {
    const html = renderToStaticMarkup(<App />);

    expect(html).toContain("NEXUS");
    expect(html).toContain("GitHub Evidence Engine");
  });
});