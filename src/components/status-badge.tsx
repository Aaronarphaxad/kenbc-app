import { Badge } from "@/components/ui/badge";
import {
  accountLabels,
  caseLabels,
  formatCad,
  paymentLabels,
  plural,
  standingLabels,
} from "@/lib/format";
import type { MemberRow } from "@/lib/fund";
import type {
  AccountStatus,
  CaseStatus,
  PaymentStatus,
  Standing,
} from "@/lib/types";

const standingVariants: Record<
  Standing,
  "secondary" | "outline" | "destructive"
> = {
  "paid-up": "secondary",
  grace: "outline",
  delinquent: "destructive",
  "removal-review": "destructive",
};

/** One badge for standing, with how long and how much when the member is short. */
export function StandingBadge({
  row,
  detail = true,
}: {
  row: MemberRow;
  detail?: boolean;
}) {
  if (row.member.accountStatus === "invited") {
    return <Badge variant="outline">Awaiting first payment</Badge>;
  }
  const { standing, daysShort, shortfall } = row.info;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <Badge variant={standingVariants[standing]}>
        {standingLabels[standing]}
      </Badge>
      {detail && shortfall > 0 ? (
        <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
          {daysShort === 0 ? "Since today" : plural(daysShort, "day")} ·{" "}
          {formatCad(shortfall)} short
        </span>
      ) : null}
    </span>
  );
}

const accountVariants: Record<
  AccountStatus,
  "secondary" | "outline" | "destructive"
> = {
  active: "outline",
  invited: "secondary",
  suspended: "destructive",
};

export function AccountBadge({ status }: { status: AccountStatus }) {
  return (
    <Badge variant={accountVariants[status]}>{accountLabels[status]}</Badge>
  );
}

const paymentVariants: Record<
  PaymentStatus,
  "secondary" | "outline" | "destructive"
> = {
  pending: "secondary",
  approved: "outline",
  rejected: "destructive",
  withdrawn: "outline",
};

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  return (
    <Badge variant={paymentVariants[status]}>{paymentLabels[status]}</Badge>
  );
}

const caseVariants: Record<
  CaseStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  submitted: "secondary",
  "under-review": "secondary",
  approved: "default",
  disbursed: "outline",
  closed: "outline",
  declined: "destructive",
};

export function CaseBadge({ status }: { status: CaseStatus }) {
  return <Badge variant={caseVariants[status]}>{caseLabels[status]}</Badge>;
}
