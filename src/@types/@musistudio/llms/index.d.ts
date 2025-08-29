// Type definitions for @musistudio/llms
import { FastifyInstance } from "fastify"
import { ConfigService, AppConfig } from "../../../llms/src/services/config"
import { LLMService } from "../../../llms/src/services/llm"
import { ProviderService } from "../../../llms/src/services/provider"
import { TransformerService } from "../../../llms/src/services/transformer"

declare class Server {
  constructor(options?: {
    initialConfig?: AppConfig
    logger?: boolean | object
  })

  app: FastifyInstance
  configService: ConfigService
  llmService: LLMService
  providerService: ProviderService
  transformerService: TransformerService

  register<Options extends object = object>(
    plugin: any,
    options?: Options
  ): Promise<void>

  addHook(hookName: string, hookFunction: any): void

  start(): Promise<void>
}

export default Server
export { Server }
