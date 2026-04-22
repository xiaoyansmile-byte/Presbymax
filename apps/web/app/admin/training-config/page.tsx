import { AppShell } from "@/components/app-shell";
import { TrainingConfigWorkbench } from "@/components/admin/training-config-workbench";
import { getCurrentUser } from "@/lib/repositories/users";
import Link from "next/link";
import { SettingsIcon } from "@/components/app-icons";

export default async function TrainingConfigAdminPage() {
  const currentUser = await getCurrentUser();
  const isAdmin = currentUser?.role === "admin";

  return (
    <AppShell>
      <section className="app-shell py-8 lg:py-10">
        <div className="space-y-8">
          <section className="app-hero rounded-[30px] p-8 md:p-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-sm font-semibold text-white/85">
              <SettingsIcon className="h-4 w-4" aria-hidden="true" />
              训练配置
            </div>
            <h2 className="mt-4 text-[2.6rem] font-semibold tracking-tight text-white">训练参数配置</h2>
            <p className="mt-4 max-w-3xl text-[15px] leading-7 text-white/82">
              这些参数只面向管理员，用来控制用户训练时的倒计时、题目数量、得分规则和难度升级策略。
            </p>
          </section>

          {isAdmin ? (
            <TrainingConfigWorkbench />
          ) : (
            <section className="rounded-app border border-border bg-white p-6">
              <p className="text-sm font-medium text-primary">当前身份：{currentUser?.displayName ?? "未登录"}</p>
              <h3 className="mt-2 text-xl font-semibold">没有管理员权限</h3>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
                你现在还没有管理员权限。请先登录管理员账号，再回来继续配置训练参数。
              </p>
              <div className="mt-5 flex gap-3">
                <Link
                  className="inline-flex h-11 items-center justify-center rounded-app bg-primary px-4 text-sm font-semibold text-white"
                  href="/auth"
                >
                  去登录
                </Link>
                <Link
                  className="inline-flex h-11 items-center justify-center rounded-app border border-border px-4 text-sm font-semibold"
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
