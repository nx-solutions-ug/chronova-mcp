---
type: Operations
title: "CI/CD workflows"
description: "GitHub Actions in this repository: test, release, OMP agent
  automation, the vouch system, and the wiki update pipeline."
tags: [ operations, ci, github-actions, omp, vouch, semantic-release ]
last_updated: 2026-09-03T14:15:24.927Z
updated_by: wiki-agent
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
| [`omp-ci.yml`](#omp-ciyml) | new issues/PRs, PR closed, manual | Issue triage and PR labeling via OMP; closed events cancel in-flight label runs |
| [`omp-code-review.yml`](#omp-code-reviewyml) | PR opened/synchronize/ready/review-requested, Jules review events, manual | Dependency review (Renovate/Dependabot) and full code review via OMP |
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
4. **Wiki agent** — installs `@chronova/wiki-agent` globally and runs `wiki --update --print --verbose --wiki`. Model and provider are env-configurable: `WIKI_OLLAMA_MODE=cloud`, `WIKI_OLLAMA_API_KEY`, `WIKI_MODEL` (default `kimi-k3`).
5. **Diff detection** — collects `git status --porcelain .wiki` minus run metadata files (`.last-update-report.md`, `.last-updated.json`). If non-empty, sets `has_changes=true` and stashes the report as the PR body.
6. **Wiki repo init check** — `git ls-remote` against `https://github.com/<owner>/<repo>.wiki.git`. If HEAD does not exist yet (the wiki has never been initialized in the GitHub UI), the publish step is skipped with a warning — the staging PR is still opened.
7. **Publish to wiki repo** — `wiki-flatten` converts the nested `.wiki/` tree to the flat `Home.md` / `_Sidebar.md` layout GitHub Wikis require, then `rsync --delete` (with `--exclude='.git'`) syncs it into a fresh clone of the wiki repo. A `docs: update wiki` commit is pushed to `master` if and only if there are net content changes.
8. **Staging snapshot PR** — uses `peter-evans/create-pull-request@v8` to open a PR on a `wiki/staging-<unix-seconds>` branch listing only `.wiki/` paths, with the report as the body. This is the PR that this very wiki-update run is invoked from.

The dual PR + wiki-repo publish is intentional: the PR gives reviewers a diff on the source-of-truth `.wiki/` directory in the main repo, while the wiki-repo push makes the rendered pages visible to readers immediately. Staging PRs older than the latest commit are closed automatically by the wiki update run.

## `auto-manage.yml`

A small triage workflow. On any new or reopened issue it adds the `needs-triage` label; on new PRs and issues it assigns the author to `niklasschaeffer`. Uses the app token so labels and assigns are stable.

## OMP agent

The repository uses the **OMP agent** for several automated tasks. The agent is installed in each OMP workflow via the native bash installer `curl -fsSL https://omp.sh/install | sh`, and is authenticated against the `ollama-cloud` provider by inserting the API key into the local SQLite store at `~/.omp/agent/agent.db`. The model used by the default role is `ollama-cloud/glm-5.3-flash`; planning/design tasks use `ollama-cloud/kimi-k2.6`; larger reasoning/vision tasks use `ollama-cloud/qwen3.5:397b`. OMP JSONL output is piped through `.omp/stream-log.py` to produce readable CI log lines.

### `omp.yml` — `/omp` comment trigger

Runs on any `issue_comment` or `pull_request_review_comment` containing `/omp` or `/oc` (case-insensitive prefix or `" /omp"` substring). The `if` guard also excludes any user whose login ends in `[bot]`.

The workflow extracts the prompt from the comment body:

1. Strips the leading `/omp` or `/oc`.
2. Tries to match a known **command file** under `.omp/commands/` (e.g. `/omp triage-issue 42` → `.omp/commands/triage-issue.md`). If the file exists, `$ARGUMENTS` is substituted with the rest of the prompt and the file's contents are used.
3. Otherwise the rest of the comment is treated as a **freeform prompt**. For **PR comments only**, `.omp/commands/_pr-commit-push.md` is appended so the agent knows to commit and push its changes back to the PR branch (this fix landed in PR #80 / commit `9d7a606` to address issue #637). The appended prompt forbids pushing to `main` or `develop`, merging the PR, or starting a dev server.

The expanded prompt is passed to `omp -p --model ollama-cloud/glm-5.3-flash --mode json <file> | python3 .omp/stream-log.py`.

### `omp-ci.yml` — triage and label

Two jobs run on new issues/PRs (and manually). The `pull_request` trigger includes `closed` (added in commit `a6e7210`) so that a dedicated `cancel-label-on-close` job can cancel any still-running label job for a merged PR via its concurrency group. PR review was split out of this workflow into `omp-code-review.yml` (see below) — `omp-ci.yml` no longer carries a `review-pr` job.

- **triage-issue** — runs `.omp/commands/triage-issue.md` against the issue body to set type/priority fields and labels, then dispatches `issue-triaged` to `omp-fix-issue.yml`.
- **label-pr** — runs `.omp/commands/label-pr.md` to apply type and priority labels. Runs only on `opened`/`ready_for_review` and self-skips when the PR already has both a type and a priority label (queried via `gh pr view --json labels`).
- **cancel-label-on-close** — no-op job that runs only on `pull_request` `closed`. It shares the `omp-label-<n>` concurrency group with `cancel-in-progress: true`, cancelling any in-flight label run for the merged PR.

### `omp-code-review.yml` — automated PR review

The review surface was split out of `omp-ci.yml` into its own workflow (see commit `f7d1830`). It triggers on `pull_request` (`opened`, `synchronize`, `ready_for_review`, `review_requested`), on `pull_request_review` `submitted` and `pull_request_review_comment` `created` (to pick up reviews/suggestions from the `jules` bot), and on manual `workflow_dispatch` with a `pr_number`. Concurrency group `omp-code-review-<n>` with `cancel-in-progress: true`.

Two jobs:

- **dependency-review** — for `renovate[bot]` / `dependabot[bot]` PRs only. Runs `.omp/commands/dependency-review.md` (`$ARGUMENTS` = PR number) to research changelogs and assess breaking changes. A verification step fails the job if OMP posted neither a review nor a comment (so silent runs surface as CI failures, not approvals).
- **code-review** — for human- and agent-authored PRs. Runs `.omp/commands/review-pr.md` to post inline comments and submit a review verdict. Skip logic:
  - A `synchronize` event where the head commit was authored by an agent (`opencode-agent`, `opencode`, `github-actions`, `omp-agent`, `chronova-agent`) is skipped to avoid re-reviewing its own pushes.
  - A `review_requested` event is treated as an explicit human retrigger from the GitHub UI and is never skipped.
  - Jules involvement (Jules-authored PR, or a Jules review/review-comment) is detected by a `jules-detect` step and passed to the review prompt via `IS_JULES`/`JULES_CONTEXT`.
  - A verification step fails the job when the PR has no review threads and no agent reviews, unless the PR modifies `omp-code-review.yml` itself (in which case verification is skipped by design). The checkout uses full history (`fetch-depth: 0`) so `git diff` against the base avoids HTTP 406 on PRs with >300 files.

### `omp-fix-issue.yml` — automated fixes

Triggered by repository dispatch (typically from a triaged issue) or manually. Reads a triaged issue, runs `.omp/commands/fix-issue.md`, implements the fix on a new branch, runs the quality gates, and opens a **draft** PR.

### Guard rules

OMP-specific guardrails live under `.omp/rules/`. Two notable rules:

- `gh-label-idempotent.md` — always append `|| true` to `gh label create`, so re-runs don't fail on existing labels.
- `tool-paths-must-be-arrays.md` — `find` / `search` `paths` arguments must be arrays (e.g. `paths: ["./src"]`, not `"./src"`).

### gh-pr-review extension pinning

All OMP workflows act through `gh`. The review-producing workflows (`omp-code-review.yml`, plus `omp.yml` when the comment trigger runs a review command) install the `agynio/gh-pr-review` CLI extension and pin it to **v1.6.2** (`gh extension install agynio/gh-pr-review --pin v1.6.2 --force`), so the PR review surface is stable and immutable across CI runs. Git evidence: commit `7c2ff66`.

## Vouch system

`.github/VOUCHED.td` stores the vouched and denounced user list. Only vouched users can open pull requests; bots and collaborators with write access are automatically allowed.

### `vouch-pr.yml` — the gate

Runs on `pull_request_target` (opened, reopened, ready_for_review) so the token can act on fork PRs. Uses `mitchellh/vouch/action/check-pr@v1` with `auto-close: true` and `require-vouch: true`. PRs that pass the gate are labelled `vouched` via a follow-up step (label is created with `--force` so the workflow is idempotent). Concurrency group `vouch-pr-<n>` with `cancel-in-progress: true`.

### `vouch-manage.yml` — the maintenance hook

Runs on `discussion_comment` created. When a maintainer comments `!vouch` (optionally `!vouch @user [reason]`) on a discussion, this workflow invokes `mitchellh/vouch/action/manage-by-discussion@v1` to update `.github/VOUCHED.td`. `!denounce @user` blocks a user; `!unvouch @user` removes them.

See `CONTRIBUTING.md` for the full user-facing vouch flow.
