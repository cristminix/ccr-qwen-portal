import path from "node:path"

export const CONFIG_DIR = path.join(process.cwd(), ".ccr")

export const CONFIG_FILE = path.join(CONFIG_DIR, "config.json")

export const PLUGINS_DIR = path.join(CONFIG_DIR, "plugins")

export const PID_FILE = path.join(CONFIG_DIR, ".ccr.pid")
export const DEFAULT_PORT = 6789
export const APP_NAME = "ccr"
export const REFERENCE_COUNT_FILE = path.join(
  CONFIG_DIR,
  "ccr-reference-count.txt"
)
export const DEFAULT_LOG_FILE = path.join(CONFIG_DIR, "logs", "server.log")

export const DEFAULT_CONFIG = {
  LOG: false,
  OPENAI_API_KEY: "",
  OPENAI_BASE_URL: "",
  OPENAI_MODEL: "",
}
