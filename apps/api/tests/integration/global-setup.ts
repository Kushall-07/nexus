import { MongoMemoryServer } from "mongodb-memory-server";

let server: MongoMemoryServer | undefined;

export async function setup(): Promise<void> {
  server = await MongoMemoryServer.create();
  process.env.NEXUS_TEST_MONGODB_URI = server.getUri("nexus_integration");
}

export async function teardown(): Promise<void> {
  await server?.stop();
}
