# Database

The app currently uses SQLite for local development and automated smoke tests.

- Local dev database: `data/persistent-store.sqlite`
- Schema source for SQLite initialization: `db/schema/sqlite.sql`
- Portable Postgres target schema: `db/schema/postgres.sql`

When we move production persistence behind Postgres, the repository layer will keep the same shape and only the storage driver will change.
The Postgres adapter now reads and writes the structured tables directly for users, sessions, plans, records, template versions, and config versions. It still keeps `app_state` as a compatibility fallback for migration and bootstrapping.

Environment variables:

- `PROSBYMAX_DATA_DIR`: overrides the local data directory for isolated test runs
- `DATABASE_URL`: reserved for the future Postgres runtime

To initialize Postgres or migrate the current SQLite snapshot:

```bash
pnpm db:init:postgres
pnpm db:migrate:postgres
```

The root `scripts/dev.sh` helper now prompts for SQLite or Postgres at startup. It also asks for a port interactively so you can avoid local port conflicts. If you select Postgres, it will ask for `DATABASE_URL` interactively unless that variable is already set in your shell or `.env.local`.

For a fresh machine bootstrap, prefer `./scripts/setup.sh` or `pnpm setup`. It checks for Node.js and pnpm, offers to install them when possible, prepares the local data directory and `.env.local`, initializes the database, and can launch the dev server afterward.

If you need to ship a restore bundle to another machine, you can also use:

```bash
./scripts/setup.sh --export ./bundle.zip
./scripts/setup.sh --bundle ./bundle.zip --target ./restored-workspace
```

The export mode packages the current workspace into a zip archive. The bundle mode restores that archive into a target directory, then continues the normal dependency and database setup flow from there.
