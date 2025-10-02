import path from "node:path"
import os from "node:os"

const CONFIG_DIR = process.env.CONFIG_DIR || ".ccr"
export const HOME_DIR = path.join(os.homedir(), CONFIG_DIR)

export const CONFIG_FILE = path.join(HOME_DIR, "config.json")

export const PLUGINS_DIR = path.join(HOME_DIR, "plugins")

export const PID_FILE = path.join(HOME_DIR, ".ccr-01.pid")

export const REFERENCE_COUNT_FILE = path.join(
  os.tmpdir(),
  "custom-claude-code-reference-count.txt"
)

export const DEFAULT_CONFIG = {
  LOG: false,
  OPENAI_API_KEY: "",
  OPENAI_BASE_URL: "",
  OPENAI_MODEL: "",
}
