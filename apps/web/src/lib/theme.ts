/**
 * NEXUS theme — light only.
 *
 * The application is permanently light-themed. Dark mode is not supported.
 * The `data-theme="light"` attribute is set directly in index.html so the
 * correct theme is active before any JavaScript executes.
 *
 * This module retains a minimal surface for compatibility in case other
 * modules import from it, but all dark-mode functionality has been removed.
 */

export type Theme = "light";

/** Always returns "light". */
export function getStoredTheme(): Theme {
  return "light";
}

/** No-op — the theme is always light. */
export function applyTheme(_theme: Theme): void {
  // The HTML element permanently carries data-theme="light" (set in index.html).
  // Nothing to do here.
}

/** No-op — there is no theme to set. */
export function setTheme(_theme: Theme): void {
  // Clear any legacy dark-theme preference that may remain in localStorage.
  if (typeof window !== "undefined") {
    localStorage.removeItem("nexus-theme");
  }
}

/** No-op — there is nothing to initialize. */
export function initTheme(): void {
  // Clear any legacy dark-theme preference that may remain in localStorage.
  if (typeof window !== "undefined") {
    localStorage.removeItem("nexus-theme");
  }
}
