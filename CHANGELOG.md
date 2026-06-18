# [1.1.0](https://github.com/nx-solutions-ug/chronova-mcp/compare/v1.0.5...v1.1.0) (2026-06-18)


### Bug Fixes

* add dedup check to review-pr command to prevent duplicate comments ([c0d04c8](https://github.com/nx-solutions-ug/chronova-mcp/commit/c0d04c8dcd8623f556a44033311084489da56565))
* add label-skip pre-check and run label-pr on synchronize/ready_for_review ([7dcfcc8](https://github.com/nx-solutions-ug/chronova-mcp/commit/7dcfcc822dbd201ad1a68df9895c0865dbe7d6b8))
* **ci:** source install + sqlite3 auth for OMP ([f6ce5e3](https://github.com/nx-solutions-ug/chronova-mcp/commit/f6ce5e36f18785c3fa07fda1d2eea6e9a0418db9))
* **ci:** source install + sqlite3 auth for OMP CI ([661eb59](https://github.com/nx-solutions-ug/chronova-mcp/commit/661eb597ad0ad471f1ff7bfdb5ae232f2ddab549))
* folders - remove opencode ([63b194f](https://github.com/nx-solutions-ug/chronova-mcp/commit/63b194fd6791cd80ede37746daee695bd35b5bfd))
* strengthen skip check - never comment, stop immediately when labels exist ([7d23ffd](https://github.com/nx-solutions-ug/chronova-mcp/commit/7d23ffdccf85142b44330e09a6c3cc7b49e371ea))


### Features

* **ci:** add OMP workflows with chronova-agent app token ([4f0bdcd](https://github.com/nx-solutions-ug/chronova-mcp/commit/4f0bdcd2d0e6fab79a426448c4e37deb40dd1ee6))
* **ci:** delete stale dependency summary comments and link Renovate Dashboard ([3852422](https://github.com/nx-solutions-ug/chronova-mcp/commit/38524223b04c0751789025f1278e06666744a6b1))
* consolidate auto-assign and auto-tag into auto-manage with app token ([5b4f91a](https://github.com/nx-solutions-ug/chronova-mcp/commit/5b4f91ae9c1fd2748275fc527675a93779b4a044))

## [1.0.5](https://github.com/nx-solutions-ug/chronova-mcp/compare/v1.0.4...v1.0.5) (2026-05-17)


### Bug Fixes

* **ci:** add token availability guard to prevent 403 errors in workflows ([4165ee9](https://github.com/nx-solutions-ug/chronova-mcp/commit/4165ee968c097466f3ace1b2a381158ad52cc096))

## [1.0.4](https://github.com/nx-solutions-ug/chronova-mcp/compare/v1.0.3...v1.0.4) (2026-05-17)


### Bug Fixes

* **ci:** upgrade workflow permissions to write for issues and pull-requests ([10e3d1a](https://github.com/nx-solutions-ug/chronova-mcp/commit/10e3d1ad4eee281fca6ecd06fba8b34a0dd205c2))

## [1.0.3](https://github.com/nx-solutions-ug/chronova-mcp/compare/v1.0.2...v1.0.3) (2026-05-15)


### Bug Fixes

* single bin entry for npx resolution and updated docs ([a333825](https://github.com/nx-solutions-ug/chronova-mcp/commit/a333825c84ec3ac8361c39e5dbf1740383e630e6))

## [1.0.2](https://github.com/nx-solutions-ug/chronova-mcp/compare/v1.0.1...v1.0.2) (2026-05-15)


### Bug Fixes

* add .npmignore and prepublishOnly script to include dist in npm package ([afbc9ad](https://github.com/nx-solutions-ug/chronova-mcp/commit/afbc9ad8578d94bd49b0cb3c877df4c825e967a6))

## [1.0.1](https://github.com/nx-solutions-ug/chronova-mcp/compare/v1.0.0...v1.0.1) (2026-05-15)


### Bug Fixes

* add shebangs to CLI entry points for npx resolution ([c1caa21](https://github.com/nx-solutions-ug/chronova-mcp/commit/c1caa216d93890b04d94a4bf0e3f089b5c7d9f53))

# 1.0.0 (2026-05-15)


### Bug Fixes

* **ci:** add id-token permission, npm registry, and NODE_AUTH_TOKEN for release ([16b9906](https://github.com/nx-solutions-ug/chronova-mcp/commit/16b9906b60e9244d584d82c187e0ce35c0c77fc4))
* **ci:** use GH_TOKEN with GITHUB_TOKEN fallback for semantic-release ([da142f3](https://github.com/nx-solutions-ug/chronova-mcp/commit/da142f33ffa8a1414db9d1545c888e2127fd73fb))
* remove leading slashes from API paths to preserve baseUrl prefix ([5962c5f](https://github.com/nx-solutions-ug/chronova-mcp/commit/5962c5f62053d5d64c023db7bd268ce5eb7c94ce))


### Features

* **mcp:** add all four MCP tools with Streamable HTTP session fix ([bb90d46](https://github.com/nx-solutions-ug/chronova-mcp/commit/bb90d46200d27adf0619855e031f4b617cb64b8a))
* **mcp:** add Chronova HTTP client, error mapping, types, and MCP server with Streamable HTTP transport ([df8f225](https://github.com/nx-solutions-ug/chronova-mcp/commit/df8f225faa9ea820d65b171e35196dee8c581229))
* **mcp:** add CLI entry point, Dockerfile, and README ([2449a0d](https://github.com/nx-solutions-ug/chronova-mcp/commit/2449a0d96610bfa736f5aa42dbe233fc1998084d))
* **mcp:** add config file support and fix API URL base path ([bc80f93](https://github.com/nx-solutions-ug/chronova-mcp/commit/bc80f937c1ae3e92891bbfe78fe81b896532e3e5))
* **mcp:** add stdio transport for local MCP client integration ([84eceb9](https://github.com/nx-solutions-ug/chronova-mcp/commit/84eceb9d11b81ed215d52053c021d343902d1800))
* **mcp:** scaffold project structure and configuration ([7b88d0f](https://github.com/nx-solutions-ug/chronova-mcp/commit/7b88d0fea47967fe9acb574e14f7cc070d3e5c16))


### Reverts

* reset version to 0.1.0 for fresh semantic-release ([2a9cdfb](https://github.com/nx-solutions-ug/chronova-mcp/commit/2a9cdfbaa52297be2f13861bfd8aa3498239a50e))

# Changelog
