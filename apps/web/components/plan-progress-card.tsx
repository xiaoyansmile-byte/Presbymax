import { trainingLabels } from "@prosbymax/core";
import type { PlanTemplate, TrainingRecord, UserPlan } from "@prosbymax/types";
import { TargetIcon } from "@/components/app-icons";

type PlanProgressCardProps = {
  plan: UserPlan | null;
  trainingItems?: PlanTemplate["trainings"];
  trainingRecords?: TrainingRecord[];
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

const localDateKeyFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" });

function getLocalDateKey(value: string | Date) {
  return localDateKeyFormatter.format(typeof value === "string" ? new Date(value) : value);
}

function buildRingProgresses(progresses: number[], trainingItems: PlanTemplate["trainings"], fallbackProgress: number) {
  const ringCount = clamp(Math.round(trainingItems.length) || 1, 1, 5);
  const outerRadius = 70;
  const step = ringCount === 1 ? 0 : 12;
  const strokeWidth = 8;
  const palette = [
    { track: "#dbeafe", progress: "#2563eb" },
    { track: "#dcfce7", progress: "#16a34a" },
    { track: "#ffe4e6", progress: "#db2777" },
    { track: "#f3e8ff", progress: "#7c3aed" },
    { track: "#ffedd5", progress: "#f97316" }
  ];

  return Array.from({ length: ringCount }, (_, index) => {
    const tone = palette[index % palette.length];
    const radius = Math.max(10, outerRadius - index * step);
    return {
      radius,
      strokeWidth,
      progress: clamp(progresses[index] ?? fallbackProgress, 0, 100),
      trackColor: tone.track,
      progressColor: tone.progress
    };
  });
}

function getTrainingWeight(frequency: string) {
  if (frequency.includes("每日")) return 7;
  const weeklyMatch = frequency.match(/每周\s*(\d+)\s*次/);
  if (weeklyMatch) return Math.max(1, Number(weeklyMatch[1]));
  return 1;
}

function buildTrainingBreakdown(plan: UserPlan, trainingItems: PlanTemplate["trainings"], trainingRecords: TrainingRecord[]) {
  if (trainingItems.length === 0) return [];

  const distinctDailyCompletionsByTrainingId = new Map<string, Set<string>>();
  for (const record of trainingRecords) {
    if (record.userId !== plan.userId) continue;
    if (record.planId !== plan.id) continue;
    const current = distinctDailyCompletionsByTrainingId.get(record.trainingType) ?? new Set<string>();
    current.add(getLocalDateKey(record.startedAt));
    distinctDailyCompletionsByTrainingId.set(record.trainingType, current);
  }

  const weights = trainingItems.map((item) => getTrainingWeight(item.frequency));
  const totalWeight = Math.max(weights.reduce((sum, weight) => sum + weight, 0), 1);
  const totalSessionsPerItem = weights.map((weight, index) => {
    const allocated = Math.round((plan.totalSessions * weight) / totalWeight);
    return Math.max(1, allocated || Math.floor(plan.totalSessions / Math.max(trainingItems.length, 1)) || 1);
  });
  const completedSessionsPerItem = trainingItems.map((item) => distinctDailyCompletionsByTrainingId.get(item.id)?.size ?? 0);

  return trainingItems.map((item, index) => {
    const totalSessions = totalSessionsPerItem[index] ?? 0;
    const completedSessions = completedSessionsPerItem[index] ?? 0;
    const progress = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

    return {
      ...item,
      label: trainingLabels[item.id],
      completedSessions,
      totalSessions,
      progress
    };
  });
}

export function PlanProgressCard({ plan, trainingItems = [], trainingRecords = [] }: PlanProgressCardProps) {
  if (!plan) {
    return (
      <section className="app-surface p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[16px] bg-primary/10 text-primary ring-1 ring-primary/10 sm:h-10 sm:w-10">
            <TargetIcon className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-primary">当前计划</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">计划进度</h2>
          </div>
        </div>
        <p className="mt-4 max-w-xl text-sm leading-6 text-slate-600">当前还没有激活的训练计划，请先加入一个计划再开始训练。</p>
      </section>
    );
  }

  const progress = Math.min(Math.round((plan.completedSessions / plan.totalSessions) * 100), 100);
  const remaining = Math.max(plan.totalSessions - plan.completedSessions, 0);
  const breakdown = buildTrainingBreakdown(plan, trainingItems, trainingRecords);
  const ringProgresses = breakdown.length > 0 ? breakdown.map((item) => item.progress) : [progress];
  const rings = buildRingProgresses(ringProgresses, trainingItems, progress);

  return (
    <section className="app-surface bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(248,250,255,0.92)_100%)] p-5 sm:p-6">
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[16px] bg-primary/10 text-primary ring-1 ring-primary/10 sm:h-10 sm:w-10">
            <TargetIcon className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-primary">当前计划</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">整体进度概览</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
              已完成 {plan.completedSessions} / {plan.totalSessions} 次训练，还剩 {remaining} 次。进度环会跟随计划推进实时更新。
            </p>
            <p className="mt-2 max-w-xl text-xs leading-5 text-slate-500">
              计划进度只统计每日 baseline 的首次完成；重复练习只更新成绩，不会增加完成次数。
            </p>
          </div>
        </div>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] xl:items-center">
          <div className="mt-6 flex items-center justify-center">
            <div className="relative flex aspect-square h-48 w-48 shrink-0 items-center justify-center sm:h-60 sm:w-60">
              <svg viewBox="0 0 160 160" className="absolute inset-0 h-full w-full" aria-hidden="true">
                {rings.map((ring, index) => {
                  const circumference = 2 * Math.PI * ring.radius;
                  const dashOffset = circumference * (1 - ring.progress / 100);

                  return (
                    <g key={`${ring.radius}-${index}`}>
                      <circle
                        cx="80"
                        cy="80"
                        r={ring.radius}
                        className="fill-none"
                        stroke={ring.trackColor}
                        strokeOpacity={0.18}
                        strokeWidth={ring.strokeWidth}
                      />
                      <circle
                        cx="80"
                        cy="80"
                        r={ring.radius}
                        className="fill-none"
                        stroke={ring.progressColor}
                        strokeDasharray={circumference}
                        strokeDashoffset={dashOffset}
                        strokeLinecap="round"
                        strokeOpacity={0.95}
                        strokeWidth={ring.strokeWidth}
                        transform="rotate(-90 80 80)"
                      />
                    </g>
                  );
                })}
              </svg>
              <div className="relative z-10 flex h-16 w-16 flex-col items-center justify-center rounded-full border border-white/90 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
                <span className="text-[1.65rem] font-semibold leading-none tracking-tight text-violet-600">{progress}%</span>
                <span className="mt-1 text-[10px] font-medium leading-none text-slate-500">整体完成</span>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            {breakdown.map((item) => (
              <div key={item.id} className="rounded-[18px] border border-slate-200 bg-white px-3 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.05)] sm:px-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[15px] font-semibold text-slate-900">{item.label}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.frequency}</p>
                  </div>
                  <span className="inline-flex h-8 items-center rounded-full bg-slate-100 px-2.5 text-xs font-semibold text-slate-500">
                    {item.progress}%
                  </span>
                </div>
                <p className="mt-3 text-sm text-slate-600">
                  {item.completedSessions} / {item.totalSessions} 次 · 完成率 {item.progress}%
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
