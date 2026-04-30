"use client";

import { useEffect, useState } from "react";
import type { ReportRange, ReportSnapshot } from "@prosbymax/types";
import { exportReport, loadReportSnapshot } from "@/lib/reports";
import { subscribeTrainingRecords } from "@/lib/training-records";
import { StatCard } from "@/components/stat-card";
import { ArrowRightIcon, ReportIcon } from "@/components/app-icons";
import { RecentRecordsAccordion, ReportRangeControls, TrendChart } from "@/components/reporting/report-kit";

export function ReportsOverview() {
  const [snapshot, setSnapshot] = useState<ReportSnapshot | null>(null);
  const [range, setRange] = useState<ReportRange>("30d");
  const [exporting, setExporting] = useState<"json" | "pdf" | null>(null);

  useEffect(() => {
    let cancelled = false;

    const reload = () =>
      void loadReportSnapshot(range).then((nextSnapshot) => {
        if (!cancelled) setSnapshot(nextSnapshot);
      });

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
  const recentRecords = snapshot?.recentRecords ?? [];
  const stats = snapshot?.summary ?? { totalSessions: 0, totalDurationSec: 0, highestScore: 0, averageScore: 0 };

  async function handleExport(format: "json" | "pdf") {
    setExporting(format);
    const response = await exportReport(range, format);
    setExporting(null);
    if (!response) return;

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = format === "pdf" ? `prosbymax-report-${range}.pdf` : `prosbymax-report-${range}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }

  function handleGenerateReport() {
    void handleExport("pdf");
  }

  return (
    <section className="app-shell py-5 sm:py-8 lg:py-10">
      <div className="space-y-5 sm:space-y-6">
        <section className="app-hero rounded-[28px] p-5 sm:p-8 md:p-10">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-sm font-semibold text-white/85">
              <ReportIcon className="h-4 w-4" aria-hidden="true" />
              训练报告
            </div>
            <h2 className="mt-4 max-w-full text-[1.85rem] font-semibold tracking-tight text-white sm:text-[2.6rem]">生成可追溯的训练总结</h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-white/82 sm:text-[15px]">
              报告模块将从统一训练记录生成摘要、进度和详细报告，并保留导出与审计记录。
            </p>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="练习次数" value={stats.totalSessions} tone="blue" />
          <StatCard label="最高分" value={stats.highestScore} tone="green" />
          <StatCard label="总时长" value={`${Math.round(stats.totalDurationSec / 60)}m`} tone="violet" />
          <StatCard label="平均分" value={stats.averageScore} tone="amber" />
        </section>

        <TrendChart snapshot={snapshot} />

        <ReportRangeControls
          range={range}
          onChange={setRange}
          title="时间范围"
          description="切换查看不同时间段的报告、趋势和训练记录。"
        />

        <section className="app-surface p-5 sm:p-6">
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              className="app-btn-primary h-11 w-full px-4 sm:w-auto"
              disabled={exporting !== null}
              onClick={() => void handleExport("json")}
            >
              <ArrowRightIcon className="mr-2 h-4 w-4" aria-hidden="true" />
              {exporting === "json" ? "导出中..." : "导出 JSON"}
            </button>
            <button
              type="button"
              className="app-btn-secondary h-11 w-full px-4 sm:w-auto"
              disabled={exporting !== null}
              onClick={() => void handleExport("pdf")}
            >
              <ArrowRightIcon className="mr-2 h-4 w-4" aria-hidden="true" />
              {exporting === "pdf" ? "导出中..." : "导出 PDF"}
            </button>
          </div>
        </section>

        <section className="app-surface p-5 sm:p-6">
          <h3 className="text-lg font-semibold text-slate-900">报告上下文</h3>
          <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
            <span>用户：{currentUser?.displayName ?? "测试用户"}</span>
            <span>当前计划：{currentPlan?.nameSnapshot ?? "未激活计划"}</span>
            <span>状态：{currentPlan?.status ?? "无"}</span>
          </div>
          <p className="mt-4 text-sm text-slate-500">
            最近生成：{snapshot?.generatedAt ? new Date(snapshot.generatedAt).toLocaleString("zh-CN") : "暂无"} · 当前范围：{snapshot?.rangeLabel ?? "30 天"}
          </p>
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {templates.map((report) => (
            <article key={report.id} className="app-surface flex h-full flex-col p-6">
              <p className="text-sm font-semibold text-primary">{report.status}</p>
              <h3 className="mt-2 text-xl font-semibold text-slate-900">{report.name}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{report.range}</p>
              <button
                type="button"
                onClick={handleGenerateReport}
                className="mt-5 inline-flex h-11 items-center justify-center rounded-[16px] bg-gradient-to-r from-blue-600 to-violet-600 px-4 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(67,56,202,0.24)] disabled:cursor-not-allowed disabled:opacity-70"
                disabled={exporting !== null}
              >
                <ReportIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                {exporting === "pdf" ? "生成中..." : "生成报告"}
              </button>
            </article>
          ))}
        </section>

        <RecentRecordsAccordion
          title="最近训练记录"
          subtitle={recentRecords.length > 0 ? "当前筛选范围内的最近记录" : "暂无训练记录"}
          emptyText="当前还没有可生成报告的训练记录。"
          records={recentRecords}
        />
      </div>
    </section>
  );
}
