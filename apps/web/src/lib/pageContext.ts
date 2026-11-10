/**
 * Lets Nexus see the page the person is on, and press things on it for them.
 *
 * `capturePage` reads the visible text of the page and lists what can be pressed (buttons, tabs, links), giving each
 * a number. The AI answers with a number, and `clickPageElement` presses that exact element.
 *
 * Safety: sign-in, sign-out, account switching and anything that deletes or removes are never offered, and links that
 * leave NEXUS are left out too. Those stay with the person. Nothing here reads form fields or passwords.
 */

export interface PageElement {
  id: number;
  role: string;
  name: string;
  section?: string;
}

export interface PageSnapshot {
  path: string;
  title: string;
  text: string;
  elements: PageElement[];
}

/** Things Nexus never presses: signing in or out, switching accounts, and deleting or removing anything. */
const NEVER_PRESS =
  /\b(sign ?(?:in|out|up)|log ?(?:in|out)|logout|login|switch account|switch user|disconnect|unlink|delete|remove|erase|clear (?:all|history|data)|discard|reset|deactivate|close account|revoke|github login|continue with github)\b/i;

const PRESSABLE = 'a[href], button, [role="button"], [role="tab"], [role="link"], [role="menuitem"], summary, input[type="checkbox"], input[type="radio"]';

/** Elements marked with this attribute (Nexus's own controls) are invisible to the page reader. */
export const IGNORE_ATTRIBUTE = "data-nexus-ignore";

const registry = new Map<number, HTMLElement>();
let snapshotCounter = 0;

function isVisible(element: Element): boolean {
  const box = element.getBoundingClientRect();
  if (box.width === 0 || box.height === 0) return false;
  const style = getComputedStyle(element);
  return style.visibility !== "hidden" && style.display !== "none";
}

function clean(text: string | null | undefined, max: number): string {
  return (text ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function nameOf(element: HTMLElement): string {
  const label = element.getAttribute("aria-label");
  if (label) return clean(label, 70);
  const labelled = element.getAttribute("aria-labelledby");
  if (labelled) {
    const text = labelled
      .split(" ")
      .map((id) => document.getElementById(id)?.textContent ?? "")
      .join(" ");
    if (clean(text, 70)) return clean(text, 70);
  }
  const own = clean(element.textContent, 70);
  return own || clean(element.getAttribute("title"), 70);
}

function roleOf(element: HTMLElement): string {
  const explicit = element.getAttribute("role");
  if (explicit) return explicit;
  const tag = element.tagName.toLowerCase();
  if (tag === "a") return "link";
  if (tag === "summary") return "toggle";
  if (tag === "input") return (element as HTMLInputElement).type;
  return "button";
}

function sectionOf(element: HTMLElement): string | undefined {
  const container = element.closest("section, [role='region'], aside, article, form");
  if (!container) return undefined;
  const labelled = container.getAttribute("aria-labelledby");
  const heading = labelled ? document.getElementById(labelled)?.textContent : container.querySelector("h1, h2, h3, h4")?.textContent;
  const text = clean(heading, 50);
  return text || undefined;
}

function isExternalLink(element: HTMLElement): boolean {
  if (element.tagName.toLowerCase() !== "a") return false;
  const anchor = element as HTMLAnchorElement;
  if (anchor.target === "_blank") return true;
  try {
    return new URL(anchor.href, window.location.href).origin !== window.location.origin;
  } catch {
    return false;
  }
}

function readText(root: Element, max: number): string {
  const parts: string[] = [];
  let length = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || !node.textContent?.trim()) return NodeFilter.FILTER_REJECT;
      if (/^(SCRIPT|STYLE|NOSCRIPT|SVG)$/i.test(parent.tagName)) return NodeFilter.FILTER_REJECT;
      if (parent.closest(`[${IGNORE_ATTRIBUTE}], [aria-hidden="true"], .sr-only`)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  for (let node = walker.nextNode(); node && length < max; node = walker.nextNode()) {
    const text = clean(node.textContent, 300);
    if (!text) continue;
    parts.push(text);
    length += text.length + 1;
  }
  return parts.join(" ").slice(0, max);
}

/** A reading of the current page: its words, and what on it can be pressed. */
export function capturePage(maxText = 3500, maxElements = 50): PageSnapshot {
  const root = document.querySelector("main") ?? document.body;
  registry.clear();
  snapshotCounter += 1;

  const candidates: Array<{ element: HTMLElement; name: string; inView: boolean }> = [];
  for (const node of Array.from(root.querySelectorAll<HTMLElement>(PRESSABLE))) {
    if (node.closest(`[${IGNORE_ATTRIBUTE}]`) || node.hasAttribute("disabled") || node.getAttribute("aria-disabled") === "true") continue;
    if (!isVisible(node)) continue;
    const name = nameOf(node);
    if (!name || NEVER_PRESS.test(name) || isExternalLink(node)) continue;
    const box = node.getBoundingClientRect();
    candidates.push({ element: node, name, inView: box.bottom > 0 && box.top < window.innerHeight });
  }
  // What is on screen comes first, so a long page does not push it out of the list.
  candidates.sort((a, b) => Number(b.inView) - Number(a.inView));

  const elements: PageElement[] = [];
  for (const candidate of candidates.slice(0, maxElements)) {
    const id = elements.length + 1;
    registry.set(id, candidate.element);
    elements.push({ id, role: roleOf(candidate.element), name: candidate.name, section: sectionOf(candidate.element) });
  }

  return {
    path: window.location.pathname,
    title: clean(document.querySelector("h1")?.textContent ?? document.title, 100),
    text: readText(root, maxText),
    elements,
  };
}

/** Presses the element that `capturePage` numbered. Returns what happened, so Nexus can say so. */
export function clickPageElement(id: number): { ok: boolean; label?: string; reason?: string } {
  const element = registry.get(id);
  if (!element || !element.isConnected) return { ok: false, reason: "That is no longer on the page." };
  const label = nameOf(element);
  if (NEVER_PRESS.test(label)) return { ok: false, label, reason: "That one is for you to press yourself." };
  element.scrollIntoView({ block: "center", behavior: "smooth" });
  element.click();
  return { ok: true, label };
}

/** Questions that are about the page in front of the person, so reading it is worth the extra tokens. */
export function needsPage(message: string): boolean {
  return /\b(page|screen|this|here|these|those|summari[sz]e|summary|click|press|tap|select|choose|open the|read|what(?:'s| is) on|show me what|explain)\b/i.test(message);
}

/** Moves the page the way a person would with the scroll wheel. */
export function scrollPage(direction: "down" | "up" | "top" | "bottom"): void {
  const step = Math.round(window.innerHeight * 0.8);
  if (direction === "top") window.scrollTo({ top: 0, behavior: "smooth" });
  else if (direction === "bottom") window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
  else window.scrollBy({ top: direction === "down" ? step : -step, behavior: "smooth" });
}
