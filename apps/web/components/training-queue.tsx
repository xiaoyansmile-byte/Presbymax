import Link from "next/link";
import { trainingLabels } from "@prosbymax/core";
import type { TodayTraining } from "@prosbymax/types";
import { CheckIcon, PlayIcon, TargetIcon } from "@/components/app-icons";
import { StatusPill } from "./status-pill";

export function TrainingQueue({ trainings }: { trainings: TodayTraining[] }) {
  return (
    <section className="app-surface overflow-hidden">
      <div className="border-b border-slate-200/80 px-6 py-4">
        <h2 className="text-lg font-semibold text-slate-900">训练队列</h2>
        <p className="mt-1 text-sm text-slate-500">按当前计划依次完成今天的训练项目。</p>
      </div>
      {trainings.length === 0 ? (
        <div className="px-6 py-8 text-sm text-slate-500">当前计划里还没有安排今天的训练项目。</div>
      ) : (
        <div className="divide-y divide-slate-200/80">
          {trainings.map((training) => (
            <div key={training.id} className="grid gap-4 px-6 py-5 md:grid-cols-[1fr_auto_auto] md:items-center">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] bg-blue-50 text-primary ring-1 ring-blue-100">
                  <TargetIcon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-[15px] font-semibold text-slate-900">{trainingLabels[training.id]}</h3>
                  <p className="mt-1 text-sm text-slate-500">预计 {training.duration}</p>
                </div>
              </div>
              <StatusPill status={training.status} />
              {training.status === "ready" ? (
                <Link
                  className="app-btn-primary h-10 px-4"
                  href={`/train/${training.id}`}
                >
                  <PlayIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                  进入训练
                </Link>
              ) : (
                <button className="app-btn-secondary h-10 px-4 text-slate-500" disabled>
                  <CheckIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                  查看结果
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
