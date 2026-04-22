import type { DashboardSnapshot } from "@prosbymax/types";
import { getCurrentUser } from "@/lib/repositories/users";
import { listPlanTemplates, listTodayTrainings } from "@/lib/repositories/plans";
import { getCurrentPlanForUser } from "@/lib/repositories/plans";

export async function getDashboardSnapshot(): Promise<DashboardSnapshot> {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return {
      currentUser: null,
      currentPlan: null,
      todayTrainings: [],
      planTemplates: []
    };
  }

  const [currentPlan, todayTrainings, planTemplates] = await Promise.all([
    getCurrentPlanForUser(currentUser.id),
    listTodayTrainings(),
    listPlanTemplates()
  ]);

  return {
    currentUser,
    currentPlan,
    todayTrainings,
    planTemplates
  };
}
