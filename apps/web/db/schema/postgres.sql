CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
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
