---
type: Operations
title: "Operations & release"
description: "Building, running, Docker, and semantic-release pipeline for
  @chronova/mcp-server."
tags: [ operations, docker, release, ci ]
last_updated: 2026-09-03T15:48:12.614Z
updated_by: wiki-agent
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

Release is automated via **semantic-release** v25.0.x (`npm run semantic-release`). Configuration in `.releaserc.json` plus these devDependencies:

- `@semantic-release/commit-analyzer` — determines version bump from conventional commits.
- `@semantic-release/release-notes-generator` — generates changelog.
- `@semantic-release/changelog` + `@semantic-release/git` — update `CHANGELOG.md`, `package.json`, and `package-lock.json` and commit them back.
- `@semantic-release/npm` — publish to npm (`"publishConfig": { "access": "public" }`).
- `@semantic-release/github` — GitHub release.

The npm package name is `@chronova/mcp-server`. `src/version.ts` reads `package.json#version` at import time, so the version reported by `/health` and MCP `initialize` is always the same as the published package version.

Git evidence: dependency `semantic-release` was updated to v25.0.9 in commit `26c7f0c` (Renovate PR #89).

Release branches: `.releaserc.json` targets `main` plus two prerelease channels, `beta` and `alpha`. Pushes to `beta` produce `v{version}-beta.N` tags/prereleases; pushes to `alpha` produce `v{version}-alpha.N`.

### Full-changelog release notes

After semantic-release runs, `.github/workflows/release.yml` runs a post-release step that replaces the GitHub release body with the **full commit list** since the previous tag (all commits, not just conventional `feat`/`fix`/`perf`). It:

1. Captures the latest tag **before** semantic-release (`pre-tag`) and compares it with the latest tag **after**. If the tag did not change, the step exits cleanly and skips the update — this prevents no-op releases from erasing release notes.
2. Derives the previous tag from `git tag --sort=-creatordate` and generates `git log --pretty=format:"- %s (%h)" --no-merges <previous>..<latest>`.
3. Writes the commit list under a `## What's Changed` header.
4. If the body exceeds 120 kB, truncates at the last complete line and appends a link to `CHANGELOG.md`.

`renovate.json` configures dependency automation. For the full CI/CD story — workflows, OMP agent commands, the vouch system, and the wiki update pipeline — see [CI/CD workflows](operations/ci-cd.md).

## Publishing notes

- `prepublishOnly` runs `npm run build`, ensuring `dist/` is fresh before publish.
- `private: false` and `publishConfig.access: public` make the scoped package publicly installable.
- The published tarball is limited to `dist/` + `README.md` by `files`; tests, sources, and configs are excluded.
- `package.json` now declares `repository`, `homepage`, and `bugs` metadata pointing at `https://github.com/nx-solutions-ug/chronova-mcp`, so the npm registry page links back to the GitHub repo and issue tracker.

## Repository automation & vouch gate

The `.github/workflows/` directory contains the full CI/automation stack. Many of these workflows authenticate as the **chronova-agent GitHub App** via `actions/create-github-app-token@v3`, using `secrets.APP_CLIENT_ID` and `secrets.APP_PRIVATE_KEY`, rather than the default `GITHUB_TOKEN`.

| Workflow | Trigger | Purpose |
|---|---|---|
| `test.yml` | push/PR to `main`, `develop`, `feat/*`, `fix/*` | Runs type-check, lint, build, and test jobs in parallel. |
| `release.yml` | push to `main` | Runs type-check + lint, then `semantic-release`; the app token writes release notes and publishes. The full Vitest suite is gated by `test.yml` on PRs/pushes. |
| `update-wiki.yml` | push to `main`, daily cron, manual | Regenerates `.wiki/` and pushes the flattened wiki to the wiki repo. |
| `auto-manage.yml` | new/reopened issues, new PRs | Adds `needs-triage` to issues and assigns issues/PRs to `niklasschaeffer`. |
| `omp.yml` | `/omp` or `/oc` comment | Runs the OMP agent from a comment trigger. |
| `omp-ci.yml` | new issues/PRs, PR closed, manual | Issue triage and PR labeling via the OMP agent. The PR `closed` event (commit `a6e7210`) lets a `cancel-label-on-close` job cancel in-flight label runs for a merged PR via its concurrency group. |
| `omp-code-review.yml` | PR opened/synchronize/ready/review-requested, Jules review events, manual | Dependency review (Renovate/Dependabot) and full code review via OMP; split out of `omp-ci.yml` (commit `f7d1830`). |
| `omp-fix-issue.yml` | repository dispatch, manual | Attempts an automated fix for a triaged issue. |
| `vouch-pr.yml` | `pull_request_target` opened/reopened/ready | PR gate: auto-closes PRs from unvouched users; labels vouched PRs. |
| `vouch-manage.yml` | `discussion_comment` created | Lets maintainers vouch/denounce/unvouch users via discussion comments. |

### OMP agent automation

The repository uses the **OMP agent** for several automated tasks. The trigger workflow `omp.yml` runs when a comment containing `/omp` or `/oc` is created on an issue or pull request review.

Command prompts live in `.omp/commands/` as Markdown files. The workflow extracts a command name from the comment (e.g. `/omp triage-issue 42` → `.omp/commands/triage-issue.md`), substitutes `$ARGUMENTS` with the rest of the comment, and passes the expanded prompt to OMP. PR review was split out of `omp-ci.yml` into `omp-code-review.yml` (commit `f7d1830`), so `omp-ci.yml` covers only issue triage and PR labeling; its `closed` PR trigger (commit `a6e7210`) powers a `cancel-label-on-close` job that cancels in-flight label runs for merged PRs via their concurrency group. The available commands are:

| Command file | Used by | Purpose |
|---|---|---|
| `triage-issue.md` | `omp-ci.yml` (triage-issue job) | Classify a new issue, set type/priority fields, apply labels. |
| `label-pr.md` | `omp-ci.yml` (label-pr job) | Apply type and priority labels to a PR. |
| `review-pr.md` | `omp-code-review.yml` (code-review job) | Review a PR, post inline comments, and submit a review verdict. |
| `dependency-review.md` | `omp-code-review.yml` (dependency-review job) | Research changelogs and assess breaking changes on Renovate/Dependabot PRs. |
| `fix-issue.md` | `omp-fix-issue.yml` | Read a triaged issue, implement a fix on a new branch, run quality gates, and open a draft PR. |
| `_pr-commit-push.md` | `omp.yml` (freeform PR prompts) | Injected after freeform `/omp` prompts on PRs to ensure changes are committed and pushed to the PR branch. |

The agent model is configured in `.omp/agent/config.yml`. The default role and most agent tasks use `ollama-cloud/glm-5.3-flash`; planning and design tasks use `ollama-cloud/kimi-k2.6`, and larger reasoning/vision tasks use `ollama-cloud/qwen3.5:397b`. OMP JSONL output is piped through `.omp/stream-log.py` to produce readable CI log lines. Additional guard rules are in `.omp/rules/`, such as `gh-label-idempotent.md` (always append `|| true` to `gh label create`) and `tool-paths-must-be-arrays.md` (`find`/`search` `paths` must be an array).

#### gh-pr-review extension pinning

The review-producing OMP workflows (`omp-code-review.yml`, plus `omp.yml` when the comment trigger runs a review command) install the `agynio/gh-pr-review` CLI extension and pin it to **v1.6.2** (`gh extension install agynio/gh-pr-review --pin v1.6.2 --force`), so the PR review surface is stable and immutable across CI runs. Git evidence: commit `7c2ff66`.

#### Commit/push behavior for PR commands

A previous limitation was that freeform `/omp` prompts on pull requests could leave changes staged in the runner without pushing them back to the PR branch. The fix in PR #80 (commit `9d7a606`) appends `.omp/commands/_pr-commit-push.md` to freeform prompts on PR comments. This prompt instructs the agent to check out the PR branch, commit the changes with `git add -A && git commit -m "fix: apply requested changes from PR comment"`, and push to `origin HEAD:<headRefName>`. It explicitly forbids pushing to `main` or `develop`, merging the PR, or starting a dev server. Command-file prompts already contain their own commit/push logic, so the extra instructions are only appended for freeform prompts.

### Vouch system

`.github/VOUCHED.td` stores the vouched and denounced user list. Only vouched users can open pull requests; bots and collaborators with write access are automatically allowed. To request a vouch, a user opens a Discussion, and a maintainer comments `!vouch` (optionally `!vouch @user [reason]`). The `vouch-manage.yml` workflow then updates `.github/VOUCHED.td` using the `mitchellh/vouch/action/manage-by-discussion@v1` action. `vouch-pr.yml` enforces the gate with `mitchellh/vouch/action/check-pr@v1`, using `auto-close: true` and `require-vouch: true`.
