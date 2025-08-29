# Contoh Konversi dari OpenAI ke Gemini

Dokumen ini memberikan contoh bagaimana permintaan dan respons dikonversi dari format OpenAI ke format Gemini menggunakan sistem transformer dalam proyek ini.

## Contoh Permintaan

### Permintaan dalam format OpenAI:
```json
{
  "messages": [
    {
      "role": "user",
      "content": "Halo, siapa namamu?"
    }
  ],
  "model": "gpt-3.5-turbo"
}
```

### Permintaan yang dikonversi ke format Unified:
```typescript
{
  messages: [
    {
      role: "user",
      content: "Halo, siapa namamu?"
    }
  ],
  model: "gpt-3.5-turbo"
}
```

### Permintaan yang dikonversi ke format Gemini:
```json
{
  "contents": [
    {
      "role": "user",
      "parts": [
        {
          "text": "Halo, siapa namamu?"
        }
      ]
    }
  ],
  "model": "gpt-3.5-turbo"
}
```

## Contoh Respons

### Respons dari API OpenAI:
```json
{
  "id": "chatcmpl-123",
  "object": "chat.completion",
  "created": 1677652288,
  "model": "gpt-3.5-turbo",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Halo! Nama saya ChatGPT. Senang berkenalan dengan Anda!"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 9,
    "completion_tokens": 12,
    "total_tokens": 21
  }
}
```

### Respons yang dikonversi ke format Gemini:
```json
{
  "candidates": [
    {
      "content": {
        "parts": [
          {
            "text": "Halo! Nama saya ChatGPT. Senang berkenalan dengan Anda!"
          }
        ]
      },
      "finishReason": "STOP"
    }
  ],
  "modelVersion": "gpt-3.5-turbo"
}
```

## Contoh dengan Tool Calling

### Permintaan dengan Tool dalam format OpenAI:
```json
{
  "messages": [
    {
      "role": "user",
      "content": "Berapa cuaca saat ini di Jakarta?"
    }
  ],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "get_current_weather",
        "description": "Mendapatkan cuaca saat ini untuk sebuah lokasi",
        "parameters": {
          "type": "object",
          "properties": {
            "location": {
              "type": "string",
              "description": "Nama kota, misalnya: Jakarta, Bandung"
            }
          }
        }
      }
    }
  ],
  "tool_choice": "auto",
  "model": "gpt-3.5-turbo"
}
```

### Respons dengan Tool Call dari API OpenAI:
```json
{
  "id": "chatcmpl-123",
  "object": "chat.completion",
  "created": 1677652288,
  "model": "gpt-3.5-turbo",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": null,
        "tool_calls": [
          {
            "id": "call_123",
            "type": "function",
            "function": {
              "name": "get_current_weather",
              "arguments": "{\"location\":\"Jakarta\"}"
            }
          }
        ]
      },
      "finish_reason": "tool_calls"
    }
  ]
}
```

### Respons yang dikonversi ke format Gemini:
```json
{
  "candidates": [
    {
      "content": {
        "parts": [
          {
            "functionCall": {
              "name": "get_current_weather",
              "args": {
                "location": "Jakarta"
              }
            }
          }
        ]
      }
    }
  ],
  "modelVersion": "gpt-3.5-turbo"
}
```