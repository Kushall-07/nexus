/**
 * Recognising the wake phrase "Hey Nexus" in text, and the small chime that says "I'm listening".
 * Listening to the microphone itself lives in handsFree.ts.
 */

/* ───────────────────────────── matching the phrase ───────────────────────────── */

const GAP = "[\\s,.!?;:'\"-]*";
const GREETING = "(?:hey|hay|hei|hi|hello|ok|okay|yo)";
// Spellings that are clearly the name; these may stand alone at the start of a sentence.
const CLEAR_NAME = "(?:nexus|nexxus|nexis|nexas|nexes|nexsus)";
// Splits and sound-alikes that are only taken as the name after a greeting, so ordinary speech such as
// "next us" does not wake it.
const WEAK_NAME = `(?:nex${GAP}us|next${GAP}us|necks${GAP}us|neck${GAP}sus|nexus)`;
const FILLER = "(?:(?:um+|uh+|so|well|oh|and|okay|ok)[\\s,.!?]+)?";

const WITH_GREETING = new RegExp(`^${FILLER}${GREETING}${GAP}(?:there${GAP})?(?:${CLEAR_NAME}|${WEAK_NAME})(?![a-z])`, "i");
const BARE = new RegExp(`^${FILLER}${CLEAR_NAME}(?![a-z])`, "i");

export interface WakeMatch {
  matched: boolean;
  /** What was said after the wake phrase ("Hey Nexus, find me internships" gives "find me internships"). */
  command: string;
}

export function matchWakeWord(transcript: string): WakeMatch {
  const text = transcript.trim();
  const found = text.match(WITH_GREETING) ?? text.match(BARE);
  if (!found) return { matched: false, command: "" };

  const rest = text.slice(found[0].length).replace(/^[\s,.!?;:'"-]+/, "").replace(/\s+/g, " ").trim();
  // A trailing word or two that is not a real request ("thank you", "bye") is not a command.
  const command = rest.length >= 4 && /[a-z]/i.test(rest) ? rest : "";
  return { matched: true, command };
}

/* ───────────────────────────── a small "I'm listening" chime ───────────────────────────── */

export function playChime(): void {
  if (typeof AudioContext === "undefined") return;
  try {
    const context = new AudioContext();
    const start = context.currentTime;
    [880, 1318].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      const at = start + index * 0.11;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.16, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.18);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.2);
    });
    window.setTimeout(() => void context.close(), 600);
  } catch {
    /* a missing chime is not worth failing for */
  }
}
