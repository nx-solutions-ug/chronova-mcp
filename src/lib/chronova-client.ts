import { mapHttpStatusToError, mapNetworkError } from "./errors.js";

const DEFAULT_TIMEOUT_MS = 30_000;

export class ChronovaClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(
    baseUrl: string = process.env.CHRONOVA_API_URL ?? "https://chronova.dev",
    apiKey: string = process.env.CHRONOVA_API_KEY ?? "",
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.apiKey = apiKey;
  }

  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(path, this.baseUrl);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== "") {
          url.searchParams.set(key, value);
        }
      }
    }

    const urlStr = url.toString();

    try {
      const response = await fetch(urlStr, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw mapHttpStatusToError(response, urlStr);
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof TypeError || (error instanceof Error && error.name === "AbortError")) {
        throw mapNetworkError(error, urlStr);
      }
      throw error;
    }
  }
}