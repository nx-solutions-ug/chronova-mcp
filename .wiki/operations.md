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

## Repository automation & agent workflows

Beyond tests and release, `.github/workflows/` runs several helper workflows. These are operational infrastructure, not part of the MCP server runtime.

### Vouch gate

`.github/workflows/vouch-pr.yml` and `.github/workflows/vouch-manage.yml` implement a contributor trust gate using the `mitchellh/vouch` action:

- **PR gate** (`vouch-pr.yml`) runs on `pull_request_target` for opened/reopened/ready-for-review PRs. It auto-closes PRs from users who are not vouched and do not have write access, then adds a `vouched` label to PRs that pass.
- **Management** (`vouch-manage.yml`) lets maintainers vouch or denounce users by commenting on a Discussion: `!vouch`, `!vouch @user [reason]`, `!denounce [@user] [reason]`, `!unvouch [@user]`. Only collaborators with `admin`, `maintain`, or `write` roles are honored.

The vouched user list lives in `.github/VOUCHED.td` — one handle per line, sorted alphabetically, with `-username` to denote active denouncement. Bots (login ending with `[bot]`) and collaborators with write access are allowed automatically.

### Auto management

`.github/workflows/auto-manage.yml` tags newly opened/reopened issues with `needs-triage` and auto-assigns new issues and PRs to `niklasschaeffer`.

### OMP agent workflows

Three workflows drive an OMP-based agent that can triage issues, label PRs, review PRs, and attempt fixes:

- **`.github/workflows/omp.yml`** — comment-triggered. Runs when a comment contains `/omp` or ` /omp` on issues or pull-request review comments. It installs `gh extension install agynio/gh-pr-review --force`, installs the OMP source distribution, expands the requested `.omp/commands/<cmd>.md` prompt, and streams the agent output via `.omp/stream-log.py`.
- **`.github/workflows/omp-ci.yml`** — event-driven. On new issues it runs `.omp/commands/triage-issue.md` and dispatches `issue-triaged`. On new/updated PRs it applies type/priority labels from `.omp/commands/label-pr.md` (skipping if both a type and priority label are already present) and reviews PRs using `.omp/commands/review-pr.md`. It uses the `gh-pr-review` extension for inline review comments and can skip re-review on `synchronize` when the latest commit is authored by a known agent or GitHub Actions.
- **`.github/workflows/omp-fix-issue.yml`** — triggered by `repository_dispatch` with `issue-triaged` or manually via `workflow_dispatch`. It runs `.omp/commands/fix-issue.md` against the supplied issue number and pushes any resulting changes.

Command prompts live in `.omp/commands/`; supporting rules (idempotent label handling, tool-path arrays) are in `.omp/rules/`. The recent commit `7bcec13` synced the `gh-pr-review` extension so the `/omp review-pr` command can post inline PR review comments.

## Release — semantic-release

Release is automated via **semantic-release** (`npm run semantic-release`). Configuration in `.releaserc.json` plus these devDependencies:

- `@semantic-release/commit-analyzer` — determines version bump from conventional commits.
- `@semantic-release/release-notes-generator` — generates changelog.
- `@semantic-release/changelog` + `@semantic-release/git` — update `CHANGELOG.md`, `package.json`, and `package-lock.json` and commit them back.
- `@semantic-release/npm` — publish to npm (`"publishConfig": { "access": "public" }`).
- `@semantic-release/github` — GitHub release.

The npm package name is `@chronova/mcp-server` (currently `version: "1.6.0"` in `package.json`). `src/version.ts` reads this value from `package.json` at import time, so the version reported by `/health` and MCP `initialize` is always the same as the published package version.

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