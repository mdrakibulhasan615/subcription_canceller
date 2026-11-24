import { BadgeCheck, CircleAlert, CircleCheck, CirclePause, Clock } from "lucide-react";
import type { SubStatus } from "@app/core";

const BADGES = {
  active: { Icon: CircleCheck, label: "Active", cls: "bg-status-active-bg text-status-active-fg" },
  stopping_soon: {
    Icon: Clock,
    label: "Stopping soon",
    cls: "bg-status-soon-bg text-status-soon-fg",
  },
  stopped: {
    Icon: CirclePause,
    label: "Stopped",
    cls: "bg-status-stopped-bg text-status-stopped-fg",
  },
  cancelled: {
    Icon: BadgeCheck,
    label: "Cancelled with merchant",
    cls: "bg-status-merchant-bg text-status-merchant-fg",
  },
  failed: { Icon: CircleAlert, label: "Failed", cls: "bg-status-error-bg text-status-error-fg" },
} as const;

export function StatusBadge({ status }: { status: SubStatus | "failed" }) {
  const { Icon, label, cls } = BADGES[status];
  return (
    <span
      className={`inline-flex min-h-6 items-center gap-1 rounded-sm px-2 text-xs font-semibold ${cls}`}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      {label}
    </span>
  );
}
