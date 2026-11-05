// Full-page navigation (OAuth redirects). Isolated so tests can observe it.
export function redirectTo(url: string): void {
  window.location.assign(url);
}
