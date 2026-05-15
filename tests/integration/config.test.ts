import { describe, it, expect } from "vitest";
import { parseIniFile, resolveConfig } from "../../src/lib/config.js";

const NO_CONFIG: Record<string, string> | null = null;

function makeConfigFile(entries: Record<string, string>): Record<string, string> {
  return entries;
}

describe("parseIniFile", () => {
  it("should parse key=value pairs under a section", () => {
    const content = `[settings]
api_key = test-key-123
api_url = https://example.com/api/v1
debug = true`;

    const result = parseIniFile(content);
    expect(result.api_key).toBe("test-key-123");
    expect(result.api_url).toBe("https://example.com/api/v1");
    expect(result.debug).toBe("true");
  });

  it("should handle whitespace around keys and values", () => {
    const content = `[settings]
  api_key   =   spaced-key  
api_url=https://example.com`;

    const result = parseIniFile(content);
    expect(result.api_key).toBe("spaced-key");
    expect(result.api_url).toBe("https://example.com");
  });

  it("should skip comments and empty lines", () => {
    const content = `# this is a comment
; this is also a comment

[settings]
api_key = test-key

# another comment
api_url = https://example.com`;

    const result = parseIniFile(content);
    expect(result.api_key).toBe("test-key");
    expect(result.api_url).toBe("https://example.com");
    expect(Object.keys(result)).toHaveLength(2);
  });

  it("should skip lines without equals sign", () => {
    const content = `[settings]
api_key = test-key
this_is_not_a_setting
api_url = https://example.com`;

    const result = parseIniFile(content);
    expect(Object.keys(result)).toHaveLength(2);
  });

  it("should handle empty content", () => {
    const result = parseIniFile("");
    expect(Object.keys(result)).toHaveLength(0);
  });

  it("should handle values with equals signs", () => {
    const content = `[settings]
api_key = key=with=equals`;

    const result = parseIniFile(content);
    expect(result.api_key).toBe("key=with=equals");
  });
});

describe("resolveConfig", () => {
  it("should use environment variable when CHRONOVA_API_KEY is set", () => {
    const config = resolveConfig({
      env: { CHRONOVA_API_KEY: "env-key-123" },
      readFile: () => NO_CONFIG,
    });
    expect(config.apiKey).toBe("env-key-123");
    expect(config.configSource).toBe("env");
  });

  it("should prefer env key over config files", () => {
    const config = resolveConfig({
      env: { CHRONOVA_API_KEY: "env-key" },
      readFile: (path: string) =>
        path.includes(".chronova.cfg")
          ? makeConfigFile({ api_key: "file-key" })
          : NO_CONFIG,
    });
    expect(config.apiKey).toBe("env-key");
    expect(config.configSource).toBe("env");
  });

  it("should return empty apiKey and source 'none' when nothing is configured", () => {
    const config = resolveConfig({
      env: {},
      readFile: () => NO_CONFIG,
    });
    expect(config.apiKey).toBe("");
    expect(config.configSource).toBe("none");
  });

  it("should use default API URL when not configured", () => {
    const config = resolveConfig({
      env: {},
      readFile: () => NO_CONFIG,
    });
    expect(config.apiUrl).toBe("https://chronova.dev/api/v1");
  });

  it("should use CHRONOVA_API_URL from env when set", () => {
    const config = resolveConfig({
      env: { CHRONOVA_API_URL: "https://custom.api.com" },
      readFile: () => NO_CONFIG,
    });
    expect(config.apiUrl).toBe("https://custom.api.com");
  });

  it("should use PORT from env when set", () => {
    const config = resolveConfig({
      env: { PORT: "8080" },
      readFile: () => NO_CONFIG,
    });
    expect(config.port).toBe(8080);
  });

  it("should use default port 3001 when not configured", () => {
    const config = resolveConfig({
      env: {},
      readFile: () => NO_CONFIG,
    });
    expect(config.port).toBe(3001);
  });

  it("should fall back to chronova.cfg when env var is not set", () => {
    const config = resolveConfig({
      env: {},
      readFile: (path: string) =>
        path.includes(".chronova.cfg")
          ? makeConfigFile({ api_key: "chronova-cfg-key", api_url: "https://chronova-cfg.example.com" })
          : NO_CONFIG,
    });
    expect(config.apiKey).toBe("chronova-cfg-key");
    expect(config.configSource).toBe("chronova.cfg");
  });

  it("should fall back to wakatime.cfg when env and chronova.cfg are unavailable", () => {
    const config = resolveConfig({
      env: {},
      readFile: (path: string) =>
        path.includes(".wakatime.cfg")
          ? makeConfigFile({ api_key: "wakatime-cfg-key", api_url: "https://wakatime-cfg.example.com" })
          : NO_CONFIG,
    });
    expect(config.apiKey).toBe("wakatime-cfg-key");
    expect(config.configSource).toBe("wakatime.cfg");
  });

  it("should prefer chronova.cfg over wakatime.cfg", () => {
    const config = resolveConfig({
      env: {},
      readFile: (path: string) => {
        if (path.includes(".chronova.cfg")) {
          return makeConfigFile({ api_key: "chronova-priority", api_url: "https://chronova.example.com" });
        }
        if (path.includes(".wakatime.cfg")) {
          return makeConfigFile({ api_key: "wakatime-lower", api_url: "https://wakatime.example.com" });
        }
        return NO_CONFIG;
      },
    });
    expect(config.apiKey).toBe("chronova-priority");
    expect(config.configSource).toBe("chronova.cfg");
    expect(config.apiUrl).toBe("https://chronova.example.com");
  });

  it("should use env API URL even when config file provides API key", () => {
    const config = resolveConfig({
      env: { CHRONOVA_API_URL: "https://env-url.com" },
      readFile: (path: string) =>
        path.includes(".chronova.cfg")
          ? makeConfigFile({ api_key: "file-key", api_url: "https://file-url.com" })
          : NO_CONFIG,
    });
    expect(config.apiKey).toBe("file-key");
    expect(config.apiUrl).toBe("https://env-url.com");
    expect(config.configSource).toBe("chronova.cfg");
  });

  it("should use api_url from chronova.cfg when env API URL is not set", () => {
    const config = resolveConfig({
      env: {},
      readFile: (path: string) =>
        path.includes(".chronova.cfg")
          ? makeConfigFile({ api_key: "cfg-key", api_url: "https://cfg-url.com/api/v1" })
          : NO_CONFIG,
    });
    expect(config.apiKey).toBe("cfg-key");
    expect(config.apiUrl).toBe("https://cfg-url.com/api/v1");
  });

  it("should use custom home directory", () => {
    const config = resolveConfig({
      env: {},
      getHomeDir: () => "/custom/home",
      readFile: (path: string) => {
        expect(path).toContain("/custom/home");
        return NO_CONFIG;
      },
    });
    expect(config.configSource).toBe("none");
  });
});