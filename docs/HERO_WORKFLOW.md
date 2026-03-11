# Hero Workflow Strategy

AgentCore OS should not try to prove itself by showing many desks at the same depth.

Near-term product credibility should come from one deeply runnable workflow that demonstrates:

- clear trigger
- visible state progression
- explicit human/AI boundary
- asset accumulation after execution

## Why narrow first

If too many role desks are developed only as polished templates, the product risks a “sample room” effect:

- looks complete
- feels organized
- but does not solve one role deeply enough to become indispensable

So the strategy is:

1. choose one hero workflow
2. make it operational end to end
3. reuse the same structure for other desks later

## Recommended first hero workflow

Suggested priority:

`Sales Desk`

Especially a vertical external-facing workflow such as:

- inbound inquiry
- lead qualification
- quote / follow-up draft
- human approval
- CRM and knowledge asset write-back

## Minimum system requirements for a hero workflow

### 1. Trigger

Each workflow must declare what starts it.

Examples:

- manual
- scheduled
- inbound message
- web form

If the trigger is not clear, the system still feels like a collection of tools.

### 2. Runtime state

Each workflow needs observable state, not just a recommended diagram.

Recommended states:

- `idle`
- `running`
- `awaiting_human`
- `completed`
- `error`

### 3. Stage state

Each stage should also show progress:

- `pending`
- `running`
- `awaiting_human`
- `completed`
- `error`

### 4. Asset landing

Each completed workflow should produce reusable assets in concrete stores, not only freeform text.

Examples:

- CRM record updates
- draft templates
- follow-up sequences
- knowledge entries
- reusable playbooks

## Current implementation direction

The current codebase has started to support this structure via:

- role-based desks in `Industry Hub`
- per-scenario workflow stage definitions
- trigger definitions
- local-first workflow runtime records
- result asset declarations

That is the right spine.

## Implemented first pass

As of `2026-03-11`, the first runnable pass of the recommended hero workflow is now in place for `Sales Desk`:

- `Deal Desk` can start a sales workflow from an inquiry-style trigger
- inquiry intake now includes concrete business fields such as source channel, language preference, and product line
- lead qualification writes back into the same workflow run
- `Email Assistant` receives the same `workflowRunId` and holds the chain at the human review boundary
- `Personal CRM` receives the reviewed handoff and acts as the local asset landing point
- a dedicated local `sales assets` store now preserves requirement summary, follow-up context, and next-step guidance

This is intentionally still narrow. The right next step is not adding more desks at the same depth, but making this chain smarter and more connector-ready.
