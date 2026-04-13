# Work Tracking Integration Design

**Date:** 2026-03-20
**Status:** Approved

## Problem

Work gets done in Claude Code sessions but disappears into git history. Linear board is empty. Notion Product section has no link to what's been built. No operational cadence.

## Design

### Linear Integration

**Trigger:** Explicit — Claude asks "Want me to log this to Linear?" after completing meaningful work. Never auto-creates.

**What counts as meaningful work:** Feature/phase builds, bug fix batches, infrastructure changes. NOT exploration, planning, or discussion.

**Issue format:**
- One issue per meaningful unit (phase, feature, fix batch)
- Checklist of sub-tasks in description
- Commit SHA reference
- Key files changed
- Status: Done (completed work) or Todo/In Progress (upcoming/WIP)
- Labels: auto-selected from existing set (Feature, Bug, Improvement, Infra, Copilot, etc.)
- Project: matched to existing or new one created with user approval

**API:** Linear GraphQL via curl, `LINEAR_API_KEY` in shell env.

### Notion Integration

**Trigger:** Explicit — Claude asks "Want me to sync this to Notion?" when a design doc is created.

**What syncs:** Design docs from `docs/plans/` → Notion Product section.

**API:** Notion MCP tools (already connected).

### Operational Prompts

After completing meaningful work, Claude always asks (in order):
1. "Want me to log this to Linear?"
2. "Want me to sync the design doc to Notion?" (only when a plan/design was created)
3. "Want me to run predeploy?"
4. "Want me to push to main?"

### Not In Scope (Yet)

- Bidirectional sync between Linear and Notion
- Make.com automation flows
- Calendar integration
- Weekly digest automation

## Linear Workspace

- **Workspace:** Verisum
- **Teams:** TrustGraph (platform), Verisum (business)
- **Project:** AI Governance Copilot v1
- **States:** Backlog → Todo → In Progress → In Review → Done

## Backfill

- TG-15: Policy Management Phase 1 (Done)
- TG-16: Policy Management Phase 2 (Todo)
