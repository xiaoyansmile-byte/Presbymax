# ProsbyMax/MCL Productization Baseline

> 中文阶段报告见 [PRODUCTIZATION_BASELINE_CN.md](./PRODUCTIZATION_BASELINE_CN.md)

## Purpose

This document freezes the current HTML demo as the baseline for turning the project into a production app. The current demo remains the reference implementation for training interactions, copy, page flow, and visual stimulus behavior while the new app architecture is introduced step by step.

## Milestone Freeze

Date: 2026-04-22

This workspace now has a stable product milestone that can be used as the main rollback target for subsequent UI, data, and workflow changes.

### Frozen capabilities

- Authenticated and role-aware app shell
- Account, plan, analytics, reports, and training routes
- Gabor match training session loop with plan-driven parameters
- Admin training configuration and plan-template editors
- SQLite local persistence with a Postgres path prepared
- Interactive setup script for restoring the dev environment on a new machine
- Bundle export / restore flow for moving the workspace between machines
- Repository split for users, plans, training records, training configs, and reports
- Smoke tests for repository, API, and auth/session flows
- Consolidated navigation and merged user-facing pages
- Current UI system with the latest visual pass and progress-circle treatment

### Intended rollback scope

If later work regresses the product experience, this milestone should restore the app to:

- The current merged page structure
- The current auth/session guards
- The current training session behavior
- The current admin configuration layout
- The current SQLite/Postgres storage boundary
- The current interactive setup and database initialization flow
- The current workspace bundle export and restore flow
- The current test coverage baseline

## Current Demo Positioning

The current project is a browser-only vision training demo. It uses plain HTML, CSS, JavaScript, Canvas, and LocalStorage to demonstrate:

- User registration and login flow
- Training plan selection and execution
- Six primary vision training modules
- Local training history
- Analytics, reports, reminders, sync, and admin utilities

It is suitable as a prototype and product discovery artifact. It is not yet a production app because authentication, data persistence, permissions, backend APIs, auditability, testing, and product-level UI architecture are still missing.

## Baseline Pages

- `index.html`: demo entry and training navigation
- `auth.html`: local demo account flow
- `plans.html`: local training plan selection
- `execute-plan.html`: current plan and daily training execution
- `gabor-match-pilot.html`: Gabor match training
- `flicker-gabor-focus.html`: flicker Gabor focus training
- `brightness-2afc.html`: contrast discrimination training
- `reading-2afc.html`: reading clarity training
- `glare-2afc.html`: glare/scatter visibility training
- `tunnel-symbol-speed.html`: tunnel near/far switching training
- `analytics.html`: training analytics
- `reports.html`: report generation
- `reminders.html`: local reminder settings
- `sync.html`: local import/export
- `admin.html`: LocalStorage inspection and management

## Baseline Data Model

The demo now has a unified client-side training record layer in `storage.js`. It reads older `gabor-training-history` records and newer `trainingHistory` records, normalizes them, and writes new records to the unified `trainingHistory` key.

The target production model should keep this shape:

```ts
type TrainingRecord = {
  id: string;
  userId: string | null;
  planId: string | null;
  trainingType: string;
  trainingLabel: string;
  startedAt: string;
  endedAt: string;
  durationSec: number;
  score: number;
  total: number | null;
  accuracy: number | null;
  metrics: Record<string, unknown>;
  createdAt: string;
};
```

## Migration Boundary

The product app should not continue expanding the standalone HTML files. New production work should happen in a structured app workspace, while the existing files stay available for reference and parity checks.

Recommended next structure:

```text
apps/web
apps/api
packages/core
packages/types
packages/ui
```

Start with `apps/web`, `packages/core`, and `packages/types`. Add `apps/api` once the first product UI shell and core training model are stable.

## Step 0 Status

- Productization branch: `codex/productization-start`
- Demo baseline documented in this file
- Existing demo remains runnable as static HTML
- Existing unrelated worktree changes should be reviewed separately before committing

## Next Step

Step 1 has created the product workspace skeleton:

- Initialize package/workspace config
- Add `apps/web` with Next.js, TypeScript, and Tailwind
- Add `packages/types` for shared domain types
- Add `packages/core` for training model helpers
- Keep the existing HTML demo intact during migration

pnpm has been installed in the user environment, dependencies have been installed, and the initial Next.js web shell has been verified at `http://localhost:3000`.

Step 2 has started by extracting the first product App Shell:

- `apps/web/components/app-shell.tsx`
- `apps/web/components/training-queue.tsx`
- `apps/web/components/plan-progress-card.tsx`
- `apps/web/components/stat-card.tsx`
- `apps/web/lib/mock-data.ts`

The dashboard is still backed by mock data, but the page is now structured for incremental migration into real routes and API-backed data.

The initial product routes are now in place:

- `/`: today training dashboard
- `/plans`: plan selection and current plan context
- `/analytics`: analytics overview and recent records
- `/reports`: report generation entry points

All routes currently use mock data and return HTTP 200 in the local Next.js dev server.

The first training migration shell is now available:

- `/train/gabor-match`: product route for Gabor match training
- `apps/web/components/training/gabor-match-shell.tsx`: interactive shell that validates training flow, result creation, and return navigation

The route now uses migrated Gabor puzzle generation and Canvas image data rendering:

- `generateGaborPuzzle`
- `createGaborImageData`
- `createSeededRandom`
- Gabor difficulty and triple types in `packages/core`

The next migration step is to add the real session loop: countdown, repeated trials, adaptive K progression, scoring, and persisted client/API-backed results.

Training runtime parameters are now separated into an admin-only configuration surface:

- `/admin/training-config`: admin route for Gabor match parameters
- `TrainingModuleConfig` and `GaborMatchConfig` shared types
- `defaultGaborMatchConfig` and `normalizeGaborMatchConfig` in `packages/core`
- `apps/web/lib/admin-config.ts`: temporary LocalStorage-backed config adapter

The user training page reads these settings but does not expose parameter controls. In production this adapter should be replaced by authenticated admin APIs and role-based access control.

Gabor stimulus parameters have also been moved into admin configuration:

- Orientation angle levels
- Spatial frequency levels
- Phase levels
- Contrast
- Baseline luminance
- Sigma ratio
- Gamma

`packages/core` now provides config-driven Gabor triple generation through `getGaborTriplesFromConfig`, and the training page passes admin-controlled rendering values into `createGaborImageData`.

The admin training configuration UI now uses a directory-style structure:

- Left navigation for training modules
- Module-scoped section navigation
- Flow settings
- Stimulus-space settings
- Rendering settings

This keeps the page scalable as more modules and parameter groups are added.

The admin component has been renamed to `TrainingConfigWorkbench` and now includes a compact configuration summary for the active module.

The Gabor admin page now includes a real-time stimulus preview. The preview renders the current config into Canvas without requiring a save first, so administrators can immediately inspect how orientation, spatial frequency, phase, contrast, baseline luminance, sigma ratio, and gamma affect the generated Gabor patch.

Deferred admin configuration improvements to revisit later:

- Configuration versions and audit trail
- Active/draft config status
- Restore-default controls
- Admin-only route protection and role-based visibility

The product data loop has started moving beyond mock-only pages:

- `apps/web/lib/training-records.ts`: temporary browser LocalStorage adapter using the unified `trainingHistory` key
- Gabor match completion now appends a real `TrainingRecord`
- Dashboard stats and analytics records now prefer local training records, falling back to demo records only when no local records exist

The Gabor match route now runs as a real continuous training session:

- Countdown uses the admin-configured session duration
- Countdown starts only after the user clicks the start-training button
- Trial progress stops at the admin-configured max-trial count
- Score and correct-count accumulate within the session
- Grid size increases after the configured number of correct answers, up to the configured max grid
- Selecting a candidate cell immediately shows correct/incorrect feedback and automatically advances to the next trial
- Session completion writes one summarized `TrainingRecord` with per-trial metrics

Product data and backend preparation has started:

- Shared domain types now include `AppUser`, `CreateTrainingRecordInput`, `TrainingRecordQuery`, and versioned training config records
- `packages/api-contract` defines repository interfaces and API route constants for users, training records, and training configs
- The current browser LocalStorage training-record adapter implements `TrainingRecordRepository`, so it can later be swapped for HTTP/API persistence without changing training UI code shape
- The Next.js app now exposes `/api/me`, `/api/training-records`, and `/api/training-configs/gabor-match/active`
- The frontend reads training records and Gabor config through API-first helpers with browser cache fallback
- The Next.js app now exposes `/api/dashboard` for current plan, today trainings, and plan templates
- The home page and plans page now read from the dashboard snapshot instead of direct static mock imports
- The Next.js app now exposes `/api/reports/summary` for report context, recent records, and generated report templates
- The reports page now renders the live report snapshot instead of static report template data
- Report export remains a follow-up task and is intentionally left out of this step
- Training records, plans, sessions, template versions, and Gabor config are now backed by SQLite tables under `apps/web/data/persistent-store.sqlite`
- The SQLite store still accepts the earlier JSON payload as a migration source, but the runtime path now reads and writes structured tables
- `apps/web/scripts/init-db.js` can initialize the schema or migrate the legacy JSON snapshot into SQLite, and `apps/web/data/README.md` documents the local database layout
- Domain-facing repository entry points now live under `apps/web/lib/repositories/` for users, plans, training records, training configs, and reports
- The `users` and `plans` repositories now own the main account and plan workflows, while `persistent-store.ts` keeps the shared SQLite/core data access helpers
- The `training-records` repository now owns training record writes, queries, and admin user summaries for the analytics/reporting path
- The `training-configs` and `reports` repositories now own configuration versioning and report snapshot generation
- The historical `server-training-store.ts` compatibility barrel has been removed, and repository smoke validation now runs through `pnpm smoke:db`
- A Node-based smoke test suite now verifies the SQLite schema, account-plan alignment, training-record links, active Gabor config, and writable plan-template history via `pnpm test:smoke`
- An API smoke suite now boots an isolated dev server against a temporary SQLite copy and verifies registration, login, session cookies, account data, plan enrollment, admin guards, and admin config writes via `pnpm test:api`
- Database schema has been extracted into `apps/web/db/schema/sqlite.sql` and `apps/web/db/schema/postgres.sql`; SQLite remains the local default, while `DATABASE_URL` is reserved for the future Postgres runtime
- The storage layer now selects SQLite by default and can write the same persistent store payload into Postgres `app_state` when `DATABASE_URL` is present; `pnpm db:init:postgres` initializes that schema
- `pnpm db:migrate:postgres` migrates the current local SQLite snapshot into the Postgres `app_state` payload for production seeding
- The Postgres adapter now reads and writes the structured user, session, plan, training-record, template-version, and config tables directly, while keeping `app_state` as a compatibility fallback
- `pnpm db:migrate:postgres` now migrates the current SQLite snapshot into the structured Postgres tables and still writes the compatibility `app_state` snapshot
- Runtime auto-migration from the legacy JSON snapshot / legacy SQLite payload has been removed; migration now happens explicitly through the `db:init` and `db:migrate:postgres` scripts
- The dashboard and reports server stores now read current plan, training queues, plan templates, and report templates from the same persistent store instead of importing them directly from `mock-data`
- The dashboard, analytics, reports, and training summary pages now stop rendering demo fallback data when real records are absent, and instead show empty states
- A lightweight role model is now available through `/api/me`, the top navigation hides the admin entry for non-admin users, and `/admin/training-config` plus the Gabor config write API are server-guarded for admin-only access
- User authentication is now available through `/auth` plus `/api/auth/login`, `/api/auth/register`, and `/api/auth/logout`; the app uses a session cookie backed by the local persistent store, and training records now default to the signed-in user when one exists
- User plans are now stored per account in the persistent store, and dashboard/report/training snapshots resolve the current plan from the signed-in user instead of a single global demo plan
- The product now includes a user center at `/account` for editing profile details and reviewing recent records, plus an admin-only `/admin/users` workspace for browsing account, plan, and training summaries
- Registration now lets the user choose a training plan template up front, `/api/plan-templates` exposes the selectable plan catalog, and `/api/account/plans` supports joining, switching, and leaving plans from the user center
- The public `/plans` page now shows only the current account's active and enrolled plans, while `/admin/plans` provides an admin-only template editor for cycle length, included training items, and template copy
- Plan templates now carry an enabled/archived state, registration only shows enabled templates, and the admin plan-template editor can toggle whether a template is available to users
- Plan template saves now create version history records, and the admin plan-template workspace shows recent save history for audit and review
- User plan actions now emit a plan event timeline, and the account page exposes joined/activated/left history alongside the active plan list
