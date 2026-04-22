#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const dataDir = path.resolve(process.env.PROSBYMAX_DATA_DIR || path.join(__dirname, "..", "data"));
const sqlitePath = path.join(dataDir, "persistent-store.sqlite");
const legacyJsonPath = path.join(dataDir, "persistent-store.json");
const schemaPath = path.join(__dirname, "..", "db", "schema", "sqlite.sql");

function applySchema(db) {
  const schemaSql = fs.readFileSync(schemaPath, "utf8");
  db.exec(schemaSql);
}

function ensureSchema(db) {
  applySchema(db);
  db.prepare(`
    INSERT INTO meta (key, value)
    VALUES ('schema_version', '2')
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run();
}

function isEmpty(db) {
  const row = db.prepare("SELECT COUNT(*) AS count FROM users").get();
  return !row || Number(row.count) === 0;
}

function writeSingletonJson(db, tableName, value) {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO ${tableName} (id, payload, updated_at)
    VALUES (1, ?, ?)
    ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
  `).run(JSON.stringify(value), now);
}

function insertRows(db, sql, rows) {
  const stmt = db.prepare(sql);
  for (const row of rows) stmt.run(row);
}

function migrateSnapshot(db, snapshot) {
  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    db.exec(`
      DELETE FROM users;
      DELETE FROM sessions;
      DELETE FROM user_plans;
      DELETE FROM plan_template_versions;
      DELETE FROM plan_instance_events;
      DELETE FROM training_records;
      DELETE FROM training_config_versions;
      DELETE FROM current_plan_state;
      DELETE FROM today_trainings_state;
      DELETE FROM plan_catalog_state;
      DELETE FROM report_summaries_state;
    `);

    db.prepare(`
      INSERT INTO meta (key, value)
      VALUES ('schema_version', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(String(snapshot.version ?? 1));

    if (snapshot.currentPlan) writeSingletonJson(db, "current_plan_state", snapshot.currentPlan);
    if (snapshot.todayTrainings) writeSingletonJson(db, "today_trainings_state", snapshot.todayTrainings);
    if (snapshot.planCatalog) writeSingletonJson(db, "plan_catalog_state", snapshot.planCatalog);
    if (snapshot.reportSummaries) writeSingletonJson(db, "report_summaries_state", snapshot.reportSummaries);

    insertRows(
      db,
      `
        INSERT INTO users (
          id, role, display_name, email, created_at, updated_at, password_salt, password_hash, password_updated_at, active_plan_id
        ) VALUES (
          @id, @role, @displayName, @email, @createdAt, @updatedAt, @passwordSalt, @passwordHash, @passwordUpdatedAt, @activePlanId
        )
      `,
      Array.isArray(snapshot.users)
        ? snapshot.users.map((user) => ({
            id: user.id,
            role: user.role,
            displayName: user.displayName,
            email: user.email ?? null,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            passwordSalt: user.passwordSalt,
            passwordHash: user.passwordHash,
            passwordUpdatedAt: user.passwordUpdatedAt,
            activePlanId: user.activePlanId ?? null
          }))
        : []
    );

    insertRows(
      db,
      `
        INSERT INTO sessions (token, user_id, created_at, updated_at, expires_at)
        VALUES (@token, @userId, @createdAt, @updatedAt, @expiresAt)
      `,
      Array.isArray(snapshot.sessions)
        ? snapshot.sessions.map((session) => ({
            token: session.token,
            userId: session.userId,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
            expiresAt: session.expiresAt
          }))
        : []
    );

    insertRows(
      db,
      `
        INSERT INTO user_plans (id, user_id, template_id, name_snapshot, start_date, end_date, total_sessions, completed_sessions, status)
        VALUES (@id, @userId, @templateId, @nameSnapshot, @startDate, @endDate, @totalSessions, @completedSessions, @status)
      `,
      Array.isArray(snapshot.userPlans)
        ? snapshot.userPlans.map((plan) => ({
            id: plan.id,
            userId: plan.userId,
            templateId: plan.templateId,
            nameSnapshot: plan.nameSnapshot,
            startDate: plan.startDate,
            endDate: plan.endDate,
            totalSessions: plan.totalSessions,
            completedSessions: plan.completedSessions,
            status: plan.status
          }))
        : []
    );

    insertRows(
      db,
      `
        INSERT INTO plan_template_versions (id, version, templates_json, changed_by, changed_at, notes)
        VALUES (@id, @version, @templatesJson, @changedBy, @changedAt, @notes)
      `,
      Array.isArray(snapshot.planTemplateVersions)
        ? snapshot.planTemplateVersions.map((version) => ({
            id: version.id,
            version: version.version,
            templatesJson: JSON.stringify(version.templates ?? []),
            changedBy: version.changedBy ?? null,
            changedAt: version.changedAt,
            notes: version.notes ?? null
          }))
        : []
    );

    insertRows(
      db,
      `
        INSERT INTO plan_instance_events (id, user_id, plan_id, template_id, template_name, type, created_at, notes)
        VALUES (@id, @userId, @planId, @templateId, @templateName, @type, @createdAt, @notes)
      `,
      Array.isArray(snapshot.planInstanceEvents)
        ? snapshot.planInstanceEvents.map((event) => ({
            id: event.id,
            userId: event.userId,
            planId: event.planId ?? null,
            templateId: event.templateId ?? null,
            templateName: event.templateName ?? null,
            type: event.type,
            createdAt: event.createdAt,
            notes: event.notes ?? null
          }))
        : []
    );

    insertRows(
      db,
      `
        INSERT INTO training_records (
          id, user_id, plan_id, training_type, training_label, started_at, ended_at, duration_sec, score, total, accuracy, metrics_json, created_at
        ) VALUES (
          @id, @userId, @planId, @trainingType, @trainingLabel, @startedAt, @endedAt, @durationSec, @score, @total, @accuracy, @metricsJson, @createdAt
        )
      `,
      Array.isArray(snapshot.trainingRecords)
        ? snapshot.trainingRecords.map((record) => ({
            id: record.id,
            userId: record.userId ?? null,
            planId: record.planId ?? null,
            trainingType: record.trainingType,
            trainingLabel: record.trainingLabel,
            startedAt: record.startedAt,
            endedAt: record.endedAt,
            durationSec: record.durationSec,
            score: record.score,
            total: record.total ?? null,
            accuracy: record.accuracy ?? null,
            metricsJson: JSON.stringify(record.metrics ?? {}),
            createdAt: record.createdAt ?? now
          }))
        : []
    );

    insertRows(
      db,
      `
        INSERT INTO training_config_versions (
          id, training_type, version, status, config_json, created_by, created_at, activated_at, notes
        ) VALUES (
          @id, @trainingType, @version, @status, @configJson, @createdBy, @createdAt, @activatedAt, @notes
        )
      `,
      Array.isArray(snapshot.trainingConfigVersions)
        ? snapshot.trainingConfigVersions.map((version) => ({
            id: version.id,
            trainingType: version.trainingType,
            version: version.version,
            status: version.status,
            configJson: JSON.stringify(version.config ?? {}),
            createdBy: version.createdBy ?? null,
            createdAt: version.createdAt,
            activatedAt: version.activatedAt ?? null,
            notes: version.notes ?? null
          }))
        : []
    );

    db.prepare(`
      INSERT INTO app_state (id, payload, updated_at)
      VALUES (1, ?, ?)
      ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
    `).run(JSON.stringify(snapshot), now);
  });

  tx();
}

function main() {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new Database(sqlitePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  ensureSchema(db);

  if (!isEmpty(db)) {
    console.log(`[db:init] SQLite already contains data at ${sqlitePath}`);
    db.close();
    return;
  }

  if (!fs.existsSync(legacyJsonPath)) {
    console.log(`[db:init] Schema created at ${sqlitePath}; no legacy snapshot found, leaving it empty.`);
    db.close();
    return;
  }

  const snapshot = JSON.parse(fs.readFileSync(legacyJsonPath, "utf8"));
  migrateSnapshot(db, snapshot);
  db.close();
  console.log(`[db:init] Migrated legacy JSON snapshot into ${sqlitePath}`);
}

main();
