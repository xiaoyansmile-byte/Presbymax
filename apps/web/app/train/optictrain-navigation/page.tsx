import { OptictrainNavigationShell } from "@/components/training/optictrain-navigation-shell";
import { getCurrentUser } from "@/lib/repositories/users";
import Link from "next/link";
import { ArrowRightIcon, LockIcon } from "@/components/app-icons";

export default async function OptictrainNavigationTrainingPage() {
  const currentUser = await getCurrentUser();

  return (
    <main className="min-h-[100dvh] bg-black">
      {currentUser ? (
        <OptictrainNavigationShell />
      ) : (
        <section className="flex min-h-[100dvh] items-center justify-center px-4 py-8">
          <div className="w-full max-w-2xl rounded-[24px] border border-white/10 bg-white p-6 text-slate-900 shadow-2xl shadow-black/30 sm:p-8">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
              <LockIcon className="h-4 w-4" aria-hidden="true" />
              需要登录
            </div>
            <h2 className="mt-5 text-[1.9rem] font-semibold tracking-tight text-slate-900 sm:text-[2.35rem]">请先登录后开始今日训练</h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-[15px]">
              这个训练页只对已登录账号开放。登录后系统会读取你的计划和训练配置，再允许开始这个驾驶式视觉训练。
            </p>
            <div className="mt-8">
              <Link className="app-btn-primary h-11 w-full px-5 sm:w-auto" href="/auth">
                <ArrowRightIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                去登录
              </Link>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
