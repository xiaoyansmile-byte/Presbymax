"use client";

import { useEffect, useState } from "react";
import type { ComponentType, SVGProps } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { AppUser } from "@prosbymax/types";
import { loadCurrentUserFromApi, logoutFromApi, notifyAuthChanged, subscribeAuthChanges } from "@/lib/auth";
import { AccountIcon, AnalyticsIcon, HomeIcon, SettingsIcon, TemplateIcon, UsersIcon } from "@/components/app-icons";

type NavIcon = ComponentType<SVGProps<SVGSVGElement>>;

type NavItem = {
  label: string;
  href: string;
  icon: NavIcon;
};

const baseNavItems: NavItem[] = [
  { label: "今日训练", href: "/", icon: HomeIcon },
  { label: "个人中心", href: "/account", icon: AccountIcon },
  { label: "训练洞察", href: "/analytics", icon: AnalyticsIcon }
];

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);

  useEffect(() => {
    let cancelled = false;

    void loadCurrentUserFromApi().then((nextUser) => {
      if (!cancelled) setCurrentUser(nextUser);
    });

    const unsubscribe = subscribeAuthChanges(() => {
      void loadCurrentUserFromApi().then((nextUser) => {
        if (!cancelled) setCurrentUser(nextUser);
      });
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  async function logout() {
    const ok = await logoutFromApi();
    if (!ok) return;

    setCurrentUser(null);
    notifyAuthChanged();
    router.push("/auth");
    router.refresh();
  }

  const navItems: NavItem[] = currentUser?.role === "admin"
    ? [
        ...baseNavItems,
        { label: "用户管理", href: "/admin/users", icon: UsersIcon },
        { label: "计划模板", href: "/admin/plans", icon: TemplateIcon },
        { label: "训练配置", href: "/admin/training-config", icon: SettingsIcon }
      ]
    : baseNavItems;

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-white/60 bg-white/85 backdrop-blur-xl">
        <div className="app-shell">
          <div className="flex flex-col gap-4 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 text-lg font-bold text-white shadow-[0_14px_30px_rgba(37,99,235,0.24)]">
                PM
              </div>
              <div>
                <h1 className="text-[1.9rem] font-semibold tracking-tight text-slate-900">PresbyMaxMCL</h1>
                <p className="text-sm text-slate-500">Vision Training</p>
              </div>
            </div>

            <nav className="flex flex-nowrap items-center gap-2 overflow-x-auto lg:justify-center">
              {navItems.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    className={[
                      "app-nav-pill shrink-0 gap-2 whitespace-nowrap",
                      active ? "app-nav-pill-active" : "app-nav-pill-inactive"
                    ].join(" ")}
                    href={item.href}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {currentUser ? (
              <div className="flex items-center gap-3 lg:justify-end">
                <div className="text-right">
                  <p className="text-[15px] font-semibold text-slate-900">{currentUser.displayName}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-500 text-lg font-semibold text-white shadow-[0_12px_28px_rgba(168,85,247,0.28)]">
                  {currentUser.displayName.slice(0, 1).toUpperCase()}
                </div>
                <button
                  className="app-btn-secondary h-10 px-4"
                  type="button"
                  onClick={() => void logout()}
                >
                  退出
                </button>
              </div>
            ) : (
              <Link className="app-btn-primary h-11 px-5" href="/auth">
                登录 / 注册
              </Link>
            )}
          </div>
        </div>
      </header>
      {children}
    </main>
  );
}
