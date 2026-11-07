/**
 * NEXUS theme system — dual theme: Gold Signal (dark) + Cream/Teal/Coral (light)
 *
 * Theme is stored in localStorage and applied via data-theme="light" on <html>.
 * Default is dark (no attribute needed — Gold Signal is the baseline).
 */

export type Theme = "dark" | "light";

const STORAGE_KEY = "nexus-theme";

/** Read the persisted theme preference, defaulting to dark. */
export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "light" ? "light" : "dark";
}

/** Apply theme to <html> immediately, suppressing the CSS transition during the apply. */
export function applyTheme(theme: Theme): void {
  const html = document.documentElement;

  // Suppress the CSS transition while changing
  html.classList.add("theme-no-transition");

  if (theme === "light") {
    html.setAttribute("data-theme", "light");
  } else {
    html.removeAttribute("data-theme");
  }

  // Re-enable transitions on the next paint
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      html.classList.remove("theme-no-transition");
    });
  });
}

/** Persist and apply a new theme selection. */
export function setTheme(theme: Theme): void {
  localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
}

/** Toggle between dark and light. */
export function toggleTheme(): Theme {
  const current = getStoredTheme();
  const next: Theme = current === "dark" ? "light" : "dark";
  setTheme(next);
  return next;
}

/** Initialize: apply the persisted theme on page load without transition. */
export function initTheme(): void {
  applyTheme(getStoredTheme());
}
