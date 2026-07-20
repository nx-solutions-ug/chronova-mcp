export class ChronovaApiError extends Error {
  statusCode: number;
  code: string;
  retryAfter?: number;

  constructor(message: string, statusCode: number, code: string, retryAfter?: number) {
    super(message);
    this.name = "ChronovaApiError";
    this.statusCode = statusCode;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

export function mapHttpStatusToError(response: Response, _url: string): ChronovaApiError {
  const status = response.status;
  const statusText = response.statusText;

  switch (status) {
    case 401:
      return new ChronovaApiError(
        "Unauthorized: Invalid or expired API key. Check your CHRONOVA_API_KEY configuration.",
        401,
        "UNAUTHORIZED",
      );

    case 429: {
      let retryAfter: number | undefined;
      const retryAfterHeader = response.headers.get("Retry-After");
      if (retryAfterHeader) {
        const parsed = Number(retryAfterHeader);
        if (!Number.isNaN(parsed)) {
          retryAfter = parsed;
        }
      }
      if (retryAfter === undefined) {
        const resetHeader = response.headers.get("X-RateLimit-Reset");
        if (resetHeader) {
          const resetEpoch = Number(resetHeader);
          if (!Number.isNaN(resetEpoch) && resetEpoch > 0) {
            const remaining = Math.max(0, Math.ceil(resetEpoch - Date.now() / 1000));
            retryAfter = remaining;
          }
        }
      }
      const suffix = retryAfter !== undefined ? ` Retry after ${retryAfter} seconds.` : "";
      return new ChronovaApiError(
        `Rate limited: Too many requests.${suffix}`,
        429,
        "RATE_LIMITED",
        retryAfter,
      );
    }

    case 404:
      return new ChronovaApiError(
        "Not found: The requested resource does not exist.",
        404,
        "NOT_FOUND",
      );

    default:
      if (status >= 500) {
        return new ChronovaApiError(
          `Chronova server error: ${statusText}. Please try again later.`,
          status,
          "SERVER_ERROR",
        );
      }

      return new ChronovaApiError(
        `Chronova API error: ${status} ${statusText}`,
        status,
        "API_ERROR",
      );
  }
}

export function mapNetworkError(error: unknown, url: string): ChronovaApiError {
  return new ChronovaApiError(
    `Cannot connect to Chronova at ${url}. Check CHRONOVA_API_URL configuration.`,
    0,
    "CONNECTION_ERROR",
  );
}
export function formatToolError(error: unknown) {
  if (error instanceof ChronovaApiError) {
    return {
      content: [{ type: "text" as const, text: error.message }],
      isError: true,
    };
  }
  return {
    content: [
      {
        type: "text" as const,
        text: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
      },
    ],
    isError: true,
  };
}
