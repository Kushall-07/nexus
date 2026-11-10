/**
 * Small spoken commands that Nexus understands on the spot, without asking the AI: stop, "that's all", what time
 * or day it is, and scrolling. They are instant and use none of the free AI quota.
 *
 * They are deliberately strict about length and wording. A long sentence that happens to contain "stop" is an
 * ordinary question, not a command.
 */

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const NAME = "(?:nexus |hey nexus |ok nexus |okay nexus )?";
const POLITE = "(?: (?:please|now|for now|nexus|thanks|thank you))*";

const STOP = new RegExp(`^${NAME}(?:stop|stop it|stop talking|stop speaking|be quiet|quiet|enough|shh+|pause|cancel|never ?mind|hold on|wait|that's enough|thats enough|shut up|silence)${POLITE}$`);
const END = new RegExp(
  `^${NAME}(?:(?:ok|okay|alright|all right|cool|great|perfect)[ ])?(?:that's all|thats all|that is all|that will be all|that'll be all|that's it|thats it|that is it|nothing else|i'm done|im done|we're done|were done|i'm good|im good|all good|go to sleep|stand by|standby|dismissed|you can go|goodbye|good bye|bye|bye bye|see you|see you later|talk to you later|thanks|thank you|thank you so much|thanks a lot|thanks nexus|thank you nexus)${POLITE}$`,
);

/** "Stop", "be quiet", "never mind": interrupt whatever Nexus is saying. */
export function matchStop(text: string): boolean {
  const said = normalize(text);
  return said.length > 0 && said.split(" ").length <= 6 && STOP.test(said);
}

/** "That's all", "goodbye", "thanks": finish the hands-free conversation. */
export function matchEndSession(text: string): boolean {
  const said = normalize(text);
  return said.length > 0 && said.split(" ").length <= 8 && END.test(said);
}

const TIME = /\b(?:what(?:'s| is)?(?: the)? time|what time is it|current time|tell me the time|time (?:right )?now)\b/;
const DATE = /\b(?:what(?:'s| is)?(?: the| today's)? date|and (?:the )?date|what day is (?:it|today)|today's date|what(?:'s| is) today|which day is it)\b/;

/** Answers "what time is it" and "what's the date" from the device's own clock. */
export function matchTimeDate(text: string, now: Date): string | null {
  const said = normalize(text);
  if (!said || said.split(" ").length > 12) return null;

  const wantsTime = TIME.test(said);
  const wantsDate = DATE.test(said);
  if (!wantsTime && !wantsDate) return null;

  const time = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const date = now.toLocaleDateString([], { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  if (wantsTime && wantsDate) return `It's ${time} on ${date}.`;
  return wantsTime ? `It's ${time}.` : `Today is ${date}.`;
}

export type ScrollCommand = "down" | "up" | "top" | "bottom";

const SCROLL = /^(?:nexus |hey nexus )?(?:please )?(?:scroll (down|up)(?: a (?:bit|little))?|page (down|up)|(?:scroll|go|jump|take me) (?:all the way )?(?:to )?(?:the )?(top|bottom)(?: of the page)?)(?: please)?$/;

export function matchScroll(text: string): ScrollCommand | null {
  const found = normalize(text).match(SCROLL);
  const direction = found?.[1] ?? found?.[2] ?? found?.[3];
  return direction === "down" || direction === "up" || direction === "top" || direction === "bottom" ? direction : null;
}
