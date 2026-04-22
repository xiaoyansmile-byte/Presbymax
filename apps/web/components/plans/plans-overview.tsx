"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { AccountSnapshot, UserPlan } from "@prosbymax/types";
import { loadAccountSnapshot } from "@/lib/account";
import { PlanProgressCard } from "@/components/plan-progress-card";
import { ArrowRightIcon, PlanIcon } from "@/components/app-icons";

export function PlansOverview() {
  const [snapshot, setSnapshot] = useState<AccountSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadAccountSnapshot().then((nextSnapshot) => {
      if (!cancelled) setSnapshot(nextSnapshot);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const currentPlan = snapshot?.currentPlan ?? null;
  const enrolledPlans: UserPlan[] = snapshot?.enrolledPlans ?? [];
  const currentPlanTemplate = snapshot?.availablePlanTemplates.find((template) => template.id === currentPlan?.templateId) ?? null;

  return (
    <section className="app-shell py-8 lg:py-10">
      <div className="space-y-6">
        <section className="app-hero rounded-[30px] p-8 md:p-10">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-sm font-semibold text-white/85">
              <PlanIcon className="h-4 w-4" aria-hidden="true" />
              我的计划
            </div>
            <h2 className="mt-4 text-[2.6rem] font-semibold tracking-tight text-white">查看当前计划与加入的项目</h2>
            <p className="mt-4 max-w-3xl text-[15px] leading-7 text-white/82">
              这里只展示当前账号已经加入的训练计划。若要添加新计划或切换当前计划，请到账户页操作。
            </p>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[0.86fr_1.14fr]">
          <PlanProgressCard plan={currentPlan} trainingItems={currentPlanTemplate?.trainings ?? []} />

          <section className="space-y-6">
            {currentPlan ? (
              <section className="app-surface p-6">
                <p className="text-sm font-semibold text-primary">当前计划</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{currentPlan.nameSnapshot}</h3>
                <p className="mt-3 text-[15px] leading-7 text-slate-600">
                  {currentPlan.completedSessions} / {currentPlan.totalSessions} 次 · {currentPlan.status}
                </p>
                <div className="mt-5">
                  <Link className="app-btn-primary h-11 px-4" href="/train/gabor-match">
                    <ArrowRightIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                    继续训练
                  </Link>
                </div>
              </section>
            ) : (
              <section className="app-surface p-6">
                <p className="text-sm font-semibold text-primary">当前计划</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">暂未激活</h3>
                <p className="mt-3 text-[15px] leading-7 text-slate-600">你还没有激活计划，请先到账户页加入一个训练计划。</p>
                <div className="mt-5">
                  <Link className="app-btn-primary h-11 px-4" href="/account">
                    <ArrowRightIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                    去账户页选择
                  </Link>
                </div>
              </section>
            )}

            <section className="app-surface p-6">
              <h3 className="text-lg font-semibold text-slate-900">已加入计划</h3>
              <div className="mt-4 space-y-3">
                {enrolledPlans.length > 0 ? (
                  enrolledPlans.map((plan) => {
                    const active = currentPlan?.id === plan.id;
                    return (
                      <article key={plan.id} className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-4 shadow-[0_8px_18px_rgba(15,23,42,0.04)]">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="text-[15px] font-semibold text-slate-900">{plan.nameSnapshot}</p>
                            <p className="mt-1 text-sm text-slate-500">
                              {plan.completedSessions} / {plan.totalSessions} 次 · {plan.status}
                            </p>
                          </div>
                          <span className="inline-flex h-9 items-center rounded-full bg-white px-3 text-sm font-semibold text-primary shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
                            {active ? "当前计划" : "已加入"}
                          </span>
                        </div>
                      </article>
                    );
                  })
                ) : (
                  <p className="text-sm text-slate-500">还没有任何计划记录。</p>
                )}
              </div>
            </section>
          </section>
        </div>
      </div>
    </section>
  );
}
