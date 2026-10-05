import { basename } from "./path-utils.js";
import type { DockerObservation, RepositoryTree } from "./types.js";

function isDockerfile(name: string): boolean {
  const lower = name.toLowerCase();
  return lower === "dockerfile" || lower.startsWith("dockerfile.");
}

function isComposeFile(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower === "docker-compose.yml" ||
    lower === "docker-compose.yaml" ||
    lower === "compose.yml" ||
    lower === "compose.yaml"
  );
}

export function analyzeDocker(tree: RepositoryTree): DockerObservation {
  const dockerfilePaths: string[] = [];
  const composePaths: string[] = [];

  for (const entry of tree.entries) {
    if (entry.type !== "blob") {
      continue;
    }

    const name = basename(entry.path);

    if (isDockerfile(name)) {
      dockerfilePaths.push(entry.path);
    } else if (isComposeFile(name)) {
      composePaths.push(entry.path);
    }
  }

  dockerfilePaths.sort();
  composePaths.sort();

  return {
    dockerfilePresent: dockerfilePaths.length > 0,
    composePresent: composePaths.length > 0,
    dockerfilePaths,
    composePaths,
  };
}
