import { Transformer, TransformerConstructor } from "@/types/transformer"
import { ConfigService } from "./config"
import Transformers from "@/transformer"

interface TransformerConfig {
  transformers: Array<{
    name: string
    type: "class" | "module"
    path?: string
    options?: any
  }>
}

export class TransformerService {
  private transformers: Map<string, Transformer | TransformerConstructor> =
    new Map()

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: any
  ) {}

  registerTransformer(name: string, transformer: Transformer): void {
    this.transformers.set(name, transformer)
    this.logger.info(
      `register transformer: ${name}${
        transformer.endPoint
          ? ` (endpoint: ${transformer.endPoint})`
          : " (no endpoint)"
      }`
    )
  }

  getTransformer(
    name: string
  ): Transformer | TransformerConstructor | undefined {
    const transformer = this.transformers.get(name)
    return transformer
  }

  getAllTransformers(): Map<string, Transformer | TransformerConstructor> {
    return new Map(this.transformers)
  }

  getTransformersWithEndpoint(): { name: string; transformer: Transformer }[] {
    const result: { name: string; transformer: Transformer }[] = []

    this.transformers.forEach((transformer, name) => {
      if (this.isTransformerInstance(transformer) && transformer.endPoint) {
        result.push({ name, transformer })
      }
    })

    return result
  }

  getTransformersWithoutEndpoint(): {
    name: string
    transformer: Transformer
  }[] {
    const result: { name: string; transformer: Transformer }[] = []

    this.transformers.forEach((transformer, name) => {
      if (this.isTransformerInstance(transformer) && !transformer.endPoint) {
        result.push({ name, transformer })
      }
    })

    return result
  }

  private isTransformerInstance(obj: any): obj is Transformer {
    return (
      obj &&
      typeof obj === "object" &&
      (typeof obj.transformRequestIn === "function" ||
        typeof obj.transformRequestOut === "function" ||
        typeof obj.transformResponseIn === "function" ||
        typeof obj.transformResponseOut === "function" ||
        "endPoint" in obj)
    )
  }

  removeTransformer(name: string): boolean {
    return this.transformers.delete(name)
  }

  hasTransformer(name: string): boolean {
    return this.transformers.has(name)
  }

  async registerTransformerFromConfig(config: {
    path?: string
    options?: any
  }): Promise<boolean> {
    try {
      if (config.path) {
        const module = await import(require.resolve(config.path))
        if (module && module.default) {
          const TransformerClass = module.default as TransformerConstructor
          const instance = new TransformerClass(config.options)
          // Set logger for transformer instance
          if (instance && typeof instance === "object") {
            ;(instance as any).logger = this.logger
          }
          if (!instance.name) {
            throw new Error(
              `Transformer instance from ${config.path} does not have a name property.`
            )
          }
          this.registerTransformer(instance.name, instance)
          return true
        } else if (module && typeof module === "function") {
          // Handle case where the module exports a constructor function directly
          const TransformerClass = module as TransformerConstructor
          const instance = new TransformerClass(config.options)
          // Set logger for transformer instance
          if (instance && typeof instance === "object") {
            ;(instance as any).logger = this.logger
          }
          if (!instance.name) {
            throw new Error(
              `Transformer instance from ${config.path} does not have a name property.`
            )
          }
          this.registerTransformer(instance.name, instance)
          return true
        }
      }
      return false
    } catch (error: any) {
      this.logger.error(
        `load transformer (${config.path}) \nerror: ${error.message}\nstack: ${error.stack}`
      )
      return false
    }
  }

  async initialize(): Promise<void> {
    try {
      await this.registerDefaultTransformersInternal()
      await this.loadFromConfig()
    } catch (error: any) {
      this.logger.error(
        `TransformerService init error: ${error.message}\nStack: ${error.stack}`
      )
    }
  }

  private async registerDefaultTransformersInternal(): Promise<void> {
    try {
      Object.values(Transformers).forEach((TransformerClass: any) => {
        // Check if this transformer has a static TransformerName property
        if (
          "TransformerName" in TransformerClass &&
          typeof TransformerClass.TransformerName === "string"
        ) {
          // Register the constructor itself for transformers with static names
          this.transformers.set(
            TransformerClass.TransformerName,
            TransformerClass
          )
          this.logger.info(
            `register transformer: ${TransformerClass.TransformerName} (constructor)`
          )
        } else {
          // Instantiate the transformer class for transformers without static names
          const transformerInstance = new TransformerClass()
          // Set logger for transformer instance
          if (transformerInstance && typeof transformerInstance === "object") {
            ;(transformerInstance as any).logger = this.logger
          }
          // Register the instance
          if (transformerInstance.name) {
            this.transformers.set(transformerInstance.name, transformerInstance)
            this.logger.info(
              `register transformer: ${transformerInstance.name}${
                transformerInstance.endPoint
                  ? ` (endpoint: ${transformerInstance.endPoint})`
                  : " (no endpoint)"
              }`
            )
          }
        }
      })
    } catch (error) {
      this.logger.error({ error }, "transformer regist error:")
    }
  }

  private async loadFromConfig(): Promise<void> {
    const transformers = this.configService.get<
      TransformerConfig["transformers"]
    >("transformers", [])
    for (const transformer of transformers) {
      await this.registerTransformerFromConfig(transformer)
    }
  }
}
