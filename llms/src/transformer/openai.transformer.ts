import { AnthropicChatRequest, ChatCompletion } from "../types/llm"
import { convertFromOpenAI } from "../utils/converter"
import { Transformer, TransformerContext } from "@/types/transformer"
import { LLMProvider, UnifiedTool } from "@/types/llm"
import { convertToAnthropic } from "@/utils/converter"
import { v4 as uuidv4 } from "uuid"
import { createApiError } from "@/api/middleware"

export class OpenAITransformer implements Transformer {
  name = "OpenAI"
  endPoint = "/v1/chat/completions"

  logger: any

  constructor() {
    this.logger = console
  }

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

  async transformRequestOut(request: any): Promise<any> {
    const unifiedRequest = convertFromOpenAI(request)
    return convertToAnthropic(unifiedRequest)
  }

  async transformResponseIn(
    response: Response,
    context?: TransformerContext
  ): Promise<Response> {
    const isStream = response.headers
      .get("Content-Type")
      ?.includes("text/event-stream")
    if (isStream) {
      if (!response.body) {
        throw new Error("Stream response body is null")
      }
      const convertedStream = await this.convertAnthropicStreamToOpenAI(
        response.body
      )
      return new Response(convertedStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      })
    } else {
      const data: any = await response.json()
      const openaiResponse = this.convertAnthropicResponseToOpenAI(
        data as ChatCompletion
      )
      return new Response(JSON.stringify(openaiResponse), {
        headers: { "Content-Type": "application/json" },
      })
    }
  }

  private async convertAnthropicStreamToOpenAI(
    anthropicStream: ReadableStream
  ): Promise<ReadableStream> {
    const readable = new ReadableStream({
      start: async (controller) => {
        const encoder = new TextEncoder()
        let messageId = ""
        let model = "unknown"
        let hasStarted = false
        let currentContent = ""
        let currentToolCall: any = null
        let toolCallBuffer: any = null
        let isClosed = false
        let choiceIndex = 0

        const safeEnqueue = (data: Uint8Array) => {
          if (!isClosed) {
            try {
              controller.enqueue(data)
              const dataStr = new TextDecoder().decode(data)
              this.logger.debug({ dataStr }, `send data`)
            } catch (error: any) {
              if (
                error instanceof TypeError &&
                error.message.includes("Controller is already closed")
              ) {
                isClosed = true
              } else {
                this.logger.debug(`send data error: ${error.message}`)
                throw error
              }
            }
          }
        }

        const sendOpenAIChunk = (
          content: string,
          finishReason: string | null = null,
          toolCall: any = null
        ) => {
          if (isClosed) return

          const openaiChunk = {
            id: messageId,
            object: "chat.completion.chunk",
            created: Math.floor(Date.now() / 1000),
            model: model,
            choices: [
              {
                index: choiceIndex,
                delta: {
                  ...(content ? { content } : {}),
                  ...(toolCall ? { tool_calls: [toolCall] } : {}),
                },
                finish_reason: finishReason,
              },
            ],
          }

          safeEnqueue(
            encoder.encode(`data: ${JSON.stringify(openaiChunk)}\n\n`)
          )
        }

        const safeClose = () => {
          if (!isClosed) {
            try {
              // Kirim chunk terakhir dengan finish_reason
              if (currentContent || currentToolCall) {
                sendOpenAIChunk(currentContent, "stop", currentToolCall)
                currentContent = ""
                currentToolCall = null
              }
              safeEnqueue(encoder.encode("data: [DONE]\n\n"))
              controller.close()
              isClosed = true
            } catch (error) {
              if (
                error instanceof TypeError &&
                error.message.includes("Controller is already closed")
              ) {
                isClosed = true
              } else {
                throw error
              }
            }
          }
        }

        let reader: ReadableStreamDefaultReader<Uint8Array> | null = null

        try {
          reader = anthropicStream.getReader()
          const decoder = new TextDecoder()
          let buffer = ""

          while (true) {
            if (isClosed) {
              break
            }

            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split("\n")
            buffer = lines.pop() || ""

            for (const line of lines) {
              if (isClosed) break

              if (!line.startsWith("event:") && !line.startsWith("data:"))
                continue

              if (line.startsWith("event:")) {
                // Proses event Anthropic
                const eventType = line.slice(6).trim() // "event:" length is 6

                if (eventType === "message_start") {
                  // Event awal yang berisi informasi pesan
                  continue
                } else if (eventType === "content_block_start") {
                  // Mulai blok konten
                  continue
                } else if (eventType === "content_block_delta") {
                  // Perubahan konten
                  continue
                } else if (eventType === "content_block_stop") {
                  // Akhiri blok konten
                  continue
                } else if (eventType === "message_delta") {
                  // Delta pesan
                  continue
                } else if (eventType === "message_stop") {
                  // Akhiri pesan
                  continue
                }
              } else if (line.startsWith("data:")) {
                const data = line.slice(5).trim() // "data:" length is 5

                if (data === "[DONE]") {
                  continue
                }

                try {
                  const chunk = JSON.parse(data)

                  if (chunk.type === "message_start") {
                    // Ambil ID dan model dari pesan awal
                    messageId = chunk.message.id || `chatcmpl-${Date.now()}`
                    model = chunk.message.model
                    hasStarted = true
                  } else if (chunk.type === "content_block_start") {
                    // Mulai blok konten
                    if (chunk.content_block?.type === "tool_use") {
                      // Mulai tool call
                      currentToolCall = {
                        id: chunk.content_block.id,
                        type: "function",
                        index: 0,
                        function: {
                          name: chunk.content_block.name,
                          arguments: "",
                        },
                      }
                    }
                  } else if (chunk.type === "content_block_delta") {
                    // Delta konten
                    if (chunk.delta?.type === "text_delta") {
                      // Teks delta
                      currentContent = chunk.delta.text || ""
                      if (currentContent) {
                        sendOpenAIChunk(currentContent)
                      }
                    } else if (chunk.delta?.type === "input_json_delta") {
                      // Delta argumen tool
                      if (currentToolCall) {
                        currentToolCall.function.arguments +=
                          chunk.delta.partial_json || ""
                        // Kirim delta tool call
                        sendOpenAIChunk("", null, {
                          ...currentToolCall,
                          function: {
                            name: currentToolCall.function.name,
                            arguments: chunk.delta.partial_json || "",
                          },
                        })
                      }
                    }
                  } else if (chunk.type === "message_delta") {
                    // Delta pesan, mungkin berisi alasan selesai
                    if (chunk.delta?.stop_reason) {
                      const finishReason = this.mapAnthropicStopReasonToOpenAI(
                        chunk.delta.stop_reason
                      )
                      sendOpenAIChunk("", finishReason)
                    }
                  } else if (chunk.type === "message_stop") {
                    // Akhiri pesan
                    if (currentContent || currentToolCall) {
                      sendOpenAIChunk(currentContent, "stop", currentToolCall)
                      currentContent = ""
                      currentToolCall = null
                    }
                  }
                } catch (parseError: any) {
                  this.logger?.error(
                    `parseError: ${parseError.name} message: ${parseError.message} stack: ${parseError.stack} data: ${data}`
                  )
                }
              }
            }
          }
          safeClose()
        } catch (error: any) {
          if (!isClosed) {
            try {
              controller.error(error)
            } catch (controllerError: any) {
              console.error(controllerError)
            }
          }
        } finally {
          if (reader) {
            try {
              reader.releaseLock()
            } catch (releaseError: any) {
              console.error(releaseError)
            }
          }
        }
      },
      cancel: (reason) => {
        this.logger.debug(`cancel stream: ${reason}`)
      },
    })

    return readable
  }

  private convertAnthropicToolsToUnified(tools: any[]): UnifiedTool[] {
    return tools.map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description || "",
        parameters: tool.input_schema,
      },
    }))
  }

  private convertAnthropicResponseToOpenAI(anthropicResponse: any): any {
    // Konversi dari format Anthropic ke OpenAI
    const choices = [
      {
        index: 0,
        message: {
          role: "assistant",
          content: null, // Akan diisi dari content Anthropic
        },
        finish_reason: this.mapAnthropicStopReasonToOpenAI(
          anthropicResponse.stop_reason
        ),
      },
    ]

    // Ekstrak konten dari field content Anthropic
    if (anthropicResponse.content && Array.isArray(anthropicResponse.content)) {
      const textContent = anthropicResponse.content
        .filter((item: any) => item.type === "text")
        .map((item: any) => item.text)
        .join("\n")

      if (textContent) {
        choices[0].message.content = textContent
      }

      // Tangani tool_calls jika ada
      const toolCalls = anthropicResponse.content
        .filter((item: any) => item.type === "tool_use")
        .map((item: any) => ({
          id: item.id,
          type: "function",
          function: {
            name: item.name,
            arguments:
              typeof item.input === "string"
                ? item.input
                : JSON.stringify(item.input),
          },
        }))

      if (toolCalls.length > 0) {
        ;(choices[0].message as any).tool_calls = toolCalls
        // Jika hanya ada tool_calls tanpa konten teks, set content ke null
        if (!textContent) {
          choices[0].message.content = null
        }
      }
    }

    const openaiResponse = {
      id: anthropicResponse.id,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: anthropicResponse.model,
      choices: choices,
      usage: {
        prompt_tokens: anthropicResponse.usage?.input_tokens || 0,
        completion_tokens: anthropicResponse.usage?.output_tokens || 0,
        total_tokens:
          (anthropicResponse.usage?.input_tokens || 0) +
          (anthropicResponse.usage?.output_tokens || 0),
      },
    }

    return openaiResponse
  }

  private mapAnthropicStopReasonToOpenAI(anthropicStopReason: string): string {
    const mapping: Record<string, string> = {
      end_turn: "stop",
      max_tokens: "length",
      tool_use: "tool_calls",
      stop_sequence: "content_filter",
      timeout: "stop",
    }
    return mapping[anthropicStopReason] || "stop"
  }

  private async convertOpenAIStreamToAnthropic(
    openaiStream: ReadableStream
  ): Promise<ReadableStream> {
    const readable = new ReadableStream({
      start: async (controller) => {
        const encoder = new TextEncoder()
        const messageId = `msg_${Date.now()}`
        let stopReasonMessageDelta: null | Record<string, any> = null
        let model = "unknown"
        let hasStarted = false
        let hasTextContentStarted = false
        let hasFinished = false
        const toolCalls = new Map<number, any>()
        const toolCallIndexToContentBlockIndex = new Map<number, number>()
        let totalChunks = 0
        let contentChunks = 0
        let toolCallChunks = 0
        let isClosed = false
        let isThinkingStarted = false
        let contentIndex = 0
        let currentContentBlockIndex = -1 // Track the current content block index
        // Variabel untuk melacak konten terakhir yang dikirim
        let lastSentContent = ""

        const safeEnqueue = (data: Uint8Array) => {
          if (!isClosed) {
            try {
              controller.enqueue(data)
              const dataStr = new TextDecoder().decode(data)
              this.logger.debug({ dataStr }, `send data`)
            } catch (error: any) {
              if (
                error instanceof TypeError &&
                error.message.includes("Controller is already closed")
              ) {
                isClosed = true
              } else {
                this.logger.debug(`send data error: ${error.message}`)
                throw error
              }
            }
          }
        }

        const safeClose = () => {
          if (!isClosed) {
            try {
              // Close any remaining open content block
              if (currentContentBlockIndex >= 0) {
                const contentBlockStop = {
                  type: "content_block_stop",
                  index: currentContentBlockIndex,
                }
                safeEnqueue(
                  encoder.encode(
                    `event: content_block_stop\ndata: ${JSON.stringify(
                      contentBlockStop
                    )}\n\n`
                  )
                )
                currentContentBlockIndex = -1
              }

              if (stopReasonMessageDelta) {
                safeEnqueue(
                  encoder.encode(
                    `event: message_delta\ndata: ${JSON.stringify(
                      stopReasonMessageDelta
                    )}\n\n`
                  )
                )
                stopReasonMessageDelta = null
              } else {
                safeEnqueue(
                  encoder.encode(
                    `event: message_delta\ndata: ${JSON.stringify({
                      type: "message_delta",
                      delta: {
                        stop_reason: "end_turn",
                        stop_sequence: null,
                      },
                      usage: {
                        input_tokens: 0,
                        output_tokens: 0,
                        cache_read_input_tokens: 0,
                      },
                    })}\n\n`
                  )
                )
              }
              const messageStop = {
                type: "message_stop",
              }
              safeEnqueue(
                encoder.encode(
                  `event: message_stop\ndata: ${JSON.stringify(
                    messageStop
                  )}\n\n`
                )
              )
              controller.close()
              isClosed = true
            } catch (error) {
              if (
                error instanceof TypeError &&
                error.message.includes("Controller is already closed")
              ) {
                isClosed = true
              } else {
                throw error
              }
            }
          }
        }

        let reader: ReadableStreamDefaultReader<Uint8Array> | null = null

        try {
          reader = openaiStream.getReader()
          const decoder = new TextDecoder()
          let buffer = ""

          while (true) {
            if (isClosed) {
              break
            }

            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split("\n")
            buffer = lines.pop() || ""

            // Jika buffer terlalu besar, kosongkan untuk mencegah duplikasi
            if (buffer.length > 10000) {
              buffer = ""
            }

            for (const line of lines) {
              if (isClosed || hasFinished) break

              if (!line.startsWith("data:")) continue
              const data = line.slice(5).trim()
              this.logger.debug(`recieved data: ${data}`)

              if (data === "[DONE]") {
                continue
              }

              try {
                const chunk = JSON.parse(data)
                totalChunks++
                this.logger.debug({ response: chunk }, `Original Response`)
                if (chunk.error) {
                  const errorMessage = {
                    type: "error",
                    message: {
                      type: "api_error",
                      message: JSON.stringify(chunk.error),
                    },
                  }

                  safeEnqueue(
                    encoder.encode(
                      `event: error\ndata: ${JSON.stringify(errorMessage)}\n\n`
                    )
                  )
                  continue
                }

                model = chunk.model || model

                if (!hasStarted && !isClosed && !hasFinished) {
                  hasStarted = true

                  const messageStart = {
                    type: "message_start",
                    message: {
                      id: messageId,
                      type: "message",
                      role: "assistant",
                      content: [],
                      model: model,
                      stop_reason: null,
                      stop_sequence: null,
                      usage: {
                        input_tokens: 0,
                        output_tokens: 0,
                      },
                    },
                  }

                  safeEnqueue(
                    encoder.encode(
                      `event: message_start\ndata: ${JSON.stringify(
                        messageStart
                      )}\n\n`
                    )
                  )
                }

                const choice = chunk.choices?.[0]
                if (chunk.usage) {
                  if (!stopReasonMessageDelta) {
                    stopReasonMessageDelta = {
                      type: "message_delta",
                      delta: {
                        stop_reason: "end_turn",
                        stop_sequence: null,
                      },
                      usage: {
                        input_tokens: chunk.usage?.prompt_tokens || 0,
                        output_tokens: chunk.usage?.completion_tokens || 0,
                        cache_read_input_tokens:
                          chunk.usage?.cache_read_input_tokens || 0,
                      },
                    }
                  } else {
                    stopReasonMessageDelta.usage = {
                      input_tokens: chunk.usage?.prompt_tokens || 0,
                      output_tokens: chunk.usage?.completion_tokens || 0,
                      cache_read_input_tokens:
                        chunk.usage?.cache_read_input_tokens || 0,
                    }
                  }
                }
                if (!choice) {
                  continue
                }

                if (choice?.delta?.thinking && !isClosed && !hasFinished) {
                  // Close any previous content block if open
                  if (currentContentBlockIndex >= 0) {
                    const contentBlockStop = {
                      type: "content_block_stop",
                      index: currentContentBlockIndex,
                    }
                    safeEnqueue(
                      encoder.encode(
                        `event: content_block_stop\ndata: ${JSON.stringify(
                          contentBlockStop
                        )}\n\n`
                      )
                    )
                    currentContentBlockIndex = -1
                  }

                  if (!isThinkingStarted) {
                    const contentBlockStart = {
                      type: "content_block_start",
                      index: contentIndex,
                      content_block: { type: "thinking", thinking: "" },
                    }
                    safeEnqueue(
                      encoder.encode(
                        `event: content_block_start\ndata: ${JSON.stringify(
                          contentBlockStart
                        )}\n\n`
                      )
                    )
                    currentContentBlockIndex = contentIndex
                    isThinkingStarted = true
                  }
                  if (choice.delta.thinking.signature) {
                    const thinkingSignature = {
                      type: "content_block_delta",
                      index: contentIndex,
                      delta: {
                        type: "signature_delta",
                        signature: choice.delta.thinking.signature,
                      },
                    }
                    safeEnqueue(
                      encoder.encode(
                        `event: content_block_delta\ndata: ${JSON.stringify(
                          thinkingSignature
                        )}\n\n`
                      )
                    )
                    const contentBlockStop = {
                      type: "content_block_stop",
                      index: contentIndex,
                    }
                    safeEnqueue(
                      encoder.encode(
                        `event: content_block_stop\ndata: ${JSON.stringify(
                          contentBlockStop
                        )}\n\n`
                      )
                    )
                    currentContentBlockIndex = -1
                    contentIndex++
                  } else if (choice.delta.thinking.content) {
                    const thinkingChunk = {
                      type: "content_block_delta",
                      index: contentIndex,
                      delta: {
                        type: "thinking_delta",
                        thinking: choice.delta.thinking.content || "",
                      },
                    }
                    safeEnqueue(
                      encoder.encode(
                        `event: content_block_delta\ndata: ${JSON.stringify(
                          thinkingChunk
                        )}\n\n`
                      )
                    )
                  }
                }

                if (choice?.delta?.content && !isClosed && !hasFinished) {
                  contentChunks++

                  // Close any previous content block if open and it's not a text content block
                  if (currentContentBlockIndex >= 0) {
                    // Check if current content block is text type
                    const isCurrentTextBlock = hasTextContentStarted
                    if (!isCurrentTextBlock) {
                      const contentBlockStop = {
                        type: "content_block_stop",
                        index: currentContentBlockIndex,
                      }
                      safeEnqueue(
                        encoder.encode(
                          `event: content_block_stop\ndata: ${JSON.stringify(
                            contentBlockStop
                          )}\n\n`
                        )
                      )
                      currentContentBlockIndex = -1
                    }
                  }

                  if (!hasTextContentStarted && !hasFinished) {
                    const contentBlockStart = {
                      type: "content_block_start",
                      index: contentIndex,
                      content_block: {
                        type: "text",
                        text: "",
                      },
                    }
                    safeEnqueue(
                      encoder.encode(
                        `event: content_block_start\ndata: ${JSON.stringify(
                          contentBlockStart
                        )}\n\n`
                      )
                    )
                    currentContentBlockIndex = contentIndex
                    hasTextContentStarted = true
                  }

                  if (!isClosed && !hasFinished) {
                    // Periksa apakah konten delta tidak kosong sebelum mengirim
                    if (
                      choice.delta.content &&
                      choice.delta.content.length > 0
                    ) {
                      // Cek apakah konten ini adalah duplikat dari yang terakhir dikirim
                      if (choice.delta.content !== lastSentContent) {
                        // Kirim konten delta
                        const anthropicChunk = {
                          type: "content_block_delta",
                          index: currentContentBlockIndex, // Use current content block index
                          delta: {
                            type: "text_delta",
                            text: choice.delta.content,
                          },
                        }
                        safeEnqueue(
                          encoder.encode(
                            `event: content_block_delta\ndata: ${JSON.stringify(
                              anthropicChunk
                            )}\n\n`
                          )
                        )
                        // Simpan konten terakhir yang dikirim
                        lastSentContent = choice.delta.content
                      }
                    }
                  }
                }

                if (
                  choice?.delta?.annotations?.length &&
                  !isClosed &&
                  !hasFinished
                ) {
                  // Close text content block if open
                  if (currentContentBlockIndex >= 0 && hasTextContentStarted) {
                    const contentBlockStop = {
                      type: "content_block_stop",
                      index: currentContentBlockIndex,
                    }
                    safeEnqueue(
                      encoder.encode(
                        `event: content_block_stop\ndata: ${JSON.stringify(
                          contentBlockStop
                        )}\n\n`
                      )
                    )
                    currentContentBlockIndex = -1
                    hasTextContentStarted = false
                  }

                  choice?.delta?.annotations.forEach((annotation: any) => {
                    contentIndex++
                    const contentBlockStart = {
                      type: "content_block_start",
                      index: contentIndex,
                      content_block: {
                        type: "web_search_tool_result",
                        tool_use_id: `srvtoolu_${uuidv4()}`,
                        content: [
                          {
                            type: "web_search_result",
                            title: annotation.url_citation.title,
                            url: annotation.url_citation.url,
                          },
                        ],
                      },
                    }
                    safeEnqueue(
                      encoder.encode(
                        `event: content_block_start\ndata: ${JSON.stringify(
                          contentBlockStart
                        )}\n\n`
                      )
                    )

                    const contentBlockStop = {
                      type: "content_block_stop",
                      index: contentIndex,
                    }
                    safeEnqueue(
                      encoder.encode(
                        `event: content_block_stop\ndata: ${JSON.stringify(
                          contentBlockStop
                        )}\n\n`
                      )
                    )
                    currentContentBlockIndex = -1
                  })
                }

                if (choice?.delta?.tool_calls && !isClosed && !hasFinished) {
                  toolCallChunks++
                  const processedInThisChunk = new Set<number>()

                  for (const toolCall of choice.delta.tool_calls) {
                    if (isClosed) break
                    const toolCallIndex = toolCall.index ?? 0
                    if (processedInThisChunk.has(toolCallIndex)) {
                      continue
                    }
                    processedInThisChunk.add(toolCallIndex)
                    const isUnknownIndex =
                      !toolCallIndexToContentBlockIndex.has(toolCallIndex)

                    if (isUnknownIndex) {
                      // Close any previous content block if open
                      if (currentContentBlockIndex >= 0) {
                        const contentBlockStop = {
                          type: "content_block_stop",
                          index: currentContentBlockIndex,
                        }
                        safeEnqueue(
                          encoder.encode(
                            `event: content_block_stop\ndata: ${JSON.stringify(
                              contentBlockStop
                            )}\n\n`
                          )
                        )
                        currentContentBlockIndex = -1
                      }

                      const newContentBlockIndex = contentIndex
                      toolCallIndexToContentBlockIndex.set(
                        toolCallIndex,
                        newContentBlockIndex
                      )
                      contentIndex++ // Increment contentIndex after setting the mapping
                      const toolCallId =
                        toolCall.id || `call_${Date.now()}_${toolCallIndex}`
                      const toolCallName =
                        toolCall.function?.name || `tool_${toolCallIndex}`
                      const contentBlockStart = {
                        type: "content_block_start",
                        index: newContentBlockIndex,
                        content_block: {
                          type: "tool_use",
                          id: toolCallId,
                          name: toolCallName,
                          input: {},
                        },
                      }

                      safeEnqueue(
                        encoder.encode(
                          `event: content_block_start\ndata: ${JSON.stringify(
                            contentBlockStart
                          )}\n\n`
                        )
                      )
                      currentContentBlockIndex = newContentBlockIndex

                      const toolCallInfo = {
                        id: toolCallId,
                        name: toolCallName,
                        arguments: "",
                        contentBlockIndex: newContentBlockIndex,
                      }
                      toolCalls.set(toolCallIndex, toolCallInfo)
                    } else if (toolCall.id && toolCall.function?.name) {
                      const existingToolCall = toolCalls.get(toolCallIndex)!
                      const wasTemporary =
                        existingToolCall.id.startsWith("call_") &&
                        existingToolCall.name.startsWith("tool_")

                      if (wasTemporary) {
                        existingToolCall.id = toolCall.id
                        existingToolCall.name = toolCall.function.name
                      }
                    }

                    if (
                      toolCall.function?.arguments &&
                      !isClosed &&
                      !hasFinished
                    ) {
                      const blockIndex =
                        toolCallIndexToContentBlockIndex.get(toolCallIndex)
                      if (blockIndex === undefined) {
                        continue
                      }
                      const currentToolCall = toolCalls.get(toolCallIndex)
                      if (currentToolCall) {
                        currentToolCall.arguments += toolCall.function.arguments
                      }

                      try {
                        const anthropicChunk = {
                          type: "content_block_delta",
                          index: blockIndex, // Use the correct content block index
                          delta: {
                            type: "input_json_delta",
                            partial_json: toolCall.function.arguments,
                          },
                        }
                        safeEnqueue(
                          encoder.encode(
                            `event: content_block_delta\ndata: ${JSON.stringify(
                              anthropicChunk
                            )}\n\n`
                          )
                        )
                      } catch (error: any) {
                        try {
                          const fixedArgument = toolCall.function.arguments
                            .replace(/[\x00-\x1F\x7F-\x9F]/g, "")
                            .replace(/\\/g, "\\\\")
                            .replace(/"/g, '\\"')

                          const fixedChunk = {
                            type: "content_block_delta",
                            index: blockIndex, // Use the correct content block index
                            delta: {
                              type: "input_json_delta",
                              partial_json: fixedArgument,
                            },
                          }
                          safeEnqueue(
                            encoder.encode(
                              `event: content_block_delta\ndata: ${JSON.stringify(
                                fixedChunk
                              )}\n\n`
                            )
                          )
                        } catch (fixError: any) {
                          console.error(fixError)
                        }
                      }
                    }
                  }
                }

                if (choice?.finish_reason && !isClosed && !hasFinished) {
                  if (contentChunks === 0 && toolCallChunks === 0) {
                    console.error("Warning: No content in the stream response!")
                  }

                  // Close any remaining open content block
                  if (currentContentBlockIndex >= 0) {
                    const contentBlockStop = {
                      type: "content_block_stop",
                      index: currentContentBlockIndex,
                    }
                    safeEnqueue(
                      encoder.encode(
                        `event: content_block_stop\ndata: ${JSON.stringify(
                          contentBlockStop
                        )}\n\n`
                      )
                    )
                    currentContentBlockIndex = -1
                  }

                  if (!isClosed) {
                    const stopReasonMapping: Record<string, string> = {
                      stop: "end_turn",
                      length: "max_tokens",
                      tool_calls: "tool_use",
                      content_filter: "stop_sequence",
                    }

                    const anthropicStopReason =
                      stopReasonMapping[choice.finish_reason] || "end_turn"

                    stopReasonMessageDelta = {
                      type: "message_delta",
                      delta: {
                        stop_reason: anthropicStopReason,
                        stop_sequence: null,
                      },
                      usage: {
                        input_tokens: chunk.usage?.prompt_tokens || 0,
                        output_tokens: chunk.usage?.completion_tokens || 0,
                        cache_read_input_tokens:
                          chunk.usage?.cache_read_input_tokens || 0,
                      },
                    }
                  }

                  break
                }
              } catch (parseError: any) {
                this.logger?.error(
                  `parseError: ${parseError.name} message: ${parseError.message} stack: ${parseError.stack} data: ${data}`
                )
              }
            }
          }
          safeClose()
        } catch (error: any) {
          if (!isClosed) {
            try {
              controller.error(error)
            } catch (controllerError: any) {
              console.error(controllerError)
            }
          }
        } finally {
          if (reader) {
            try {
              reader.releaseLock()
            } catch (releaseError: any) {
              console.error(releaseError)
            }
          }
        }
      },
      cancel: (reason) => {
        this.logger.debug(`cancle stream: ${reason}`)
      },
    })

    return readable
  }

  private convertOpenAIResponseToAnthropic(
    openaiResponse: ChatCompletion
  ): any {
    this.logger.debug({ response: openaiResponse }, `Original OpenAI response`)
    try {
      const choice = openaiResponse.choices[0]
      if (!choice) {
        throw new Error("No choices found in OpenAI response")
      }
      const content: any[] = []
      if (choice.message.annotations) {
        const id = `srvtoolu_${uuidv4()}`
        content.push({
          type: "server_tool_use",
          id,
          name: "web_search",
          input: {
            query: "",
          },
        })
        content.push({
          type: "web_search_tool_result",
          tool_use_id: id,
          content: choice.message.annotations.map((item: any) => {
            return {
              type: "web_search_result",
              url: item.url_citation.url,
              title: item.url_citation.title,
            }
          }),
        })
      }
      if (choice.message.content) {
        // Hanya tambahkan konten jika belum ada konten teks sebelumnya
        const hasTextContent = content.some(
          (item) => item.type === "text" && item.text === choice.message.content
        )
        if (!hasTextContent) {
          content.push({
            type: "text",
            text: choice.message.content,
          })
        }
      }
      if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
        choice.message.tool_calls.forEach((toolCall: any, index: number) => {
          let parsedInput = {}
          try {
            const argumentsStr = toolCall.function?.arguments || "{}"

            if (typeof argumentsStr === "object") {
              parsedInput = argumentsStr
            } else if (typeof argumentsStr === "string") {
              parsedInput = JSON.parse(argumentsStr)
            }
          } catch (parseError) {
            parsedInput = { text: toolCall.function?.arguments || "" }
          }

          content.push({
            type: "tool_use",
            id: toolCall.id,
            name: toolCall.function?.name,
            input: parsedInput,
          })
        })
      }

      const result = {
        id: openaiResponse.id,
        type: "message",
        role: "assistant",
        model: openaiResponse.model,
        content: content,
        stop_reason:
          choice.finish_reason === "stop"
            ? "end_turn"
            : choice.finish_reason === "length"
            ? "max_tokens"
            : choice.finish_reason === "tool_calls"
            ? "tool_use"
            : choice.finish_reason === "content_filter"
            ? "stop_sequence"
            : "end_turn",
        stop_sequence: null,
        usage: {
          input_tokens: openaiResponse.usage?.prompt_tokens || 0,
          output_tokens: openaiResponse.usage?.completion_tokens || 0,
        },
      }
      this.logger.debug(
        { result },
        `Conversion complete, final Anthropic response`
      )
      return result
    } catch (e) {
      throw createApiError(
        `Provider error: ${JSON.stringify(openaiResponse)}`,
        500,
        "provider_error"
      )
    }
  }
}
