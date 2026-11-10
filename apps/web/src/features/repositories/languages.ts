/**
 * Language mix across a set of repositories.
 *
 * The share of a language is its bytes divided by the total bytes of ALL languages
 * across the counted repositories — i.e. "how much of this code is Python" — so a large
 * repository weighs more than a small one. (Averaging each repository's own percentages
 * would weigh a 2 KB script the same as a 2 MB application, which is wrong.)
 *
 * Bytes come from GitHub's languages endpoint, stored per repository by the API. A
 * repository only has them once it has been analyzed, so repositories without byte data
 * are left out and reported in `repositoriesWithoutData` rather than guessed.
 */

export interface LanguageShare {
  name: string;
  /** 0–100, share of the counted bytes (unrounded). */
  pct: number;
  bytes: number;
}

export interface LanguageMix {
  /** Largest first. The long tail is folded into a single "Other" entry. */
  shares: LanguageShare[];
  totalBytes: number;
  repositoriesCounted: number;
  repositoriesWithoutData: number;
}

interface HasLanguageBytes {
  languages?: Record<string, number> | null;
}

const MAX_NAMED = 6;
/** Hide a folded tail smaller than this share; it cannot be seen or read. */
const MIN_OTHER_PCT = 0.5;

export function aggregateLanguages<T extends HasLanguageBytes>(repositories: readonly T[], maxNamed = MAX_NAMED): LanguageMix {
  const bytesByLanguage = new Map<string, number>();
  let counted = 0;
  let withoutData = 0;

  for (const repository of repositories) {
    const entries = repository.languages ? Object.entries(repository.languages) : [];
    let repositoryBytes = 0;
    for (const [name, bytes] of entries) {
      if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes <= 0) continue;
      bytesByLanguage.set(name, (bytesByLanguage.get(name) ?? 0) + bytes);
      repositoryBytes += bytes;
    }
    if (repositoryBytes > 0) counted += 1;
    else withoutData += 1;
  }

  let totalBytes = 0;
  for (const bytes of bytesByLanguage.values()) totalBytes += bytes;
  if (totalBytes === 0) {
    return { shares: [], totalBytes: 0, repositoriesCounted: 0, repositoriesWithoutData: withoutData };
  }

  const sorted = Array.from(bytesByLanguage, ([name, bytes]) => ({ name, bytes, pct: (bytes / totalBytes) * 100 }))
    // Ties broken by name so the order never flickers between renders.
    .sort((a, b) => b.bytes - a.bytes || a.name.localeCompare(b.name));

  const head = sorted.slice(0, maxNamed);
  const tail = sorted.slice(maxNamed);
  let tailBytes = 0;
  for (const item of tail) tailBytes += item.bytes;
  const tailPct = (tailBytes / totalBytes) * 100;

  const shares = tailPct >= MIN_OTHER_PCT ? [...head, { name: "Other", bytes: tailBytes, pct: tailPct }] : head;
  return { shares, totalBytes, repositoriesCounted: counted, repositoriesWithoutData: withoutData };
}
