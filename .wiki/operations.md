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

## Community, PR gating & agent automation

The repository uses several GitHub workflows to manage contributions and automate agent-driven tasks.

### Vouch PR gate (`vouch-pr.yml`, `vouch-manage.yml`, `.github/VOUCHED.td`)

External pull requests are gated by the lightweight [vouch](https://github.com/mitchellh/vouch) system:

- `.github/VOUCHED.td` stores the canonical list of vouched users (one GitHub handle per line, alphabetically sorted). Denounced users are prefixed with `-`. The file also documents how to request and grant a vouch.
- `vouch-pr.yml` runs on `pull_request_target` (opened/reopened/ready for review). It auto-closes PRs from users who are not vouched, not a bot, and not a collaborator with write access. Vouched or allowed PRs receive the green `vouched` label.
- `vouch-manage.yml` runs on `discussion_comment` events. Maintainers with `admin`, `maintain`, or `write` roles can manage vouches by commenting `!vouch`, `!vouch @user [reason]`, `!denounce [@user] [reason]`, or `!unvouch [@user]` in a discussion.

### Automatic issue/PR management (`auto-manage.yml`)

New and reopened issues are tagged with `needs-triage`. New issues and new PRs are auto-assigned to `niklasschaeffer`. Both actions use a generated GitHub App token (`APP_CLIENT_ID` + `APP_PRIVATE_KEY`).

### OMP agent automation (`omp.yml`, `omp-ci.yml`, `omp-fix-issue.yml`, `.omp/`)

The `.omp/` directory contains agent command prompts and rules for an OMP-based assistant:

- `omp.yml` reacts to `!omp` or `/omp` comments on issues and PR review comments, dispatching a command from `.omp/commands/<cmd>.md`.
- `omp-ci.yml` runs automatically on newly opened issues and PRs (opened, synchronize, ready for review). It triages issues, labels PRs by type/priority, and reviews PRs.
- `omp-fix-issue.yml` is triggered after issue triage (`repository_dispatch: issue-triaged`) or manually; it attempts to generate a fix branch.

Commands live under `.omp/commands/` (`fix-issue.md`, `label-pr.md`, `review-pr.md`, `triage-issue.md`) and shared rules under `.omp/rules/`. A small Python helper (`.omp/stream-log.py`) parses the agent's JSON stream and posts comments back to GitHub.

### Release notes drafting (`.github/release-drafter.yml`)

`.github/release-drafter.yml` configures the Release Drafter app (or workflow) with conventional categories: Features, Bug Fixes, Maintenance, and Dependencies. It uses label-based version resolution and excludes `needs-triage`, `needs-info`, and `released` labels. Note: the primary release pipeline is still `semantic-release` (see above); release-drafter is a complementary draft/notes helper.

### Wiki updates (`update-wiki.yml`)

`.github/workflows/update-wiki.yml` regenerates `.wiki/` on pushes to `main`, on a daily schedule (`0 8 * * *`), and via `workflow_dispatch`. It installs the `@chronova/wiki-agent` CLI, runs `wiki --update --print --verbose --wiki`, and — if content changed — publishes the flattened wiki to the repository's GitHub Wiki and opens a `wiki/staging-<timestamp>` pull request with the `.wiki/` changes.