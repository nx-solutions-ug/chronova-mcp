#!/usr/bin/env node
import { startServer } from "./server.js";

const HELP_TEXT = `
Usage: @chronova/mcp-server [options]

Options:
  --port <number>     Port to listen on (default: 3001)
  --api-url <url>     Chronova API URL (default: https://chronova.dev/api/v1)
  --help              Show this help message

Configuration priority:
  1. Environment variables (CHRONOVA_API_KEY, CHRONOVA_API_URL)
  2. ~/.chronova.cfg file (api_key, api_url under [settings])
  3. ~/.wakatime.cfg file (api_key, api_url under [settings])
  4. Defaults

Environment variables:
  CHRONOVA_API_KEY    Your Chronova API key (required if no config file)
  CHRONOVA_API_URL    Chronova API URL (default: https://chronova.dev/api/v1)
  PORT                Server port (default: 3001)
`;

function parseArgs(): void {
  const args = process.argv.slice(2);
  let i = 0;

  while (i < args.length) {
    const arg = args[i];

    if (arg === "--help") {
      console.log(HELP_TEXT.trim());
      process.exit(0);
    }

    if (arg === "--port") {
      const value = args[++i];
      if (!value || isNaN(Number(value))) {
        console.error("Error: --port requires a number");
        process.exit(1);
      }
      process.env.PORT = value;
    } else if (arg === "--api-url") {
      const value = args[++i];
      if (!value) {
        console.error("Error: --api-url requires a URL");
        process.exit(1);
      }
      process.env.CHRONOVA_API_URL = value;
    } else {
      console.error(`Error: Unknown option '${arg}'`);
      console.log(HELP_TEXT.trim());
      process.exit(1);
    }

    i++;
  }
}

parseArgs();
startServer();