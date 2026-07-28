---
type: Contributing
title: "Contributing & vouching"
description: "The vouch-based PR gate, allowed bots, the Discussions vouch flow, and the maintainer command set."
tags: [contributing, vouch, discussions, pull-requests]
---

# Contributing & vouching

The repository is open for pull requests, but **only from vouched contributors**. Unvouched PRs are auto-closed by the [`vouch-pr`](../operations/ci-cd.md#vouch-pryml--the-gate) workflow. This is enforced by `mitchellh/vouch/action/check-pr@v1` with `require-vouch: true` and `auto-close: true`.

## Who does not need a vouch

- **Bots** whose GitHub login ends in `[bot]` are automatically allowed. Notable allowed bots:
  - `renovate[bot]` — dependency updates (via `renovate.json`)
  - `chronova-agent[bot]` — CI/automation (the app token used by every workflow in `.github/workflows/`)
  - `google-labs-jules[bot]` — automated contributions
- **Collaborators with write access** to the repository.

## How to get vouched

1. Open a **Discussion** in the [Discussions tab](https://github.com/nx-solutions-ug/chronova-mcp/discussions) of the repository.
2. Describe what you'd like to contribute.
3. A maintainer will comment `!vouch` (or `!vouch @user [reason]`) on your discussion.
4. The [`vouch-manage` workflow](../operations/ci-cd.md#vouch-manageyml--the-maintenance-hook) runs on the `discussion_comment` event, invokes `mitchellh/vouch/action/manage-by-discussion@v1`, and updates `.github/VOUCHED.td`.
5. After the workflow finishes you can open pull requests normally.

## Maintainer commands

Used in discussion comments. Only maintainers should issue these.

| Command | Effect |
|---|---|
| `!vouch` | Vouch the discussion author |
| `!vouch @user` | Vouch a specific user |
| `!vouch @user <reason>` | Vouch a user with a recorded reason |
| `!denounce @user` | Block a user from contributing |
| `!unvouch @user` | Remove a user from the vouched list |

The `vouch-pr` workflow also labels passing PRs with the `vouched` label (created on demand with `gh label create --force`, so the workflow is idempotent).

## Opening a PR

- The `vouch-pr` workflow runs on `pull_request_target` (so it can act on fork PRs too) and uses the same `chronova-agent` GitHub App token as the other workflows.
- The CI pipeline (`.github/workflows/test.yml`) runs four jobs in parallel on every push or PR to `main`, `develop`, `feat/*`, and `fix/*`: **Type Check**, **Lint**, **Build**, **Test** (Vitest). All four must pass.
- Commits follow the [Conventional Commits](https://www.conventionalcommits.org/) spec. `semantic-release` (`.releaserc.json`) determines the next version from these messages on push to `main`: `feat:` → minor, `fix:` → patch, `BREAKING CHANGE:` → major. Do not manually bump `package.json` or edit `CHANGELOG.md`.
- If you're using the OMP agent (`/omp` comment), command files in `.omp/commands/` (e.g. `triage-issue.md`, `label-pr.md`, `review-pr.md`, `fix-issue.md`) wrap the agent prompt with the right context. Freeform `/omp` prompts on PR comments automatically get the `_pr-commit-push.md` prompt appended so the agent pushes its changes back to the PR branch.

See [Operations & release](../operations.md) and [CI/CD workflows](../operations/ci-cd.md) for the full automation story.
