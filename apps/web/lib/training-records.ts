"use client";

import type { TrainingRecordRepository } from "@prosbymax/api-contract";
import type { CreateTrainingRecordInput, TrainingRecord, TrainingRecordQuery } from "@prosbymax/types";

const storageKey = "trainingHistory";
const recordsChangedEvent = "prosbymax-training-records-changed";

function isTrainingRecord(value: unknown): value is TrainingRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<TrainingRecord>;
  return (
    typeof record.id === "string" &&
    typeof record.trainingType === "string" &&
    typeof record.trainingLabel === "string" &&
    typeof record.startedAt === "string" &&
    typeof record.endedAt === "string" &&
    typeof record.durationSec === "number" &&
    typeof record.score === "number"
  );
}

function applyRecordQuery(records: TrainingRecord[], query: TrainingRecordQuery = {}) {
  const limit = query.limit && query.limit > 0 ? query.limit : records.length;

  return records
    .filter((record) => (query.userId ? record.userId === query.userId : true))
    .filter((record) => (query.planId ? record.planId === query.planId : true))
    .filter((record) => (query.trainingType ? record.trainingType === query.trainingType : true))
    .filter((record) => (query.startedFrom ? record.startedAt >= query.startedFrom : true))
    .filter((record) => (query.startedTo ? record.startedAt <= query.startedTo : true))
    .slice(0, limit);
}

function normalizeCreateInput(input: CreateTrainingRecordInput): TrainingRecord {
  const now = new Date().toISOString();

  return {
    ...input,
    id: input.id ?? [input.userId ?? "anonymous", input.planId ?? "no-plan", input.trainingType, input.startedAt, input.endedAt].join("|"),
    createdAt: input.createdAt ?? now
  };
}

async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T | null> {
  try {
    const response = await fetch(input, init);
    if (!response.ok) return null;
    const payload = (await response.json()) as { ok?: boolean; data?: T };
    return payload?.ok ? (payload.data ?? null) : null;
  } catch {
    return null;
  }
}

export function loadTrainingRecords(): TrainingRecord[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isTrainingRecord).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  } catch {
    return [];
  }
}

export const browserTrainingRecordRepository: TrainingRecordRepository = {
  async list(query: TrainingRecordQuery = {}) {
    return applyRecordQuery(loadTrainingRecords(), query);
  },
  async create(input: CreateTrainingRecordInput) {
    const record = normalizeCreateInput(input);
    appendTrainingRecord(record);
    return record;
  }
};

export function saveTrainingRecords(records: TrainingRecord[]) {
  window.localStorage.setItem(storageKey, JSON.stringify(records));
  window.dispatchEvent(new CustomEvent(recordsChangedEvent));
}

export function appendTrainingRecord(record: TrainingRecord) {
  const records = loadTrainingRecords();
  saveTrainingRecords([record, ...records]);
}

export function subscribeTrainingRecords(listener: () => void) {
  window.addEventListener(recordsChangedEvent, listener);
  window.addEventListener("storage", listener);

  return () => {
    window.removeEventListener(recordsChangedEvent, listener);
    window.removeEventListener("storage", listener);
  };
}

export async function loadTrainingRecordsFromApi(query: TrainingRecordQuery = {}) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    params.set(key, String(value));
  });

  const records = await fetchJson<TrainingRecord[]>(`/api/training-records${params.toString() ? `?${params.toString()}` : ""}`);
  if (records) {
    saveTrainingRecords(records);
    return records;
  }

  return loadTrainingRecords();
}

export async function saveTrainingRecord(record: TrainingRecord) {
  appendTrainingRecord(record);
  const saved = await fetchJson<TrainingRecord>("/api/training-records", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(record)
  });

  if (saved) {
    saveTrainingRecords([saved, ...loadTrainingRecords().filter((entry) => entry.id !== saved.id)]);
    return saved;
  }

  return record;
}
