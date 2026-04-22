import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/repositories/users";
import { getCurrentPlanForUser, listPlanCatalog, listPlanInstanceEvents, listUserPlans } from "@/lib/repositories/plans";
import { listTrainingRecords } from "@/lib/repositories/training-records";

export async function GET() {
  const currentUser = await getCurrentUser();
  const [currentPlan, availablePlanTemplates, enrolledPlans, planEvents, recentRecords] = await Promise.all([
    getCurrentPlanForUser(currentUser?.id),
    listPlanCatalog(),
    listUserPlans(currentUser?.id ?? null),
    listPlanInstanceEvents(currentUser?.id ?? null),
    listTrainingRecords({ limit: 8, userId: currentUser?.id ?? undefined })
  ]);

  return NextResponse.json({
    ok: true,
    data: {
      currentUser,
      currentPlan,
      availablePlanTemplates,
      enrolledPlans,
      planEvents,
      recentRecords,
      generatedAt: new Date().toISOString()
    }
  });
}
