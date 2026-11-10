/**
 * Renders a chat reply with light formatting: paragraphs, bullet and numbered lists, **bold**,
 * `code` and https links. It builds React elements only (never raw HTML), so a reply can never
 * inject markup or scripts.
 */
import type { ReactNode } from "react";

const INLINE = /(\*\*[^*\n]+\*\*|`[^`\n]+`|\[[^\]\n]+\]\(https?:\/\/[^\s)]+\))/g;

function inline(text: string, keyPrefix: string): ReactNode[] {
  return text.split(INLINE).map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) return <strong key={key}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code key={key} className="rounded bg-slate-200/70 px-1 py-0.5 font-mono text-[0.85em]">
          {part.slice(1, -1)}
        </code>
      );
    }
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
    if (link) {
      return (
        <a key={key} href={link[2]} target="_blank" rel="noopener noreferrer" className="font-medium text-indigo-800 underline">
          {link[1]}
        </a>
      );
    }
    return part;
  });
}

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;

export function ChatText({ text }: { text: string }) {
  const blocks = text.trim().split(/\n{2,}/);

  return (
    <div className="space-y-2.5">
      {blocks.map((block, blockIndex) => {
        const lines = block.split("\n").filter((line) => line.trim() !== "");
        const key = `b${blockIndex}`;

        if (lines.length > 0 && lines.every((line) => BULLET.test(line))) {
          return (
            <ul key={key} className="list-disc space-y-1 pl-5">
              {lines.map((line, i) => (
                <li key={i}>{inline(line.match(BULLET)![1]!, `${key}-${i}`)}</li>
              ))}
            </ul>
          );
        }
        if (lines.length > 0 && lines.every((line) => NUMBERED.test(line))) {
          return (
            <ol key={key} className="list-decimal space-y-1 pl-5">
              {lines.map((line, i) => (
                <li key={i}>{inline(line.match(NUMBERED)![1]!, `${key}-${i}`)}</li>
              ))}
            </ol>
          );
        }
        return (
          <p key={key}>
            {lines.map((line, i) => (
              <span key={i}>
                {i > 0 ? <br /> : null}
                {inline(line, `${key}-${i}`)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
