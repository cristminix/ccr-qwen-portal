import Server from "@musistudio/llms"

declare module "fastify" {
  interface FastifyInstance {
    _server?: Server
  }
}
