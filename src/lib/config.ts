import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface ChronovaConfig {
  apiKey: string;
  apiUrl: string;
  port: number;
  configSource: "env" | "chronova.cfg" | "wakatime.cfg" | "none";
}

export interface ResolveConfigOptions {
  readFile?: (path: string) => Record<string, string> | null;
  getHomeDir?: () => string;
  env?: NodeJS.ProcessEnv;
}

const DEFAULT_API_URL = "https://chronova.dev/api/v1";
const DEFAULT_PORT = 3001;

export function parseIniFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("[") || trimmed.startsWith("#") || trimmed.startsWith(";")) {
      continue;
    }
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    result[key] = value;
  }
  return result;
}

export function readConfigFile(filePath: string): Record<string, string> | null {
  try {
    const content = readFileSync(filePath, "utf-8");
    return parseIniFile(content);
  } catch {
    return null;
  }
}

export function resolveConfig(options?: ResolveConfigOptions): ChronovaConfig {
  const readFile = options?.readFile ?? readConfigFile;
  const getHome = options?.getHomeDir ?? homedir;
  const env = options?.env ?? process.env;

  const envApiKey = env.CHRONOVA_API_KEY;
  const envApiUrl = env.CHRONOVA_API_URL;
  const envPort = env.PORT;

  if (envApiKey) {
    return {
      apiKey: envApiKey,
      apiUrl: envApiUrl ?? DEFAULT_API_URL,
      port: envPort ? Number(envPort) : DEFAULT_PORT,
      configSource: "env",
    };
  }

  const chronovaCfg = readFile(join(getHome(), ".chronova.cfg"));
  if (chronovaCfg?.api_key) {
    return {
      apiKey: chronovaCfg.api_key,
      apiUrl: envApiUrl ?? chronovaCfg.api_url ?? DEFAULT_API_URL,
      port: envPort ? Number(envPort) : DEFAULT_PORT,
      configSource: "chronova.cfg",
    };
  }

  const wakatimeCfg = readFile(join(getHome(), ".wakatime.cfg"));
  if (wakatimeCfg?.api_key) {
    return {
      apiKey: wakatimeCfg.api_key,
      apiUrl: envApiUrl ?? wakatimeCfg.api_url ?? DEFAULT_API_URL,
      port: envPort ? Number(envPort) : DEFAULT_PORT,
      configSource: "wakatime.cfg",
    };
  }

  return {
    apiKey: "",
    apiUrl: envApiUrl ?? DEFAULT_API_URL,
    port: envPort ? Number(envPort) : DEFAULT_PORT,
    configSource: "none",
  };
}