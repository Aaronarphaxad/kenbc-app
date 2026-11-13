import { CheckIcon, XIcon } from "lucide-react";
import { cn } from "cn";

import { formatDate, plural } from "@/lib/format";
import { caseTimeline, caseTurnaround } from "@/lib/fund";
import type { BereavementCase, CaseStatus } from "@/lib/types";

const upcoming: Record<CaseStatus, string[]> = {
  submitted: ["Under review", "Decision", "Payout", "Closed"],
  "under-review": ["Decision", "Payout", "Closed"],
  approved: ["Payout", "Closed"],
  disbursed: ["Closed"],
  closed: [],
  declined: [],
};

export function turnaroundText(item: BereavementCase, today: string) {
  const { days, done } = caseTurnaround(item, today);
  if (!done)
    return days === 0 ? "Opened today" : `Open for ${plural(days, "day")}`;
  const verb = item.status === "declined" ? "Decided" : "Paid out";
  return days === 0
    ? `${verb} the same day`
    : `${verb} in ${plural(days, "day")}`;
}

/** The fixed path a request follows, with what has happened and what is left. */
export function CaseTimeline({
  item,
  today,
}: {
  item: BereavementCase;
  today: string;
}) {
  const done = caseTimeline(item);

  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col">
        {done.map((step) => (
          <li key={step.label} className="flex gap-3 pb-4 last:pb-0">
            <span
              className={cn(
                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
                step.label === "Declined"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-primary text-primary-foreground",
              )}
            >
              {step.label === "Declined" ? (
                <XIcon className="size-3" />
              ) : (
                <CheckIcon className="size-3" />
              )}
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-medium">
                {step.label}
                <span className="ml-2 font-normal text-muted-foreground">
                  {formatDate(step.on)}
                </span>
              </span>
              {step.detail ? (
                <span className="text-sm text-muted-foreground">
                  {step.detail}
                </span>
              ) : null}
            </div>
          </li>
        ))}
        {upcoming[item.status].map((label) => (
          <li key={label} className="flex gap-3 pt-4 first:pt-0">
            <span className="mt-0.5 size-5 shrink-0 rounded-full border border-dashed" />
            <span className="text-sm text-muted-foreground">{label}</span>
          </li>
        ))}
      </ol>
      <p className="text-xs text-muted-foreground">
        {turnaroundText(item, today)}
      </p>
    </div>
  );
}
