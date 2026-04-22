"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AppUser, PlanTemplate } from "@prosbymax/types";
import {
  loadCurrentUserFromApi,
  loginWithCredentials,
  notifyAuthChanged,
  logoutFromApi,
  registerWithCredentials
} from "@/lib/auth";
import { loadPlanTemplatesFromApi } from "@/lib/plan-templates";
import { AccountIcon, ArrowRightIcon, ClockIcon, PlanIcon, UsersIcon } from "@/components/app-icons";

type Mode = "login" | "register";

export function AuthPanel() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [planTemplates, setPlanTemplates] = useState<PlanTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const activePlanTemplates = planTemplates.filter((template) => template.status === "active");

  useEffect(() => {
    let cancelled = false;
    void loadCurrentUserFromApi().then((nextUser) => {
      if (!cancelled) setCurrentUser(nextUser);
    });
    void loadPlanTemplatesFromApi().then((templates) => {
      if (cancelled) return;
      const nextTemplates = templates ?? [];
      setPlanTemplates(nextTemplates);
      setSelectedTemplateId((current) => current || nextTemplates.find((template) => template.status === "active")?.id || "");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit() {
    setLoading(true);
    setMessage(null);

    const activeTemplateId = activePlanTemplates.find((template) => template.id === selectedTemplateId)?.id ?? activePlanTemplates[0]?.id ?? "";
    if (mode === "register" && !activeTemplateId) {
      setLoading(false);
      setMessage("当前没有可注册的训练计划，请联系管理员开启一个模板。");
      return;
    }

    const payload =
      mode === "login"
        ? await loginWithCredentials({ email, password })
        : await registerWithCredentials({ displayName, email, password, templateId: activeTemplateId });

    setLoading(false);

    if (!payload) {
      setMessage(mode === "login" ? "登录失败，请检查邮箱和密码。" : "注册失败，请检查输入内容。");
      return;
    }

    setCurrentUser(payload);
    notifyAuthChanged();
    router.push("/");
    router.refresh();
  }

  async function logout() {
    const ok = await logoutFromApi();
    if (!ok) return;

    setCurrentUser(null);
    notifyAuthChanged();
    router.refresh();
  }

  return (
    <section className="app-shell py-10">
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="app-hero flex flex-col justify-between overflow-hidden p-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-sm font-semibold text-white/85">
              <AccountIcon className="h-4 w-4" aria-hidden="true" />
              账号入口
            </div>
            <h2 className="mt-4 text-[2.4rem] font-semibold tracking-tight text-white">登录或创建账户</h2>
            <p className="mt-4 text-[15px] leading-7 text-white/82">
          登录后，你的训练记录、报告视图和管理员配置会按当前账号生效。注册后会自动登录。
            </p>
          </div>

          {currentUser ? (
            <div className="mt-8 rounded-[24px] bg-white/12 p-5 ring-1 ring-white/15">
              <p className="text-sm font-semibold text-white/85">当前会话</p>
              <h3 className="mt-2 text-xl font-semibold text-white">{currentUser.displayName}</h3>
              <p className="mt-1 text-sm text-white/75">{currentUser.email ?? "无邮箱"}</p>
              <p className="mt-2 text-sm text-white/75">角色：{currentUser.role === "admin" ? "管理员" : "普通用户"}</p>
              <div className="mt-5 flex gap-3">
                <button type="button" className="app-btn-secondary h-11 bg-white px-4 text-blue-700" onClick={() => router.push("/")}>
                  <ArrowRightIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                  进入应用
                </button>
                <button type="button" className="app-btn-secondary h-11 bg-white/10 px-4 text-white ring-1 ring-white/15" onClick={() => void logout()}>
                  <UsersIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                  退出登录
                </button>
              </div>
            </div>
          ) : null}
        </section>

        <section className="app-surface p-6 md:p-8">
          <div className="grid grid-cols-2 gap-2 rounded-[18px] bg-slate-100 p-1">
            <button
              type="button"
              className={["h-11 rounded-[14px] text-sm font-semibold", mode === "login" ? "bg-white text-slate-900 shadow-[0_8px_18px_rgba(15,23,42,0.06)]" : "text-slate-500"].join(" ")}
              onClick={() => setMode("login")}
            >
              登录
            </button>
            <button
              type="button"
              className={["h-11 rounded-[14px] text-sm font-semibold", mode === "register" ? "bg-white text-slate-900 shadow-[0_8px_18px_rgba(15,23,42,0.06)]" : "text-slate-500"].join(" ")}
              onClick={() => setMode("register")}
            >
              注册
            </button>
          </div>

          <div className="mt-6 space-y-4">
          {mode === "register" ? (
            <div className="space-y-4">
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">姓名</span>
                <input
                  className="app-input mt-2"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="输入你的姓名"
                />
              </label>

              <div className="space-y-3">
                <p className="text-sm font-semibold text-slate-700">选择训练计划</p>
                <div className="grid gap-3">
                  {activePlanTemplates.map((template) => {
                    const selected = template.id === selectedTemplateId;
                    return (
                      <button
                        key={template.id}
                        type="button"
                        className={[
                          "rounded-[22px] border p-4 text-left transition",
                          selected ? "border-blue-200 bg-blue-50 shadow-[0_10px_24px_rgba(37,99,235,0.08)]" : "border-slate-200 bg-white"
                        ].join(" ")}
                        onClick={() => setSelectedTemplateId(template.id)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-900">{template.name}</p>
                            <p className="mt-1 text-sm text-slate-500">{template.description}</p>
                          </div>
                          <span className="text-xs font-semibold text-primary">{template.durationWeeks} 周</span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                          <span>每周 {template.sessionsPerWeek} 次</span>
                          <span>{template.sessionDurationText}</span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs">
                          {template.trainings.map((training) => (
                            <span key={training.id} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-500">
                              {training.id}
                            </span>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {activePlanTemplates.length === 0 ? (
                  <p className="text-sm text-slate-500">当前没有可注册的训练计划，请联系管理员开启一个模板。</p>
                ) : null}
              </div>
            </div>
          ) : null}

          <label className="block">
            <span className="text-sm font-semibold text-slate-700">邮箱</span>
            <input
              className="app-input mt-2"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-700">密码</span>
            <input
              className="app-input mt-2"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="至少 6 位更好"
            />
          </label>

          <button
            className="app-btn-primary h-11 w-full px-4"
            disabled={loading}
            onClick={() => void submit()}
          >
            <PlanIcon className="mr-2 h-4 w-4" aria-hidden="true" />
            {loading ? "处理中..." : mode === "login" ? "登录" : "创建账户"}
          </button>

          {message ? <p className="text-sm text-danger">{message}</p> : null}
          </div>
        </section>

        <section className="space-y-6">
          <section className="app-surface p-6">
            <h3 className="text-lg font-semibold text-slate-900">本地演示账号</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">为了方便测试，先准备了两个本地账户。</p>
            <div className="mt-4 grid gap-3 text-sm text-slate-600">
              <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                <p className="flex items-center gap-2 font-semibold text-slate-900">
                  <UsersIcon className="h-4 w-4 text-primary" aria-hidden="true" />
                  普通用户
                </p>
                <p className="mt-1">邮箱：demo@prosbymax.local</p>
                <p>密码：demo1234</p>
              </div>
              <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                <p className="flex items-center gap-2 font-semibold text-slate-900">
                  <ClockIcon className="h-4 w-4 text-primary" aria-hidden="true" />
                  管理员
                </p>
                <p className="mt-1">邮箱：admin@prosbymax.local</p>
                <p>密码：admin1234</p>
              </div>
            </div>
          </section>

          <section className="app-surface p-6">
            <h3 className="text-lg font-semibold text-slate-900">这一步的意义</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              登录后，训练记录会绑定账号，管理员配置会受到权限控制，后面我们再接真正的用户计划和报告导出，会顺很多。
            </p>
          </section>
        </section>
      </div>
    </section>
  );
}
