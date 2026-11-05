// Concrete development tasks per skill. Effort ranges are rough planning
// figures for a learner with the prerequisites, not guarantees. A completed
// task never counts as verified evidence: only a GitHub re-analysis or a
// user-reviewed resume entry changes the evidence profile.

export interface TaskTemplate {
  learn: string;
  milestone: string;
  verification: string;
  effortHours?: [number, number];
}

export const TASK_TEMPLATES: Record<string, TaskTemplate> = {
  "rest-apis": {
    learn: "Learn resource modelling, HTTP verbs, status codes and input validation.",
    milestone: "Build a small CRUD REST API with validation and consistent error responses.",
    verification: "Public repository with documented endpoints and request/response examples.",
    effortHours: [12, 25],
  },
  "backend-development": {
    learn: "Learn layering (routes, services, data access), configuration and structured logging.",
    milestone: "Build a service with authentication, a persistence layer and environment-based configuration.",
    verification: "Repository with a README describing the architecture and a runnable start command.",
    effortHours: [20, 40],
  },
  "database-systems": {
    learn: "Learn schema design, normalization, indexes and transactions.",
    milestone: "Design a relational schema for a small domain with migrations and seed data.",
    verification: "Repository containing schema/migration files and queries that use indexes.",
    effortHours: [10, 20],
  },
  postgresql: {
    learn: "Learn PostgreSQL data types, joins, indexes and running it locally in Docker.",
    milestone: "Back an API with PostgreSQL, including at least one migration and a transaction.",
    verification: "Repository with PostgreSQL migrations and a driver/ORM dependency.",
    effortHours: [10, 20],
  },
  mongodb: {
    learn: "Learn document modelling, indexes and the aggregation basics.",
    milestone: "Persist an API's data in MongoDB with schema validation and indexes.",
    verification: "Repository with MongoDB models and an index definition.",
    effortHours: [8, 16],
  },
  sql: {
    learn: "Practise SELECT, JOIN, GROUP BY and subqueries.",
    milestone: "Write and document a set of analytical queries against a sample database.",
    verification: "Repository containing SQL files used by an application or notebook.",
    effortHours: [8, 15],
  },
  "software-testing": {
    learn: "Learn the test pyramid and how to isolate units from I/O.",
    milestone: "Add automated tests with meaningful assertions to an existing project and run them in CI.",
    verification: "Test files plus a passing CI workflow in a public repository.",
    effortHours: [8, 16],
  },
  "unit-testing": {
    learn: "Learn a test runner (Jest, Vitest or pytest), mocking and fixtures.",
    milestone: "Cover the core logic of one project with unit tests.",
    verification: "Test directory with unit tests that run via one command.",
    effortHours: [6, 12],
  },
  "integration-testing": {
    learn: "Learn to test an HTTP API end to end against a real or in-memory database.",
    milestone: "Write integration tests that exercise API routes and persistence together.",
    verification: "Integration tests committed to the repository and run in CI.",
    effortHours: [8, 16],
  },
  docker: {
    learn: "Learn images, layers, volumes and docker compose.",
    milestone: "Containerize an application and its database with a Dockerfile and compose file.",
    verification: "Dockerfile and docker-compose file in the repository; the app starts with one command.",
    effortHours: [6, 12],
  },
  "ci-cd": {
    learn: "Learn pipeline stages: install, test, build, deploy.",
    milestone: "Add a GitHub Actions workflow that tests and builds a project on every push.",
    verification: "A workflow file and a passing run visible on the repository.",
    effortHours: [4, 10],
  },
  react: {
    learn: "Learn components, state, effects and data fetching.",
    milestone: "Build a small React app that consumes your own API with loading and error states.",
    verification: "Repository with a React application and component tests.",
    effortHours: [20, 40],
  },
  nodejs: {
    learn: "Learn the Node.js runtime, modules and asynchronous I/O.",
    milestone: "Build a Node.js service with a tested HTTP interface.",
    verification: "Repository with a package.json, source and tests.",
    effortHours: [12, 24],
  },
  typescript: {
    learn: "Learn types, generics and strict compiler options.",
    milestone: "Convert or build a project in strict TypeScript.",
    verification: "tsconfig with strict enabled and a clean type check.",
    effortHours: [10, 20],
  },
  python: {
    learn: "Learn core Python, packaging and virtual environments.",
    milestone: "Build a command-line or API project with tests.",
    verification: "Repository with Python source, dependency file and tests.",
    effortHours: [15, 30],
  },
  pytorch: {
    learn: "Learn tensors, autograd and training loops.",
    milestone: "Train and evaluate a model on a public dataset, with a reproducible script.",
    verification: "Repository with training code, evaluation metrics and a README.",
    effortHours: [25, 50],
  },
  "model-development": {
    learn: "Learn the train/validate/test workflow and basic evaluation metrics.",
    milestone: "Build an end-to-end model pipeline with documented evaluation.",
    verification: "Repository with data preparation, training and evaluation code.",
    effortHours: [25, 50],
  },
  "llm-applications": {
    learn: "Learn prompting, structured outputs and failure handling.",
    milestone: "Build an application that calls an LLM API with validated outputs and error handling.",
    verification: "Repository with an LLM integration and tests using mocked responses.",
    effortHours: [12, 25],
  },
  rag: {
    learn: "Learn embeddings, chunking and retrieval evaluation.",
    milestone: "Build a retrieval-augmented question-answering demo over a small document set.",
    verification: "Repository with ingestion, retrieval and an evaluation script.",
    effortHours: [15, 30],
  },
};

export function templateFor(skillId: string, skillName: string): TaskTemplate {
  return (
    TASK_TEMPLATES[skillId] ?? {
      learn: `Study the fundamentals of ${skillName} from its official documentation.`,
      milestone: `Build a small project that uses ${skillName} in a realistic way.`,
      verification: `A public repository whose code, dependencies or tests clearly use ${skillName}.`,
    }
  );
}
