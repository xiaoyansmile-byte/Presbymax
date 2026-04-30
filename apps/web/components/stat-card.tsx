import { CheckIcon, ClockIcon, ReportIcon, TargetIcon, TrendUpIcon } from "@/components/app-icons";

type StatTone = "blue" | "green" | "violet" | "amber" | "rose";

const toneClasses: Record<
  StatTone,
  { card: string; label: string; value: string; badge: string; Icon: typeof TargetIcon }
> = {
  blue: {
    card: "app-stat-blue",
    label: "text-blue-700",
    value: "text-blue-600",
    badge: "bg-blue-500/10 text-blue-600 ring-blue-200/70",
    Icon: TargetIcon
  },
  green: {
    card: "app-stat-green",
    label: "text-emerald-700",
    value: "text-emerald-600",
    badge: "bg-emerald-500/10 text-emerald-600 ring-emerald-200/70",
    Icon: CheckIcon
  },
  violet: {
    card: "app-stat-violet",
    label: "text-violet-700",
    value: "text-violet-600",
    badge: "bg-violet-500/10 text-violet-600 ring-violet-200/70",
    Icon: ClockIcon
  },
  amber: {
    card: "app-stat-amber",
    label: "text-orange-700",
    value: "text-orange-600",
    badge: "bg-orange-500/10 text-orange-600 ring-orange-200/70",
    Icon: TrendUpIcon
  },
  rose: {
    card: "app-stat-rose",
    label: "text-rose-700",
    value: "text-rose-600",
    badge: "bg-rose-500/10 text-rose-600 ring-rose-200/70",
    Icon: ReportIcon
  }
};

export function StatCard({ label, value, tone = "blue" }: { label: string; value: string | number; tone?: StatTone }) {
  const styles = toneClasses[tone];

  return (
    <div className={`aspect-[1.35/1] min-w-0 overflow-hidden rounded-[24px] border p-3 shadow-[0_12px_28px_rgba(15,23,42,0.08)] sm:aspect-auto sm:p-5 ${styles.card}`}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-[13px] font-semibold sm:text-sm ${styles.label}`}>{label}</p>
          <p className={`mt-2 text-[1.45rem] font-semibold leading-none tracking-tight sm:mt-4 sm:text-[2.1rem] ${styles.value}`}>{value}</p>
        </div>
        <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[18px] shadow-[0_8px_18px_rgba(15,23,42,0.06)] ring-1 sm:h-11 sm:w-11 ${styles.badge}`}>
          <styles.Icon className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
        </span>
      </div>
    </div>
  );
}
