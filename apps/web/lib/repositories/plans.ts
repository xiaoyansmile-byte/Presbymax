import type {
  PlanInstanceEvent,
  PlanTemplate,
  PlanTemplateSummary,
  PlanTemplateVersion,
  TodayTraining,
  UserPlan,
} from "@prosbymax/types";
import { planCatalog as seedPlanCatalog } from "@/lib/mock-data";
import { getCurrentUser } from "@/lib/repositories/users";
import {
  buildPlanTemplateSummaries,
  buildPlanTemplateVersion,
  createPlanEvent,
  createPlanFromTemplate,
  findActivePlanTemplateById,
  findPlanForUser,
  loadStore,
  normalizePlanCatalog,
  updateStore,
} from "@/lib/persistent-store";

export async function getCurrentPlanId(): Promise<string> {
  const currentPlan = await getCurrentPlan();
  return currentPlan?.id ?? "";
}

export async function getCurrentPlan(): Promise<UserPlan | null> {
  const store = await loadStore();
  const currentUser = await getCurrentUser();
  return findPlanForUser(store, currentUser?.id);
}

export async function getCurrentPlanForUser(userId?: string | null): Promise<UserPlan | null> {
  const store = await loadStore();
  return findPlanForUser(store, userId ?? null);
}

export async function listUserPlans(userId?: string | null): Promise<UserPlan[]> {
  const store = await loadStore();
  if (!userId) return [];
  return store.userPlans.filter((plan) => plan.userId === userId).sort((a, b) => b.startDate.localeCompare(a.startDate));
}

export async function listPlanCatalog(): Promise<PlanTemplate[]> {
  const store = await loadStore();
  return store.planCatalog;
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
  return store.planInstanceEvents
    .filter((event) => (userId ? event.userId === userId : true))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function savePlanCatalog(
  nextCatalog: PlanTemplate[],
  options?: { changedBy?: string | null; notes?: string | null }
): Promise<PlanTemplate[]> {
  const normalizedCatalog = normalizePlanCatalog(nextCatalog, seedPlanCatalog);

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
    userPlans: current.userPlans.map((entry) => (entry.id === activePlan.id ? { ...entry, status: "cancelled" as const } : entry)),
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
