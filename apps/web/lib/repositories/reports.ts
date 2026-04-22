import type { ReportSnapshot, ReportTemplateSummary } from "@prosbymax/types";
import { getCurrentPlanForUser } from "@/lib/repositories/plans";
import { getCurrentUser } from "@/lib/repositories/users";
import { listTrainingRecords } from "@/lib/repositories/training-records";
import { loadStore } from "@/lib/persistent-store";

export async function listReportSummaries(): Promise<ReportTemplateSummary[]> {
  const store = await loadStore();
  return store.reportSummaries;
}

export async function getReportSnapshot(): Promise<ReportSnapshot> {
  const currentUser = await getCurrentUser();
  const [currentPlan, reportSummaries, recentRecords] = await Promise.all([
    getCurrentPlanForUser(currentUser?.id),
    listReportSummaries(),
    listTrainingRecords({ limit: 8, userId: currentUser?.id ?? undefined })
  ]);

  return {
    currentUser,
    currentPlan,
    templates: reportSummaries.map((template) => ({
      ...template,
      status: recentRecords.length > 0 && template.id === "weekly" ? "已生成" : template.status
    })),
    recentRecords,
    generatedAt: new Date().toISOString()
  };
}
