const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const Database = require("better-sqlite3");

const dataDir = path.join(process.cwd(), "data");
const sqlitePath = path.join(dataDir, "persistent-store.sqlite");

function openDb() {
  assert.ok(fs.existsSync(sqlitePath), `Expected SQLite database at ${sqlitePath}. Run pnpm db:init first.`);
  return new Database(sqlitePath, { readonly: true });
}

function openTempWritableCopy() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "prosbymax-smoke-"));
  const tempDbPath = path.join(tempDir, "persistent-store.sqlite");
  fs.copyFileSync(sqlitePath, tempDbPath);
  return {
    db: new Database(tempDbPath),
    tempDir
  };
}

test("database schema is initialized", () => {
  const db = openDb();
  try {
    const schemaVersion = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get();
    assert.equal(schemaVersion?.value, "2");
  } finally {
    db.close();
  }
});

test("core account and plan data exist", () => {
  const db = openDb();
  try {
    const userCount = db.prepare("SELECT COUNT(*) AS count FROM users").get();
    const planCount = db.prepare("SELECT COUNT(*) AS count FROM user_plans").get();
    const activePlanCount = db.prepare("SELECT COUNT(*) AS count FROM user_plans WHERE status = 'active'").get();
    const activeUserCount = db.prepare("SELECT COUNT(*) AS count FROM users WHERE active_plan_id IS NOT NULL").get();

    assert.ok(Number(userCount.count) >= 2);
    assert.ok(Number(planCount.count) >= 1);
    assert.ok(Number(activePlanCount.count) >= 1);
    assert.ok(Number(activeUserCount.count) >= 1);
  } finally {
    db.close();
  }
});

test("active plans stay aligned with users", () => {
  const db = openDb();
  try {
    const rows = db
      .prepare(
        `
          SELECT users.id AS user_id, users.active_plan_id AS active_plan_id, user_plans.status AS plan_status
          FROM users
          LEFT JOIN user_plans ON user_plans.id = users.active_plan_id
        `
      )
      .all();

    for (const row of rows) {
      if (row.active_plan_id === null) {
        continue;
      }

      assert.equal(row.plan_status, "active");
    }
  } finally {
    db.close();
  }
});

test("training records are linked to users and plans", () => {
  const db = openDb();
  try {
    const rows = db
      .prepare(
        `
          SELECT training_records.user_id, training_records.plan_id, users.id AS user_exists, user_plans.id AS plan_exists
          FROM training_records
          LEFT JOIN users ON users.id = training_records.user_id
          LEFT JOIN user_plans ON user_plans.id = training_records.plan_id
        `
      )
      .all();

    assert.ok(rows.length >= 1);
    for (const row of rows) {
      assert.ok(row.user_exists);
      if (row.plan_id !== null) {
        assert.ok(row.plan_exists);
      }
    }
  } finally {
    db.close();
  }
});

test("there is an active Gabor config version", () => {
  const db = openDb();
  try {
    const activeConfig = db
      .prepare(
        `
          SELECT id, training_type, status
          FROM training_config_versions
          WHERE training_type = 'gabor-match' AND status = 'active'
          LIMIT 1
        `
      )
      .get();

    assert.ok(activeConfig);
    assert.equal(activeConfig.training_type, "gabor-match");
    assert.equal(activeConfig.status, "active");
  } finally {
    db.close();
  }
});

test("plan template history storage is writable", () => {
  const { db, tempDir } = openTempWritableCopy();
  try {
    const versionCount = db.prepare("SELECT COUNT(*) AS count FROM plan_template_versions").get();
    const beforeCount = Number(versionCount.count);

    db.prepare(
      `
        INSERT INTO plan_template_versions (id, version, templates_json, changed_by, changed_at, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `
    ).run(
      "plan-template-v999",
      999,
      JSON.stringify([{ id: "sample", name: "Sample", durationWeeks: 4, sessionsPerWeek: 10, sessionDurationText: "每日 8-10 分钟", description: "Sample", status: "active", trainings: [] }]),
      "smoke-test",
      new Date().toISOString(),
      "writable-history-check"
    );

    const afterCount = db.prepare("SELECT COUNT(*) AS count FROM plan_template_versions").get();
    const latest = db
      .prepare("SELECT id, version, changed_by, notes FROM plan_template_versions ORDER BY version DESC LIMIT 1")
      .get();

    assert.equal(Number(afterCount.count), beforeCount + 1);
    assert.equal(latest.id, "plan-template-v999");
    assert.equal(latest.version, 999);
    assert.equal(latest.changed_by, "smoke-test");
    assert.equal(latest.notes, "writable-history-check");
  } finally {
    db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
