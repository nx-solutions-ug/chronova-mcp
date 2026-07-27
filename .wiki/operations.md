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

The npm package name is `@chronova/mcp-server` (currently `version: "1.9.1"` in `package.json`). `src/version.ts` reads this value from `package.json` at import time, so the version reported by `/health` and MCP `initialize` is always the same as the published package version.

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

## Repository automation & vouch gate

The `.github/workflows/` directory contains the full CI/automation stack. Many of these workflows authenticate as the **chronova-agent GitHub App** via `actions/create-github-app-token@v3`, using `secrets.APP_CLIENT_ID` and `secrets.APP_PRIVATE_KEY`, rather than the default `GITHUB_TOKEN`.

| Workflow | Trigger | Purpose |
|---|---|---|
| `test.yml` | push/PR to `main`, `develop`, `feat/*`, `fix/*` | Runs type-check, lint, build, and test jobs in parallel. |
| `release.yml` | push to `main` | Tests, then runs `semantic-release`; the app token writes release notes and publishes. |
| `update-wiki.yml` | push to `main`, daily cron, manual | Regenerates `.wiki/` and pushes the flattened wiki to the wiki repo. |
| `auto-manage.yml` | new/reopened issues, new PRs | Adds `needs-triage` to issues and assigns issues/PRs to `niklasschaeffer`. |
| `omp.yml` | `/omp` comment | Runs the OMP agent from a comment trigger. |
| `omp-ci.yml` | new issues/PRs, manual | Triage, label, and review automation via the OMP agent. |
| `omp-fix-issue.yml` | repository dispatch, manual | Attempts an automated fix for a triaged issue. |
| `vouch-pr.yml` | `pull_request_target` opened/reopened/ready | PR gate: auto-closes PRs from unvouched users; labels vouched PRs. |
| `vouch-manage.yml` | `discussion_comment` created | Lets maintainers vouch/denounce/unvouch users via discussion comments. |

### Vouch system

`.github/VOUCHED.td` stores the vouched and denounced user list. Only vouched users can open pull requests; bots and collaborators with write access are automatically allowed. To request a vouch, a user opens a Discussion, and a maintainer comments `!vouch` (optionally `!vouch @user [reason]`). The `vouch-manage.yml` workflow then updates `.github/VOUCHED.td` using the `mitchellh/vouch/action/manage-by-discussion@v1` action. `vouch-pr.yml` enforces the gate with `mitchellh/vouch/action/check-pr@v1`, using `auto-close: true` and `require-vouch: true`.