import { AppShell } from "@/components/app-shell";
import { AnalyticsOverview } from "@/components/analytics/analytics-overview";
import { TrendUpIcon } from "@/components/app-icons";

export default function AnalyticsPage() {
  return (
    <AppShell>
      <section className="app-shell py-8 lg:py-10">
        <div className="space-y-8">
          <section className="app-hero rounded-[30px] p-8 md:p-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-sm font-semibold text-white/85">
              <TrendUpIcon className="h-4 w-4" aria-hidden="true" />
              训练洞察
            </div>
            <h2 className="mt-4 text-[2.6rem] font-semibold tracking-tight text-white">训练表现与报告中心</h2>
            <p className="mt-4 max-w-3xl text-[15px] leading-7 text-white/82">
              这里把训练总览和训练报告合并到一起，方便一眼看懂表现并直接生成报告。
            </p>
          </section>
          <AnalyticsOverview />
        </div>
      </section>
    </AppShell>
  );
}
