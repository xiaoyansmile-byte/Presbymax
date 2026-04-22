"use client";

import { useEffect, useState } from "react";
import { summarizeRecords } from "@prosbymax/core";
import type { ReportSnapshot, TrainingRecord } from "@prosbymax/types";
import { loadReportSnapshot } from "@/lib/reports";
import { StatCard } from "@/components/stat-card";
import { ArrowRightIcon, ReportIcon } from "@/components/app-icons";

export function ReportsOverview() {
  const [snapshot, setSnapshot] = useState<ReportSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadReportSnapshot().then((nextSnapshot) => {
      if (!cancelled) setSnapshot(nextSnapshot);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const currentUser = snapshot?.currentUser;
  const currentPlan = snapshot?.currentPlan;
  const templates = snapshot?.templates ?? [];
  const recentRecords: TrainingRecord[] = snapshot?.recentRecords ?? [];
  const stats = summarizeRecords(recentRecords);

  return (
    <section className="app-shell py-8 lg:py-10">
      <div className="space-y-6">
        <section className="app-hero rounded-[30px] p-8 md:p-10">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-sm font-semibold text-white/85">
              <ReportIcon className="h-4 w-4" aria-hidden="true" />
              训练报告
            </div>
            <h2 className="mt-4 text-[2.6rem] font-semibold tracking-tight text-white">生成可追溯的训练总结</h2>
            <p className="mt-4 max-w-3xl text-[15px] leading-7 text-white/82">
              报告模块将从统一训练记录生成摘要、进度和详细报告，并保留导出与审计记录。
            </p>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-4">
          <StatCard label="训练次数" value={stats.totalSessions} tone="blue" />
          <StatCard label="最高分" value={stats.highestScore} tone="green" />
          <StatCard label="总时长" value={`${Math.round(stats.totalDurationSec / 60)}m`} tone="violet" />
          <StatCard label="平均分" value={stats.averageScore} tone="amber" />
        </section>

        <section className="app-surface p-6">
          <h3 className="text-lg font-semibold text-slate-900">报告上下文</h3>
          <div className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-3">
            <span>用户：{currentUser?.displayName ?? "测试用户"}</span>
            <span>当前计划：{currentPlan?.nameSnapshot ?? "未激活计划"}</span>
            <span>状态：{currentPlan?.status ?? "无"}</span>
          </div>
          <p className="mt-4 text-sm text-slate-500">最近生成：{snapshot?.generatedAt ? new Date(snapshot.generatedAt).toLocaleString("zh-CN") : "暂无"}</p>
        </section>

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

        <section className="app-surface overflow-hidden">
          <div className="border-b border-slate-200/80 px-6 py-4">
            <h3 className="text-lg font-semibold text-slate-900">最近训练记录</h3>
          </div>
          {recentRecords.length === 0 ? (
            <div className="px-6 py-8 text-sm text-slate-500">当前还没有可生成报告的训练记录。</div>
          ) : (
            <div className="divide-y divide-slate-200/80">
              {recentRecords.map((record) => (
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
      </div>
    </section>
  );
}
