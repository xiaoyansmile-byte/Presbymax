import type { AdminUserSummary, CreateTrainingRecordInput, TrainingRecord, TrainingRecordQuery } from "@prosbymax/types";
import { createTrainingRecord } from "@prosbymax/core";
import { applyTrainingRecordToStore, findPlanForUser, loadStore, toPublicUser, updateStore } from "@/lib/persistent-store";
import { getCurrentPlanForUser } from "@/lib/repositories/plans";
import { getCurrentUser } from "@/lib/repositories/users";

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

export async function listAdminUserSummaries(): Promise<AdminUserSummary[]> {
  const store = await loadStore();

  return store.users.map((user) => {
    const plan = findPlanForUser(store, user.id);
    const records = store.trainingRecords
      .filter((record) => record.userId === user.id)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    const latest = records[0] ?? null;

    return {
      user: toPublicUser(user),
      plan,
      trainingCount: records.length,
      recentTrainingAt: latest?.startedAt ?? null,
      recentTrainingLabel: latest?.trainingLabel ?? null
    };
  });
}

export async function getCurrentUserTrainingRecords(limit = 8): Promise<TrainingRecord[]> {
  const currentUser = await getCurrentUser();
  if (!currentUser) return [];
  const currentPlan = await getCurrentPlanForUser(currentUser.id);
  return listTrainingRecords({ limit, userId: currentUser.id, planId: currentPlan?.id });
}
