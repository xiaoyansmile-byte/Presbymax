"use client";

import { useEffect, useState } from "react";
import { summarizeRecords } from "@prosbymax/core";
import type { DashboardSnapshot, PlanTemplate, TrainingRecord } from "@prosbymax/types";
import { loadDashboardSnapshot } from "@/lib/dashboard";
import { loadAccountSnapshot } from "@/lib/account";
import { loadTrainingRecords, loadTrainingRecordsFromApi, subscribeTrainingRecords } from "@/lib/training-records";
import { PlanProgressCard } from "@/components/plan-progress-card";
import { StatCard } from "@/components/stat-card";
import { TrainingQueue } from "@/components/training-queue";
import Link from "next/link";
import { ArrowRightIcon, HomeIcon, TrendUpIcon } from "@/components/app-icons";

function getDisplayRecords() {
  const records = loadTrainingRecords();
  return records;
}

export function DashboardOverview() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [records, setRecords] = useState<TrainingRecord[]>([]);
  const [trainingItems, setTrainingItems] = useState<PlanTemplate["trainings"]>([]);

  useEffect(() => {
    let cancelled = false;

    void loadDashboardSnapshot().then((nextSnapshot) => {
      if (!cancelled) setSnapshot(nextSnapshot);
    });
    void loadAccountSnapshot().then((accountSnapshot) => {
      if (!cancelled && accountSnapshot?.currentPlan) {
        const template = accountSnapshot.availablePlanTemplates.find((item) => item.id === accountSnapshot.currentPlan?.templateId);
        setTrainingItems(
          template?.trainings.map((training) => ({
            id: training.id,
            priority: training.priority,
            frequency: training.frequency
          })) ?? []
        );
        return;
      }
      if (!cancelled) setTrainingItems([]);
    });
    void loadTrainingRecordsFromApi().then((nextRecords) => {
      if (!cancelled) setRecords(nextRecords);
    });

    const unsubscribe = subscribeTrainingRecords(() => setRecords(getDisplayRecords()));
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const currentPlan = snapshot?.currentPlan ?? null;
  const todayTrainings = snapshot?.todayTrainings ?? [];
  const stats = summarizeRecords(records);
  const nextTrainingId = todayTrainings.find((training) => training.status === "ready")?.id;

  if (!snapshot?.currentUser) {
    return (
      <section className="app-shell py-8 lg:py-10">
        <div className="space-y-6">
          <section className="app-hero rounded-[30px] p-8 md:p-10">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-sm font-semibold text-white/85">
                <HomeIcon className="h-4 w-4" aria-hidden="true" />
                今日训练
              </div>
              <h2 className="mt-4 text-[2.6rem] font-semibold tracking-tight text-white">请先登录后开始训练</h2>
              <p className="mt-4 max-w-2xl text-[15px] leading-7 text-white/82">
                当前还没有登录会话，训练队列和计划内容不会展示。登录后你才能查看今天的训练安排并开始训练。
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  className="inline-flex h-12 items-center justify-center rounded-[16px] bg-white px-5 text-sm font-semibold text-blue-700 shadow-[0_14px_28px_rgba(15,23,42,0.14)]"
                  href="/auth"
                >
                  <ArrowRightIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                  去登录
                </Link>
              </div>
            </div>
          </section>
        </div>
      </section>
    );
  }

  return (
    <section className="app-shell py-8 lg:py-10">
      <div className="space-y-6">
        <section className="app-hero rounded-[30px] p-8 md:p-10">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-sm font-semibold text-white/85">
              <HomeIcon className="h-4 w-4" aria-hidden="true" />
              早上好
            </div>
            <h2 className="mt-4 text-[2.6rem] font-semibold tracking-tight text-white">
              继续你的视觉训练之旅
            </h2>
            <p className="mt-4 max-w-2xl text-[15px] leading-7 text-white/82">
              {currentPlan
                ? `今天还有 ${todayTrainings.length} 个训练项目等待完成。系统会自动记录分数、用时和计划进度。`
                : "你还没有激活训练计划，请先到账户页加入一个计划，再开始今天的训练。"}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              {currentPlan ? (
                <Link
                  className="inline-flex h-12 items-center justify-center rounded-[16px] bg-white px-5 text-sm font-semibold text-blue-700 shadow-[0_14px_28px_rgba(15,23,42,0.14)]"
                  href={nextTrainingId ? `/train/${nextTrainingId}` : "/account#plans"}
                >
                  <ArrowRightIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                  {nextTrainingId ? "开始今日训练" : "查看计划"}
                </Link>
              ) : (
                <Link className="inline-flex h-12 items-center justify-center rounded-[16px] bg-white px-5 text-sm font-semibold text-blue-700 shadow-[0_14px_28px_rgba(15,23,42,0.14)]" href="/account">
                  <ArrowRightIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                  去选计划
                </Link>
              )}
              <Link
                className="inline-flex h-12 items-center justify-center rounded-[16px] bg-white/14 px-5 text-sm font-semibold text-white ring-1 ring-white/18"
                href="/analytics#reports"
              >
                <TrendUpIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                查看进度
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-4">
          <StatCard label="训练次数" value={stats.totalSessions} tone="blue" />
          <StatCard label="最高分" value={stats.highestScore} tone="green" />
          <StatCard label="总时长" value={`${Math.round(stats.totalDurationSec / 60)}m`} tone="violet" />
          <StatCard label="平均分" value={stats.averageScore} tone="amber" />
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_0.98fr]">
          <PlanProgressCard plan={currentPlan} trainingItems={trainingItems} />
          <TrainingQueue trainings={todayTrainings} />
        </section>
      </div>
    </section>
  );
}
