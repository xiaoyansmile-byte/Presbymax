"use client";

import { useEffect, useState } from "react";
import { summarizeRecords } from "@prosbymax/core";
import type { ReportSnapshot, TrainingRecord } from "@prosbymax/types";
import { StatCard } from "@/components/stat-card";
import { ArrowRightIcon, ReportIcon, TrendUpIcon } from "@/components/app-icons";
import { loadReportSnapshot } from "@/lib/reports";
import { loadTrainingRecords, loadTrainingRecordsFromApi, subscribeTrainingRecords } from "@/lib/training-records";

function getDisplayRecords() {
  const records = loadTrainingRecords();
  return records;
}

export function AnalyticsOverview() {
  const [records, setRecords] = useState<TrainingRecord[]>([]);
  const [reportSnapshot, setReportSnapshot] = useState<ReportSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;

    void loadTrainingRecordsFromApi().then((nextRecords) => {
      if (!cancelled) setRecords(nextRecords);
    });
    void loadReportSnapshot().then((nextSnapshot) => {
      if (!cancelled) setReportSnapshot(nextSnapshot);
    });

    const unsubscribe = subscribeTrainingRecords(() => setRecords(getDisplayRecords()));
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const stats = summarizeRecords(records);
  const currentUser = reportSnapshot?.currentUser;
  const currentPlan = reportSnapshot?.currentPlan;
  const templates = reportSnapshot?.templates ?? [];

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-4">
        <StatCard label="训练次数" value={stats.totalSessions} tone="blue" />
        <StatCard label="最高分" value={stats.highestScore} tone="green" />
        <StatCard label="总时长" value={`${Math.round(stats.totalDurationSec / 60)}m`} tone="violet" />
        <StatCard label="平均分" value={stats.averageScore} tone="amber" />
      </section>

      <section className="app-surface overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-slate-200/80 px-6 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">最近训练记录</h3>
            <p className="mt-1 text-sm text-slate-500">{records.length > 0 ? "来自本机训练记录" : "暂无训练记录"}</p>
          </div>
        </div>
        {records.length === 0 ? (
          <div className="px-6 py-8 text-sm text-slate-500">当前还没有训练记录，完成一次训练后这里会自动更新。</div>
        ) : (
          <div className="divide-y divide-slate-200/80">
            {records.map((record) => (
              <div key={record.id} className="grid gap-2 px-6 py-5 md:grid-cols-[1fr_auto_auto] md:items-center">
                <div>
                  <h4 className="text-[15px] font-semibold text-slate-900">{record.trainingLabel}</h4>
                  <p className="mt-1 text-sm text-slate-500">{new Date(record.startedAt).toLocaleString("zh-CN")}</p>
                </div>
                <span className="text-sm text-slate-600">得分 {record.score}</span>
                <span className="text-sm text-slate-600">{record.durationSec} 秒</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section id="reports" className="space-y-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
              <ReportIcon className="h-4 w-4" aria-hidden="true" />
              报告中心
            </div>
            <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">训练报告与洞察</h3>
            <p className="mt-2 max-w-3xl text-[15px] leading-7 text-slate-600">
              报告卡片、训练上下文和最近训练记录现在放在同一个页面里，方便在看表现的同时直接生成汇总。
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-[22px] bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <TrendUpIcon className="h-4 w-4 text-primary" aria-hidden="true" />
            {reportSnapshot?.generatedAt ? `最近生成于 ${new Date(reportSnapshot.generatedAt).toLocaleString("zh-CN")}` : "暂无生成记录"}
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-3">
          {templates.map((report) => (
            <article key={report.id} className="app-surface flex h-full flex-col p-6">
              <p className="text-sm font-semibold text-primary">{report.status}</p>
              <h3 className="mt-2 text-xl font-semibold text-slate-900">{report.name}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{report.range}</p>
              <button className="mt-5 inline-flex h-11 items-center justify-center rounded-[16px] bg-gradient-to-r from-blue-600 to-violet-600 px-4 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(67,56,202,0.24)]">
                <ArrowRightIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                生成报告
              </button>
            </article>
          ))}
        </section>

        <section className="app-surface p-6">
          <h3 className="text-lg font-semibold text-slate-900">报告上下文</h3>
          <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-3">
            <span>用户：{currentUser?.displayName ?? "测试用户"}</span>
            <span>当前计划：{currentPlan?.nameSnapshot ?? "未激活计划"}</span>
            <span>状态：{currentPlan?.status ?? "无"}</span>
          </div>
        </section>
      </section>
    </div>
  );
}
