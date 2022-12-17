import type { FastifyInstance, FastifyServerOptions } from "fastify";
import { fastify } from "fastify";

import * as routes from "./routes";

export async function createServer(opts: FastifyServerOptions = {}): Promise<FastifyInstance> {
  const server = fastify(opts);

  await server.register(routes.setup);

  return server;
}
