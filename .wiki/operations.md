---
type: Operations
title: "Operations & release"
description: "Building, running, Docker, and semantic-release pipeline for @chronova/mcp-server."
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

Note: the runtime copies the *full* `node_modules` from the builder (no production prune), since the builder already installed via `npm ci`. The image runs the **HTTP entrypoint**, so Docker deployment is HTTP-transport only.

```bash
docker build -t chronova-mcp .
docker run -e CHRONOVA_API_KEY=your-key -p 3001:3001 chronova-mcp
```

`/health` is available for liveness/readiness probes; graceful shutdown is handled via `SIGTERM`/`SIGINT` in `startServer()`.

## Release — semantic-release

Release is automated via **semantic-release** (`npm run semantic-release`). Configuration in `.releaserc.json` plus these devDependencies:

- `@semantic-release/commit-analyzer` — determines version bump from conventional commits.
- `@semantic-release/release-notes-generator` — generates changelog.
- `@semantic-release/changelog` + `@semantic-release/git` — update `CHANGELOG.md`, `package.json`, and `package-lock.json` and commit them back.
- `@semantic-release/npm` — publish to npm (`"publishConfig": { "access": "public" }`).
- `@semantic-release/github` — GitHub release.

The npm package name is `@chronova/mcp-server` (currently `version: "1.1.3"` in `package.json`). `src/version.ts` reads this value from `package.json` at import time, so the version reported by `/health` and MCP `initialize` is always the same as the published package version.

Release branches: `.releaserc.json` targets `main` plus two prerelease channels, `beta` and `alpha`. Pushes to `beta` produce `v{version}-beta.N` tags/prereleases; pushes to `alpha` produce `v{version}-alpha.N`.

### Full-changelog release notes

After semantic-release runs, `.github/workflows/release.yml` runs a post-release step that replaces the GitHub release body with the **full commit list** since the previous tag (all commits, not just conventional `feat`/`fix`/`perf`). It:

1. Captures the latest tag **before** semantic-release (`pre-tag`) and compares it with the latest tag **after**. If the tag did not change, the step exits cleanly and skips the update — this prevents no-op releases from erasing release notes.
2. Derives the previous tag from `git tag --sort=-creatordate` and generates `git log --pretty=format:"- %s (%h)" --no-merges <previous>..<latest>`.
3. Writes the commit list under a `## What's Changed` header.
4. If the body exceeds 120 kB, truncates at the last complete line and appends a link to `CHANGELOG.md`.

`renovate.json` configures dependency automation; `.github/` holds CI workflows (not inspected in detail here).

## Publishing notes

- `prepublishOnly` runs `npm run build`, ensuring `dist/` is fresh before publish.
- `private: false` and `publishConfig.access: public` make the scoped package publicly installable.
- The published tarball is limited to `dist/` + `README.md` by `files`; tests, sources, and configs are excluded.