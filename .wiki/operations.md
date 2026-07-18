---
type: Operations
title: "Operations & release"
description: "Building, running, Docker, CI, and semantic-release pipeline for @chronova/mcp-server."
tags: [operations, docker, release, ci]
---

# Operations & release

## Build & run

| Command | Effect |
|---|---|
| `npm run build` | `tsc` compiles `src/` → `dist/` |
| `npm run type-check` | `tsc --noEmit` |
| `npm run dev` | `tsc --watch` + `node --watch dist/index.js` (HTTP) |
| `npm start` | `node dist/index.js` (HTTP entrypoint) |
| `npm run lint` | `eslint .` |

`package.json#main` is `dist/index.js` (HTTP), and `package.json#bin.chronova-mcp-server` points at `dist/stdio.js` (stdio). The published package includes only `dist/` and `README.md` (see `files`).

Node engine: `>=18`. TypeScript target is configured by `tsconfig.json`.

## Docker

`Dockerfile` is a two-stage build on `node:24-alpine`:

1. **Builder** — `npm ci`, copies `tsconfig.json` + `src/`, runs `npm run build`.
2. **Runtime** — copies `dist/` and `node_modules` from the builder, plus `package*.json`. Sets `ENV PORT=3001`, `EXPOSE 3001`, and `CMD ["node", "dist/index.js"]`.

The image runs the **HTTP entrypoint**, so Docker deployment is HTTP-transport only.

```bash
docker build -t chronova-mcp .
docker run -e CHRONOVA_API_KEY=your-key -p 3001:3001 chronova-mcp
```

`/health` is available for liveness/readiness probes; graceful shutdown is handled via `SIGTERM`/`SIGINT` in `startServer()`.

## Release — semantic-release

Release is automated via **semantic-release** (`npm run semantic-release`). Configuration in `.releaserc.json` plus these devDependencies:

- `@semantic-release/commit-analyzer` — determines version bump from conventional commits.
- `@semantic-release/release-notes-generator` — generates changelog.
- `@semantic-release/changelog` + `@semantic-release/git` — update `CHANGELOG.md` and commit it back.
- `@semantic-release/npm` — publish to npm (`"publishConfig": { "access": "public" }`).
- `@semantic-release/github` — GitHub release.

The npm package name is `@chronova/mcp-server` (currently `version: "1.1.0"` in `package.json`). Note the `McpServer` internal `VERSION = "0.1.0"` constant in `server.ts`/`stdio.ts` is **independent** of the npm package version and is what `/health` and `initialize` report.

`.releaserc.json` tracks:

- `main`
- `beta` as a prerelease (`beta`)
- `alpha` as a prerelease (`alpha`)
- tag format `v${version}`
- release notes truncated to 120 KB with a link to the full `CHANGELOG.md`

`renovate.json` configures dependency automation.

## Continuous integration

`.github/workflows/test.yml` runs on push/PR to `main`, `develop`, `feat/*`, and `fix/*`:

| Job | What it does |
|---|---|
| `type-check` | `npm run type-check` |
| `lint` | `npm run lint` |
| `build` | `npm run build` |
| `test` | `npm test` |

Concurrency is grouped by workflow + ref and cancels in-flight runs on the same ref.

`.github/workflows/release.yml` runs on every push to `main`: a `test` job runs type-check and lint, then a `release` job uses a GitHub App token and `npx semantic-release` to publish to npm and cut a GitHub release.

`.github/workflows/update-wiki.yml` regenerates `.wiki/` daily at 08:00 UTC and on every push to `main`, opening (or updating) a PR from a `wiki/update-{timestamp}` branch using a GitHub App token.

`.github/workflows/auto-manage.yml` auto-tags new/reopened issues with `needs-triage` and auto-assigns issues/PRs to `niklasschaeffer`.

`.github/workflows/omp.yml`, `omp-ci.yml`, and `omp-fix-issue.yml` drive the OMP agent automation (issue triage, PR labelling/review, issue fixing). They consume the `.omp/` command/rule configuration and are not part of the MCP server itself.

## Publishing notes

- `prepublishOnly` runs `npm run build`, ensuring `dist/` is fresh before publish.
- `private: false` and `publishConfig.access: public` make the scoped package publicly installable.
- The published tarball is limited to `dist/` + `README.md` by `files`; tests, sources, and configs are excluded.
- `CHANGELOG.md`, `package.json`, and `package-lock.json` are updated by semantic-release; do not edit them by hand.
