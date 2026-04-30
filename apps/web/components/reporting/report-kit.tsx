"use client";

import type { ReportRange, ReportSnapshot } from "@prosbymax/types";
import { ChevronDownIcon, TrendUpIcon } from "@/components/app-icons";

export const reportRanges: Array<{ value: ReportRange; label: string }> = [
  { value: "7d", label: "7 天" },
  { value: "30d", label: "30 天" },
  { value: "90d", label: "90 天" },
  { value: "all", label: "全部" }
];

export function ReportRangeControls({
  range,
  onChange,
  title,
  description
}: {
  range: ReportRange;
  onChange: (range: ReportRange) => void;
  title: string;
  description: string;
}) {
  return (
    <section className="app-surface p-5 sm:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">{title}</p>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {reportRanges.map((item) => (
            <button
              key={item.value}
              type="button"
              className={[
                "inline-flex h-10 items-center justify-center rounded-[14px] px-4 text-sm font-semibold transition",
                range === item.value ? "bg-primary text-white shadow-[0_10px_22px_rgba(37,99,235,0.18)]" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              ].join(" ")}
              onClick={() => onChange(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

export function TrendChart({ snapshot }: { snapshot: ReportSnapshot | null }) {
  const points = snapshot?.trend ?? [];
  const maxSessions = Math.max(...points.map((point) => point.sessions), 1);

  return (
    <section className="app-surface p-5 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">趋势图</p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">训练趋势概览</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            {snapshot?.rangeLabel ?? "当前范围"} 内的训练次数、时长与得分分布。
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-[18px] bg-slate-50 px-3 py-2 text-xs text-slate-500">
          <TrendUpIcon className="h-4 w-4 text-primary" aria-hidden="true" />
          {points.length > 0 ? `${points.length} 个时间点` : "暂无趋势数据"}
        </div>
      </div>

      {points.length === 0 ? (
        <div className="mt-5 rounded-[20px] border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
          当前范围内还没有足够的训练记录，完成训练后会自动生成趋势数据。
        </div>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <div className="min-w-[520px]">
            <div className="grid items-end gap-3" style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}>
              {points.map((point) => {
                const height = Math.max(16, Math.round((point.sessions / maxSessions) * 120));
                return (
                  <div key={point.date} className="flex flex-col items-center gap-2">
                    <div className="flex h-36 w-full items-end rounded-[18px] bg-slate-50 px-2 py-2">
                      <div
                        className="w-full rounded-[14px] bg-gradient-to-t from-blue-600 via-cyan-500 to-violet-500 shadow-[0_10px_24px_rgba(37,99,235,0.15)]"
                        style={{ height }}
                        title={`${point.label} · ${point.sessions} 次 · ${point.averageScore} 分`}
                      />
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-semibold text-slate-900">{point.label}</p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {point.sessions} 次 · {point.durationSec} 秒
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export function RecentRecordsAccordion({
  title,
  subtitle,
  emptyText,
  records
}: {
  title: string;
  subtitle: string;
  emptyText: string;
  records: Array<{ id: string; trainingLabel: string; startedAt: string; score: number; durationSec: number }>;
}) {
  return (
    <details className="group app-surface overflow-hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition group-open:rotate-180">
          <ChevronDownIcon className="h-4 w-4" aria-hidden="true" />
        </span>
      </summary>
      <div className="border-t border-slate-200/80">
        {records.length === 0 ? (
          <div className="px-4 py-8 text-sm text-slate-500 sm:px-6">{emptyText}</div>
        ) : (
          <div className="divide-y divide-slate-200/80">
            {records.map((record) => (
              <div key={record.id} className="grid gap-2 px-4 py-4 sm:px-6 sm:py-5 md:grid-cols-[1fr_auto_auto] md:items-center">
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
      </div>
    </details>
  );
}
