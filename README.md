# A Fork of Claude Code Router

## 🚀 Getting Started

### 1. Installation

```shell
npm install -g @qwen-code/qwen-code@latest

```

Then, install Claude Code Router:

```shell
pnpm i
pnpm build
./scripts/update-ccr-api-keys.sh
pnpm start
```

### 2. Configuration

Create and configure your `~/${CONFIG_DIR:-.ccr}/config.json` file. For more details, you can refer to `config.example.json`.

The `config.json` file has several key sections:

- **`PROXY_URL`** (optional): You can set a proxy for API requests, for example: `"PROXY_URL": "http://127.0.0.1:4567"`.
- **`LOG`** (optional): You can enable logging by setting it to `true`. When set to `false`, no log files will be created. Default is `true`.
- **`LOG_LEVEL`** (optional): Set the logging level. Available options are: `"fatal"`, `"error"`, `"warn"`, `"info"`, `"debug"`, `"trace"`. Default is `"debug"`.

### 3.Added OpenAi Endpoint

```
http://127.0.0.1:4567/v1/models
http://127.0.0.1:4567/v1/chat/completions

```
