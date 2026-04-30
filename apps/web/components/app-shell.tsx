"use client";

import { useEffect, useState } from "react";
import type { ComponentType, SVGProps } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { AppUser } from "@prosbymax/types";
import { loadCurrentUserFromApi, logoutFromApi, notifyAuthChanged, subscribeAuthChanges } from "@/lib/auth";
import { AccountIcon, AnalyticsIcon, CloseIcon, HomeIcon, MenuIcon, SettingsIcon, TemplateIcon, UsersIcon } from "@/components/app-icons";
import { LayoutDebugOverlay } from "@/components/layout-debug-overlay";

type NavIcon = ComponentType<SVGProps<SVGSVGElement>>;

type NavItem = {
  label: string;
  href: string;
  icon: NavIcon;
};

const baseNavItems: NavItem[] = [
  { label: "今日训练", href: "/", icon: HomeIcon },
  { label: "训练洞察", href: "/analytics", icon: AnalyticsIcon },
  { label: "个人中心", href: "/account", icon: AccountIcon }
];

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileMenuOpen]);

  async function logout() {
    const ok = await logoutFromApi();
    if (!ok) return;

    setCurrentUser(null);
    notifyAuthChanged();
    setMobileMenuOpen(false);
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
    <main className="min-h-screen overflow-x-clip">
      <header className="sticky top-0 z-30 border-b border-white/60 bg-white/85 backdrop-blur-xl">
        <div className="app-shell relative">
          <div className="flex w-full min-w-0 items-center justify-between gap-3 py-2.5 sm:py-4">
            <div className="flex min-w-0 flex-none items-center gap-3 sm:gap-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 text-sm font-bold text-white shadow-[0_14px_30px_rgba(37,99,235,0.24)] sm:h-12 sm:w-12 sm:rounded-[18px] sm:text-lg">
                PM
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-[1.35rem] font-semibold tracking-tight text-slate-900 sm:text-[1.9rem]">PresbyMaxMCL</h1>
                <p className="text-[11px] text-slate-500 sm:text-sm">Vision Training</p>
              </div>
            </div>

            <nav className="hidden min-w-0 flex-wrap items-center gap-1.5 md:flex md:flex-nowrap md:overflow-x-auto lg:justify-center">
              {navItems.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    className={[
                      "app-nav-pill shrink-0 gap-1.5 whitespace-nowrap",
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

            <div className="relative z-50 flex shrink-0 items-center gap-2 md:hidden">
              <button
                type="button"
                aria-label={mobileMenuOpen ? "关闭菜单" : "打开菜单"}
                className="inline-flex h-10 w-10 items-center justify-center rounded-[14px] border border-slate-200 bg-white text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.06)]"
                onClick={() => setMobileMenuOpen((current) => !current)}
              >
                {mobileMenuOpen ? <CloseIcon className="h-5 w-5" aria-hidden="true" /> : <MenuIcon className="h-5 w-5" aria-hidden="true" />}
              </button>
            </div>

            <div className="hidden shrink-0 items-center gap-2 sm:gap-3 md:flex md:ml-auto lg:justify-end">
              {currentUser ? (
                <>
                  <div className="min-w-0 text-right">
                    <p className="truncate text-[13px] font-semibold text-slate-900 sm:text-[15px]">{currentUser.displayName}</p>
                  </div>
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-500 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(168,85,247,0.28)] sm:h-12 sm:w-12 sm:text-lg">
                    {currentUser.displayName.slice(0, 1).toUpperCase()}
                  </div>
                  <button
                    className="app-btn-secondary h-9 px-3 text-xs sm:h-10 sm:px-4 sm:text-sm"
                    type="button"
                    onClick={() => void logout()}
                  >
                    退出
                  </button>
                </>
              ) : (
                <Link className="app-btn-primary h-11 px-5" href="/auth">
                  登录 / 注册
                </Link>
              )}
            </div>
          </div>

          {mobileMenuOpen ? (
            <div className="fixed inset-0 z-40 md:hidden">
              <button
                type="button"
                aria-label="关闭菜单"
                className="absolute inset-0 bg-slate-950/15 backdrop-blur-[2px]"
                onClick={() => setMobileMenuOpen(false)}
              />

              <div className="absolute left-4 right-4 top-[4.75rem] sm:left-auto sm:right-4 sm:w-80">
                <div className="overflow-hidden rounded-[22px] border border-slate-200/80 bg-white shadow-[0_20px_40px_rgba(15,23,42,0.16)]">
                  <nav className="grid gap-1 p-2">
                    {navItems.map((item) => {
                      const active = pathname === item.href;
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          className={[
                            "flex items-center gap-3 rounded-[16px] px-3 py-3 text-sm font-semibold",
                            active ? "bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-[0_12px_24px_rgba(37,99,235,0.22)]" : "text-slate-700 hover:bg-slate-50"
                          ].join(" ")}
                          href={item.href}
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <Icon className="h-4 w-4" aria-hidden="true" />
                          {item.label}
                        </Link>
                      );
                    })}
                  </nav>

                  <div className="border-t border-slate-200/80 p-2">
                    {currentUser ? (
                      <div className="grid gap-2">
                        <div className="flex items-center gap-3 rounded-[16px] bg-slate-50 px-3 py-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-500 text-sm font-semibold text-white">
                            {currentUser.displayName.slice(0, 1).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">{currentUser.displayName}</p>
                            <p className="text-xs text-slate-500">{currentUser.role === "admin" ? "管理员" : "普通用户"}</p>
                          </div>
                        </div>
                        <button
                          className="app-btn-secondary h-11 w-full px-4 text-sm"
                          type="button"
                          onClick={() => void logout()}
                        >
                          退出登录
                        </button>
                      </div>
                    ) : (
                      <Link className="app-btn-primary h-11 w-full px-5" href="/auth" onClick={() => setMobileMenuOpen(false)}>
                        登录 / 注册
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </header>
      {children}
      <LayoutDebugOverlay />
    </main>
  );
}
