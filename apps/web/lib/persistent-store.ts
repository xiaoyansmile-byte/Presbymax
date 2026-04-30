import { promises as fs } from "fs";
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import path from "path";
import { cookies } from "next/headers";
import Database from "better-sqlite3";
import {
  createTrainingRecord,
  defaultGaborMatchConfig,
  trainingLabels
} from "@prosbymax/core";
import type {
  AppUser,
  CreateTrainingRecordInput,
  GaborMatchConfig,
  PlanInstanceEvent,
  PlanTemplate,
  PlanTemplateSummary,
  PlanTemplateVersion,
  ReportTemplateSummary,
  TodayTraining,
  UserPlan,
  TrainingType,
  TrainingConfigVersion,
  TrainingRecord,
  TrainingRecordQuery
} from "@prosbymax/types";
import {
  currentPlan,
  currentUser as demoCurrentUser,
  demoRecords,
  planCatalog,
  planTemplates,
  reportSummaries,
  todayTrainings
} from "@/lib/mock-data";
import { loadPostgresStore, persistPostgresStore } from "@/lib/postgres-store";

const authCookieName = "prosbymax-session";
const sessionTtlMs = 1000 * 60 * 60 * 24 * 30;

export type StoredUser = AppUser & {
  passwordSalt: string;
  passwordHash: string;
  passwordUpdatedAt: string;
  activePlanId: string | null;
};

export type SessionRecord = {
  token: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
};

type SqliteSessionRow = {
  token: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  expires_at: string;
};

type SqliteUserPlanRow = {
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

type SqlitePlanTemplateVersionRow = {
  id: string;
  version: number;
  templates_json: string;
  changed_by: string | null;
  changed_at: string;
  notes: string | null;
};

type SqlitePlanInstanceEventRow = {
  id: string;
  user_id: string;
  plan_id: string | null;
  template_id: string | null;
  template_name: string | null;
  type: PlanInstanceEvent["type"];
  created_at: string;
  notes: string | null;
};

type SqliteTrainingRecordRow = {
  id: string;
  user_id: string | null;
  plan_id: string | null;
  training_type: TrainingType;
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

type SqliteTrainingConfigVersionRow = {
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

export type PersistentStore = {
  version: number;
  users: StoredUser[];
  sessions: SessionRecord[];
  userPlans: UserPlan[];
  currentPlan: UserPlan;
  todayTrainings: TodayTraining[];
  planCatalog: PlanTemplate[];
  planTemplates: PlanTemplateSummary[];
  planTemplateVersions: PlanTemplateVersion[];
  planInstanceEvents: PlanInstanceEvent[];
  reportSummaries: ReportTemplateSummary[];
  currentPlanId: string;
  trainingRecords: TrainingRecord[];
  trainingConfigVersions: TrainingConfigVersion<GaborMatchConfig>[];
};

const dataDir = path.resolve(process.env.PROSBYMAX_DATA_DIR ?? path.join(process.cwd(), "data"));
const sqlitePath = path.join(dataDir, "persistent-store.sqlite");
const usePostgres = Boolean(process.env.DATABASE_URL);

let storeCache: PersistentStore | null = null;
let writeQueue: Promise<void> = Promise.resolve();
let sqliteDb: Database.Database | null = null;
const localDateKeyFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" });

export function hashPassword(password: string, salt: string) {
  return createHash("sha256").update(`${salt}:${password}`).digest("hex");
}

export function createStoredUser(input: {
  id: string;
  role: AppUser["role"];
  displayName: string;
  email?: string | null;
  age?: number | null;
  gender?: AppUser["gender"] | null;
  surgeryType?: AppUser["surgeryType"] | null;
  surgeryAt?: string | null;
  password: string;
  createdAt: string;
  updatedAt: string;
  activePlanId?: string | null;
}): StoredUser {
  const passwordSalt = randomBytes(16).toString("hex");

  return {
    id: input.id,
    role: input.role,
    displayName: input.displayName,
    email: input.email ?? null,
    age: input.age ?? null,
    gender: input.gender ?? null,
    surgeryType: input.surgeryType ?? null,
    surgeryAt: input.surgeryAt ?? null,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    passwordSalt,
    passwordHash: hashPassword(input.password, passwordSalt),
    passwordUpdatedAt: input.updatedAt,
    activePlanId: input.activePlanId ?? null
  };
}

export function toPublicUser(user: StoredUser): AppUser {
  const {
    passwordSalt: _passwordSalt,
    passwordHash: _passwordHash,
    passwordUpdatedAt: _passwordUpdatedAt,
    activePlanId: _activePlanId,
    ...publicUser
  } = user;
  return publicUser;
}

export function verifyPassword(user: StoredUser, password: string) {
  const nextHash = hashPassword(password, user.passwordSalt);
  const stored = Buffer.from(user.passwordHash, "hex");
  const received = Buffer.from(nextHash, "hex");
  return stored.length === received.length && timingSafeEqual(stored, received);
}

function getLocalDateKey(value: string | Date) {
  return localDateKeyFormatter.format(typeof value === "string" ? new Date(value) : value);
}

function buildDemoUsers(): StoredUser[] {
  const base = "2026-04-21T00:00:00.000Z";
  return [
    createStoredUser({
      id: demoCurrentUser.id,
      role: "user",
      displayName: demoCurrentUser.name,
      email: demoCurrentUser.email,
      age: demoCurrentUser.age,
      gender: demoCurrentUser.gender,
      surgeryType: demoCurrentUser.surgeryType,
      surgeryAt: demoCurrentUser.surgeryAt,
      password: "demo1234",
      createdAt: base,
      updatedAt: base,
      activePlanId: currentPlan.id
    }),
    createStoredUser({
      id: "demo-admin",
      role: "admin",
      displayName: "管理员",
      email: "admin@prosbymax.local",
      age: null,
      gender: null,
      surgeryType: null,
      surgeryAt: null,
      password: "admin1234",
      createdAt: base,
      updatedAt: base,
      activePlanId: null
    })
  ];
}

export function buildPlanForUser(userId: string, overrides?: Partial<UserPlan>): UserPlan {
  return {
    id: overrides?.id ?? `plan-${userId}`,
    userId,
    templateId: overrides?.templateId ?? currentPlan.templateId,
    nameSnapshot: overrides?.nameSnapshot ?? currentPlan.nameSnapshot,
    startDate: overrides?.startDate ?? currentPlan.startDate,
    endDate: overrides?.endDate ?? currentPlan.endDate,
    totalSessions: overrides?.totalSessions ?? currentPlan.totalSessions,
    completedSessions: overrides?.completedSessions ?? currentPlan.completedSessions,
    status: overrides?.status ?? currentPlan.status
  };
}

export function buildPlanFromTemplate(userId: string, template: PlanTemplate, overrides?: Partial<UserPlan>): UserPlan {
  const baseStart = overrides?.startDate ?? currentPlan.startDate;
  const baseDurationDays = template.durationWeeks * 7;
  const startDate = baseStart;
  const endDate = overrides?.endDate ?? new Date(new Date(baseStart).getTime() + baseDurationDays * 24 * 60 * 60 * 1000).toISOString();
  const totalSessions = overrides?.totalSessions ?? template.durationWeeks * template.sessionsPerWeek;

  return {
    id: overrides?.id ?? `plan-${userId}-${template.id}`,
    userId,
    templateId: template.id,
    nameSnapshot: overrides?.nameSnapshot ?? template.name,
    startDate,
    endDate,
    totalSessions,
    completedSessions: overrides?.completedSessions ?? 0,
    status: overrides?.status ?? "active"
  };
}

export function buildDemoPlans(): UserPlan[] {
  const demoTemplate = (planCatalog.find((template) => template.id === currentPlan.templateId) ?? planCatalog[0]) as PlanTemplate;
  const adminTemplate = (planCatalog[1] ?? demoTemplate) as PlanTemplate;

  return [
    buildPlanFromTemplate(demoCurrentUser.id, demoTemplate, {
      id: currentPlan.id,
      userId: demoCurrentUser.id,
      completedSessions: currentPlan.completedSessions,
      status: currentPlan.status,
      startDate: currentPlan.startDate,
      endDate: currentPlan.endDate,
      totalSessions: currentPlan.totalSessions,
      nameSnapshot: currentPlan.nameSnapshot
    }),
    buildPlanFromTemplate("demo-admin", adminTemplate, {
      id: "plan-demo-admin",
      userId: "demo-admin",
      completedSessions: 0,
      status: "not_started"
    })
  ];
}

export function buildPlanTemplateSummaries(catalog: PlanTemplate[]): PlanTemplateSummary[] {
  return catalog.map((template) => ({
    id: template.id,
    name: template.name,
    durationWeeks: template.durationWeeks,
    sessionsPerWeek: template.sessionsPerWeek,
    sessionDurationText: template.sessionDurationText,
    description: template.description,
    status: template.status,
    focus: template.trainings[0] ? trainingLabels[template.trainings[0].id] : template.name
  }));
}

export function buildPlanTemplateVersion(
  catalog: PlanTemplate[],
  version: number,
  options?: { changedBy?: string | null; notes?: string | null; changedAt?: string }
): PlanTemplateVersion {
  return {
    id: `plan-template-v${version}`,
    version,
    templates: catalog,
    changedBy: options?.changedBy ?? null,
    changedAt: options?.changedAt ?? new Date().toISOString(),
    notes: options?.notes ?? null
  };
}

export function createPlanEvent(input: {
  userId: string;
  planId: string | null;
  templateId: string | null;
  templateName: string | null;
  type: PlanInstanceEvent["type"];
  notes?: string | null;
}): PlanInstanceEvent {
  return {
    id: `plan-event-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    userId: input.userId,
    planId: input.planId,
    templateId: input.templateId,
    templateName: input.templateName,
    type: input.type,
    createdAt: new Date().toISOString(),
    notes: input.notes ?? null
  };
}

export function normalizePlanCatalog(parsedCatalog: unknown, fallback: PlanTemplate[]): PlanTemplate[] {
  if (!Array.isArray(parsedCatalog) || parsedCatalog.length === 0) return fallback;

  const validTrainingTypes = new Set(Object.keys(trainingLabels) as TrainingType[]);
  const normalized = parsedCatalog
    .map((entry, index) => {
      const fallbackTemplate = fallback[index] ?? fallback[0];
      if (!entry || typeof entry !== "object") return fallbackTemplate ?? null;

      const template = entry as Partial<PlanTemplate> & { trainings?: PlanTemplate["trainings"] };
      const id = typeof template.id === "string" && template.id.trim()
        ? template.id.trim()
        : fallbackTemplate?.id ?? `plan-template-${index + 1}`;
      const name = typeof template.name === "string" && template.name.trim()
        ? template.name.trim()
        : fallbackTemplate?.name ?? id;
      const durationWeeks = Number.isFinite(template.durationWeeks) ? Number(template.durationWeeks) : fallbackTemplate?.durationWeeks ?? 4;
      const sessionsPerWeek = Number.isFinite(template.sessionsPerWeek) ? Number(template.sessionsPerWeek) : fallbackTemplate?.sessionsPerWeek ?? 10;
      const sessionDurationText = typeof template.sessionDurationText === "string" && template.sessionDurationText.trim()
        ? template.sessionDurationText.trim()
        : fallbackTemplate?.sessionDurationText ?? "每日 8-10 分钟";
      const description = typeof template.description === "string" && template.description.trim()
        ? template.description.trim()
        : fallbackTemplate?.description ?? "";
      const status = template.status === "archived" ? "archived" : "active";
      const trainings = Array.isArray(template.trainings)
        ? template.trainings
            .filter((training) => training && typeof training === "object")
            .map((training) => {
              const item = training as Partial<PlanTemplate["trainings"][number]> & { id?: string };
              const trainingId = typeof item.id === "string" && validTrainingTypes.has(item.id as TrainingType)
                ? (item.id as TrainingType)
                : (fallbackTemplate?.trainings[0]?.id ?? "gabor-match");
              const priority =
                item.priority === "low" || item.priority === "medium" || item.priority === "high"
                  ? item.priority
                  : (fallbackTemplate?.trainings[0]?.priority ?? "medium");
              const frequency = typeof item.frequency === "string" && item.frequency.trim()
                ? item.frequency.trim()
                : fallbackTemplate?.trainings[0]?.frequency ?? "每周 1 次";
              return {
                id: trainingId,
                priority,
                frequency
              };
            })
        : fallbackTemplate?.trainings ?? [];

      return {
        id,
        name,
        durationWeeks,
        sessionsPerWeek,
        sessionDurationText,
        description,
        status,
        trainings
      } satisfies PlanTemplate;
    })
    .filter((template): template is PlanTemplate => Boolean(template));

  return normalized.length > 0 ? normalized : fallback;
}

export function createInitialStore(): PersistentStore {
  const base = "2026-04-21T00:00:00.000Z";
  const initialCatalog = planCatalog.map((template) => ({ ...template }));
  return {
    version: 1,
    users: buildDemoUsers(),
    sessions: [],
    userPlans: buildDemoPlans(),
    currentPlan,
    todayTrainings,
    planCatalog: initialCatalog,
    planTemplates: buildPlanTemplateSummaries(initialCatalog),
    planTemplateVersions: [buildPlanTemplateVersion(initialCatalog, 1, { changedBy: demoCurrentUser.id, notes: "Initial product workspace seed", changedAt: base })],
    planInstanceEvents: [
      createPlanEvent({
        userId: demoCurrentUser.id,
        planId: currentPlan.id,
        templateId: currentPlan.templateId,
        templateName: currentPlan.nameSnapshot,
        type: "joined",
        notes: "Seeded demo plan"
      })
    ],
    reportSummaries,
    currentPlanId: currentPlan.id,
    trainingRecords: [...demoRecords],
    trainingConfigVersions: [
      {
        id: "gabor-match-v1",
        trainingType: "gabor-match",
        version: 1,
        status: "active",
        config: defaultGaborMatchConfig,
        createdBy: demoCurrentUser.id,
        createdAt: base,
        activatedAt: base,
        notes: "Initial product workspace seed"
      }
    ]
  };
}

async function ensureStoreDir() {
  await fs.mkdir(dataDir, { recursive: true });
}

export function parseJsonValue<T>(value: string | null | undefined, fallback: T | null): T | null {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function openSqliteDb() {
  if (sqliteDb) return sqliteDb;
  sqliteDb = new Database(sqlitePath);
  sqliteDb.pragma("journal_mode = WAL");
  sqliteDb.pragma("foreign_keys = ON");
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS current_plan_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS today_trainings_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS plan_catalog_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS report_summaries_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      display_name TEXT NOT NULL,
      email TEXT,
      age INTEGER,
      gender TEXT,
      surgery_type TEXT,
      surgery_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      password_updated_at TEXT NOT NULL,
      active_plan_id TEXT
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS user_plans (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      template_id TEXT NOT NULL,
      name_snapshot TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      total_sessions INTEGER NOT NULL,
      completed_sessions INTEGER NOT NULL,
      status TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS plan_template_versions (
      id TEXT PRIMARY KEY,
      version INTEGER NOT NULL,
      templates_json TEXT NOT NULL,
      changed_by TEXT,
      changed_at TEXT NOT NULL,
      notes TEXT
    );
    CREATE TABLE IF NOT EXISTS plan_instance_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      plan_id TEXT,
      template_id TEXT,
      template_name TEXT,
      type TEXT NOT NULL,
      created_at TEXT NOT NULL,
      notes TEXT
    );
    CREATE TABLE IF NOT EXISTS training_records (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      plan_id TEXT,
      training_type TEXT NOT NULL,
      training_label TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT NOT NULL,
      duration_sec INTEGER NOT NULL,
      score INTEGER NOT NULL,
      total INTEGER,
      accuracy REAL,
      metrics_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS training_config_versions (
      id TEXT PRIMARY KEY,
      training_type TEXT NOT NULL,
      version INTEGER NOT NULL,
      status TEXT NOT NULL,
      config_json TEXT NOT NULL,
      created_by TEXT,
      created_at TEXT NOT NULL,
      activated_at TEXT,
      notes TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_plans_user_id ON user_plans(user_id);
    CREATE INDEX IF NOT EXISTS idx_plan_instance_events_user_id ON plan_instance_events(user_id);
    CREATE INDEX IF NOT EXISTS idx_training_records_user_started_at ON training_records(user_id, started_at DESC);
    CREATE INDEX IF NOT EXISTS idx_training_config_versions_type_status ON training_config_versions(training_type, status);
  `);
  ensureUserProfileColumns(sqliteDb);
  return sqliteDb;
}

export function readSingletonJson<T>(db: Database.Database, tableName: string): T | null {
  const row = db.prepare(`SELECT payload FROM ${tableName} WHERE id = 1`).get() as { payload?: string } | undefined;
  return row?.payload ? parseJsonValue<T>(row.payload, null as T | null) : null;
}

export function writeSingletonJson(db: Database.Database, tableName: string, value: unknown) {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO ${tableName} (id, payload, updated_at)
    VALUES (1, ?, ?)
    ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at
  `).run(JSON.stringify(value), now);
}

function ensureUserProfileColumns(db: Database.Database) {
  const existingColumns = new Set(
    (db.prepare(`PRAGMA table_info(users)`).all() as Array<{ name: string }>).map((column) => column.name)
  );
  const migrations = [
    { name: "age", sql: "ALTER TABLE users ADD COLUMN age INTEGER" },
    { name: "gender", sql: "ALTER TABLE users ADD COLUMN gender TEXT" },
    { name: "surgery_type", sql: "ALTER TABLE users ADD COLUMN surgery_type TEXT" },
    { name: "surgery_at", sql: "ALTER TABLE users ADD COLUMN surgery_at TEXT" }
  ];

  for (const migration of migrations) {
    if (!existingColumns.has(migration.name)) {
      db.exec(migration.sql);
    }
  }
}

export function readStoreFromTables(): PersistentStore | null {
  const db = openSqliteDb();
  const fallback = createInitialStore();
  ensureUserProfileColumns(db);

  const users = db.prepare(`
    SELECT id, role, display_name, email, age, gender, surgery_type, surgery_at, created_at, updated_at, password_salt, password_hash, password_updated_at, active_plan_id
    FROM users
    ORDER BY created_at ASC
  `).all() as Array<{
    id: string;
    role: AppUser["role"];
    display_name: string;
    email: string | null;
    age: number | null;
    gender: AppUser["gender"] | null;
    surgery_type: AppUser["surgeryType"] | null;
    surgery_at: string | null;
    created_at: string;
    updated_at: string;
    password_salt: string;
    password_hash: string;
    password_updated_at: string;
    active_plan_id: string | null;
  }>;

  const sessions = db.prepare(`
    SELECT token, user_id, created_at, updated_at, expires_at
    FROM sessions
    ORDER BY updated_at DESC
  `).all() as SqliteSessionRow[];

  const userPlans = db.prepare(`
    SELECT id, user_id, template_id, name_snapshot, start_date, end_date, total_sessions, completed_sessions, status
    FROM user_plans
    ORDER BY start_date DESC
  `).all() as SqliteUserPlanRow[];

  const currentPlan = readSingletonJson<UserPlan>(db, "current_plan_state") ?? fallback.currentPlan;
  const todayTrainings = readSingletonJson<TodayTraining[]>(db, "today_trainings_state") ?? fallback.todayTrainings;
  const planCatalogRaw = readSingletonJson<PlanTemplate[]>(db, "plan_catalog_state");
  const planCatalogNormalized = normalizePlanCatalog(planCatalogRaw, fallback.planCatalog);
  const reportSummaries = readSingletonJson<ReportTemplateSummary[]>(db, "report_summaries_state") ?? fallback.reportSummaries;

  const planTemplateVersions = db.prepare(`
    SELECT id, version, templates_json, changed_by, changed_at, notes
    FROM plan_template_versions
    ORDER BY version DESC
  `).all() as SqlitePlanTemplateVersionRow[];

  const planInstanceEvents = db.prepare(`
    SELECT id, user_id, plan_id, template_id, template_name, type, created_at, notes
    FROM plan_instance_events
    ORDER BY created_at DESC
  `).all() as SqlitePlanInstanceEventRow[];

  const trainingRecords = db.prepare(`
    SELECT id, user_id, plan_id, training_type, training_label, started_at, ended_at, duration_sec, score, total, accuracy, metrics_json, created_at
    FROM training_records
    ORDER BY started_at DESC
  `).all() as SqliteTrainingRecordRow[];

  const trainingConfigVersions = db.prepare(`
    SELECT id, training_type, version, status, config_json, created_by, created_at, activated_at, notes
    FROM training_config_versions
    ORDER BY version DESC
  `).all() as SqliteTrainingConfigVersionRow[];

  const hasAnyData =
    users.length > 0 ||
    sessions.length > 0 ||
    userPlans.length > 0 ||
    planTemplateVersions.length > 0 ||
    planInstanceEvents.length > 0 ||
    trainingRecords.length > 0 ||
    trainingConfigVersions.length > 0 ||
    readSingletonJson<UserPlan>(db, "current_plan_state") !== null ||
    readSingletonJson<TodayTraining[]>(db, "today_trainings_state") !== null ||
    planCatalogRaw !== null ||
    reportSummaries !== null;

  if (!hasAnyData) return null;

  return {
    version: Number((db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get() as { value?: string } | undefined)?.value ?? "3"),
    users: users.map((user) => ({
      id: user.id,
      role: user.role,
      displayName: user.display_name,
      email: user.email,
      age: user.age,
      gender: user.gender,
      surgeryType: user.surgery_type,
      surgeryAt: user.surgery_at,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      passwordSalt: user.password_salt,
      passwordHash: user.password_hash,
      passwordUpdatedAt: user.password_updated_at,
      activePlanId: user.active_plan_id
    })),
    sessions: sessions.map((session) => ({
      token: session.token,
      userId: session.user_id,
      createdAt: session.created_at,
      updatedAt: session.updated_at,
      expiresAt: session.expires_at
    })),
    userPlans: userPlans.map((plan) => ({
      id: plan.id,
      userId: plan.user_id,
      templateId: plan.template_id,
      nameSnapshot: plan.name_snapshot,
      startDate: plan.start_date,
      endDate: plan.end_date,
      totalSessions: plan.total_sessions,
      completedSessions: plan.completed_sessions,
      status: plan.status
    })),
    currentPlan,
    todayTrainings,
    planCatalog: planCatalogNormalized,
    planTemplates: buildPlanTemplateSummaries(planCatalogNormalized),
    planTemplateVersions: planTemplateVersions.map((version) => ({
      id: version.id,
      version: version.version,
      templates: (parseJsonValue<PlanTemplate[]>(version.templates_json, fallback.planCatalog) ?? fallback.planCatalog),
      changedBy: version.changed_by,
      changedAt: version.changed_at,
      notes: version.notes
    })),
    planInstanceEvents: planInstanceEvents.map((event) => ({
      id: event.id,
      userId: event.user_id,
      planId: event.plan_id ?? null,
      templateId: event.template_id ?? null,
      templateName: event.template_name ?? null,
      type: event.type,
      createdAt: event.created_at,
      notes: event.notes ?? null
    })),
    reportSummaries,
    currentPlanId: currentPlan.id,
    trainingRecords: trainingRecords.map((record) => ({
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
      metrics: parseJsonValue<Record<string, unknown>>(record.metrics_json, {}) ?? {},
      createdAt: record.created_at
    })),
    trainingConfigVersions: trainingConfigVersions.map((version) => ({
      id: version.id,
      trainingType: version.training_type,
      version: version.version,
      status: version.status,
      config: parseJsonValue<GaborMatchConfig>(version.config_json, defaultGaborMatchConfig) ?? defaultGaborMatchConfig,
      createdBy: version.created_by,
      createdAt: version.created_at,
      activatedAt: version.activated_at,
      notes: version.notes
    }))
  };
}

export async function persistStore(store: PersistentStore) {
  const normalizedCatalog = normalizePlanCatalog(store.planCatalog, planCatalog);
  const normalizedStore: PersistentStore = {
    ...store,
    planCatalog: normalizedCatalog,
    planTemplates: buildPlanTemplateSummaries(normalizedCatalog),
    currentPlanId: store.currentPlanId || store.currentPlan.id
  };

  if (usePostgres) {
    await persistPostgresStore(normalizedStore);
    storeCache = normalizedStore;
    return;
  }

  await ensureStoreDir();
  const db = openSqliteDb();

  const tx = db.transaction((nextStore: PersistentStore) => {
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
      DELETE FROM meta WHERE key = 'schema_version';
    `);

    db.prepare(`
      INSERT INTO meta (key, value)
      VALUES ('schema_version', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(String(nextStore.version));

    writeSingletonJson(db, "current_plan_state", nextStore.currentPlan);
    writeSingletonJson(db, "today_trainings_state", nextStore.todayTrainings);
    writeSingletonJson(db, "plan_catalog_state", nextStore.planCatalog);
    writeSingletonJson(db, "report_summaries_state", nextStore.reportSummaries);

    const insertUser = db.prepare(`
      INSERT INTO users (
        id, role, display_name, email, age, gender, surgery_type, surgery_at, created_at, updated_at, password_salt, password_hash, password_updated_at, active_plan_id
      ) VALUES (
        @id, @role, @display_name, @email, @age, @gender, @surgery_type, @surgery_at, @created_at, @updated_at, @password_salt, @password_hash, @password_updated_at, @active_plan_id
      )
    `);
    for (const user of nextStore.users) {
      insertUser.run({
        id: user.id,
        role: user.role,
        display_name: user.displayName,
        email: user.email,
        age: user.age ?? null,
        gender: user.gender ?? null,
        surgery_type: user.surgeryType ?? null,
        surgery_at: user.surgeryAt ?? null,
        created_at: user.createdAt,
        updated_at: user.updatedAt,
        password_salt: user.passwordSalt,
        password_hash: user.passwordHash,
        password_updated_at: user.passwordUpdatedAt,
        active_plan_id: user.activePlanId
      });
    }

    const insertSession = db.prepare(`
      INSERT INTO sessions (token, user_id, created_at, updated_at, expires_at)
      VALUES (@token, @userId, @createdAt, @updatedAt, @expiresAt)
    `);
    for (const session of nextStore.sessions) {
      insertSession.run({
        token: session.token,
        userId: session.userId,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        expiresAt: session.expiresAt
      });
    }

    const insertPlan = db.prepare(`
      INSERT INTO user_plans (id, user_id, template_id, name_snapshot, start_date, end_date, total_sessions, completed_sessions, status)
      VALUES (@id, @userId, @templateId, @nameSnapshot, @startDate, @endDate, @totalSessions, @completedSessions, @status)
    `);
    for (const plan of nextStore.userPlans) {
      insertPlan.run({
        id: plan.id,
        userId: plan.userId,
        templateId: plan.templateId,
        nameSnapshot: plan.nameSnapshot,
        startDate: plan.startDate,
        endDate: plan.endDate,
        totalSessions: plan.totalSessions,
        completedSessions: plan.completedSessions,
        status: plan.status
      });
    }

    const insertTemplateVersion = db.prepare(`
      INSERT INTO plan_template_versions (id, version, templates_json, changed_by, changed_at, notes)
      VALUES (@id, @version, @templates_json, @changedBy, @changedAt, @notes)
    `);
    for (const version of nextStore.planTemplateVersions) {
      insertTemplateVersion.run({
        id: version.id,
        version: version.version,
        templates_json: JSON.stringify(version.templates),
        changedBy: version.changedBy,
        changedAt: version.changedAt,
        notes: version.notes
      });
    }

    const insertEvent = db.prepare(`
      INSERT INTO plan_instance_events (id, user_id, plan_id, template_id, template_name, type, created_at, notes)
      VALUES (@id, @userId, @planId, @templateId, @templateName, @type, @createdAt, @notes)
    `);
    for (const event of nextStore.planInstanceEvents) {
      insertEvent.run({
        id: event.id,
        userId: event.userId,
        planId: event.planId,
        templateId: event.templateId,
        templateName: event.templateName,
        type: event.type,
        createdAt: event.createdAt,
        notes: event.notes
      });
    }

    const insertRecord = db.prepare(`
      INSERT INTO training_records (
        id, user_id, plan_id, training_type, training_label, started_at, ended_at, duration_sec, score, total, accuracy, metrics_json, created_at
      ) VALUES (
        @id, @userId, @planId, @trainingType, @trainingLabel, @startedAt, @endedAt, @durationSec, @score, @total, @accuracy, @metrics_json, @createdAt
      )
    `);
    for (const record of nextStore.trainingRecords) {
      insertRecord.run({
        id: record.id,
        userId: record.userId,
        planId: record.planId,
        trainingType: record.trainingType,
        trainingLabel: record.trainingLabel,
        startedAt: record.startedAt,
        endedAt: record.endedAt,
        durationSec: record.durationSec,
        score: record.score,
        total: record.total,
        accuracy: record.accuracy,
        metrics_json: JSON.stringify(record.metrics ?? {}),
        createdAt: record.createdAt
      });
    }

    const insertConfigVersion = db.prepare(`
      INSERT INTO training_config_versions (
        id, training_type, version, status, config_json, created_by, created_at, activated_at, notes
      ) VALUES (
        @id, @trainingType, @version, @status, @config_json, @createdBy, @createdAt, @activatedAt, @notes
      )
    `);
    for (const version of nextStore.trainingConfigVersions) {
      insertConfigVersion.run({
        id: version.id,
        trainingType: version.trainingType,
        version: version.version,
        status: version.status,
        config_json: JSON.stringify(version.config),
        createdBy: version.createdBy,
        createdAt: version.createdAt,
        activatedAt: version.activatedAt,
        notes: version.notes
      });
    }
  });

  tx(normalizedStore);
  storeCache = normalizedStore;
}

export async function loadStore(): Promise<PersistentStore> {
  if (storeCache) return storeCache;

  if (usePostgres) {
    const fromPostgres = await loadPostgresStore();
    if (fromPostgres) {
      const normalized = {
        ...fromPostgres,
        planCatalog: normalizePlanCatalog(fromPostgres.planCatalog, planCatalog),
        planTemplates: buildPlanTemplateSummaries(normalizePlanCatalog(fromPostgres.planCatalog, planCatalog))
      };
      storeCache = normalized;
      return normalized;
    }

    const initial = createInitialStore();
    await persistStore(initial);
    return initial;
  }

  const fromSqlite = readStoreFromTables();
  if (fromSqlite) {
    const normalized = {
      ...fromSqlite,
      planCatalog: normalizePlanCatalog(fromSqlite.planCatalog, planCatalog),
      planTemplates: buildPlanTemplateSummaries(normalizePlanCatalog(fromSqlite.planCatalog, planCatalog))
    };
    storeCache = normalized;
    return normalized;
  }

  const initial = createInitialStore();
  await persistStore(initial);
  return initial;
}

export async function updateStore(mutator: (store: PersistentStore) => PersistentStore | Promise<PersistentStore>) {
  writeQueue = writeQueue.then(async () => {
    const current = await loadStore();
    const next = await mutator(current);
    await persistStore(next);
  });

  await writeQueue;
  return loadStore();
}

export async function getCurrentSessionToken(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get(authCookieName)?.value ?? null;
  } catch {
    return null;
  }
}

export function findSessionUser(store: PersistentStore, token: string | null): AppUser | null {
  if (!token) return null;
  const session = store.sessions.find((entry) => entry.token === token);
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() <= Date.now()) return null;

  const user = store.users.find((entry) => entry.id === session.userId);
  return user ? toPublicUser(user) : null;
}

export function findPlanForUser(store: PersistentStore, userId: string | null | undefined): UserPlan | null {
  if (!userId) return store.currentPlan;

  const user = store.users.find((entry) => entry.id === userId);
  const activePlanId = user?.activePlanId ?? null;
  if (user && activePlanId === null) return null;
  if (activePlanId) {
    const activePlan = store.userPlans.find((entry) => entry.id === activePlanId && entry.userId === userId);
    if (activePlan && activePlan.status !== "cancelled") {
      return derivePlanProgressFromRecords(store, activePlan);
    }
  }

  const plan = store.userPlans
    .filter((entry) => entry.userId === userId && entry.status === "active")
    .sort((a, b) => b.startDate.localeCompare(a.startDate))[0] ?? null;
  return plan ? derivePlanProgressFromRecords(store, plan) : null;
}

function countDistinctDailyCompletions(store: PersistentStore, plan: UserPlan) {
  const seen = new Set<string>();

  for (const record of store.trainingRecords) {
    if (record.userId !== plan.userId) continue;
    if (record.planId !== plan.id) continue;
    seen.add(`${record.trainingType}|${getLocalDateKey(record.startedAt)}`);
  }

  return seen.size;
}

export function derivePlanProgressFromRecords(store: PersistentStore, plan: UserPlan): UserPlan {
  if (plan.status === "cancelled" || plan.status === "expired") {
    return plan;
  }

  const completedSessions = Math.min(countDistinctDailyCompletions(store, plan), plan.totalSessions);

  if (completedSessions >= plan.totalSessions) {
    return {
      ...plan,
      completedSessions,
      status: "completed"
    };
  }

  if (plan.status === "not_started" && completedSessions === 0) {
    return {
      ...plan,
      completedSessions
    };
  }

  return {
    ...plan,
    completedSessions,
    status: "active"
  };
}

export function findPlanTemplateById(store: PersistentStore, templateId: string | null | undefined): PlanTemplate | null {
  if (!templateId) return null;
  return store.planCatalog.find((template) => template.id === templateId) ?? null;
}

export function findActivePlanTemplateById(store: PersistentStore, templateId: string | null | undefined): PlanTemplate | null {
  const template = findPlanTemplateById(store, templateId);
  return template?.status === "active" ? template : null;
}

export function createPlanFromTemplate(store: PersistentStore, userId: string, templateId: string): UserPlan {
  const template = (findPlanTemplateById(store, templateId) ?? store.planCatalog[0] ?? planCatalog[0]) as PlanTemplate;
  const startDate = new Date().toISOString();
  const endDate = new Date(Date.now() + template.durationWeeks * 7 * 24 * 60 * 60 * 1000).toISOString();

  return buildPlanFromTemplate(userId, template, {
    id: `plan-${userId}-${template.id}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    startDate,
    endDate,
    totalSessions: template.durationWeeks * template.sessionsPerWeek,
    completedSessions: 0,
    status: "active"
  });
}

async function updateSessionStoreToken(userId: string, token: string | null) {
  await updateStore((store) => {
    const now = new Date().toISOString();
    const nextSessions = token
      ? [
          ...store.sessions.filter((entry) => entry.token !== token),
          {
            token,
            userId,
            createdAt: now,
            updatedAt: now,
            expiresAt: new Date(Date.now() + sessionTtlMs).toISOString()
          }
        ]
      : store.sessions;

    return {
      ...store,
      sessions: nextSessions
    };
  });
}

export async function getCurrentUser(): Promise<AppUser | null> {
  const store = await loadStore();
  const token = await getCurrentSessionToken();
  return findSessionUser(store, token);
}

export async function updateCurrentUser(
  patch: Partial<Pick<AppUser, "displayName" | "email">>
): Promise<AppUser | null> {
  const token = await getCurrentSessionToken();
  if (!token) return null;

  const now = new Date().toISOString();
  const updatedStore = await updateStore((store) => {
    const session = store.sessions.find((entry) => entry.token === token);
    if (!session) return store;

    return {
      ...store,
      users: store.users.map((user) =>
        user.id === session.userId
          ? {
              ...user,
              ...patch,
              updatedAt: now
            }
          : user
      )
    };
  });

  return findSessionUser(updatedStore, token);
}

export async function createUserAccount(input: {
  displayName: string;
  email: string;
  password: string;
  role?: AppUser["role"];
  templateId?: string;
}): Promise<AppUser | null> {
  const email = input.email.trim().toLowerCase();
  const now = new Date().toISOString();
  let created: StoredUser | null = null;

  await updateStore((store) => {
    if (store.users.some((user) => user.email?.toLowerCase() === email)) {
      return store;
    }

    const requestedTemplate = findActivePlanTemplateById(store, input.templateId);
    const template =
      requestedTemplate ??
      store.planCatalog.find((entry) => entry.status === "active") ??
      planCatalog.find((entry) => entry.status === "active") ??
      null;
    if (!template) {
      return store;
    }
    const plan = createPlanFromTemplate(store, `user-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`, template.id);

    created = createStoredUser({
      id: plan.userId,
      role: input.role ?? "user",
      displayName: input.displayName.trim(),
      email,
      password: input.password,
      createdAt: now,
      updatedAt: now,
      activePlanId: plan.id
    });

    const createdUser = created;
    if (!createdUser) return store;

    return {
      ...store,
      users: [...store.users, createdUser],
      userPlans: [...store.userPlans.map((entry) => (entry.userId === createdUser.id && entry.status === "active" ? { ...entry, status: "cancelled" as const } : entry)), plan],
      planInstanceEvents: [
        createPlanEvent({
          userId: createdUser.id,
          planId: plan.id,
          templateId: template.id,
          templateName: template.name,
          type: "joined",
          notes: "Registered account selected plan"
        }),
        ...store.planInstanceEvents
      ]
    };
  });

  return created ? toPublicUser(created) : null;
}

export async function findUserByEmail(email: string): Promise<StoredUser | null> {
  const store = await loadStore();
  const normalized = email.trim().toLowerCase();
  return store.users.find((user) => user.email?.toLowerCase() === normalized) ?? null;
}

export async function authenticateUser(email: string, password: string): Promise<AppUser | null> {
  const user = await findUserByEmail(email);
  if (!user) return null;
  return verifyPassword(user, password) ? toPublicUser(user) : null;
}

export async function createSessionForUser(userId: string): Promise<string> {
  const token = randomBytes(24).toString("hex");
  await updateSessionStoreToken(userId, token);
  return token;
}

export async function deleteSession(token: string): Promise<void> {
  await updateStore((store) => ({
    ...store,
    sessions: store.sessions.filter((session) => session.token !== token)
  }));
}

export async function getCurrentPlanId(): Promise<string> {
  const currentUser = await getCurrentUser();
  const store = await loadStore();
  return findPlanForUser(store, currentUser?.id)?.id ?? "";
}

export async function getCurrentPlan(): Promise<UserPlan | null> {
  const currentUser = await getCurrentUser();
  const store = await loadStore();
  return findPlanForUser(store, currentUser?.id);
}

export async function getCurrentPlanForUser(userId?: string | null): Promise<UserPlan | null> {
  const store = await loadStore();
  return findPlanForUser(store, userId ?? null);
}

export async function listUserPlans(userId?: string | null): Promise<UserPlan[]> {
  const store = await loadStore();
  if (!userId) return [];
  return store.userPlans
    .filter((plan) => plan.userId === userId)
    .map((plan) => derivePlanProgressFromRecords(store, plan))
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
}

export async function listPlanCatalog(): Promise<PlanTemplate[]> {
  const store = await loadStore();
  return store.planCatalog;
}

export async function enrollUserInPlan(userId: string, templateId: string): Promise<UserPlan | null> {
  const store = await loadStore();
  const user = store.users.find((entry) => entry.id === userId);
  const template = findActivePlanTemplateById(store, templateId);
  if (!user || !template) return null;

  const nextPlan = createPlanFromTemplate(store, userId, templateId);

  await updateStore((current) => ({
    ...current,
    users: current.users.map((entry) => (entry.id === userId ? { ...entry, activePlanId: nextPlan.id } : entry)),
    userPlans: [
      ...current.userPlans.map((entry) => (entry.userId === userId && entry.status === "active" ? { ...entry, status: "cancelled" as const } : entry)),
      nextPlan
    ],
    planInstanceEvents: [
      createPlanEvent({
        userId,
        planId: nextPlan.id,
        templateId: nextPlan.templateId,
        templateName: nextPlan.nameSnapshot,
        type: "joined",
        notes: "Added from account page"
      }),
      ...current.planInstanceEvents
    ]
  }));

  return nextPlan;
}

export async function activateUserPlan(userId: string, planId: string): Promise<UserPlan | null> {
  const store = await loadStore();
  const target = store.userPlans.find((plan) => plan.id === planId && plan.userId === userId);
  if (!target) return null;

  await updateStore((current) => ({
    ...current,
    users: current.users.map((entry) => (entry.id === userId ? { ...entry, activePlanId: planId } : entry)),
    userPlans: current.userPlans.map((entry) => {
      if (entry.userId !== userId) return entry;
      if (entry.id === planId) return { ...entry, status: "active" as const };
      return entry.status === "active" ? { ...entry, status: "cancelled" as const } : entry;
    }),
    planInstanceEvents: [
      createPlanEvent({
        userId,
        planId,
        templateId: target.templateId,
        templateName: target.nameSnapshot,
        type: "activated",
        notes: "Switched active plan from account page"
      }),
      ...current.planInstanceEvents
    ]
  }));

  return { ...target, status: "active" };
}

export async function leaveCurrentPlan(userId: string): Promise<UserPlan | null> {
  const store = await loadStore();
  const user = store.users.find((entry) => entry.id === userId);
  if (!user?.activePlanId) return null;

  const activePlan = store.userPlans.find((plan) => plan.id === user.activePlanId && plan.userId === userId);
  if (!activePlan) return null;

  await updateStore((current) => ({
    ...current,
    users: current.users.map((entry) => (entry.id === userId ? { ...entry, activePlanId: null } : entry)),
    userPlans: current.userPlans.map((entry) =>
      entry.id === activePlan.id ? { ...entry, status: "cancelled" as const } : entry
    ),
    planInstanceEvents: [
      createPlanEvent({
        userId,
        planId: activePlan.id,
        templateId: activePlan.templateId,
        templateName: activePlan.nameSnapshot,
        type: "left",
        notes: "Left plan from account page"
      }),
      ...current.planInstanceEvents
    ]
  }));

  return { ...activePlan, status: "cancelled" };
}

export async function listUsers(): Promise<AppUser[]> {
  const store = await loadStore();
  return store.users.map(toPublicUser);
}

export async function listTodayTrainings(): Promise<TodayTraining[]> {
  const store = await loadStore();
  return store.todayTrainings;
}

export async function listPlanTemplates(): Promise<PlanTemplateSummary[]> {
  const store = await loadStore();
  return store.planTemplates;
}

export async function listPlanInstanceEvents(userId?: string | null): Promise<PlanInstanceEvent[]> {
  const store = await loadStore();
  const events = store.planInstanceEvents
    .filter((event) => (userId ? event.userId === userId : true))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return events;
}

export async function savePlanCatalog(
  nextCatalog: PlanTemplate[],
  options?: { changedBy?: string | null; notes?: string | null }
): Promise<PlanTemplate[]> {
  const normalizedCatalog = normalizePlanCatalog(nextCatalog, planCatalog);

  await updateStore((current) => ({
    ...current,
    planCatalog: normalizedCatalog,
    planTemplates: buildPlanTemplateSummaries(normalizedCatalog),
    planTemplateVersions: [
      buildPlanTemplateVersion(normalizedCatalog, current.planTemplateVersions.length + 1, options),
      ...current.planTemplateVersions
    ]
  }));

  return normalizedCatalog;
}

export async function listPlanTemplateVersions(): Promise<PlanTemplateVersion[]> {
  const store = await loadStore();
  return store.planTemplateVersions;
}

export async function getSessionUserByToken(token: string): Promise<AppUser | null> {
  const store = await loadStore();
  return findSessionUser(store, token);
}

export async function listTrainingRecords(query: TrainingRecordQuery = {}): Promise<TrainingRecord[]> {
  const store = await loadStore();
  const limit = query.limit && query.limit > 0 ? query.limit : store.trainingRecords.length;

  return store.trainingRecords
    .filter((record) => (query.userId ? record.userId === query.userId : true))
    .filter((record) => (query.planId ? record.planId === query.planId : true))
    .filter((record) => (query.trainingType ? record.trainingType === query.trainingType : true))
    .filter((record) => (query.startedFrom ? record.startedAt >= query.startedFrom : true))
    .filter((record) => (query.startedTo ? record.startedAt <= query.startedTo : true))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, limit);
}

export async function createStoredTrainingRecord(input: CreateTrainingRecordInput): Promise<TrainingRecord> {
  const record = createTrainingRecord(input);

  await updateStore((store) => applyTrainingRecordToStore(store, record));

  return record;
}

export function applyTrainingRecordToStore(store: PersistentStore, record: TrainingRecord): PersistentStore {
  const alreadyStored = store.trainingRecords.some((entry) => entry.id === record.id);
  const nextTrainingRecords = [record, ...store.trainingRecords.filter((entry) => entry.id !== record.id)];

  if (alreadyStored) {
    return {
      ...store,
      trainingRecords: nextTrainingRecords
    };
  }

  const matchedPlanId = record.planId ?? (record.userId ? findPlanForUser(store, record.userId)?.id ?? null : null);
  const matchedTodayTraining = store.todayTrainings.find((item) => item.id === record.trainingType) ?? null;
  const recordDayKey = getLocalDateKey(record.startedAt);
  const hasSameDayRecordForTraining = matchedPlanId
    ? store.trainingRecords.some(
        (entry) =>
          entry.id !== record.id &&
          entry.planId === matchedPlanId &&
          entry.userId === record.userId &&
          entry.trainingType === record.trainingType &&
          getLocalDateKey(entry.startedAt) === recordDayKey
      )
    : false;
  const countsTowardProgress = Boolean(matchedTodayTraining && !hasSameDayRecordForTraining);
  const nextUserPlans: UserPlan[] = matchedPlanId && countsTowardProgress
    ? store.userPlans.map((plan): UserPlan => {
        if (plan.id !== matchedPlanId) return plan;
        const nextCompletedSessions = Math.min(plan.completedSessions + 1, plan.totalSessions);
        const nextStatus: UserPlan["status"] =
          nextCompletedSessions >= plan.totalSessions ? "completed" : plan.status === "cancelled" ? plan.status : "active";
        return {
          ...plan,
          completedSessions: nextCompletedSessions,
          status: nextStatus
        };
      })
    : store.userPlans;

  const updatedPlan = matchedPlanId ? nextUserPlans.find((plan) => plan.id === matchedPlanId) ?? null : null;
  const currentPlanMatches = Boolean(matchedPlanId && store.currentPlan.id === matchedPlanId);
  const nextCurrentPlan: UserPlan = currentPlanMatches && updatedPlan ? updatedPlan : store.currentPlan;
  const isTodayRecord = getLocalDateKey(record.startedAt) === getLocalDateKey(new Date());
  const nextTodayTrainings = store.todayTrainings.map((item) => {
    if (item.id === record.trainingType) {
      return { ...item, status: isTodayRecord ? ("done" as const) : item.status };
    }

    return item;
  });

  return {
    ...store,
    trainingRecords: nextTrainingRecords,
    userPlans: nextUserPlans,
    currentPlan: nextCurrentPlan,
    currentPlanId: currentPlanMatches && updatedPlan ? updatedPlan.id : store.currentPlanId,
    todayTrainings: nextTodayTrainings
  };
}
