# Contoh Konversi dari Gemini ke OpenAI

Dokumen ini memberikan contoh bagaimana permintaan dan respons dikonversi dari format Gemini ke format OpenAI menggunakan sistem transformer dalam proyek ini.

## Contoh Permintaan

### Permintaan dalam format Gemini:
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
  "model": "gemini-pro"
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
  model: "gemini-pro"
}
```

### Permintaan yang dikonversi ke format OpenAI:
```json
{
  "messages": [
    {
      "role": "user",
      "content": "Halo, siapa namamu?"
    }
  ],
  "model": "gemini-pro"
}
```

## Contoh Respons

### Respons dari API Gemini:
```json
{
  "candidates": [
    {
      "content": {
        "parts": [
          {
            "text": "Halo! Nama saya Gemini. Senang berkenalan dengan Anda!"
          }
        ]
      },
      "finishReason": "STOP"
    }
  ],
  "modelVersion": "gemini-pro"
}
```

### Respons yang dikonversi ke format OpenAI:
```json
{
  "id": "response-id",
  "choices": [
    {
      "finish_reason": "stop",
      "index": 0,
      "message": {
        "content": "Halo! Nama saya Gemini. Senang berkenalan dengan Anda!",
        "role": "assistant"
      }
    }
  ],
  "created": 1700000000,
  "model": "gemini-pro",
  "object": "chat.completion"
}
```

## Contoh dengan Tool Calling

### Permintaan dengan Tool dalam format Gemini:
```json
{
  "contents": [
    {
      "role": "user",
      "parts": [
        {
          "text": "Berapa cuaca saat ini di Jakarta?"
        }
      ]
    }
  ],
  "tools": [
    {
      "functionDeclarations": [
        {
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
      ]
    }
  ],
  "model": "gemini-pro"
}
```

### Respons dengan Tool Call dari API Gemini:
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
  "modelVersion": "gemini-pro"
}
```

### Respons yang dikonversi ke format OpenAI:
```json
{
  "id": "response-id",
  "choices": [
    {
      "finish_reason": null,
      "index": 0,
      "message": {
        "content": null,
        "role": "assistant",
        "tool_calls": [
          {
            "id": "tool_call_id",
            "type": "function",
            "function": {
              "name": "get_current_weather",
              "arguments": "{\"location\":\"Jakarta\"}"
            }
          }
        ]
      }
    }
  ],
  "created": 1700000000,
  "model": "gemini-pro",
  "object": "chat.completion"
}
```