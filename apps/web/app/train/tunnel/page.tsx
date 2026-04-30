import { AppShell } from "@/components/app-shell";
import { TunnelTrainingShell } from "@/components/training/tunnel-training-shell";
import { getCurrentUser } from "@/lib/repositories/users";
import Link from "next/link";
import { ArrowRightIcon, LockIcon } from "@/components/app-icons";

export default async function TunnelTrainingPage() {
  const currentUser = await getCurrentUser();

  return (
    <AppShell>
      <section className="app-shell py-5 sm:py-8 lg:py-10">
        {currentUser ? (
          <TunnelTrainingShell />
        ) : (
          <section className="app-surface p-5 sm:p-8 md:p-10">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
              <LockIcon className="h-4 w-4" aria-hidden="true" />
              需要登录
            </div>
            <h2 className="mt-4 max-w-full text-[1.85rem] font-semibold tracking-tight text-slate-900 sm:text-[2.2rem]">请先登录后开始今日训练</h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-[15px]">
              这个训练页只对已登录账号开放。登录后系统会读取你的计划和训练配置，再允许开始隧道远近切换识别训练。
            </p>
            <div className="mt-7">
              <Link className="app-btn-primary h-11 w-full px-5 sm:w-auto" href="/auth">
                <ArrowRightIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                去登录
              </Link>
            </div>
          </section>
        )}
      </section>
    </AppShell>
  );
}
