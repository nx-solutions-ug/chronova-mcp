import { startServer } from "./server.js";

const HELP_TEXT = `
Usage: @chronova/mcp-server [options]

Options:
  --port <number>     Port to listen on (default: 3001)
  --api-url <url>     Chronova API URL (default: https://chronova.dev)
  --help              Show this help message

Environment variables:
  CHRONOVA_API_KEY    Required. Your Chronova API key
  CHRONOVA_API_URL    Chronova API URL (default: https://chronova.dev)
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