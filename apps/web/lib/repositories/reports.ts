import type { ReportRange, ReportSnapshot, ReportTemplateSummary, ReportTrendPoint } from "@prosbymax/types";
import { summarizeRecords } from "@prosbymax/core";
import { getCurrentPlanForUser } from "@/lib/repositories/plans";
import { getCurrentUser } from "@/lib/repositories/users";
import { listTrainingRecords } from "@/lib/repositories/training-records";
import { loadStore } from "@/lib/persistent-store";

const localDateKeyFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" });
const localRangeLabel: Record<ReportRange, string> = {
  "7d": "最近 7 天",
  "30d": "最近 30 天",
  "90d": "最近 90 天",
  all: "全部时间"
};

function resolveRangeWindow(range: ReportRange) {
  if (range === "all") return { startedFrom: undefined, startedTo: undefined };
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const startedFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  return { startedFrom, startedTo: undefined };
}

function formatTrendLabel(dateKey: string) {
  const [year, month, day] = dateKey.split("-");
  return `${month}/${day}`;
}

function buildTrendSeries(records: Awaited<ReturnType<typeof listTrainingRecords>>): ReportTrendPoint[] {
  const grouped = new Map<
    string,
    {
      sessions: number;
      durationSec: number;
      totalScore: number;
      highestScore: number;
    }
  >();

  for (const record of records.slice().reverse()) {
    const dateKey = localDateKeyFormatter.format(new Date(record.startedAt));
    const current = grouped.get(dateKey) ?? { sessions: 0, durationSec: 0, totalScore: 0, highestScore: 0 };
    current.sessions += 1;
    current.durationSec += record.durationSec;
    current.totalScore += record.score;
    current.highestScore = Math.max(current.highestScore, record.score);
    grouped.set(dateKey, current);
  }

  return Array.from(grouped.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, value]) => ({
      date,
      label: formatTrendLabel(date),
      sessions: value.sessions,
      durationSec: value.durationSec,
      averageScore: value.sessions > 0 ? Math.round((value.totalScore / value.sessions) * 10) / 10 : 0,
      highestScore: value.highestScore
    }));
}

export async function listReportSummaries(): Promise<ReportTemplateSummary[]> {
  const store = await loadStore();
  return store.reportSummaries;
}

export async function getReportSnapshot(range: ReportRange = "30d"): Promise<ReportSnapshot> {
  const currentUser = await getCurrentUser();
  const currentPlan = currentUser ? await getCurrentPlanForUser(currentUser.id) : null;
  const window = resolveRangeWindow(range);
  const rangeRecords = currentUser ? await listTrainingRecords({ userId: currentUser.id, ...window }) : [];
  const recentRecords = rangeRecords.slice(0, 8);
  const summary = summarizeRecords(rangeRecords);
  const reportSummaries = await listReportSummaries();

  return {
    currentUser,
    currentPlan,
    range,
    rangeLabel: localRangeLabel[range],
    summary,
    templates: reportSummaries.map((template) => ({
      ...template,
      status: recentRecords.length > 0 && template.id === "weekly" ? "已生成" : template.status
    })),
    recentRecords,
    trend: buildTrendSeries(rangeRecords),
    generatedAt: new Date().toISOString()
  };
}
