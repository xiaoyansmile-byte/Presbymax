#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const { Pool } = require("pg");

const dataDir = path.resolve(process.env.PROSBYMAX_DATA_DIR || path.join(__dirname, "..", "data"));
const sqlitePath = path.join(dataDir, "persistent-store.sqlite");
const schemaPath = path.join(__dirname, "..", "db", "schema", "postgres.sql");

function readSingletonJson(db, tableName) {
  const row = db.prepare(`SELECT payload FROM ${tableName} WHERE id = 1`).get();
  if (!row || !row.payload) return null;
  try {
    return JSON.parse(row.payload);
  } catch {
    return null;
  }
}

function loadSqliteSnapshot() {
  if (!fs.existsSync(sqlitePath)) {
    throw new Error(`Missing SQLite database at ${sqlitePath}. Run pnpm db:init first.`);
  }

  const db = new Database(sqlitePath, { readonly: true });
  try {
    const meta = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get();

    const users = db
      .prepare(
        `
          SELECT id, role, display_name, email, created_at, updated_at, password_salt, password_hash, password_updated_at, active_plan_id
          FROM users
          ORDER BY created_at ASC
        `
      )
      .all()
      .map((user) => ({
        id: user.id,
        role: user.role,
        displayName: user.display_name,
        email: user.email,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        passwordSalt: user.password_salt,
        passwordHash: user.password_hash,
        passwordUpdatedAt: user.password_updated_at,
        activePlanId: user.active_plan_id
      }));

    const sessions = db
      .prepare("SELECT token, user_id, created_at, updated_at, expires_at FROM sessions ORDER BY updated_at DESC")
      .all()
      .map((session) => ({
        token: session.token,
        userId: session.user_id,
        createdAt: session.created_at,
        updatedAt: session.updated_at,
        expiresAt: session.expires_at
      }));

    const userPlans = db
      .prepare(
        `
          SELECT id, user_id, template_id, name_snapshot, start_date, end_date, total_sessions, completed_sessions, status
          FROM user_plans
          ORDER BY start_date DESC
        `
      )
      .all()
      .map((plan) => ({
        id: plan.id,
        userId: plan.user_id,
        templateId: plan.template_id,
        nameSnapshot: plan.name_snapshot,
        startDate: plan.start_date,
        endDate: plan.end_date,
        totalSessions: plan.total_sessions,
        completedSessions: plan.completed_sessions,
        status: plan.status
      }));

    const planTemplateVersions = db
      .prepare(
        `
          SELECT id, version, templates_json, changed_by, changed_at, notes
          FROM plan_template_versions
          ORDER BY version DESC
        `
      )
      .all()
      .map((version) => ({
        id: version.id,
        version: version.version,
        templates: JSON.parse(version.templates_json),
        changedBy: version.changed_by,
        changedAt: version.changed_at,
        notes: version.notes
      }));

    const planInstanceEvents = db
      .prepare(
        `
          SELECT id, user_id, plan_id, template_id, template_name, type, created_at, notes
          FROM plan_instance_events
          ORDER BY created_at DESC
        `
      )
      .all()
      .map((event) => ({
        id: event.id,
        userId: event.user_id,
        planId: event.plan_id ?? null,
        templateId: event.template_id ?? null,
        templateName: event.template_name ?? null,
        type: event.type,
        createdAt: event.created_at,
        notes: event.notes ?? null
      }));

    const trainingRecords = db
      .prepare(
        `
          SELECT id, user_id, plan_id, training_type, training_label, started_at, ended_at, duration_sec, score, total, accuracy, metrics_json, created_at
          FROM training_records
          ORDER BY started_at DESC
        `
      )
      .all()
      .map((record) => ({
        id: record.id,
        userId: record.user_id,
        planId: record.plan_id ?? null,
        trainingType: record.training_type,
        trainingLabel: record.training_label,
        startedAt: record.started_at,
        endedAt: record.ended_at,
        durationSec: record.duration_sec,
        score: record.score,
        total: record.total ?? null,
        accuracy: record.accuracy ?? null,
        metrics: JSON.parse(record.metrics_json || "{}"),
        createdAt: record.created_at
      }));

    const trainingConfigVersions = db
      .prepare(
        `
          SELECT id, training_type, version, status, config_json, created_by, created_at, activated_at, notes
          FROM training_config_versions
          ORDER BY version DESC
        `
      )
      .all()
      .map((version) => ({
        id: version.id,
        trainingType: version.training_type,
        version: version.version,
        status: version.status,
        config: JSON.parse(version.config_json),
        createdBy: version.created_by,
        createdAt: version.created_at,
        activatedAt: version.activated_at,
        notes: version.notes
      }));

    const snapshot = {
      version: Number(meta?.value ?? "2"),
      users,
      sessions,
      userPlans,
      currentPlan: readSingletonJson(db, "current_plan_state"),
      todayTrainings: readSingletonJson(db, "today_trainings_state") ?? [],
      planCatalog: readSingletonJson(db, "plan_catalog_state") ?? [],
      planTemplates: [],
      planTemplateVersions,
      planInstanceEvents,
      reportSummaries: readSingletonJson(db, "report_summaries_state") ?? [],
      currentPlanId: readSingletonJson(db, "current_plan_state")?.id ?? "",
      trainingRecords,
      trainingConfigVersions
    };

    snapshot.planTemplates = Array.isArray(snapshot.planCatalog)
      ? snapshot.planCatalog.map((template) => ({
          id: template.id,
          name: template.name,
          durationWeeks: template.durationWeeks,
          sessionsPerWeek: template.sessionsPerWeek,
          sessionDurationText: template.sessionDurationText,
          description: template.description,
          status: template.status,
          focus: template.trainings?.[0]?.id ?? template.name
        }))
      : [];

    return snapshot;
  } finally {
    db.close();
  }
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to migrate data into Postgres.");
  }

  const pool = new Pool({ connectionString, max: 5 });
  const schemaSql = fs.readFileSync(schemaPath, "utf8");
  const snapshot = loadSqliteSnapshot();

  try {
    await pool.query(schemaSql);
    await pool.query("BEGIN");
    await pool.query("DELETE FROM users");
    await pool.query("DELETE FROM sessions");
    await pool.query("DELETE FROM user_plans");
    await pool.query("DELETE FROM plan_template_versions");
    await pool.query("DELETE FROM plan_instance_events");
    await pool.query("DELETE FROM training_records");
    await pool.query("DELETE FROM training_config_versions");
    await pool.query("DELETE FROM current_plan_state");
    await pool.query("DELETE FROM today_trainings_state");
    await pool.query("DELETE FROM plan_catalog_state");
    await pool.query("DELETE FROM report_summaries_state");
    await pool.query(
      `
        INSERT INTO meta (key, value)
        VALUES ('schema_version', $1)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
      `,
      [String(snapshot.version)]
    );
    const now = new Date().toISOString();
    const writeSingleton = async (tableName, payload) => {
      await pool.query(
        `
          INSERT INTO ${tableName} (id, payload, updated_at)
          VALUES (1, $1, $2)
          ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = EXCLUDED.updated_at
        `,
        [JSON.stringify(payload), now]
      );
    };

    await writeSingleton("current_plan_state", snapshot.currentPlan);
    await writeSingleton("today_trainings_state", snapshot.todayTrainings);
    await writeSingleton("plan_catalog_state", snapshot.planCatalog);
    await writeSingleton("report_summaries_state", snapshot.reportSummaries);

    for (const user of snapshot.users) {
      await pool.query(
        `
          INSERT INTO users (
            id, role, display_name, email, created_at, updated_at, password_salt, password_hash, password_updated_at, active_plan_id
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
          )
        `,
        [
          user.id,
          user.role,
          user.displayName,
          user.email,
          user.createdAt,
          user.updatedAt,
          user.passwordSalt,
          user.passwordHash,
          user.passwordUpdatedAt,
          user.activePlanId
        ]
      );
    }

    for (const session of snapshot.sessions) {
      await pool.query(
        `
          INSERT INTO sessions (token, user_id, created_at, updated_at, expires_at)
          VALUES ($1, $2, $3, $4, $5)
        `,
        [session.token, session.userId, session.createdAt, session.updatedAt, session.expiresAt]
      );
    }

    for (const plan of snapshot.userPlans) {
      await pool.query(
        `
          INSERT INTO user_plans (id, user_id, template_id, name_snapshot, start_date, end_date, total_sessions, completed_sessions, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        [
          plan.id,
          plan.userId,
          plan.templateId,
          plan.nameSnapshot,
          plan.startDate,
          plan.endDate,
          plan.totalSessions,
          plan.completedSessions,
          plan.status
        ]
      );
    }

    for (const version of snapshot.planTemplateVersions) {
      await pool.query(
        `
          INSERT INTO plan_template_versions (id, version, templates_json, changed_by, changed_at, notes)
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [version.id, version.version, JSON.stringify(version.templates), version.changedBy, version.changedAt, version.notes]
      );
    }

    for (const event of snapshot.planInstanceEvents) {
      await pool.query(
        `
          INSERT INTO plan_instance_events (id, user_id, plan_id, template_id, template_name, type, created_at, notes)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [event.id, event.userId, event.planId, event.templateId, event.templateName, event.type, event.createdAt, event.notes]
      );
    }

    for (const record of snapshot.trainingRecords) {
      await pool.query(
        `
          INSERT INTO training_records (
            id, user_id, plan_id, training_type, training_label, started_at, ended_at, duration_sec, score, total, accuracy, metrics_json, created_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
          )
        `,
        [
          record.id,
          record.userId,
          record.planId,
          record.trainingType,
          record.trainingLabel,
          record.startedAt,
          record.endedAt,
          record.durationSec,
          record.score,
          record.total,
          record.accuracy,
          JSON.stringify(record.metrics ?? {}),
          record.createdAt
        ]
      );
    }

    for (const version of snapshot.trainingConfigVersions) {
      await pool.query(
        `
          INSERT INTO training_config_versions (
            id, training_type, version, status, config_json, created_by, created_at, activated_at, notes
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9
          )
        `,
        [
          version.id,
          version.trainingType,
          version.version,
          version.status,
          JSON.stringify(version.config),
          version.createdBy,
          version.createdAt,
          version.activatedAt,
          version.notes
        ]
      );
    }

    await writeSingleton("app_state", snapshot);
    await pool.query("COMMIT");
    console.log(`[db:migrate:postgres] migrated SQLite snapshot from ${sqlitePath} into Postgres structured tables`);
  } catch (error) {
    await pool.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`[db:migrate:postgres] ${error.message}`);
  process.exit(1);
});
