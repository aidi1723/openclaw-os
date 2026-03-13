# AgentCore OS Changelog

## Unreleased

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
