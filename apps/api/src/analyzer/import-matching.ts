// Shared static-text matching helpers used by both the source-usage analyzer
// (counting references) and the framework detector (capturing a real,
// traceable source line as evidence). No code is ever executed or evaluated
// — this is plain regular-expression text matching against already-decoded
// file content.

export function countMatches(content: string, pattern: RegExp): number {
  const globalPattern = new RegExp(
    pattern.source,
    pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`,
  );
  const matches = content.match(globalPattern);
  return matches ? matches.length : 0;
}

// Returns the first source line that matches any of the given patterns, so
// evidence can cite the real text ("import React from 'react'") rather than
// a fabricated reference.
export function findFirstMatchedLine(content: string, patterns: RegExp[]): string | null {
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    for (const pattern of patterns) {
      if (pattern.test(line)) {
        return line.trim();
      }
    }
  }

  return null;
}
