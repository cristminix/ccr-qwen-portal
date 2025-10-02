import { TransformerConstructor } from "@/types/transformer"
import {
  LLMProvider,
  RegisterProviderRequest,
  ModelRoute,
  RequestRouteInfo,
  ConfigProvider,
} from "../types/llm"
import { ConfigService } from "./config"
import { TransformerService } from "./transformer"

export class ProviderService {
  private providers: Map<string, LLMProvider> = new Map()
  private modelRoutes: Map<string, ModelRoute> = new Map()

  constructor(
    private readonly configService: ConfigService,
    private readonly transformerService: TransformerService,
    private readonly logger: any
  ) {
    this.initializeCustomProviders()
  }

  private initializeCustomProviders() {
    // Debug: Log all config keys
    const allConfig = this.configService.getAll()
    console.log("=== PROVIDER SERVICE INITIALIZATION ===")
    console.log("All config keys:", Object.keys(allConfig))

    // Check both "providers" (lowercase) and "Providers" (uppercase) for compatibility
    const providersLower = this.configService.get<ConfigProvider[]>("providers")
    const providersUpper = this.configService.get<ConfigProvider[]>("Providers")

    console.log("providers (lowercase):", providersLower)
    console.log("Providers (uppercase):", providersUpper)

    const providersConfig = providersLower || providersUpper

    if (providersConfig && Array.isArray(providersConfig)) {
      console.log(
        `Found ${providersConfig.length} provider(s) in configuration`
      )
      this.logger.info(
        `Found ${providersConfig.length} provider(s) in configuration`
      )
      this.initializeFromProvidersArray(providersConfig)
      return
    }

    console.log("WARNING: No providers found in configuration")
    this.logger.warn("No providers found in configuration")
  }

  private initializeFromProvidersArray(providersConfig: ConfigProvider[]) {
    console.log(`Initializing ${providersConfig.length} providers...`)
    providersConfig.forEach((providerConfig: ConfigProvider, index) => {
      console.log(`\nProcessing provider ${index + 1}:`, providerConfig.name)
      try {
        console.log("Validating provider config...")
        console.log("  - name:", providerConfig.name)
        console.log("  - api_base_url:", providerConfig.api_base_url)
        console.log(
          "  - api_key:",
          providerConfig.api_key ? "EXISTS" : "MISSING"
        )
        console.log("  - models:", providerConfig.models)

        if (
          !providerConfig.name ||
          !providerConfig.api_base_url ||
          !providerConfig.api_key
        ) {
          console.log("❌ Provider validation FAILED - missing required fields")
          return
        }

        console.log("✓ Provider validation passed")
        console.log("Processing transformers...")

        const transformer: LLMProvider["transformer"] = {}

        if (providerConfig.transformer) {
          console.log(
            "Provider has transformer config:",
            Object.keys(providerConfig.transformer)
          )
          Object.keys(providerConfig.transformer).forEach((key) => {
            console.log(`  Processing transformer key: ${key}`)
            if (key === "use") {
              if (Array.isArray(providerConfig.transformer.use)) {
                transformer.use = providerConfig.transformer.use
                  .map((transformer) => {
                    try {
                      if (
                        Array.isArray(transformer) &&
                        typeof transformer[0] === "string"
                      ) {
                        console.log(
                          `    Getting transformer: ${transformer[0]}`
                        )
                        const Constructor =
                          this.transformerService.getTransformer(transformer[0])
                        console.log(`    Constructor type:`, typeof Constructor)

                        if (Constructor && typeof Constructor === "function") {
                          console.log(
                            `    Creating instance with config:`,
                            transformer[1]
                          )
                          return new (Constructor as TransformerConstructor)(
                            transformer[1]
                          )
                        } else {
                          console.log(
                            `    ⚠️ Constructor not found or not a function for: ${transformer[0]}`
                          )
                          return undefined
                        }
                      }
                      if (typeof transformer === "string") {
                        console.log(`    Getting transformer: ${transformer}`)
                        const transformerInstance =
                          this.transformerService.getTransformer(transformer)
                        console.log(
                          `    Instance type:`,
                          typeof transformerInstance
                        )

                        if (typeof transformerInstance === "function") {
                          return new transformerInstance()
                        }
                        return transformerInstance
                      }
                    } catch (err) {
                      console.log(`    ❌ Error processing transformer:`, err)
                      return undefined
                    }
                  })
                  .filter((transformer) => typeof transformer !== "undefined")
              }
            } else {
              if (Array.isArray(providerConfig.transformer[key]?.use)) {
                transformer[key] = {
                  use: providerConfig.transformer[key].use
                    .map((transformer) => {
                      try {
                        if (
                          Array.isArray(transformer) &&
                          typeof transformer[0] === "string"
                        ) {
                          console.log(
                            `    Getting model transformer: ${transformer[0]}`
                          )
                          const Constructor =
                            this.transformerService.getTransformer(
                              transformer[0]
                            )
                          console.log(
                            `    Constructor type:`,
                            typeof Constructor
                          )

                          if (
                            Constructor &&
                            typeof Constructor === "function"
                          ) {
                            console.log(
                              `    Creating instance with config:`,
                              transformer[1]
                            )
                            return new (Constructor as TransformerConstructor)(
                              transformer[1]
                            )
                          } else {
                            console.log(
                              `    ⚠️ Constructor not found or not a function for: ${transformer[0]}`
                            )
                            return undefined
                          }
                        }
                        if (typeof transformer === "string") {
                          console.log(
                            `    Getting model transformer: ${transformer}`
                          )
                          const transformerInstance =
                            this.transformerService.getTransformer(transformer)
                          console.log(
                            `    Instance type:`,
                            typeof transformerInstance
                          )

                          if (typeof transformerInstance === "function") {
                            return new transformerInstance()
                          }
                          return transformerInstance
                        }
                      } catch (err) {
                        console.log(
                          `    ❌ Error processing model transformer:`,
                          err
                        )
                        return undefined
                      }
                    })
                    .filter(
                      (transformer) => typeof transformer !== "undefined"
                    ),
                }
              }
            }
          })
        }

        console.log("Transformer processing complete")
        console.log("Calling registerProvider...")

        this.registerProvider({
          name: providerConfig.name,
          baseUrl: providerConfig.api_base_url,
          apiKey: providerConfig.api_key,
          models: providerConfig.models || [],
          transformer: providerConfig.transformer ? transformer : undefined,
        })

        console.log(`✓ ${providerConfig.name} provider registered successfully`)
        this.logger.info(`${providerConfig.name} provider registered`)
      } catch (error) {
        console.log(
          `❌ ERROR registering provider ${providerConfig.name}:`,
          error
        )
        console.log("Error stack:", (error as Error).stack)
        this.logger.error(
          `${providerConfig.name} provider registered error: ${error}`
        )
      }
    })
  }

  registerProvider(request: RegisterProviderRequest): LLMProvider {
    const provider: LLMProvider = {
      ...request,
    }

    console.log(`Registering provider: ${provider.name}`)
    this.providers.set(provider.name, provider)
    console.log(`Provider registered. Total providers: ${this.providers.size}`)

    request.models.forEach((model) => {
      const fullModel = `${provider.name},${model}`
      const route: ModelRoute = {
        provider: provider.name,
        model,
        fullModel,
      }
      this.modelRoutes.set(fullModel, route)
      if (!this.modelRoutes.has(model)) {
        this.modelRoutes.set(model, route)
      }
    })

    return provider
  }

  getProviders(): LLMProvider[] {
    console.log(
      `getProviders called. Total providers in Map: ${this.providers.size}`
    )
    console.log(`Provider names:`, Array.from(this.providers.keys()))
    return Array.from(this.providers.values())
  }

  getProvider(name: string): LLMProvider | undefined {
    console.log(`getProvider called for: ${name}`)
    console.log(`Total providers in Map: ${this.providers.size}`)
    console.log(`Available provider names:`, Array.from(this.providers.keys()))
    const provider = this.providers.get(name)
    console.log(`Found provider:`, provider ? "YES" : "NO")
    return provider
  }

  updateProvider(
    id: string,
    updates: Partial<LLMProvider>
  ): LLMProvider | null {
    const provider = this.providers.get(id)
    if (!provider) {
      return null
    }

    const updatedProvider = {
      ...provider,
      ...updates,
      updatedAt: new Date(),
    }

    this.providers.set(id, updatedProvider)

    if (updates.models) {
      provider.models.forEach((model) => {
        const fullModel = `${provider.name},${model}`
        this.modelRoutes.delete(fullModel)
        this.modelRoutes.delete(model)
      })

      updates.models.forEach((model) => {
        const fullModel = `${provider.name},${model}`
        const route: ModelRoute = {
          provider: provider.name,
          model,
          fullModel,
        }
        this.modelRoutes.set(fullModel, route)
        if (!this.modelRoutes.has(model)) {
          this.modelRoutes.set(model, route)
        }
      })
    }

    return updatedProvider
  }

  deleteProvider(id: string): boolean {
    const provider = this.providers.get(id)
    if (!provider) {
      return false
    }

    provider.models.forEach((model) => {
      const fullModel = `${provider.name},${model}`
      this.modelRoutes.delete(fullModel)
      this.modelRoutes.delete(model)
    })

    this.providers.delete(id)
    return true
  }

  toggleProvider(name: string, enabled: boolean): boolean {
    const provider = this.providers.get(name)
    if (!provider) {
      return false
    }
    return true
  }

  resolveModelRoute(modelName: string): RequestRouteInfo | null {
    const route = this.modelRoutes.get(modelName)
    if (!route) {
      return null
    }

    const provider = this.providers.get(route.provider)
    if (!provider) {
      return null
    }

    return {
      provider,
      originalModel: modelName,
      targetModel: route.model,
    }
  }

  getAvailableModelNames(): string[] {
    const modelNames: string[] = []
    this.providers.forEach((provider) => {
      provider.models.forEach((model) => {
        modelNames.push(model)
        modelNames.push(`${provider.name},${model}`)
      })
    })
    return modelNames
  }

  getModelRoutes(): ModelRoute[] {
    return Array.from(this.modelRoutes.values())
  }

  private parseTransformerConfig(transformerConfig: any): any {
    if (!transformerConfig) return {}

    if (Array.isArray(transformerConfig)) {
      return transformerConfig.reduce((acc, item) => {
        if (Array.isArray(item)) {
          const [name, config = {}] = item
          acc[name] = config
        } else {
          acc[item] = {}
        }
        return acc
      }, {})
    }

    return transformerConfig
  }

  async getAvailableModels(): Promise<{
    object: string
    data: Array<{
      id: string
      object: string
      owned_by: string
      provider: string
    }>
  }> {
    const models: Array<{
      id: string
      object: string
      owned_by: string
      provider: string
    }> = []

    this.providers.forEach((provider) => {
      provider.models.forEach((model) => {
        models.push({
          id: model,
          object: "model",
          owned_by: provider.name,
          provider: provider.name,
        })

        models.push({
          id: `${provider.name},${model}`,
          object: "model",
          owned_by: provider.name,
          provider: provider.name,
        })
      })
    })

    return {
      object: "list",
      data: models,
    }
  }
}
