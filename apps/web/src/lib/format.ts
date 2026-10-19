// Presentation-only formatting. Nothing here recalculates a score.

export function formatScore(value: number): string {
  return value.toFixed(1);
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

// Signed value with an explicit sign so direction is never ambiguous.
export function formatSigned(value: number): string {
  const text = Math.abs(value).toFixed(1);

  if (value > 0) return `+${text}`;
  if (value < 0) return `−${text}`;
  return text;
}

export function formatFactor(value: number): string {
  return Number(value.toFixed(3)).toString();
}

const SIGNAL_LABELS: Record<string, string> = {
  dependency: "Dependencies",
  framework: "Frameworks",
  sourceUsage: "Source usage",
  projectStructure: "Project structure",
  testing: "Testing",
  documentation: "Documentation",
  activity: "Activity",
};

export function signalLabel(signal: string): string {
  return SIGNAL_LABELS[signal] ?? signal;
}
