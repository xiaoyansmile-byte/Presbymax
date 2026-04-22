(function () {
  "use strict";

  const UNIFIED_HISTORY_KEY = "trainingHistory";
  const GABOR_HISTORY_KEY = "gabor-training-history";
  const CURRENT_USER_KEY = "vision-training-current-user";
  const TRAINING_PLAN_KEY = "vision-training-plan";

  const TRAINING_LABELS = {
    "optictrain-navigation": "Visual Neuro-Navigation",
    "gabor-match": "Gabor配对",
    "flicker-gabor": "闪烁Gabor",
    brightness: "对比辨别",
    reading: "阅读清晰度",
    glare: "眩光测试",
    tunnel: "隧道识别"
  };

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    } catch (e) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function loadCurrentUser() {
    const user = readJson(CURRENT_USER_KEY, null);
    return user && typeof user === "object" ? user : null;
  }

  function loadTrainingPlan() {
    const plan = readJson(TRAINING_PLAN_KEY, null);
    return plan && typeof plan === "object" ? plan : null;
  }

  function makeRecordId(record) {
    return [
      record.userId || "anonymous",
      record.planId || "no-plan",
      record.trainingType || "unknown",
      record.startedAt || record.endedAt || record.createdAt || "",
      record.score == null ? "" : record.score,
      record.total == null ? "" : record.total
    ].join("|");
  }

  function normalizeTrainingRecord(item, fallbackType) {
    if (!item || typeof item !== "object") return null;

    const user = loadCurrentUser();
    const trainingType = item.trainingType || item.trainingId || fallbackType || "gabor-match";
    const startedAt = item.startedAt || item.ts || item.date || item.createdAt || new Date().toISOString();
    const endedAt = item.endedAt || item.date || item.ts || startedAt;
    const durationSec = Number(item.durationSec ?? item.duration ?? item.metrics?.durationSec ?? 0) || 0;
    const score = Number(item.score ?? 0) || 0;
    const total = item.total == null ? null : Number(item.total);
    const accuracy = item.accuracy == null
      ? (Number.isFinite(total) && total > 0 ? Math.round((score / total) * 100) : null)
      : Number(item.accuracy);

    const metrics = Object.assign({}, item.metrics || {});
    ["maxK", "mode", "excellent", "medium", "poor", "difficulty", "duration", "durationSec"].forEach(function (key) {
      if (item[key] != null && metrics[key] == null) metrics[key] = item[key];
    });

    const normalized = {
      id: item.id || "",
      userId: item.userId || (user && user.id) || null,
      planId: item.planId || null,
      trainingType,
      trainingLabel: item.trainingLabel || TRAINING_LABELS[trainingType] || trainingType,
      startedAt,
      endedAt,
      durationSec,
      score,
      total: Number.isFinite(total) ? total : null,
      accuracy: Number.isFinite(accuracy) ? accuracy : null,
      metrics,
      createdAt: item.createdAt || endedAt
    };

    normalized.id = normalized.id || makeRecordId(normalized);

    // Compatibility aliases for older pages and imported data.
    normalized.trainingId = normalized.trainingType;
    normalized.date = normalized.endedAt;
    normalized.ts = normalized.startedAt;
    if (normalized.metrics.maxK != null) normalized.maxK = normalized.metrics.maxK;
    if (normalized.metrics.mode != null) normalized.mode = normalized.metrics.mode;

    return normalized;
  }

  function uniqueRecords(records) {
    const seen = new Set();
    const out = [];
    records.forEach(function (record) {
      const normalized = normalizeTrainingRecord(record);
      if (!normalized || seen.has(normalized.id)) return;
      seen.add(normalized.id);
      out.push(normalized);
    });
    return out.sort(function (a, b) {
      return new Date(a.startedAt) - new Date(b.startedAt);
    });
  }

  function loadTrainingRecords() {
    const unified = readJson(UNIFIED_HISTORY_KEY, []);
    const gabor = readJson(GABOR_HISTORY_KEY, []);
    return uniqueRecords(
      (Array.isArray(unified) ? unified : []).concat(Array.isArray(gabor) ? gabor : [])
    );
  }

  function saveTrainingRecords(records) {
    writeJson(UNIFIED_HISTORY_KEY, uniqueRecords(Array.isArray(records) ? records : []));
  }

  function saveTrainingRecord(input) {
    const record = normalizeTrainingRecord(input);
    if (!record) return null;
    const records = loadTrainingRecords().filter(function (item) {
      return item.id !== record.id;
    });
    records.push(record);
    saveTrainingRecords(records);
    return record;
  }

  function removeTrainingRecords(predicate) {
    const records = loadTrainingRecords();
    const next = records.filter(function (record) {
      return !predicate(record);
    });
    saveTrainingRecords(next);
    return next;
  }

  window.VisionTrainingStorage = {
    keys: {
      trainingHistory: UNIFIED_HISTORY_KEY,
      gaborHistory: GABOR_HISTORY_KEY,
      currentUser: CURRENT_USER_KEY,
      trainingPlan: TRAINING_PLAN_KEY
    },
    labels: TRAINING_LABELS,
    readJson,
    writeJson,
    loadCurrentUser,
    loadTrainingPlan,
    normalizeTrainingRecord,
    loadTrainingRecords,
    saveTrainingRecords,
    saveTrainingRecord,
    removeTrainingRecords
  };
})();
