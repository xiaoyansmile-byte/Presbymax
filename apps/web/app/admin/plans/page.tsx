import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PlanTemplateWorkbench } from "@/components/admin/plan-template-workbench";
import { getCurrentUser } from "@/lib/repositories/users";
import { TemplateIcon } from "@/components/app-icons";

export default async function AdminPlansPage() {
  const currentUser = await getCurrentUser();
  const isAdmin = currentUser?.role === "admin";

  return (
    <AppShell>
      <section className="app-shell py-5 sm:py-8 lg:py-10">
        <div className="space-y-5 sm:space-y-8">
          <section className="app-hero rounded-[28px] p-5 sm:p-8 md:p-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-sm font-semibold text-white/85">
              <TemplateIcon className="h-4 w-4" aria-hidden="true" />
              计划模板
            </div>
            <h2 className="mt-4 max-w-full text-[1.85rem] font-semibold tracking-tight text-white sm:text-[2.6rem]">计划模板配置</h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-white/82 sm:text-[15px]">
              这里管理用户注册时可选的训练计划模板，包含训练项目、周期、每周次数和展示文案。
            </p>
          </section>

          {isAdmin ? (
            <PlanTemplateWorkbench />
          ) : (
            <section className="rounded-app border border-border bg-white p-6">
              <p className="text-sm font-medium text-primary">当前身份：{currentUser?.displayName ?? "未登录"}</p>
              <h3 className="mt-2 text-xl font-semibold">没有管理员权限</h3>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
                你现在还没有管理员权限。请先登录管理员账号，再回来配置计划模板。
              </p>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <Link
                  className="inline-flex h-11 w-full items-center justify-center rounded-app bg-primary px-4 text-sm font-semibold text-white sm:w-auto"
                  href="/auth"
                >
                  去登录
                </Link>
                <Link
                  className="inline-flex h-11 w-full items-center justify-center rounded-app border border-border px-4 text-sm font-semibold sm:w-auto"
                  href="/"
                >
                  返回首页
                </Link>
              </div>
            </section>
          )}
        </div>
      </section>
    </AppShell>
  );
}
