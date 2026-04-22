import type { TrainingStatus } from "@prosbymax/types";
import { CheckIcon, ClockIcon, LockIcon } from "@/components/app-icons";

export function StatusPill({ status }: { status: TrainingStatus }) {
  const labels = {
    ready: "可开始",
    done: "已完成",
    locked: "未开放"
  };
  const Icon = {
    ready: ClockIcon,
    done: CheckIcon,
    locked: LockIcon
  }[status];

  const className = {
    ready: "border-primary/20 bg-primary/10 text-primary",
    done: "border-success/20 bg-success/10 text-success",
    locked: "border-border bg-white text-muted"
  }[status];

  return (
    <span className={`inline-flex h-8 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold ${className}`}>
      <Icon className="h-4 w-4" aria-hidden="true" />
      {labels[status]}
    </span>
  );
}
