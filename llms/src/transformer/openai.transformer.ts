import { Transformer } from "@/types/transformer"
import { LLMProvider } from "@/types/llm"

export class OpenAITransformer implements Transformer {
  name = "OpenAI"
  endPoint = "/v1/chat/completions"

  async auth(request: any, provider: LLMProvider): Promise<any> {
    // console.log("=== OPENAI TRANSFORMER AUTH ===")
    // console.log("Request:", request)
    // console.log("Provider:", provider.name)

    const result = {
      body: request,
      config: {
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
          "Content-Type": "application/json",
        },
      },
    }

    console.log("Auth result:", result)
    return result
  }
}
