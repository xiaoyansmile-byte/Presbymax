# Product App Setup

## Workspace

The product app skeleton uses a pnpm workspace:

```text
apps/web
packages/core
packages/types
packages/ui
```

The existing standalone HTML demo remains in the repository as the migration baseline.

## Prerequisites

- Node.js 20 or newer
- pnpm 10 or newer

If pnpm is unavailable but Node.js includes Corepack, enable it first:

```bash
corepack enable
corepack prepare pnpm@10.9.0 --activate
```

## Install

```bash
pnpm install
```

In the Codex desktop environment used for this migration, the app-bundled `node`
cannot load Next.js native SWC modules on macOS. Use the workspace runtime Node
first in `PATH` when running pnpm commands:

```bash
export PATH="/Users/hanxiaoyan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/hanxiaoyan/Library/pnpm:$PATH"
```

## Run Web App

```bash
pnpm dev
```

The initial product shell runs from `apps/web` and is available at:

```text
http://localhost:3000
```

## Current Skeleton Scope

- Root workspace config
- `apps/web` Next.js App Router shell
- `packages/types` shared product domain types
- `packages/core` training record helpers and summary logic
- `packages/ui` shared UI utility entry point

## Next Implementation Step

Migrate the first real product flow into `apps/web`:

- Today training dashboard
- Local mock training record data provider
- Plan progress model
- Navigation layout
- First migrated training module wrapper
