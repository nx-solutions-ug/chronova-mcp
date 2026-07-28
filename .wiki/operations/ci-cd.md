---
type: Operations
title: "CI/CD workflows"
description: "GitHub Actions in this repository: test, release, OMP agent automation, the vouch system, and the wiki update pipeline."
tags: [operations, ci, github-actions, omp, vouch, semantic-release]
---

# CI/CD workflows

This repository runs a large automation stack under `.github/workflows/`. Most workflows authenticate as the **`chronova-agent` GitHub App** via `actions/create-github-app-token@v3` (secrets: `APP_CLIENT_ID`, `APP_PRIVATE_KEY`) rather than the default `GITHUB_TOKEN`, because the agent needs to act on issues, PRs, releases, and the wiki repo with consistent identity.

| Workflow | Trigger | Purpose |
|---|---|---|
| [`test.yml`](#testyml) | push/PR to `main`, `develop`, `feat/*`, `fix/*` | Parallel jobs: type-check, lint, build, test |
| [`release.yml`](#releaseyml) | push to `main` | Pre-release quality gates + `semantic-release` |
| [`update-wiki.yml`](#update-wikiyml) | push to `main`, daily cron, manual | Regenerates `.wiki/`, opens a staging PR, publishes to the wiki repo |
| [`auto-manage.yml`](#auto-manageyml) | new/reopened issues, new PRs | Tags `needs-triage`, assigns to `niklasschaeffer` |
| [`omp.yml`](#ompyml) | `/omp` or `/oc` comment | Runs the OMP agent from a comment trigger |
| [`omp-ci.yml`](#omp-ciyml) | new issues/PRs, PR closed, manual | Triage, label, and PR review automation via OMP; closed events cancel in-flight review/label runs for merged PRs |
| [`omp-fix-issue.yml`](#omp-fix-issueyml) | repository dispatch, manual | Attempts an automated fix for a triaged issue |
| [`vouch-pr.yml`](#vouch-pryml) | `pull_request_target` | PR gate: auto-closes PRs from unvouched users |
| [`vouch-manage.yml`](#vouch-manageyml) | `discussion_comment` created | Lets maintainers vouch/denounce/unvouch users via discussions |

## `test.yml`

Four parallel jobs run on every push or PR to `main`, `develop`, `feat/*`, and `fix/*`:

- **Type Check** — `npm ci` → `npm run type-check` (5 min timeout)
- **Lint** — `npm ci` → `npm run lint` (5 min timeout)
- **Build** — `npm ci` → `npm run build` (5 min timeout)
- **Test** — `npm ci` → `npm test` (Vitest, 10 min timeout)

All four use Node 25 and `actions/setup-node@v7` with npm cache. Concurrency group `${{ github.workflow }}-${{ github.ref }}` with `cancel-in-progress: true` so a new push on the same branch supersedes a previous in-flight run.

## `release.yml`

Runs only on push to `main`. Quality gates (type-check + lint) precede `semantic-release`. The release step:

1. Runs `semantic-release` (configured by `.releaserc.json`), which:
   - Determines the next version from conventional commits.
   - Updates `CHANGELOG.md` (`@semantic-release/changelog`).
   - Updates `package.json` + `package-lock.json` and commits them with `chore(release): ${nextRelease.version} [skip ci]` (`@semantic-release/git`).
   - Publishes to npm as `@chronova/mcp-server` (`@semantic-release/npm`).
   - Creates a GitHub release (`@semantic-release/github`), truncating the body at 120 kB with a pointer to `CHANGELOG.md` if exceeded.

The app token is used so the release PR/branch and the GitHub release are authored by the same identity as the agent's other workflows.

## `update-wiki.yml`

The wiki is **regenerated daily** (cron `0 8 * * *`), on every push to `main`, and on manual dispatch. The pipeline:

1. **Token** — mints a GitHub App token (`continue-on-error: true` so the run still proceeds with `GITHUB_TOKEN` if the app isn't available).
2. **Checkout** — full clone with the app token.
3. **Toolchain** — installs Bun (for the wiki agent) and Node 25.
4. **Wiki agent** — installs `@chronova/wiki-agent` globally and runs `wiki --update --print --verbose --wiki`. Model and provider are env-configurable: `WIKI_OLLAMA_MODE=cloud`, `WIKI_OLLAMA_API_KEY`, `WIKI_MODEL` (default `kimi-k2.7-code`).
5. **Diff detection** — collects `git status --porcelain .wiki` minus run metadata files (`.last-update-report.md`, `.last-updated.json`). If non-empty, sets `has_changes=true` and stashes the report as the PR body.
6. **Wiki repo init check** — `git ls-remote` against `https://github.com/<owner>/<repo>.wiki.git`. If HEAD does not exist yet (the wiki has never been initialized in the GitHub UI), the publish step is skipped with a warning — the staging PR is still opened.
7. **Publish to wiki repo** — `wiki-flatten` converts the nested `.wiki/` tree to the flat `Home.md` / `_Sidebar.md` layout GitHub Wikis require, then `rsync --delete` (with `--exclude='.git'`) syncs it into a fresh clone of the wiki repo. A `docs: update wiki` commit is pushed to `master` if and only if there are net content changes.
8. **Staging snapshot PR** — uses `peter-evans/create-pull-request@v8` to open a PR on a `wiki/staging-<unix-seconds>` branch listing only `.wiki/` paths, with the report as the body. This is the PR that this very wiki-update run is invoked from.

The dual PR + wiki-repo publish is intentional: the PR gives reviewers a diff on the source-of-truth `.wiki/` directory in the main repo, while the wiki-repo push makes the rendered pages visible to readers immediately. Staging PRs older than the latest commit are closed automatically by the wiki update run.

## `auto-manage.yml`

A small triage workflow. On any new or reopened issue it adds the `needs-triage` label; on new PRs and issues it assigns the author to `niklasschaeffer`. Uses the app token so labels and assigns are stable.

## OMP agent

The repository uses the **OMP agent** for several automated tasks. The agent is installed in each OMP workflow via `curl -fsSL https://omp.sh/install | sh -s -- --source`, and is authenticated against the `ollama-cloud` provider by inserting the API key into the local SQLite store at `~/.omp/agent/agent.db`. The model used by the default role is `ollama-cloud/minimax-m3`; planning/design tasks use `ollama-cloud/kimi-k2.6`; larger reasoning/vision tasks use `ollama-cloud/qwen3.5:397b`. OMP JSONL output is piped through `.omp/stream-log.py` to produce readable CI log lines.

### `omp.yml` — `/omp` comment trigger

Runs on any `issue_comment` or `pull_request_review_comment` containing `/omp` or `/oc` (case-insensitive prefix or `" /omp"` substring). The `if` guard also excludes any user whose login ends in `[bot]`.

The workflow extracts the prompt from the comment body:

1. Strips the leading `/omp` or `/oc`.
2. Tries to match a known **command file** under `.omp/commands/` (e.g. `/omp triage-issue 42` → `.omp/commands/triage-issue.md`). If the file exists, `$ARGUMENTS` is substituted with the rest of the prompt and the file's contents are used.
3. Otherwise the rest of the comment is treated as a **freeform prompt**. For **PR comments only**, `.omp/commands/_pr-commit-push.md` is appended so the agent knows to commit and push its changes back to the PR branch (this fix landed in PR #80 / commit `9d7a606` to address issue #637). The appended prompt forbids pushing to `main` or `develop`, merging the PR, or starting a dev server.

The expanded prompt is passed to `omp -p --model ollama-cloud/minimax-m3 --mode json <file> | python3 .omp/stream-log.py`.

### `omp-ci.yml` — triage, label, and review

Three jobs run on new issues/PRs (and manually). The `pull_request` trigger includes `closed` (added in commit `a6e7210`) so that dedicated `cancel-*-on-close` jobs can cancel any still-running review or label jobs for a merged PR via their concurrency groups:

- **triage-issue** — runs `.omp/commands/triage-issue.md` against the issue body to set type/priority fields and labels.
- **label-pr** — runs `.omp/commands/label-pr.md` to apply type and priority labels. Skipped when the PR action is `closed`.
- **review-pr** — runs `.omp/commands/review-pr.md` to post inline comments and submit a review verdict. Skipped when the PR action is `closed` (`github.event.action != 'closed'`).
- **cancel-review-on-close** / **cancel-label-on-close** — no-op jobs that run only on `pull_request` `closed`. They share the `omp-review-<n>` and `omp-label-<n>` concurrency groups with `cancel-in-progress: true`, cancelling in-flight review/label runs for the merged PR.

### `omp-fix-issue.yml` — automated fixes

Triggered by repository dispatch (typically from a triaged issue) or manually. Reads a triaged issue, runs `.omp/commands/fix-issue.md`, implements the fix on a new branch, runs the quality gates, and opens a **draft** PR.

### Guard rules

OMP-specific guardrails live under `.omp/rules/`. Two notable rules:

- `gh-label-idempotent.md` — always append `|| true` to `gh label create`, so re-runs don't fail on existing labels.
- `tool-paths-must-be-arrays.md` — `find` / `search` `paths` arguments must be arrays (e.g. `paths: ["./src"]`, not `"./src"`).

## Vouch system

`.github/VOUCHED.td` stores the vouched and denounced user list. Only vouched users can open pull requests; bots and collaborators with write access are automatically allowed.

### `vouch-pr.yml` — the gate

Runs on `pull_request_target` (opened, reopened, ready_for_review) so the token can act on fork PRs. Uses `mitchellh/vouch/action/check-pr@v1` with `auto-close: true` and `require-vouch: true`. PRs that pass the gate are labelled `vouched` via a follow-up step (label is created with `--force` so the workflow is idempotent). Concurrency group `vouch-pr-<n>` with `cancel-in-progress: true`.

### `vouch-manage.yml` — the maintenance hook

Runs on `discussion_comment` created. When a maintainer comments `!vouch` (optionally `!vouch @user [reason]`) on a discussion, this workflow invokes `mitchellh/vouch/action/manage-by-discussion@v1` to update `.github/VOUCHED.td`. `!denounce @user` blocks a user; `!unvouch @user` removes them.

See `CONTRIBUTING.md` for the full user-facing vouch flow.
