"use client";

import { useEffect, useRef, useState } from "react";
import type { ReportRange, ReportSnapshot } from "@prosbymax/types";
import { exportReport } from "@/lib/reports";
import { loadReportSnapshot } from "@/lib/reports";
import { subscribeTrainingRecords } from "@/lib/training-records";
import { StatCard } from "@/components/stat-card";
import { LockIcon, ReportIcon, TrendUpIcon } from "@/components/app-icons";
import { RecentRecordsAccordion, ReportRangeControls, TrendChart } from "@/components/reporting/report-kit";

export function AnalyticsOverview() {
  const [snapshot, setSnapshot] = useState<ReportSnapshot | null>(null);
  const [range, setRange] = useState<ReportRange>("30d");
  const [exporting, setExporting] = useState<"pdf" | null>(null);
  const snapshotSeqRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const reload = () => {
      const seq = ++snapshotSeqRef.current;
      void loadReportSnapshot(range).then((nextSnapshot) => {
        if (!cancelled && seq === snapshotSeqRef.current) setSnapshot(nextSnapshot);
      });
    };

    reload();
    const unsubscribe = subscribeTrainingRecords(reload);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [range]);

  const currentUser = snapshot?.currentUser;
  const currentPlan = snapshot?.currentPlan;
  const templates = snapshot?.templates ?? [];
  const records = snapshot?.recentRecords ?? [];
  const stats = snapshot?.summary ?? { totalSessions: 0, totalDurationSec: 0, highestScore: 0, averageScore: 0 };

  async function handleGenerateReport() {
    setExporting("pdf");
    const response = await exportReport(range, "pdf");
    setExporting(null);
    if (!response) return;

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `prosbymax-report-${range}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }

  if (!currentUser) {
    return (
      <section className="app-surface p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] bg-slate-100 text-slate-500 ring-1 ring-slate-200">
            <LockIcon className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-500">训练洞察</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">请先登录查看训练数据</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              训练次数、报告和最近训练记录只对已登录用户开放，登录后会显示你的个人训练摘要。
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="练习次数" value={stats.totalSessions} tone="blue" />
        <StatCard label="最高分" value={stats.highestScore} tone="green" />
        <StatCard label="总时长" value={`${Math.round(stats.totalDurationSec / 60)}m`} tone="violet" />
        <StatCard label="平均分" value={stats.averageScore} tone="amber" />
      </section>

      <TrendChart snapshot={snapshot} />

      <section id="reports" className="space-y-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
              <ReportIcon className="h-4 w-4" aria-hidden="true" />
              报告中心
            </div>
            <h3 className="mt-3 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">训练报告与洞察</h3>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600 sm:text-[15px]">
              报告卡片、训练上下文和最近训练记录现在放在同一个页面里，方便在看表现的同时直接生成汇总。
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-[22px] bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <TrendUpIcon className="h-4 w-4 text-primary" aria-hidden="true" />
            {snapshot?.generatedAt ? `最近生成于 ${new Date(snapshot.generatedAt).toLocaleString("zh-CN")}` : "暂无生成记录"}
          </div>
        </div>

        <ReportRangeControls
          range={range}
          onChange={setRange}
          title="时间范围"
          description="切换查看不同时间段的洞察、趋势和最近记录。"
        />

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {templates.map((report) => (
            <article key={report.id} className="app-surface flex h-full flex-col p-6">
              <p className="text-sm font-semibold text-primary">{report.status}</p>
              <h3 className="mt-2 text-xl font-semibold text-slate-900">{report.name}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{report.range}</p>
              <button
                type="button"
                onClick={() => void handleGenerateReport()}
                className="mt-5 inline-flex h-11 items-center justify-center rounded-[16px] bg-gradient-to-r from-blue-600 to-violet-600 px-4 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(67,56,202,0.24)] disabled:cursor-not-allowed disabled:opacity-70"
                disabled={exporting !== null}
              >
                <ReportIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                {exporting === "pdf" ? "生成中..." : "生成报告"}
              </button>
            </article>
          ))}
        </section>

        <section className="app-surface p-5 sm:p-6">
          <h3 className="text-lg font-semibold text-slate-900">报告上下文</h3>
          <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
            <span>用户：{currentUser?.displayName ?? "测试用户"}</span>
            <span>当前计划：{currentPlan?.nameSnapshot ?? "未激活计划"}</span>
            <span>状态：{currentPlan?.status ?? "无"}</span>
          </div>
        </section>

        <RecentRecordsAccordion
          title="最近训练记录"
          subtitle={records.length > 0 ? "来自当前筛选范围" : "暂无训练记录"}
          emptyText="当前范围内还没有训练记录，完成一次训练后这里会自动更新。"
          records={records}
        />
      </section>
    </div>
  );
}
