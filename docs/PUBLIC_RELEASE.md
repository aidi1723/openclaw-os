# Public Release Guide

This document defines what should be included in the public AgentCore OS repository when preparing an open-source release, what must stay private, and how to describe the release boundary in a way that is understandable to external users and contributors.

## Purpose

This release line separates the public-facing AgentCore OS product surface from legacy internal naming and private operator-oriented implementation details.

The main goals are:

- present a clean public runtime surface under the AgentCore OS name
- avoid exposing historical private naming such as `openclaw` in public entrypoints
- keep local/private operator assets out of the public repository and release archives
- preserve enough compatibility so existing local runtime setups do not break immediately

## Public release boundary statement

For the current public release line, the intended external reading order is:

1. `v1.0.0` as the current stable public distribution baseline
2. earlier tags as historical context, packaging traceability, and release evolution record

This means the public repository should now treat `v1.0.0` as the recommended external starting point for evaluation, installation, and release-note reference. Earlier beta tags remain useful for history, but should no longer be presented as the primary public recommendation.

In practical terms:

- `v1.0.0` is the current public stable snapshot to recommend to new external users
- `v0.2.0-beta.2` remains the last beta milestone before the stable line, but not the default public entry point
- public docs, installation guidance, and GitHub release copy should align around `v1.0.0`
- domestic mirror / CNB distribution may still proceed as a separate follow-up step

When writing release notes, repository docs, or external summaries, prefer wording that makes this positioning explicit.

## Scope of This Public Refactor

This release includes four connected categories of change.

### 1. Public naming cleanup

The public product surface is renamed away from legacy `OpenClaw` terminology and aligned to `Agent Runtime`, `Runtime Console`, and `AgentCore` naming.

This applies across:

- public API paths
- app/window labels
- local storage namespaces
- frontend events
- settings semantics
- runtime-facing client helpers

### 2. Public API path migration

Public API entrypoints move from:

- `src/app/api/openclaw/**`

To:

- `src/app/api/runtime/**`

This migration is meant to make the public repository reflect the actual public product boundary and reduce exposure of historical internal/private naming.

Representative public runtime routes include:

- `src/app/api/runtime/agent/route.ts`
- `src/app/api/runtime/copy/route.ts`
- `src/app/api/runtime/execute/route.ts`
- `src/app/api/runtime/gateway/health/route.ts`
- `src/app/api/runtime/test/route.ts`
- `src/app/api/runtime/vault/query/route.ts`
- `src/app/api/runtime/assets/[name]/route.ts`
- `src/app/api/runtime/remote-validate/route.ts`
- `src/app/api/runtime/remote-validate/archive/route.ts`

At the same time, the old public-facing route files under `src/app/api/openclaw/**` should be removed from the public tree.

### 3. Public release boundary hardening

This release also tightens the publication boundary so private local runtime assets and operator state do not leak into the public repository or distribution archives.

Examples of content that should remain outside the public release boundary:

- `.openclaw/`
- `.openclaw-data/`
- local operator files
- temporary runtime directories
- machine-specific local state
- private validation artifacts

This boundary should be enforced through repository rules such as:

- `.gitignore`
- `.gitattributes`
- release packaging exclusions
- explicit documentation of what is public vs. local-only

### 4. Compatibility-preserving migration

Although the public naming changes are substantial, the release should preserve compatibility boundaries where practical.

Examples of compatibility intentionally retained:

- `.openclaw-data` local data directory compatibility
- `OPENCLAW_BIN` environment-variable compatibility
- selected legacy request-header compatibility
- migration of old `openclaw.*` browser/local state into new `agentcore.*` namespaces

The goal is to make the public surface cleaner without immediately breaking existing local runtime environments.

## Recommended Public Change Summary

The following wording can be used directly in release notes, PR descriptions, or public changelogs.

### Public summary

- Renamed the public product surface from legacy **OpenClaw** naming to **Agent Runtime / Runtime Console**, reducing exposure of historical private or internal terminology.
- Migrated public API entrypoints from `src/app/api/openclaw/**` to `src/app/api/runtime/**`, and removed the old public-facing route files.
- Added stricter public release boundaries so `.openclaw/`, `.openclaw-data/`, local operator files, and temporary runtime artifacts do not enter the public repo or release archives.
- Migrated frontend event and local-storage namespaces to `agentcore:*` / `agentcore.*`, while preserving automatic migration from legacy `openclaw.*` state to avoid local data loss.
- Updated public settings semantics from `openclaw` to `runtimeAgent`, so the exposed configuration model better matches AgentCore OS naming.
- Preserved compatibility boundaries, including `.openclaw-data`, `OPENCLAW_BIN`, and selected legacy request headers, so existing local runtimes do not immediately break.
- Verified the public release build path: `npm run lint` and `npm run build` pass.

## Recommended File Groups for This Release

These file groups are appropriate for a single public-release refactor commit when they are part of the same coherent change.

### Release boundary and public documentation

- `.gitignore`
- `.gitattributes`
- `README.md`
- `docs/PUBLIC_RELEASE.md`
- `docs/GETTING_STARTED.md`
- `docs/ARCHITECTURE.md`
- `docs/CONFIGURATION.md`
- `docs/TROUBLESHOOTING.md`
- `docs/REMOTE_VALIDATION.md`
- `docs/releases/2026-03-14.md`

### Public runtime API

- `src/app/api/runtime/agent/route.ts`
- `src/app/api/runtime/copy/route.ts`
- `src/app/api/runtime/execute/route.ts`
- `src/app/api/runtime/gateway/health/route.ts`
- `src/app/api/runtime/test/route.ts`
- `src/app/api/runtime/vault/query/route.ts`
- `src/app/api/runtime/assets/[name]/route.ts`
- `src/app/api/runtime/remote-validate/route.ts`
- `src/app/api/runtime/remote-validate/archive/route.ts`

### Runtime client, execution, and validation layer

- `src/lib/runtime-agent-client.ts`
- `src/lib/runtime-agent-context.ts`
- `src/lib/runtime-cli.ts`
- `src/lib/solution-usecase-map.ts`
- `src/lib/server/remote-validation.ts`
- `src/lib/remote-validation.ts`
- `src/lib/remote-validation-targets.ts`
- `src/lib/result-records.ts`
- `src/lib/server/publish-dispatch.ts`
- `src/lib/publish-config.ts`
- `src/lib/publish.ts`
- `src/lib/tasks.ts`
- `src/lib/workflow-runs.ts`
- `src/lib/playbooks.ts`

### Desktop/UI naming and runtime entry updates

- `src/components/apps/RuntimeConsoleAppWindow.tsx`
- `src/apps/registry.ts`
- `src/apps/types.ts`
- `src/apps/modes.ts`
- `src/lib/app-display.ts`
- `src/app/page.tsx`
- `src/components/windows/AppWindowShell.tsx`
- `src/components/PublishQueueRunner.tsx`
- `src/components/Spotlight.tsx`
- `src/components/results`
- `src/components/apps`

### State, settings, and namespace migration

- `src/lib/storage.ts`
- `src/lib/settings.ts`
- `src/lib/ui-events.ts`
- `src/lib/asset-jumps.ts`
- `src/lib/runtime-agent-context.ts`
- `src/lib/runtime-cli.ts`

## Recommended Legacy File Removals

The following legacy public paths can be removed as part of the same change when they have been fully replaced by the runtime-named equivalents.

- `src/app/api/openclaw/agent/route.ts`
- `src/app/api/openclaw/assets/[name]/route.ts`
- `src/app/api/openclaw/copy/route.ts`
- `src/app/api/openclaw/execute/route.ts`
- `src/app/api/openclaw/gateway/health/route.ts`
- `src/app/api/openclaw/test/route.ts`
- `src/app/api/openclaw/vault/query/route.ts`
- `src/components/apps/OpenClawConsoleAppWindow.tsx`
- `src/lib/openclaw-agent-client.ts`
- `src/lib/openclaw-cli.ts`
- `src/lib/openclaw-usecase-map.ts`

These removals should be described as a naming and boundary cleanup, not as feature removal.

## Public Commit Framing

A commit in this area should read like a coherent product-boundary refactor, not like an unrelated file dump.

Recommended commit-message styles:

- `refactor: public runtime rename and release boundary cleanup`
- `refactor: split public runtime naming and tighten release boundaries`

## Staging Guidance

When preparing this change for a public repository, avoid broad staging patterns that may accidentally include unrelated internal or experimental files.

Recommended workflow:

1. Review `git status --short`
2. Stage only files that belong to this public-release change
3. Remove only the legacy files that have true runtime-named replacements
4. Review with `git diff --cached --stat`
5. Commit only after verifying that no local/private artifacts were included

In particular, use extra care with broad directory-level adds such as:

- `src/components/apps`
- `src/components/results`
- `src/app/api/runtime`

These can be valid, but they should be reviewed before commit in a public-release context.

## Notes

- If `docs/releases/2026-03-14.md` is intended as a working migration record, that is acceptable.
- If the document is intended to function as an externally referenced release note, a versioned release-note filename such as `docs/releases/v1.0.0.md` may be easier to index from `README.md` and GitHub Releases.
- The public repository should prefer clarity over perfect internal history fidelity. The goal is a clean, supportable public surface with explicit compatibility boundaries.
