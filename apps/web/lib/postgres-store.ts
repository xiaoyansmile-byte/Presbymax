import { readFileSync } from "fs";
import path from "path";
import { Pool } from "pg";
import {
  buildPlanTemplateSummaries,
  createInitialStore,
  normalizePlanCatalog,
  parseJsonValue,
  type PersistentStore,
  type SessionRecord,
} from "@/lib/persistent-store";
import type {
  AppUser,
  GaborMatchConfig,
  PlanInstanceEvent,
  PlanTemplate,
  PlanTemplateVersion,
  ReportTemplateSummary,
  TodayTraining,
  TrainingConfigVersion,
  TrainingRecord,
  UserPlan,
} from "@prosbymax/types";
import { defaultGaborMatchConfig } from "@prosbymax/core";
import { planCatalog as seedPlanCatalog } from "@/lib/mock-data";

const schemaPath = path.join(process.cwd(), "db", "schema", "postgres.sql");

type UserRow = {
  id: string;
  role: AppUser["role"];
  display_name: string;
  email: string | null;
  created_at: string;
  updated_at: string;
  password_salt: string;
  password_hash: string;
  password_updated_at: string;
  active_plan_id: string | null;
};

type UserPlanRow = {
  id: string;
  user_id: string;
  template_id: string;
  name_snapshot: string;
  start_date: string;
  end_date: string;
  total_sessions: number;
  completed_sessions: number;
  status: UserPlan["status"];
};

type SessionRow = SessionRecord;

type PlanTemplateVersionRow = {
  id: string;
  version: number;
  templates_json: string;
  changed_by: string | null;
  changed_at: string;
  notes: string | null;
};

type PlanInstanceEventRow = {
  id: string;
  user_id: string;
  plan_id: string | null;
  template_id: string | null;
  template_name: string | null;
  type: PlanInstanceEvent["type"];
  created_at: string;
  notes: string | null;
};

type TrainingRecordRow = {
  id: string;
  user_id: string | null;
  plan_id: string | null;
  training_type: TrainingRecord["trainingType"];
  training_label: string;
  started_at: string;
  ended_at: string;
  duration_sec: number;
  score: number;
  total: number | null;
  accuracy: number | null;
  metrics_json: string;
  created_at: string;
};

type TrainingConfigVersionRow = {
  id: string;
  training_type: TrainingConfigVersion<GaborMatchConfig>["trainingType"];
  version: number;
  status: TrainingConfigVersion<GaborMatchConfig>["status"];
  config_json: string;
  created_by: string | null;
  created_at: string;
  activated_at: string | null;
  notes: string | null;
};

let pool: Pool | null = null;
let schemaReady = false;

function getPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for the Postgres storage backend.");
  }

  if (!pool) {
    pool = new Pool({
      connectionString,
      max: 5
    });
  }

  return pool;
}

async function ensureSchema() {
  if (schemaReady) return;
  const db = getPool();
  const schemaSql = readFileSync(schemaPath, "utf8");
  await db.query(schemaSql);
  schemaReady = true;
}

async function readSingleton<T>(client: Pool, tableName: string): Promise<T | null> {
  const result = await client.query<{ payload: string | null }>(`SELECT payload FROM ${tableName} WHERE id = 1 LIMIT 1`);
  const payload = result.rows[0]?.payload ?? null;
  return parseJsonValue<T>(payload, null as T | null);
}

function mapUser(row: UserRow) {
  return {
    id: row.id,
    role: row.role,
    displayName: row.display_name,
    email: row.email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    passwordSalt: row.password_salt,
    passwordHash: row.password_hash,
    passwordUpdatedAt: row.password_updated_at,
    activePlanId: row.active_plan_id
  };
}

function mapUserPlan(row: UserPlanRow): UserPlan {
  return {
    id: row.id,
    userId: row.user_id,
    templateId: row.template_id,
    nameSnapshot: row.name_snapshot,
    startDate: row.start_date,
    endDate: row.end_date,
    totalSessions: row.total_sessions,
    completedSessions: row.completed_sessions,
    status: row.status
  };
}

function mapPlanTemplateVersion(row: PlanTemplateVersionRow): PlanTemplateVersion {
  return {
    id: row.id,
    version: row.version,
    templates: parseJsonValue<PlanTemplate[]>(row.templates_json, seedPlanCatalog) ?? seedPlanCatalog,
    changedBy: row.changed_by,
    changedAt: row.changed_at,
    notes: row.notes
  };
}

function mapPlanInstanceEvent(row: PlanInstanceEventRow): PlanInstanceEvent {
  return {
    id: row.id,
    userId: row.user_id,
    planId: row.plan_id,
    templateId: row.template_id,
    templateName: row.template_name,
    type: row.type,
    createdAt: row.created_at,
    notes: row.notes
  };
}

function mapTrainingRecord(row: TrainingRecordRow): TrainingRecord {
  return {
    id: row.id,
    userId: row.user_id,
    planId: row.plan_id,
    trainingType: row.training_type,
    trainingLabel: row.training_label,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationSec: row.duration_sec,
    score: row.score,
    total: row.total,
    accuracy: row.accuracy,
    metrics: parseJsonValue<Record<string, unknown>>(row.metrics_json, {}) ?? {},
    createdAt: row.created_at
  };
}

function mapTrainingConfigVersion(row: TrainingConfigVersionRow): TrainingConfigVersion<GaborMatchConfig> {
  return {
    id: row.id,
    trainingType: row.training_type,
    version: row.version,
    status: row.status,
    config: parseJsonValue<GaborMatchConfig>(row.config_json, defaultGaborMatchConfig) ?? defaultGaborMatchConfig,
    createdBy: row.created_by,
    createdAt: row.created_at,
    activatedAt: row.activated_at,
    notes: row.notes
  };
}

export async function loadPostgresStore(): Promise<PersistentStore | null> {
  await ensureSchema();
  const db = getPool();

  const users = (await db.query<UserRow>(
    `
      SELECT id, role, display_name, email, created_at, updated_at, password_salt, password_hash, password_updated_at, active_plan_id
      FROM users
      ORDER BY created_at ASC
    `
  )).rows;
  const sessions = (await db.query<SessionRow>(
    `
      SELECT token, user_id AS "userId", created_at AS "createdAt", updated_at AS "updatedAt", expires_at AS "expiresAt"
      FROM sessions
      ORDER BY updated_at DESC
    `
  )).rows;
  const userPlans = (await db.query<UserPlanRow>(
    `
      SELECT id, user_id, template_id, name_snapshot, start_date, end_date, total_sessions, completed_sessions, status
      FROM user_plans
      ORDER BY start_date DESC
    `
  )).rows;
  const currentPlan = await readSingleton<UserPlan>(db, "current_plan_state");
  const todayTrainings = (await readSingleton<TodayTraining[]>(db, "today_trainings_state")) ?? [];
  const planCatalogRaw = await readSingleton<PlanTemplate[]>(db, "plan_catalog_state");
  const reportSummaries = (await readSingleton<ReportTemplateSummary[]>(db, "report_summaries_state")) ?? [];
  const planTemplateVersions = (await db.query<PlanTemplateVersionRow>(
    `
      SELECT id, version, templates_json, changed_by, changed_at, notes
      FROM plan_template_versions
      ORDER BY version DESC
    `
  )).rows;
  const planInstanceEvents = (await db.query<PlanInstanceEventRow>(
    `
      SELECT id, user_id, plan_id, template_id, template_name, type, created_at, notes
      FROM plan_instance_events
      ORDER BY created_at DESC
    `
  )).rows;
  const trainingRecords = (await db.query<TrainingRecordRow>(
    `
      SELECT id, user_id, plan_id, training_type, training_label, started_at, ended_at, duration_sec, score, total, accuracy, metrics_json, created_at
      FROM training_records
      ORDER BY started_at DESC
    `
  )).rows;
  const trainingConfigVersions = (await db.query<TrainingConfigVersionRow>(
    `
      SELECT id, training_type, version, status, config_json, created_by, created_at, activated_at, notes
      FROM training_config_versions
      ORDER BY version DESC
    `
  )).rows;
  const appState = await readSingleton<PersistentStore>(db, "app_state");

  const hasAnyData =
    users.length > 0 ||
    sessions.length > 0 ||
    userPlans.length > 0 ||
    planTemplateVersions.length > 0 ||
    planInstanceEvents.length > 0 ||
    trainingRecords.length > 0 ||
    trainingConfigVersions.length > 0 ||
    currentPlan !== null ||
    todayTrainings.length > 0 ||
    planCatalogRaw !== null ||
    reportSummaries.length > 0 ||
    appState !== null;

  if (!hasAnyData) return null;

  const structuredHasData =
    users.length > 0 ||
    sessions.length > 0 ||
    userPlans.length > 0 ||
    planTemplateVersions.length > 0 ||
    planInstanceEvents.length > 0 ||
    trainingRecords.length > 0 ||
    trainingConfigVersions.length > 0 ||
    currentPlan !== null ||
    todayTrainings.length > 0 ||
    planCatalogRaw !== null ||
    reportSummaries.length > 0;

  if (!structuredHasData && appState) {
    return {
      ...appState,
      planCatalog: normalizePlanCatalog(appState.planCatalog ?? seedPlanCatalog, seedPlanCatalog),
      planTemplates: buildPlanTemplateSummaries(
        normalizePlanCatalog(appState.planCatalog ?? seedPlanCatalog, seedPlanCatalog)
      )
    };
  }

  const fallback = createInitialStore();
  const planCatalog = normalizePlanCatalog(planCatalogRaw ?? fallback.planCatalog, seedPlanCatalog);

  return {
    version: Number((await db.query<{ value: string }>("SELECT value FROM meta WHERE key = 'schema_version' LIMIT 1")).rows[0]?.value ?? "2"),
    users: users.map(mapUser),
    sessions: sessions.map((session) => ({
      token: session.token,
      userId: session.userId,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      expiresAt: session.expiresAt
    })),
    userPlans: userPlans.map(mapUserPlan),
    currentPlan: currentPlan ?? fallback.currentPlan,
    todayTrainings: todayTrainings.length > 0 ? todayTrainings : fallback.todayTrainings,
    planCatalog,
    planTemplates: buildPlanTemplateSummaries(planCatalog),
    planTemplateVersions: planTemplateVersions.map(mapPlanTemplateVersion),
    planInstanceEvents: planInstanceEvents.map(mapPlanInstanceEvent),
    reportSummaries: reportSummaries.length > 0 ? reportSummaries : fallback.reportSummaries,
    currentPlanId: currentPlan?.id ?? fallback.currentPlanId,
    trainingRecords: trainingRecords.map(mapTrainingRecord),
    trainingConfigVersions: trainingConfigVersions.map(mapTrainingConfigVersion)
  };
}

export async function persistPostgresStore(store: PersistentStore): Promise<void> {
  await ensureSchema();
  const db = getPool();
  const now = new Date().toISOString();
  const normalizedCatalog = normalizePlanCatalog(store.planCatalog, seedPlanCatalog);
  const normalizedStore: PersistentStore = {
    ...store,
    planCatalog: normalizedCatalog,
    planTemplates: buildPlanTemplateSummaries(normalizedCatalog),
    currentPlanId: store.currentPlanId || store.currentPlan.id
  };

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM users");
    await client.query("DELETE FROM sessions");
    await client.query("DELETE FROM user_plans");
    await client.query("DELETE FROM plan_template_versions");
    await client.query("DELETE FROM plan_instance_events");
    await client.query("DELETE FROM training_records");
    await client.query("DELETE FROM training_config_versions");
    await client.query("DELETE FROM current_plan_state");
    await client.query("DELETE FROM today_trainings_state");
    await client.query("DELETE FROM plan_catalog_state");
    await client.query("DELETE FROM report_summaries_state");

    await client.query(
      `
        INSERT INTO meta (key, value)
        VALUES ('schema_version', $1)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
      `,
      [String(normalizedStore.version)]
    );

    const insertSingleton = async (tableName: string, payload: unknown) => {
      await client.query(
        `
          INSERT INTO ${tableName} (id, payload, updated_at)
          VALUES (1, $1, $2)
          ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = EXCLUDED.updated_at
        `,
        [JSON.stringify(payload), now]
      );
    };

    await insertSingleton("current_plan_state", normalizedStore.currentPlan);
    await insertSingleton("today_trainings_state", normalizedStore.todayTrainings);
    await insertSingleton("plan_catalog_state", normalizedStore.planCatalog);
    await insertSingleton("report_summaries_state", normalizedStore.reportSummaries);

    for (const user of normalizedStore.users) {
      await client.query(
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

    for (const session of normalizedStore.sessions) {
      await client.query(
        `
          INSERT INTO sessions (token, user_id, created_at, updated_at, expires_at)
          VALUES ($1, $2, $3, $4, $5)
        `,
        [session.token, session.userId, session.createdAt, session.updatedAt, session.expiresAt]
      );
    }

    for (const plan of normalizedStore.userPlans) {
      await client.query(
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

    for (const version of normalizedStore.planTemplateVersions) {
      await client.query(
        `
          INSERT INTO plan_template_versions (id, version, templates_json, changed_by, changed_at, notes)
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [version.id, version.version, JSON.stringify(version.templates), version.changedBy, version.changedAt, version.notes]
      );
    }

    for (const event of normalizedStore.planInstanceEvents) {
      await client.query(
        `
          INSERT INTO plan_instance_events (id, user_id, plan_id, template_id, template_name, type, created_at, notes)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [event.id, event.userId, event.planId, event.templateId, event.templateName, event.type, event.createdAt, event.notes]
      );
    }

    for (const record of normalizedStore.trainingRecords) {
      await client.query(
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

    for (const version of normalizedStore.trainingConfigVersions) {
      await client.query(
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

    await client.query(
      `
        INSERT INTO app_state (id, payload, updated_at)
        VALUES (1, $1, $2)
        ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = EXCLUDED.updated_at
      `,
      [JSON.stringify(normalizedStore), now]
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function closePostgresStore() {
  if (!pool) return;
  await pool.end();
  pool = null;
  schemaReady = false;
}
