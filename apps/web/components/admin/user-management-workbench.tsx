"use client";

import { useEffect, useMemo, useState } from "react";
import type { AdminUserSummary } from "@prosbymax/types";
import { loadAdminUserSummaries } from "@/lib/admin-users";
import { StatCard } from "@/components/stat-card";

export function UserManagementWorkbench() {
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    void loadAdminUserSummaries().then((nextUsers) => {
      if (!cancelled) setUsers(nextUsers ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return users;
    return users.filter((entry) =>
      [entry.user.displayName, entry.user.email ?? "", entry.user.role, entry.plan?.nameSnapshot ?? "", entry.plan?.status ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(normalized)
    );
  }, [query, users]);

  const adminCount = users.filter((entry) => entry.user.role === "admin").length;
  const activePlanCount = users.filter((entry) => entry.plan?.status === "active").length;

  return (
    <div className="space-y-8">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <StatCard label="用户总数" value={users.length} tone="blue" />
        <StatCard label="管理员" value={adminCount} tone="green" />
        <StatCard label="活跃计划" value={activePlanCount} tone="violet" />
      </section>

      <section className="rounded-app border border-border bg-white p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold">用户列表</h3>
            <p className="mt-1 text-sm text-muted">查看账户、计划和最近训练情况。</p>
          </div>
          <input
            className="h-11 w-full rounded-app border border-border px-3 text-sm md:w-80"
            placeholder="搜索姓名、邮箱、计划或角色"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </section>

      <section className="grid gap-6">
        {filteredUsers.map((entry) => (
          <article key={entry.user.id} className="rounded-app border border-border bg-white p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-semibold">{entry.user.displayName}</h3>
                  <span className="rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted">
                    {entry.user.role === "admin" ? "管理员" : entry.user.role === "clinician" ? "临床人员" : "普通用户"}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted">{entry.user.email ?? "未填写邮箱"}</p>
                <p className="mt-1 text-sm text-muted">
                  注册：{new Date(entry.user.createdAt).toLocaleDateString("zh-CN")} · 更新：{new Date(entry.user.updatedAt).toLocaleString("zh-CN")}
                </p>
              </div>
              <div className="grid gap-3 text-sm text-muted md:text-right">
                <span>计划：{entry.plan?.nameSnapshot ?? "未激活"}</span>
                <span>
                  完成 {entry.plan?.completedSessions ?? 0} / {entry.plan?.totalSessions ?? 0}
                </span>
                <span>状态：{entry.plan?.status ?? "无"}</span>
              </div>
            </div>

            <div className="mt-5 grid gap-3 border-t border-border pt-5 md:grid-cols-3">
              <div className="rounded-app border border-border bg-slate-50 p-4">
                <p className="text-xs text-muted">训练次数</p>
                <p className="mt-1 text-lg font-semibold">{entry.trainingCount}</p>
              </div>
              <div className="rounded-app border border-border bg-slate-50 p-4">
                <p className="text-xs text-muted">最近训练</p>
                <p className="mt-1 text-sm font-semibold">{entry.recentTrainingLabel ?? "暂无记录"}</p>
                <p className="mt-1 text-xs text-muted">
                  {entry.recentTrainingAt ? new Date(entry.recentTrainingAt).toLocaleString("zh-CN") : "—"}
                </p>
              </div>
              <div className="rounded-app border border-border bg-slate-50 p-4">
                <p className="text-xs text-muted">计划 ID</p>
                <p className="mt-1 text-sm font-semibold">{entry.plan?.id ?? "未激活"}</p>
              </div>
            </div>
          </article>
        ))}

        {filteredUsers.length === 0 ? (
          <section className="rounded-app border border-border bg-white p-6 text-sm text-muted">没有匹配到用户。</section>
        ) : null}
      </section>
    </div>
  );
}
