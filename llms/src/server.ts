import Fastify, {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  FastifyPluginAsync,
  FastifyPluginCallback,
  FastifyPluginOptions,
  FastifyRegisterOptions,
  preHandlerHookHandler,
  onRequestHookHandler,
  preParsingHookHandler,
  preValidationHookHandler,
  preSerializationHookHandler,
  onSendHookHandler,
  onResponseHookHandler,
  onTimeoutHookHandler,
  onErrorHookHandler,
  onRouteHookHandler,
  onRegisterHookHandler,
  onReadyHookHandler,
  onListenHookHandler,
  onCloseHookHandler,
  FastifyBaseLogger,
  FastifyLoggerOptions,
} from "fastify"
import cors from "@fastify/cors"
import { ConfigService, AppConfig } from "./services/config"
import { errorHandler } from "./api/middleware"
import { registerApiRoutes } from "./api/routes"
import { LLMService } from "./services/llm"
import { ProviderService } from "./services/provider"
import { TransformerService } from "./services/transformer"
import { PinoLoggerOptions } from "fastify/types/logger"

// Extend FastifyRequest to include custom properties
declare module "fastify" {
  interface FastifyRequest {
    provider?: string
  }
  interface FastifyInstance {
    _server?: Server
  }
}

interface ServerOptions {
  initialConfig?: AppConfig
  logger?: boolean | PinoLoggerOptions
}

// Application factory
function createApp(logger: boolean | PinoLoggerOptions): FastifyInstance {
  const fastify = Fastify({
    bodyLimit: 50 * 1024 * 1024,
    logger,
  })

  // Register error handler
  fastify.setErrorHandler(errorHandler)

  // Register CORS
  fastify.register(cors)
  return fastify
}

// Server class
class Server {
  private app: FastifyInstance
  configService: ConfigService
  llmService!: LLMService
  providerService!: ProviderService
  transformerService: TransformerService

  getApp(): FastifyInstance {
    return this.app
  }

  constructor(options: ServerOptions = {}) {
    this.app = createApp(options.logger ?? true)
    this.configService = new ConfigService(options)
    this.transformerService = new TransformerService(
      this.configService,
      this.app.log
    )
    this.transformerService.initialize().finally(() => {
      this.providerService = new ProviderService(
        this.configService,
        this.transformerService,
        this.app.log
      )
      this.llmService = new LLMService(this.providerService)
    })
  }

  // Type-safe register method using Fastify native types
  async register<Options extends FastifyPluginOptions = FastifyPluginOptions>(
    plugin: FastifyPluginAsync<Options> | FastifyPluginCallback<Options>,
    options?: FastifyRegisterOptions<Options>
  ): Promise<void> {
    await (this.app as any).register(plugin, options)
  }

  // Type-safe addHook method with Fastify native types
  addHook(hookName: "onRequest", hookFunction: onRequestHookHandler): void
  addHook(hookName: "preParsing", hookFunction: preParsingHookHandler): void
  addHook(
    hookName: "preValidation",
    hookFunction: preValidationHookHandler
  ): void
  addHook(hookName: "preHandler", hookFunction: preHandlerHookHandler): void
  addHook(
    hookName: "preSerialization",
    hookFunction: preSerializationHookHandler
  ): void
  addHook(hookName: "onSend", hookFunction: onSendHookHandler): void
  addHook(hookName: "onResponse", hookFunction: onResponseHookHandler): void
  addHook(hookName: "onTimeout", hookFunction: onTimeoutHookHandler): void
  addHook(hookName: "onError", hookFunction: onErrorHookHandler): void
  addHook(hookName: "onRoute", hookFunction: onRouteHookHandler): void
  addHook(hookName: "onRegister", hookFunction: onRegisterHookHandler): void
  addHook(hookName: "onReady", hookFunction: onReadyHookHandler): void
  addHook(hookName: "onListen", hookFunction: onListenHookHandler): void
  addHook(hookName: "onClose", hookFunction: onCloseHookHandler): void
  public addHook(hookName: string, hookFunction: any): void {
    this.app.addHook(hookName as any, hookFunction)
  }

  async start(): Promise<void> {
    try {
      this.app._server = this

      this.app.addHook("preHandler", (request, reply, done) => {
        if (request.url.startsWith("/v1/messages") && request.body) {
          request.log.info({ body: request.body }, "request body")
          const body = request.body as any
          if (body.stream === true) {
            // Do something if stream is true
          }
          if (!body.stream) {
            body.stream = false // Ensure stream is false if not set
          }
        }
        done()
      })

      // Add new hook to process POST:/v1/chat/completions with OpenAI transformer
      this.app.addHook("preHandler", (request, reply, done) => {
        if (request.url.startsWith("/v1/chat/completions") && request.body) {
          request.log.info(
            { body: request.body },
            "OpenAI chat completion request body"
          )
          console.log("=== PRE HANDLER ===")
          console.log("URL:", request.url)
          console.log("Method:", request.method)
          // console.log("Headers:", request.headers)
          // console.log("Body:", request.body)

          const body = request.body as any
          console.log("Stream mode:", body.stream)
          console.log("Model:", body.model)

          if (body.stream === true) {
            console.log("Stream mode is enabled")
          }
          if (!body.stream) {
            body.stream = false // Ensure stream is false if not set
            console.log("Stream mode set to false")
          }
        }
        done()
      })

      this.app.addHook(
        "preHandler",
        async (req: FastifyRequest, reply: FastifyReply) => {
          if (req.url.startsWith("/api") || req.method !== "POST") return
          try {
            const body = req.body as any
            if (!body || !body.model) {
              return reply
                .code(400)
                .send({ error: "Missing model in request body" })
            }
            const [provider, model] = body.model.split(",")
            body.model = model
            req.provider = provider
            return
          } catch (err) {
            req.log.error("Error in modelProviderMiddleware:", err as any)
            return reply.code(500).send({ error: "Internal server error" })
          }
        }
      )

      this.app.register(registerApiRoutes)

      const address = await this.app.listen({
        port: parseInt(this.configService.get("PORT") || "3000", 10),
        host: this.configService.get("HOST") || "127.0.0.1",
      })

      this.app.log.info(`🚀 LLMs API server listening on ${address}`)

      const shutdown = async (signal: string) => {
        this.app.log.info(`Received ${signal}, shutting down gracefully...`)
        await this.app.close()
        process.exit(0)
      }

      process.on("SIGINT", () => shutdown("SIGINT"))
      process.on("SIGTERM", () => shutdown("SIGTERM"))
    } catch (error) {
      this.app.log.error(`Error starting server: ${error}`)
      process.exit(1)
    }
  }
}

// Export for external use
export default Server
