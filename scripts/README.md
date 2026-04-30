# Scripts

This folder contains the two entry scripts for the workspace:

- `dev.sh`: start the local dev server
- `setup.sh`: package, restore, prepare, and optionally launch the workspace on another machine

## One-step restore

If you want to move this project to another machine, keep:

- `scripts/setup.sh`
- one code bundle zip, for example `bundle.zip`

Then run:

```bash
./scripts/setup.sh --bundle ./bundle.zip --target ./restored-workspace
```

The script will:

1. Restore the zip into the target directory if the code is missing
2. Check for Node.js, pnpm, zip, and unzip
3. Offer to install missing dependencies when possible
4. Create `apps/web/.env.local` if needed
5. Initialize the local SQLite database, or ask for `DATABASE_URL` if you choose Postgres
6. Optionally start the dev server

## Create a bundle

To export the current workspace into a zip archive:

```bash
./scripts/setup.sh --export ./bundle.zip
```

Recommended: run thi[setup.sh](assets/setup.sh)
s command from the project root so the bundle path is easy to find and the output zip lands where you expect.

The bundle intentionally excludes generated or local-only artifacts such as:

- `.git`
- `node_modules`
- `.next`
- local SQLite files
- existing zip archives

## Start the app directly

If the workspace is already present on the machine, you can skip restoration and go straight to environment setup:

```bash
./scripts/setup.sh
```

Or start only the app:

```bash
./scripts/dev.sh
```

## Notes

- `setup.sh` is the preferred bootstrap entry for a fresh machine.
- `dev.sh` is the shorter daily-start entry when the workspace already exists.
- The local database default is SQLite, but the script can prompt for Postgres through `DATABASE_URL`.
