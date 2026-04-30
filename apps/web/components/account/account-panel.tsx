"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { summarizeRecords } from "@prosbymax/core";
import type { AccountSnapshot, AppUser, PlanTemplate, PlanInstanceEvent, TrainingRecord, UserPlan } from "@prosbymax/types";
import { logoutFromApi, loadCurrentUserFromApi, notifyAuthChanged, updateCurrentUserProfile } from "@/lib/auth";
import { loadAccountSnapshot } from "@/lib/account";
import { subscribeTrainingRecords } from "@/lib/training-records";
import { PlanProgressCard } from "@/components/plan-progress-card";
import { StatCard } from "@/components/stat-card";
import { addPlanToAccount, leaveCurrentPlan, switchActivePlan } from "@/lib/account";
import { AccountIcon, ArrowRightIcon, ChevronDownIcon, ClockIcon, PlanIcon, ReportIcon, UsersIcon } from "@/components/app-icons";

const genderOptions = [
  { value: "male", label: "男" },
  { value: "female", label: "女" },
  { value: "other", label: "其他" }
] as const;

const surgeryTypeOptions = [
  { value: "smile", label: "Smile全飞秒" },
  { value: "lisk", label: "LASIK半飞秒" },
  { value: "prosbymax", label: "ProsbyMax 迈可视" },
  { value: "mcl", label: "MCL 多焦点隐形眼镜" }
] as const;

function formatDateOnly(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (input: number) => String(input).padStart(2, "0");
  return [date.getFullYear(), "-", pad(date.getMonth() + 1), "-", pad(date.getDate())].join("");
}

function parseDateOnly(value: string) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function AccountPanel() {
  const [snapshot, setSnapshot] = useState<AccountSnapshot | null>(null);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [surgeryType, setSurgeryType] = useState("");
  const [surgeryAt, setSurgeryAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [planBusyId, setPlanBusyId] = useState<string | null>(null);
  const snapshotSeqRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    void loadCurrentUserFromApi().then((user) => {
      if (cancelled) return;
      setCurrentUser(user);
      if (user) {
        setDisplayName(user.displayName);
        setEmail(user.email ?? "");
        setAge(user.age !== null && user.age !== undefined ? String(user.age) : "");
        setGender(user.gender ?? "");
        setSurgeryType(user.surgeryType ?? "");
        setSurgeryAt(formatDateOnly(user.surgeryAt));
      }
    });
    const reloadSnapshot = () => {
      const seq = ++snapshotSeqRef.current;
      void loadAccountSnapshot().then((nextSnapshot) => {
        if (cancelled || seq !== snapshotSeqRef.current) return;
        setSnapshot(nextSnapshot);
        if (nextSnapshot?.currentUser) {
          setCurrentUser(nextSnapshot.currentUser);
          setDisplayName(nextSnapshot.currentUser.displayName);
          setEmail(nextSnapshot.currentUser.email ?? "");
          setAge(nextSnapshot.currentUser.age !== null && nextSnapshot.currentUser.age !== undefined ? String(nextSnapshot.currentUser.age) : "");
          setGender(nextSnapshot.currentUser.gender ?? "");
          setSurgeryType(nextSnapshot.currentUser.surgeryType ?? "");
          setSurgeryAt(formatDateOnly(nextSnapshot.currentUser.surgeryAt));
        }
      });
    };

    reloadSnapshot();
    const unsubscribe = subscribeTrainingRecords(reloadSnapshot);

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  async function saveProfile() {
    setSaving(true);
    setMessage(null);

    const updated = await updateCurrentUserProfile({
      displayName: displayName.trim(),
      age: age.trim() ? Number(age.trim()) : null,
      gender: gender || null,
      surgeryType: surgeryType || null,
      surgeryAt: parseDateOnly(surgeryAt)
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

  const trainingRecords: TrainingRecord[] = snapshot?.recentRecords ?? [];
  const recentRecords = trainingRecords.slice(0, 8);
  const enrolledPlans: UserPlan[] = snapshot?.enrolledPlans ?? [];
  const allTemplates: PlanTemplate[] = snapshot?.availablePlanTemplates ?? [];
  const availableTemplates: PlanTemplate[] = allTemplates.filter((template) => template.status === "active");
  const planEvents: PlanInstanceEvent[] = snapshot?.planEvents ?? [];
  const currentPlanTemplate = snapshot?.currentPlan ? allTemplates.find((template) => template.id === snapshot.currentPlan?.templateId) ?? null : null;
  const stats = summarizeRecords(trainingRecords);

  if (!currentUser) {
    return (
      <section className="app-shell py-6 sm:py-8 lg:py-10">
        <section className="app-surface p-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
            <AccountIcon className="h-4 w-4" aria-hidden="true" />
            个人中心
          </div>
          <h2 className="mt-2 text-[2.15rem] font-semibold tracking-tight text-slate-900">请先登录</h2>
          <p className="mt-3 max-w-2xl text-[15px] leading-7 text-slate-600">
            登录后你可以查看和修改自己的资料、查看当前计划以及最近训练记录。
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Link className="app-btn-primary h-11 w-full px-4 sm:w-auto" href="/auth">
              <ArrowRightIcon className="mr-2 h-4 w-4" aria-hidden="true" />
              去登录
            </Link>
            <Link className="app-btn-secondary h-11 w-full px-4 sm:w-auto" href="/">
              <PlanIcon className="mr-2 h-4 w-4" aria-hidden="true" />
              返回首页
            </Link>
          </div>
        </section>
      </section>
    );
  }

  return (
      <section className="app-shell py-6 sm:py-8 lg:py-10">
      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <aside className="app-hero overflow-hidden p-4 sm:p-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/80 sm:text-xs">
              <AccountIcon className="h-4 w-4" aria-hidden="true" />
              个人中心
            </div>
            <div className="mt-5 flex items-center gap-4 text-left sm:mt-10 sm:flex-col sm:items-center sm:text-center">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white/18 text-2xl font-semibold text-white shadow-[0_18px_40px_rgba(15,23,42,0.12)] sm:h-28 sm:w-28 sm:text-4xl">
                {currentUser.displayName.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-[1.25rem] font-semibold tracking-tight text-white sm:mt-6 sm:text-[2rem]">{currentUser.displayName}</h2>
                <p className="mt-1 text-[13px] text-white/80 sm:text-sm">{currentUser.role === "admin" ? "管理员" : "普通用户"}</p>
              </div>
            </div>

            <div className="mt-5 grid gap-2 sm:mt-8 sm:space-y-3">
              <div className="flex items-center gap-3 rounded-[16px] bg-white/12 px-3 py-2.5 text-[13px] text-white/90 sm:px-4 sm:py-3 sm:text-sm">
                <UsersIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 truncate">{currentUser.email ?? "未填写邮箱"}</span>
              </div>
              <div className="hidden items-center gap-3 rounded-[16px] bg-white/12 px-3 py-2.5 text-[13px] text-white/90 sm:flex sm:px-4 sm:py-3 sm:text-sm">
                <ClockIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                注册：{new Date(currentUser.createdAt).toLocaleDateString("zh-CN")}
              </div>
              <div className="flex items-center gap-3 rounded-[16px] bg-white/12 px-3 py-2.5 text-[13px] text-white/90 sm:px-4 sm:py-3 sm:text-sm">
                <ReportIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="hidden sm:inline">最近登录：</span>
                <span className="sm:hidden">登录：</span>
                {new Date(currentUser.updatedAt).toLocaleString("zh-CN")}
              </div>
            </div>
          </div>

        </aside>

        <section className="space-y-6">
        <section className="app-surface p-5 sm:p-6">
            <p className="text-sm font-semibold text-primary">账户资料</p>
            <h2 className="mt-2 text-[1.45rem] font-semibold tracking-tight text-slate-900 sm:text-[2.15rem]">个人中心</h2>
            <p className="mt-3 hidden max-w-3xl text-[15px] leading-7 text-slate-600 sm:block">
              这里维护你的姓名、邮箱、当前训练归属，以及你加入和退出计划的完整状态。
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
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
                  className="app-input mt-2 bg-slate-50 text-slate-500"
                  type="email"
                  value={email}
                  readOnly
                />
                <span className="mt-2 block text-xs text-slate-400">邮箱由登录账号决定，暂不可修改。</span>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">年龄</span>
                <input
                  className="app-input mt-2"
                  inputMode="numeric"
                  type="number"
                  min="0"
                  value={age}
                  onChange={(event) => setAge(event.target.value)}
                  placeholder="例如 54"
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">性别</span>
                <select className="app-input mt-2" value={gender} onChange={(event) => setGender(event.target.value)}>
                  <option value="">请选择</option>
                  {genderOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">手术类型</span>
                <select className="app-input mt-2" value={surgeryType} onChange={(event) => setSurgeryType(event.target.value)}>
                  <option value="">请选择</option>
                  {surgeryTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block sm:col-span-2">
                <span className="text-sm font-semibold text-slate-700">手术时间</span>
                <input
                  className="app-input mt-2"
                  type="date"
                  value={surgeryAt}
                  onChange={(event) => setSurgeryAt(event.target.value)}
                />
              </label>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <button
                type="button"
                className="app-btn-primary h-11 w-full px-5 sm:w-auto"
                disabled={saving}
                onClick={() => void saveProfile()}
              >
                {saving ? "保存中..." : "保存资料"}
              </button>
              <button
                type="button"
                className="app-btn-secondary h-11 w-full px-5 sm:w-auto"
                onClick={() => void logout()}
              >
                退出登录
              </button>
              {message ? <p className="text-sm text-slate-500">{message}</p> : null}
            </div>
          </section>

          <section id="plans" className="space-y-6">
            <PlanProgressCard
              plan={snapshot?.currentPlan ?? null}
              trainingItems={currentPlanTemplate?.trainings ?? []}
              trainingRecords={snapshot?.recentRecords ?? []}
            />

            <section className="grid grid-cols-2 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <StatCard label="练习次数" value={stats.totalSessions} tone="blue" />
              <StatCard label="最高分" value={stats.highestScore} tone="green" />
              <StatCard label="总时长" value={`${Math.round(stats.totalDurationSec / 60)}m`} tone="violet" />
              <StatCard label="平均分" value={stats.averageScore} tone="amber" />
            </section>

            <section className="app-surface p-5 sm:p-6">
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
                              className="app-btn-secondary h-9 w-full px-3 sm:w-auto"
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

            <section className="app-surface p-5 sm:p-6">
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
                      className="app-btn-primary h-10 w-full px-4 sm:w-auto"
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

            <details className="group app-surface overflow-hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">计划时间线</h3>
                  <p className="mt-1 text-sm text-slate-500">记录你加入、切换和退出计划的历史动作。</p>
                </div>
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition group-open:rotate-180">
                  <ChevronDownIcon className="h-4 w-4" aria-hidden="true" />
                </span>
              </summary>
              <div className="border-t border-slate-200/80">
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
              </div>
            </details>
          </section>

          <details className="group app-surface overflow-hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">最近训练记录</h3>
                <p className="mt-1 text-sm text-slate-500">只保留最近几次训练的简要信息，需要时再展开查看。</p>
              </div>
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition group-open:rotate-180">
                <ChevronDownIcon className="h-4 w-4" aria-hidden="true" />
              </span>
            </summary>
            <div className="border-t border-slate-200/80">
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
            </div>
          </details>
        </section>
      </div>
    </section>
  );
}
