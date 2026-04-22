"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { summarizeRecords } from "@prosbymax/core";
import type { AccountSnapshot, AppUser, PlanTemplate, PlanInstanceEvent, TrainingRecord, UserPlan } from "@prosbymax/types";
import { logoutFromApi, loadCurrentUserFromApi, notifyAuthChanged, updateCurrentUserProfile } from "@/lib/auth";
import { loadAccountSnapshot } from "@/lib/account";
import { PlanProgressCard } from "@/components/plan-progress-card";
import { StatCard } from "@/components/stat-card";
import { addPlanToAccount, leaveCurrentPlan, switchActivePlan } from "@/lib/account";
import { AccountIcon, ArrowRightIcon, ClockIcon, PlanIcon, ReportIcon, UsersIcon } from "@/components/app-icons";

export function AccountPanel() {
  const [snapshot, setSnapshot] = useState<AccountSnapshot | null>(null);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [planBusyId, setPlanBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void loadCurrentUserFromApi().then((user) => {
      if (!cancelled) setCurrentUser(user);
    });
    void loadAccountSnapshot().then((nextSnapshot) => {
      if (cancelled) return;
      setSnapshot(nextSnapshot);
      if (nextSnapshot?.currentUser) {
        setCurrentUser(nextSnapshot.currentUser);
        setDisplayName(nextSnapshot.currentUser.displayName);
        setEmail(nextSnapshot.currentUser.email ?? "");
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  async function saveProfile() {
    setSaving(true);
    setMessage(null);

    const updated = await updateCurrentUserProfile({
      displayName: displayName.trim(),
      email: email.trim()
    });

    setSaving(false);

    if (!updated) {
      setMessage("保存失败，请确认已登录后重试。");
      return;
    }

    setCurrentUser(updated);
    notifyAuthChanged();
    setMessage("资料已更新。");
  }

  async function logout() {
    const ok = await logoutFromApi();
    if (!ok) return;

    setCurrentUser(null);
    setSnapshot(null);
    notifyAuthChanged();
  }

  async function addPlan(templateId: string) {
    setPlanBusyId(templateId);
    setMessage(null);
    const updated = await addPlanToAccount(templateId);
    setPlanBusyId(null);
    if (!updated) {
      setMessage("加入计划失败，请稍后重试。");
      return;
    }

    setMessage("已加入并切换到新计划。");
    void loadAccountSnapshot().then((nextSnapshot) => {
      if (nextSnapshot) setSnapshot(nextSnapshot);
    });
  }

  async function activatePlan(planId: string) {
    setPlanBusyId(planId);
    setMessage(null);
    const updated = await switchActivePlan(planId);
    setPlanBusyId(null);
    if (!updated) {
      setMessage("切换计划失败，请稍后重试。");
      return;
    }

    setMessage("已切换到该计划。");
    void loadAccountSnapshot().then((nextSnapshot) => {
      if (nextSnapshot) setSnapshot(nextSnapshot);
    });
  }

  async function exitPlan() {
    if (!snapshot?.currentPlan) return;
    setPlanBusyId(snapshot.currentPlan.id);
    setMessage(null);
    const updated = await leaveCurrentPlan();
    setPlanBusyId(null);
    if (!updated) {
      setMessage("当前计划暂时不能直接退出，请先加入其他计划再试。");
      return;
    }

    setMessage("已退出当前计划。");
    void loadAccountSnapshot().then((nextSnapshot) => {
      if (nextSnapshot) setSnapshot(nextSnapshot);
    });
  }

  const recentRecords: TrainingRecord[] = snapshot?.recentRecords ?? [];
  const enrolledPlans: UserPlan[] = snapshot?.enrolledPlans ?? [];
  const allTemplates: PlanTemplate[] = snapshot?.availablePlanTemplates ?? [];
  const availableTemplates: PlanTemplate[] = allTemplates.filter((template) => template.status === "active");
  const planEvents: PlanInstanceEvent[] = snapshot?.planEvents ?? [];
  const currentPlanTemplate = snapshot?.currentPlan ? allTemplates.find((template) => template.id === snapshot.currentPlan?.templateId) ?? null : null;
  const stats = summarizeRecords(recentRecords);

  if (!currentUser) {
    return (
      <section className="app-shell py-10">
        <section className="app-surface p-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
            <AccountIcon className="h-4 w-4" aria-hidden="true" />
            个人中心
          </div>
          <h2 className="mt-2 text-[2.15rem] font-semibold tracking-tight text-slate-900">请先登录</h2>
          <p className="mt-3 max-w-2xl text-[15px] leading-7 text-slate-600">
            登录后你可以查看和修改自己的资料、查看当前计划以及最近训练记录。
          </p>
          <div className="mt-5 flex gap-3">
            <Link className="app-btn-primary h-11 px-4" href="/auth">
              <ArrowRightIcon className="mr-2 h-4 w-4" aria-hidden="true" />
              去登录
            </Link>
            <Link className="app-btn-secondary h-11 px-4" href="/">
              <PlanIcon className="mr-2 h-4 w-4" aria-hidden="true" />
              返回首页
            </Link>
          </div>
        </section>
      </section>
    );
  }

  return (
    <section className="app-shell py-8 lg:py-10">
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <aside className="app-hero flex flex-col justify-between overflow-hidden p-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
              <AccountIcon className="h-4 w-4" aria-hidden="true" />
              个人中心
            </div>
            <div className="mt-10 flex flex-col items-center text-center">
              <div className="flex h-28 w-28 items-center justify-center rounded-full bg-white/18 text-4xl font-semibold text-white shadow-[0_18px_40px_rgba(15,23,42,0.12)]">
                {currentUser.displayName.slice(0, 1).toUpperCase()}
              </div>
              <h2 className="mt-6 text-[2rem] font-semibold tracking-tight text-white">{currentUser.displayName}</h2>
              <p className="mt-1 text-sm text-white/80">{currentUser.role === "admin" ? "管理员" : "普通用户"}</p>
            </div>

            <div className="mt-8 space-y-3">
              <div className="flex items-center gap-3 rounded-[18px] bg-white/12 px-4 py-3 text-sm text-white/90">
                <UsersIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{currentUser.email ?? "未填写邮箱"}</span>
              </div>
              <div className="flex items-center gap-3 rounded-[18px] bg-white/12 px-4 py-3 text-sm text-white/90">
                <ClockIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                注册：{new Date(currentUser.createdAt).toLocaleDateString("zh-CN")}
              </div>
              <div className="flex items-center gap-3 rounded-[18px] bg-white/12 px-4 py-3 text-sm text-white/90">
                <ReportIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                最近登录：{new Date(currentUser.updatedAt).toLocaleString("zh-CN")}
              </div>
            </div>
          </div>

        </aside>

        <section className="space-y-6">
          <section className="app-surface p-6">
            <p className="text-sm font-semibold text-primary">账户资料</p>
            <h2 className="mt-2 text-[2.15rem] font-semibold tracking-tight text-slate-900">个人中心</h2>
            <p className="mt-3 max-w-3xl text-[15px] leading-7 text-slate-600">
              这里维护你的姓名、邮箱、当前训练归属，以及你加入和退出计划的完整状态。
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">姓名</span>
                <input
                  className="app-input mt-2"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">邮箱</span>
                <input
                  className="app-input mt-2"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="app-btn-primary h-11 px-5"
                disabled={saving}
                onClick={() => void saveProfile()}
              >
                {saving ? "保存中..." : "保存资料"}
              </button>
              <button
                type="button"
                className="app-btn-secondary h-11 px-5"
                onClick={() => void logout()}
              >
                退出登录
              </button>
              {message ? <p className="text-sm text-slate-500">{message}</p> : null}
            </div>
          </section>

          <section id="plans" className="space-y-6">
            <PlanProgressCard plan={snapshot?.currentPlan ?? null} trainingItems={currentPlanTemplate?.trainings ?? []} />

            <section className="app-surface p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">已加入计划</h3>
                <p className="mt-1 text-sm text-slate-500">查看已加入和当前激活的计划，必要时可以切换。</p>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {enrolledPlans.length > 0 ? (
                enrolledPlans.map((plan) => {
                  const active = snapshot?.currentPlan?.id === plan.id;
                  return (
                    <div key={plan.id} className="rounded-[22px] border border-slate-200 bg-slate-50/80 p-5 shadow-[0_8px_18px_rgba(15,23,42,0.04)]">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-[15px] font-semibold text-slate-900">{plan.nameSnapshot}</p>
                          <p className="mt-1 text-sm text-slate-500">
                            {plan.completedSessions} / {plan.totalSessions} 次 · {plan.status}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {!active ? (
                            <button
                              type="button"
                              className="app-btn-secondary h-9 px-3"
                              disabled={planBusyId === plan.id}
                              onClick={() => void activatePlan(plan.id)}
                            >
                              {planBusyId === plan.id ? "处理中..." : "设为当前"}
                            </button>
                          ) : (
                            <span className="inline-flex h-9 items-center rounded-full bg-emerald-100 px-3 text-sm font-semibold text-emerald-700">
                              当前计划
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-slate-500">还没有加入任何计划。</p>
              )}
            </div>
            </section>

            <section className="app-surface p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">可加入计划</h3>
                <p className="mt-1 text-sm text-slate-500">从管理员开启的模板里挑选新的训练计划。</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3">
              {availableTemplates.map((template) => (
                <article key={template.id} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-2">
                      <p className="text-[15px] font-semibold text-slate-900">{template.name}</p>
                      <p className="text-sm leading-6 text-slate-600">{template.description}</p>
                      <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1">{template.durationWeeks} 周</span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1">每周 {template.sessionsPerWeek} 次</span>
                        <span className="rounded-full bg-slate-100 px-2.5 py-1">{template.sessionDurationText}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="app-btn-primary h-10 px-4"
                      disabled={planBusyId === template.id}
                      onClick={() => void addPlan(template.id)}
                    >
                      {planBusyId === template.id ? "处理中..." : "加入并切换"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
            {availableTemplates.length === 0 ? <p className="mt-3 text-sm text-slate-500">当前没有可加入的计划模板，请联系管理员开启模板。</p> : null}
            </section>

            <section className="app-surface overflow-hidden">
            <div className="border-b border-slate-200/80 px-6 py-4">
              <h3 className="text-lg font-semibold text-slate-900">计划时间线</h3>
              <p className="mt-1 text-sm text-slate-500">记录你加入、切换和退出计划的历史动作。</p>
            </div>
            <div className="divide-y divide-slate-200/80">
              {planEvents.length > 0 ? (
                planEvents.slice(0, 8).map((event) => (
                  <div key={event.id} className="grid gap-2 px-6 py-4 md:grid-cols-[1fr_auto] md:items-center">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {event.type === "joined" ? "加入计划" : event.type === "activated" ? "切换当前计划" : "退出计划"}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {event.templateName ?? event.templateId ?? "未知计划"}
                        {event.notes ? ` · ${event.notes}` : ""}
                      </p>
                    </div>
                    <p className="text-sm text-slate-500">{new Date(event.createdAt).toLocaleString("zh-CN")}</p>
                  </div>
                ))
              ) : (
                <div className="px-6 py-8 text-sm text-slate-500">还没有计划动作记录。</div>
              )}
            </div>
            </section>
          </section>

          <section className="grid gap-3 md:grid-cols-4">
            <StatCard label="训练次数" value={stats.totalSessions} tone="blue" />
            <StatCard label="最高分" value={stats.highestScore} tone="green" />
            <StatCard label="总时长" value={`${Math.round(stats.totalDurationSec / 60)}m`} tone="violet" />
            <StatCard label="平均分" value={stats.averageScore} tone="amber" />
          </section>

          <section className="app-surface overflow-hidden">
            <div className="border-b border-slate-200/80 px-6 py-4">
              <h3 className="text-lg font-semibold text-slate-900">最近训练记录</h3>
            </div>
            <div className="divide-y divide-slate-200/80">
              {recentRecords.length > 0 ? (
                recentRecords.map((record) => (
                  <div key={record.id} className="grid gap-2 px-6 py-5 md:grid-cols-[1fr_auto_auto] md:items-center">
                    <div>
                      <h4 className="text-[15px] font-semibold text-slate-900">{record.trainingLabel}</h4>
                      <p className="mt-1 text-sm text-slate-500">{new Date(record.startedAt).toLocaleString("zh-CN")}</p>
                    </div>
                    <span className="text-sm text-slate-600">得分 {record.score}</span>
                    <span className="text-sm text-slate-600">{record.durationSec} 秒</span>
                  </div>
                ))
              ) : (
                <div className="px-6 py-8 text-sm text-slate-500">还没有训练记录。</div>
              )}
            </div>
          </section>
        </section>
      </div>
    </section>
  );
}
