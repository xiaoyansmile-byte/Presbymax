"use client";

import { useEffect, useRef, useState } from "react";
import type { DashboardSnapshot, PlanTemplate, ReportSnapshot } from "@prosbymax/types";
import { loadDashboardSnapshot } from "@/lib/dashboard";
import { loadAccountSnapshot } from "@/lib/account";
import { subscribeTrainingRecords } from "@/lib/training-records";
import { PlanProgressCard } from "@/components/plan-progress-card";
import { StatCard } from "@/components/stat-card";
import { TrainingQueue } from "@/components/training-queue";
import Link from "next/link";
import { ArrowRightIcon, HomeIcon, TrendUpIcon } from "@/components/app-icons";
import { loadReportSnapshot } from "@/lib/reports";

export function DashboardOverview() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [reportSnapshot, setReportSnapshot] = useState<ReportSnapshot | null>(null);
  const [trainingItems, setTrainingItems] = useState<PlanTemplate["trainings"]>([]);
  const [recentRecords, setRecentRecords] = useState<NonNullable<Awaited<ReturnType<typeof loadAccountSnapshot>>>["recentRecords"]>([]);
  const snapshotSeqRef = useRef(0);
  const reportSeqRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const reloadDashboardSnapshot = () => {
      const seq = ++snapshotSeqRef.current;
      void loadDashboardSnapshot().then((nextSnapshot) => {
        if (!cancelled && seq === snapshotSeqRef.current) setSnapshot(nextSnapshot);
      });
    };

    reloadDashboardSnapshot();
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
        setRecentRecords(accountSnapshot.recentRecords ?? []);
        return;
      }
      if (!cancelled) setTrainingItems([]);
      if (!cancelled) setRecentRecords([]);
    });
    void loadReportSnapshot("all").then((nextSnapshot) => {
      if (!cancelled) setReportSnapshot(nextSnapshot);
    });

    const unsubscribe = subscribeTrainingRecords(() => {
      reloadDashboardSnapshot();
      const reportSeq = ++reportSeqRef.current;
      void loadReportSnapshot("all").then((nextSnapshot) => {
        if (!cancelled && reportSeq === reportSeqRef.current) setReportSnapshot(nextSnapshot);
      });
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const currentPlan = snapshot?.currentPlan ?? null;
  const todayTrainings = snapshot?.todayTrainings ?? [];
  const stats = reportSnapshot?.summary ?? { totalSessions: 0, totalDurationSec: 0, highestScore: 0, averageScore: 0 };
  const pendingTrainings = todayTrainings.filter((training) => training.status === "ready");
  const completedTrainings = todayTrainings.filter((training) => training.status === "done");
  const nextTrainingId = pendingTrainings[0]?.id;

  if (!snapshot?.currentUser) {
    return (
      <section className="app-shell pb-24 pt-5 sm:py-8 lg:py-10">
        <div className="space-y-3 sm:space-y-6">
          <section className="app-hero rounded-[28px] p-3.5 sm:p-8 md:p-10">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-sm font-semibold text-white/85">
                <HomeIcon className="h-4 w-4" aria-hidden="true" />
                今日训练
              </div>
              <h2 className="mt-3 max-w-full text-[1.75rem] font-semibold tracking-tight text-white sm:mt-4 sm:text-[2.6rem]">请先登录后开始训练</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/82 sm:mt-4 sm:text-[15px]">
                当前还没有登录会话，训练队列和计划内容不会展示。登录后你才能查看今天的训练安排并开始训练。
              </p>
              <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:gap-3">
                <Link
                  className="inline-flex h-11 w-full items-center justify-center rounded-[16px] bg-white px-4 text-sm font-semibold text-blue-700 shadow-[0_14px_28px_rgba(15,23,42,0.14)] sm:w-auto sm:px-5"
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
    <section className="app-shell py-5 sm:py-8 lg:py-10">
      <div className="space-y-5 sm:space-y-6">
        <section className="app-hero rounded-[28px] p-5 sm:p-8 md:p-10">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-sm font-semibold text-white/85">
              <HomeIcon className="h-4 w-4" aria-hidden="true" />
              早上好
            </div>
              <h2 className="mt-3 max-w-full text-[1.55rem] font-semibold tracking-tight text-white sm:mt-4 sm:text-[2.6rem]">
                继续你的视觉训练之旅
              </h2>
            <p className="mt-3 max-w-2xl text-[13px] leading-6 text-white/82 sm:mt-4 sm:text-[15px]">
              {currentPlan
                ? pendingTrainings.length > 0
                  ? `今天还有 ${pendingTrainings.length} 个训练项目等待完成，${completedTrainings.length} 个项目已完成。系统会自动记录分数、用时和计划进度。`
                  : `今天的计划训练已经完成，${completedTrainings.length} 个项目已完成。你仍然可以在下方重新练习已完成项目。`
                : "你还没有激活训练计划，请先到账户页加入一个计划，再开始今天的训练。"}
            </p>
            {reportSnapshot ? (
              <p className="mt-2 text-[12px] font-medium uppercase tracking-[0.18em] text-white/60 sm:text-[13px]">
                {reportSnapshot.rangeLabel} 汇总 · {reportSnapshot.summary.totalSessions} 次练习
              </p>
            ) : null}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
              {currentPlan ? (
                <Link
                  className="inline-flex h-11 w-full items-center justify-center rounded-[16px] bg-white px-4 text-sm font-semibold text-blue-700 shadow-[0_14px_28px_rgba(15,23,42,0.14)] sm:w-auto sm:px-5"
                  href={nextTrainingId ? `/train/${nextTrainingId}` : "/plans"}
                >
                  <ArrowRightIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                  {nextTrainingId ? "继续训练" : "查看计划"}
                </Link>
              ) : (
                <Link className="inline-flex h-11 w-full items-center justify-center rounded-[16px] bg-white px-4 text-sm font-semibold text-blue-700 shadow-[0_14px_28px_rgba(15,23,42,0.14)] sm:w-auto sm:px-5" href="/account">
                  <ArrowRightIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                  去选计划
                </Link>
              )}
              <Link
                className="inline-flex h-11 w-full items-center justify-center rounded-[16px] bg-white/14 px-4 text-sm font-semibold text-white ring-1 ring-white/18 sm:w-auto sm:px-5"
                href="/analytics#reports"
              >
                <TrendUpIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                查看进度
              </Link>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="练习次数" value={stats.totalSessions} tone="blue" />
          <StatCard label="最高分" value={stats.highestScore} tone="green" />
          <StatCard label="总时长" value={`${Math.round(stats.totalDurationSec / 60)}m`} tone="violet" />
          <StatCard label="平均分" value={stats.averageScore} tone="amber" />
        </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_0.98fr]">
          <PlanProgressCard plan={currentPlan} trainingItems={trainingItems} trainingRecords={recentRecords} />
          <TrainingQueue trainings={todayTrainings} />
        </section>
      </div>
    </section>
  );
}
