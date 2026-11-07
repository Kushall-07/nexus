import { configure } from "@testing-library/react";

// Whole-App renders are slow under jsdom (especially on synced/Windows disks);
// the default 1s findBy*/waitFor budget made correct tests flaky.
configure({ asyncUtilTimeout: 8000 });

// jsdom does not implement window.matchMedia or IntersectionObserver — provide
// minimal stubs so LandingPage components (hero, scroll-reveal) don't throw.
if (typeof window !== "undefined") {
  if (typeof window.matchMedia !== "function") {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }

  if (typeof window.IntersectionObserver === "undefined") {
    Object.defineProperty(window, "IntersectionObserver", {
      writable: true,
      value: class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    });
  }
}
