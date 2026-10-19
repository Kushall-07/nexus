import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { App } from "./App";

describe("NEXUS web foundation", () => {
  it("renders the NEXUS application shell", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );

    expect(html).toContain("NEXUS");
    expect(html).toContain("GitHub Evidence Engine");
  });
});
