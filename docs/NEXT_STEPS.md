# Next Steps

Last updated: 2026-03-11

This document is the execution backlog for the current `main` branch. It is narrower and more implementation-oriented than the public roadmap.

## Current assessment

AgentCore OS is already beyond a pure UI shell:

- the desktop shell is usable
- packaged apps and scenario bundles are in place
- OpenClaw / LLM / publish APIs exist
- `npm run lint` and `npm run build` pass

The main gap is no longer feature count. The main gap is turning the existing surface area into a smaller number of reliable, intelligent, scenario-ready workflows.

## Product direction

Do not keep expanding app count in the near term. Focus on making these workflow lines real:

1. Content workflow
   `Creator Radar -> Content Repurposer -> Publisher`
2. Sales workflow
   `Deal Desk -> Email Assistant -> Personal CRM -> local asset write-back`
3. Solo operator workflow
   `Morning Brief -> Inbox Declutter -> Task Manager -> CRM / Meeting / Email`
4. Research workflow
   `Deep Research Hub -> Knowledge Vault -> Morning Brief / Drafts`

If a new feature does not strengthen one of the three lines above, it should usually wait.

Structural north star:

- AgentCore OS should evolve from an app collection into an industry solution operating system
- primary entrance should become `industry + role + workflow`, with apps acting as execution components underneath

## Priority reset

For the next stage, prioritize in this order:

1. automation depth
2. AI usefulness inside existing apps
3. scenario landing quality
4. platform hardening
5. admin/auth concerns later

That means management passwords, admin gates, and broader permission models are intentionally not the immediate focus unless they directly unblock a workflow.

## P0

These items unblock the next stage of the project and should be treated as the default priority.

### 1. Deepen the sales hero workflow

Why:
- the first cross-app runnable chain now exists
- this is the clearest proof that AgentCore OS can behave like a solution operating system instead of an app shelf
- the remaining gap is deeper automation, richer trigger handling, and stronger asset structure

Scope:
- support richer trigger payloads such as inquiry channel, preferred language, and product requirement fields
- add a more concrete local asset shape for preferences, objections, quote status, and follow-up cadence
- connect CRM completion with knowledge or playbook retention
- add one guided demo seed so the workflow is obvious on first launch

Primary files:
- `src/components/apps/DealDeskAppWindow.tsx`
- `src/components/apps/EmailAssistantAppWindow.tsx`
- `src/components/apps/PersonalCRMAppWindow.tsx`
- `src/components/workflows/SalesHeroWorkflowPanel.tsx`
- `src/lib/sales-assets.ts`
- `src/lib/workflow-runs.ts`

Expected outcome:
- one complete business chain feels trustworthy instead of performative
- users can see where the flow started, what is waiting on them, and what asset was retained
- the product narrative becomes much more concrete in demos and real trials

### 2. Make the content workflow actually compound

Why:
- `Creator Radar -> Content Repurposer -> Publisher` is the clearest revenue-adjacent path in the product
- the apps exist, but the handoff still feels like separate tools instead of one pipeline
- this is the fastest path to a scenario that feels useful on day one

Scope:
- strengthen app-to-app handoff between radar, repurposing, drafts, and publisher
- preserve source context, target platform intent, and publish notes across steps
- make it obvious what the next action is after each app finishes
- add simple feedback capture so published outcomes can become reusable patterns

Primary files:
- `src/components/apps/CreatorRadarAppWindow.tsx`
- `src/components/apps/ContentRepurposerAppWindow.tsx`
- `src/components/apps/PublisherAppWindow.tsx`
- `src/lib/drafts.ts`
- `src/lib/ui-events.ts`

Expected outcome:
- one topic can move from idea to repurpose to publish without copy/paste chaos
- users feel a real pipeline instead of a demo collection
- the content scenario becomes the flagship workflow

### 3. Make scenario packs runnable, not just installable

Why:
- Solutions Hub and Playbooks already imply scenario delivery
- today they are good reference material, but not yet strong operators for guided execution
- this is where “场景落地” becomes visible to users

Scope:
- let playbooks prefill concrete app state instead of only opening apps
- add clearer “next step” cues, expected outputs, and completion markers
- turn a few high-value scenario packs into guided execution flows
- prioritize content ops, product launch, and solo daily operations

Primary files:
- `src/components/apps/SolutionsHubAppWindow.tsx`
- `src/components/apps/SoloOpsAppWindow.tsx`
- `src/lib/playbooks.ts`
- `src/lib/ui-events.ts`

Expected outcome:
- scenario packs become something users can run, not just read
- onboarding into real workflows becomes much faster

### 4. Make the publish flow reliable enough to support automation

Why:
- publish is still the execution endpoint for the content workflow
- queueing and receipts are now much better, but this line still needs stronger automation confidence
- without a trustworthy final dispatch stage, upstream workflow improvements lose value

Scope:
- finish shaping publish as a reliable workflow endpoint
- keep retry policy, receipts, and queue visibility practical
- improve receipt readability and connector outcome explanation
- keep deployment guidance aligned with actual usage

Primary files:
- `src/components/apps/PublisherAppWindow.tsx`
- `src/app/api/publish/dispatch/route.ts`
- `src/app/api/publish/connector/health/route.ts`
- `src/app/api/publish/connector/jobs/route.ts`
- `src/lib/server/publish-queue-runner.ts`
- `src/lib/publish.ts`

Expected outcome:
- publish continues even if the window is closed
- retry behavior is deterministic
- connector status and receipts are inspectable
- the browser is no longer the job runner

### 5. Add useful AI assistance inside the existing workflows

Why:
- the repo already has many AI-shaped apps, but some flows still feel like static forms around text areas
- intelligence should reduce user decisions, not only generate more text
- this is the difference between “AI-themed workspace” and “AI operator workspace”

Scope:
- add next-step suggestions after generation results
- add reusable prompt presets and structured outputs for the strongest apps
- improve context carry-over between research, drafting, and execution
- focus on recommendation quality, not just model plumbing

Primary files:
- `src/components/apps/ContentRepurposerAppWindow.tsx`
- `src/components/apps/MorningBriefAppWindow.tsx`
- `src/components/apps/DeepResearchHubAppWindow.tsx`
- `src/components/apps/EmailAssistantAppWindow.tsx`
- `src/lib/openclaw-agent-client.ts`

Expected outcome:
- users get better decisions and clearer recommended actions
- AI output is more actionable and less generic

### 6. Add a minimum regression test layer

Why:
- the project now has enough cross-app behavior that lint/build are not enough
- current repo has no meaningful automated regression coverage

Scope:
- add unit tests for storage/state helpers
- add API tests for publish and OpenClaw wrappers
- add one browser smoke test for window open/minimize/restore and one workflow smoke test

Primary files:
- `package.json`
- new test setup files
- `src/lib/*.ts`
- `src/app/api/**/*.ts`
- desktop shell and workflow smoke specs

Expected outcome:
- core regressions are caught before release
- refactoring the shell and workflows becomes safe enough to move faster

### 7. Turn Creative Studio into a real capability

Why:
- it is currently an obvious placeholder path
- users will interpret it as implemented because the UI exists

Scope:
- replace placeholder SVG output with a real processing path
- support either OpenClaw video-frames integration or a documented local fallback
- define output storage behavior and error handling

Primary files:
- `src/app/api/creative-studio/process/route.ts`
- `src/components/apps/CreativeStudioAppWindow.tsx`
- `docs/ARCHITECTURE.md`
- `docs/GETTING_STARTED.md`

Expected outcome:
- Creative Studio is no longer a demo-only screen
- users know what runtime dependencies are required

## P1

These items improve maintainability and product clarity after P0 is underway.

### 7. Refactor the desktop shell state model

Why:
- `src/app/page.tsx` is carrying too much orchestration logic
- window state, focus, prefill events, shortcuts, language onboarding, and workspace logic are tightly coupled

Scope:
- extract a dedicated window manager state layer
- isolate open/minimize/restore/focus/z-order behavior
- isolate app prefill/event routing from shell rendering
- keep the top-level page focused on composition

Primary files:
- `src/app/page.tsx`
- `src/components/windows/AppWindowShell.tsx`
- `src/components/SystemTrayWindows.tsx`
- `src/components/DesktopIcon.tsx`
- `src/lib/ui-events.ts`

Expected outcome:
- lower change risk when adding or modifying apps
- clearer boundaries between shell, window manager, and app-to-app messaging

### 8. Reduce oversized content/config modules

Why:
- several large files are already difficult to review and evolve
- `SolutionsHubAppWindow` and solution data are especially heavy

Scope:
- split content data from rendering logic
- move static solution definitions into structured content modules
- introduce smaller view components where sections are repeated

Primary files:
- `src/components/apps/SolutionsHubAppWindow.tsx`
- `src/lib/industry-solutions.ts`
- `src/components/apps/IndustryHubAppWindow.tsx`
- `src/components/apps/SettingsAppWindow.tsx`

Expected outcome:
- easier content iteration
- simpler reviews and lower merge conflict risk

### 9. Define the first real server-backed workspace model

Why:
- many apps are currently local-first islands
- a small shared data model would unlock better cross-app workflows

Scope:
- define a minimal workspace/user model
- decide which records must be shareable across devices
- start with drafts, tasks, playbooks, publish jobs, and contacts

Primary files:
- `src/lib/drafts.ts`
- `src/lib/tasks.ts`
- `src/lib/playbooks.ts`
- `src/lib/publish.ts`
- `src/lib/crm.ts`
- architecture and configuration docs

Expected outcome:
- a path from demo workspace to persistent product
- less duplication across app-local storage helpers

## P2

These items matter, but they should not displace the workflow and platform work above.

### 10. Accessibility pass

Scope:
- keyboard navigation across windows and Spotlight
- focus trapping and restore rules
- ARIA roles and labels for window controls and dialogs

Primary files:
- `src/components/windows/AppWindowShell.tsx`
- `src/components/Spotlight.tsx`
- app window components

### 11. Multi-language content consistency pass

Scope:
- audit mixed-language labels and missing translations
- centralize repeated labels where possible
- ensure onboarding, shell, and app chrome follow the selected language

Primary files:
- `src/lib/app-display.ts`
- `src/lib/language.ts`
- app window components with inline copy

### 12. Connector ecosystem packaging

### 13. Replace browser-only secret handling

Why:
- current settings still include API keys, tokens, and webhook URLs
- docs already state this is demo behavior and not safe for production
- this matters, but it is not the first-order product bottleneck right now

Scope:
- move provider keys and connector credentials to server-side storage
- keep browser storage only for low-risk personalization
- define a clear split between local preferences and protected config

Primary files:
- `src/lib/settings.ts`
- `src/components/apps/SettingsAppWindow.tsx`
- `docs/CONFIGURATION.md`
- `docs/DEPLOYMENT.md`
- `docs/PRIVACY.md`

Expected outcome:
- personalization remains local-first
- credentials are no longer treated as UI state
- deployment docs stop describing unsafe defaults as the main path

### 14. Admin/auth hardening

Why:
- management passwords and admin gates are useful later
- they do not currently solve the main product problem of weak workflow depth

Scope:
- minimum admin access control
- protected config mutation paths
- clearer operational roles if the app later becomes multi-user

Expected outcome:
- a path to controlled operations when the product matures

Scope:
- add clearer recipes for approved publish services
- define a stable connector contract
- provide one or two stronger reference connectors

Primary files:
- `docs/CONNECTORS.md`
- `docs/CONNECTOR_RECIPES.md`
- `scripts/webhook-connector/`

## Documentation corrections to make soon

These are not blockers, but they should be cleaned up early.

- align `docs/ROADMAP.md` with what is already implemented in `README.md`
- explicitly mark partial or placeholder app capabilities in docs
- describe which platforms are currently first-class in Publisher and which are placeholders
- add a short architecture note explaining which features are local-first by design and which are pending server backing

## Suggested implementation order

1. P0.1 content workflow compounding
2. P0.2 runnable scenario packs
3. P0.3 publish reliability for automation
4. P0.4 useful AI assistance
5. P0.5 test layer
6. P0.6 Creative Studio real processing
7. P1.7 shell state refactor
8. P1.8 large module split
9. P1.9 server-backed workspace model

## Exit criteria for the next milestone

The next milestone should not be defined by app count. It should be defined by these outcomes:

- at least one workflow is reliable end to end
- secrets are not stored as normal browser state
- core regressions are covered by automation
- placeholder capabilities are either implemented or clearly labeled
- shell state is easier to change without touching unrelated behavior
