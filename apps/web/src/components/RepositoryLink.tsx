import type { RepositoryReference } from "../api/types";

function isGithubUrl(url: string): boolean {
  return url.startsWith("https://github.com/");
}

// The backend supplies the repository URL; it is linked only when it points at
// github.com so a malformed stored value can never become a script link.
export function RepositoryLink({ repository }: { repository: RepositoryReference }) {
  const label = repository.fullName ?? `Repository ${repository.id.slice(-6)}`;

  if (repository.url && isGithubUrl(repository.url)) {
    return (
      <a
        href={repository.url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-indigo-800 underline focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700"
      >
        {label}
        <span className="sr-only"> (opens on GitHub)</span>
      </a>
    );
  }

  return <span className="font-medium text-slate-900">{label}</span>;
}
