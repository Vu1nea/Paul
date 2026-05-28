# Handoff — Pipeline Builder Implementation

**Date:** 2026-05-27
**Branch:** `worktree-squishy-wibbling-dream`
**Worktree path:** `C:\Users\vinod\OneDrive\Documents\Summer 2026 Projects\Paul\.claude\worktrees\squishy-wibbling-dream`

---

## What This Branch Is

Full implementation of Phase 2 scripting layer (TASK-011 to TASK-015 from TASKS.md) extended with a low-code **pipeline builder** — a step-based UI that lets non-technical users fetch and combine data from HTTP APIs without writing code.

Design spec: `docs/superpowers/specs/2026-05-27-pipeline-builder-design.md`
Implementation plan: `docs/superpowers/plans/2026-05-27-pipeline-builder.md`

---

## Completed Tasks (server-side, Tasks 1–5)

| # | Task | Commit | Status |
|---|------|--------|--------|
| 1 | Server test infrastructure (Jest + ts-jest) | `4caaa48` | ✅ |
| 2 | Database schema (data_sources, connectors, secrets tables) | `ee2e0b6` | ✅ |
| 3 | Pipeline types + code generator (`server/src/pipeline.ts`) | `09f8349` + `b1bbd2c` | ✅ |
| 4 | Connector routes + Open-Meteo built-in seed | `8dba231` + `0f8558d` | ✅ |
| 5 | Data source CRUD routes (`server/src/routes/sources.ts`) | `9c1f4cc` | ✅ |

**Current HEAD:** `9c1f4cc`

**Test suite:** 13 tests passing (Jest, server-side only)

---

## Next Task — Task 6: Script runner

**File to create:** `server/src/runner.ts`

A stub of `runner.ts` already exists at `server/src/runner.ts` (no-op functions, created by Task 5 to satisfy TypeScript imports). Task 6 **replaces** this stub with the real implementation.

The full implementation is in the plan at Task 6. Key points:
- Uses Node.js `vm.runInNewContext()` with a 10-second timeout
- Sandbox provides: `fetch`, `console`, `getSecret`, `Promise`
- `getSecret` reads from the `secrets` table and calls `decryptValue` (from `server/src/secrets.ts` — **does not exist yet**, created in Task 7)
- Scripts are wrapped: `(async () => { ${script} })()`
- On success: saves `JSON.stringify(result)` to `last_output`, ISO timestamp to `last_run_at`
- On failure: saves `JSON.stringify({ error: message })` to `last_output`
- `startAllCronJobs()`: loads all data_sources from DB, registers a cron job per source
- Active jobs stored in `Map<string, cron.ScheduledTask>` — `registerCronJob` stops any existing job before creating a new one
- `node-cron` is already installed

**IMPORTANT dependency:** `runner.ts` imports `decryptValue` from `./secrets`. Since `secrets.ts` doesn't exist yet (Task 7), you must either:
- Create both Task 6 and Task 7 together, OR
- Create `server/src/secrets.ts` as a stub first, then implement runner, then implement the real secrets.ts in Task 7

The plan handles this by having Task 7 create `secrets.ts` and Task 8 do the final wire-up. To unblock Task 6, create a minimal secrets stub:
```typescript
// server/src/secrets.ts (stub — replaced in Task 7)
export function encryptValue(_value: string): string { return '' }
export function decryptValue(_stored: string): string { return '' }
```

---

## Remaining Tasks (6–16)

| # | Task | Files |
|---|------|-------|
| 6 | Script runner | `server/src/runner.ts` (replace stub) |
| 7 | Secrets store | `server/src/secrets.ts`, `server/src/routes/secrets.ts` |
| 8 | Wire up index.ts | `server/src/index.ts` (replace entirely) |
| 9 | Client test infra + resolvePath | `client/src/utils/resolvePath.ts`, Vitest setup |
| 10 | Script Widget | `client/src/widgets/ScriptWidget.tsx` |
| 11 | App.tsx navigation + Script widget | `client/src/App.tsx` |
| 12 | SecretsView | `client/src/views/SecretsView.tsx` |
| 13 | ScriptsView (code mode) | `client/src/views/ScriptsView.tsx` (install `@monaco-editor/react`) |
| 14 | PipelineBuilderView | `client/src/views/PipelineBuilderView.tsx` |
| 15 | ConnectorsView | `client/src/views/ConnectorsView.tsx` |
| 16 | End-to-end verification | `docker compose up --build`, manual checks |

Full step-by-step instructions with complete code for each task are in `docs/superpowers/plans/2026-05-27-pipeline-builder.md`.

---

## Key Architecture Notes

- **Pipeline mode vs code mode:** A data source has a nullable `pipeline_json` column. When set, the server generates a JavaScript `script` from it on every save. The script runner always reads `script` — it never sees `pipeline_json`.
- **Code generator:** `server/src/pipeline.ts` → `generateScript(pipeline)` — pure function, fully tested.
- **Connector resolution:** Before calling `generateScript`, the route handler calls `resolveConnectorStep` for any Fetch step with a `connector_id` — substitutes `{variables}` into the connector's URL/headers/body template.
- **Secrets encryption:** AES-256-GCM, key derived from `PAUL_SECRET_KEY` env var via `scryptSync`. Format: `iv_hex:authTag_hex:ciphertext_hex`.
- **All better-sqlite3 calls are synchronous** — never use async/await with the DB.

---

## How to Resume

To pick up where this left off, use the subagent-driven-development approach:

1. Read the plan: `docs/superpowers/plans/2026-05-27-pipeline-builder.md`
2. Tasks 1–5 are complete. Start at **Task 6**.
3. Dispatch an implementer subagent for Task 6 with the full task text from the plan + the context above (runner stub exists, secrets stub needed).
4. After implementer → spec reviewer → code quality reviewer → mark complete → next task.

The worktree is already isolated. All work goes on branch `worktree-squishy-wibbling-dream`.
