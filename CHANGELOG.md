# AgentCore OS Changelog

## Unreleased

- Release prep and documentation polish for the `v1.1.0` line.

## v1.1.0 - 2026-03-22

### Sales and Support Workflow Upgrade

- Added a curated expert-role layer for high-frequency sales and support chains.
- Added stage-bound expert profiles:
  - `sales_qualification_specialist`
  - `outreach_draft_specialist`
  - `support_reply_specialist`
  - `reality_checker`
  - `knowledge_asset_editor`
- Deal qualification, outreach drafting, and support reply generation can now call expert-bound prompts while still staying inside existing workflow boundaries.
- Added `Reality Checker` as a review-stage safety layer before approval and handoff.
- Added expert-profile enable/disable controls in Settings so only a small approved whitelist is active.

### Workflow Asset Accumulation

- Sales and support records now persist review notes for human-visible audit.
- Completed sales and support workflows can now generate structured reusable asset drafts instead of only freeform text.
- Added a dedicated `knowledge-assets` store for structured process assets with status, tags, reuse count, and source jump targets.
- Personal CRM now supports confirming sales asset drafts into Knowledge Vault.
- Support Copilot now supports confirming FAQ / escalation-boundary assets into Knowledge Vault.

### Knowledge Vault

- Added a `流程资产` section to Knowledge Vault for structured sales and support assets.
- Added search, active/archived filtering, archive/restore, remove, source jump, and reuse counting for process assets.
- Upgraded one-click reuse from raw body injection to structured prefill parsing for:
  - `Deal Desk`
  - `Support Copilot`
- Knowledge Vault assets can now be edited in place:
  - title
  - applicable scene
  - tags
  - body
- Asset cards now expose lineage/audit metadata:
  - workflow run id
  - source key
  - created time
  - updated time

### Documentation and Release

- Aligned release-facing docs, product docs, and version references around `v1.1.0`.
- Added a dedicated `v1.1.0` release note and launch copy.
- Refreshed README, documentation index, user guide, hero workflow strategy, and public release guidance for the new stable line.

### Verification

- Verified `npm run lint`
- Verified `npm run build`

### Desktop and Workspace

- Desktop app area now groups apps by work category instead of rendering a single flat grid.
- Shared category metadata now drives category name, description, and placement guidance across both the desktop surface and Settings.
- Desktop overview cards now display category count and accurate Dock totals.
- Workspace presets have expanded to cover creator, sales, support, research, operations, personal, and language-learning scenarios.
- Industry App Center continues to package industry bundles, scenario-based setup, and custom workspace composition flows.
- Solutions Hub now maps mature use cases into installable workspace/app workflows.

### Settings and Personalization

- `App 配备` has been redesigned from simple checkbox rows into category cards with:
  - app counts per category
  - Desktop / Dock counts
  - bulk actions for `全选 Desktop`, `全选 Dock`, and `清空本类`
  - clearer per-app state copy
- Enabling custom workspace now initializes from the selected scenario when needed, instead of dropping users into an empty state unexpectedly.
- Custom workspace selections now honor explicit empty Desktop or Dock configurations instead of silently falling back to scenario defaults.

### Agent Sidebar

- Agent sidebar sessions now restore from local storage automatically.
- Orphaned message history can now be recovered into visible sessions when session metadata is missing.
- Session retention has been expanded to up to 40 sessions, with up to 120 messages stored per session.
- Session strip now supports scrolling through the full list and includes a quick `回到最近` action.
- New blank sessions are reused when possible to reduce duplicate empty conversations.
- Fixed a session-isolation bug where an in-flight reply could be written into the wrong conversation after switching sessions.

### Documentation and Onboarding

- `GETTING_STARTED.md` now splits setup into three practical tracks:
  - browser-only
  - desktop shell + local sidecar
  - desktop shell + `lobster-src` compatibility work
- `CONFIGURATION.md` now recommends staged setup for:
  - LLM provider configuration
  - publish and webhook flows
  - desktop runtime features
  - LobsterAI integration work
- Documentation now more clearly separates Node, Python, Rust, and Lobster runtime expectations to reduce setup friction.

### LobsterAI Sync

- Local bundled `lobster-src` has been upgraded from `v0.2.3` to `v0.2.4`.
- Upstream sync now includes:
  - IM bridge connectivity-test related fixes
  - WeCom-related improvements
  - bundled QQ bot support
  - startup loading-state fix from upstream `v0.2.4`

### Multi-language and App Packaging

- Top-level interface language switching and first-launch language selection remain part of the current workspace experience.
- Newly packaged apps in the current workspace set include:
  - Recruiting Desk
  - Project Ops Board
  - Deep Research Hub
  - Financial Document Bot
  - Social Media Auto-pilot
  - Website SEO Studio
  - Morning Brief
  - Meeting Copilot
  - Personal CRM
  - Inbox Declutter
  - Support Copilot
  - Second Brain
  - Email Assistant
  - Deal Desk
  - Family Calendar
  - Habit Tracker
  - Health Tracker
  - Creator Radar
  - Content Repurposer
  - Tech News Digest
  - Language Learning Desk

### Fixes

- Fixed Dock statistics in the desktop overview so Dock-only apps are counted correctly.
- Fixed custom workspace behavior so clearing all Desktop or Dock entries does not unexpectedly restore defaults.
- Fixed Agent sidebar async reply routing so switching sessions mid-request no longer pollutes another session's history.
- Type-check / build verification is now stable under the current Next-managed TypeScript configuration.

## v0.2.0-alpha.1 - 2026-03-11

- Desktop UX: window resize + keyboard tiling/restore shortcuts
- Spotlight: local recent apps/commands + `?` help actions
- Playbooks: local-first SOP library (save/export/import)
- Solutions Hub: curated workflow packs installable as Playbooks
- Publisher: queued dispatch with basic retry/backoff (while Publisher is open)
