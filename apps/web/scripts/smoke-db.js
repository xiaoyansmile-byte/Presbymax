#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const dataDir = path.join(__dirname, "..", "data");
const sqlitePath = path.join(dataDir, "persistent-store.sqlite");

function fail(message) {
  console.error(`[smoke:db] ${message}`);
  process.exit(1);
}

if (!fs.existsSync(sqlitePath)) {
  fail(`missing SQLite database at ${sqlitePath}. Run "pnpm db:init" first.`);
}

const db = new Database(sqlitePath, { readonly: true });

try {
  const schemaVersion = db
    .prepare("SELECT value FROM meta WHERE key = 'schema_version'")
    .get();
  if (!schemaVersion) fail("meta.schema_version is missing.");

  const counts = {
    users: db.prepare("SELECT COUNT(*) AS count FROM users").get().count,
    sessions: db.prepare("SELECT COUNT(*) AS count FROM sessions").get().count,
    userPlans: db.prepare("SELECT COUNT(*) AS count FROM user_plans").get().count,
    planTemplates: db.prepare("SELECT COUNT(*) AS count FROM plan_catalog_state").get().count,
    trainingRecords: db.prepare("SELECT COUNT(*) AS count FROM training_records").get().count,
    trainingConfigs: db.prepare("SELECT COUNT(*) AS count FROM training_config_versions").get().count
  };

  if (Number(counts.users) === 0) fail("users table is empty.");
  if (Number(counts.planTemplates) === 0) fail("plan_catalog_state is empty.");
  if (Number(counts.trainingConfigs) === 0) fail("training_config_versions is empty.");

  const activeConfig = db
    .prepare("SELECT id, training_type FROM training_config_versions WHERE status = 'active' LIMIT 1")
    .get();
  if (!activeConfig) fail("no active training configuration found.");

  const activePlans = db
    .prepare("SELECT COUNT(*) AS count FROM user_plans WHERE status = 'active'")
    .get();
  if (Number(activePlans.count) === 0) fail("no active user plan found.");

  console.log(
    [
      "[smoke:db] OK",
      `schema=${schemaVersion.value}`,
      `users=${counts.users}`,
      `plans=${counts.userPlans}`,
      `records=${counts.trainingRecords}`,
      `activeConfig=${activeConfig.id}`
    ].join(" ")
  );
} finally {
  db.close();
}
