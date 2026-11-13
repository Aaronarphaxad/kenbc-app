"use client"

import Link from "next/link"
import * as React from "react"
import {
  AlarmClockIcon,
  BanknoteIcon,
  CheckIcon,
  ChevronRightIcon,
  FolderOpenIcon,
  HandCoinsIcon,
  type LucideIcon,
} from "lucide-react"

import { FundChart } from "@/components/fund-chart"
import { useFund } from "@/components/fund-provider"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  formatCad,
  formatDate,
  formatDay,
  plural,
  standingLabels,
} from "@/lib/format"
import {
  describeEntry,
  fundTotals,
  isInArrears,
  memberName,
  memberRows,
} from "@/lib/fund"
import { round2 } from "@/lib/rules"
import type { Standing } from "@/lib/types"

type Task = {
  icon: LucideIcon
  title: string
  detail: string
  href: string
}

const standings: Standing[] = [
  "paid-up",
  "grace",
  "delinquent",
  "removal-review",
]

export default function AdminHomePage() {
  const { state, today } = useFund()
  const rows = React.useMemo(() => memberRows(state, today), [state, today])
  const totals = fundTotals(state, rows)

  const pending = state.payments.filter((item) => item.status === "pending")
  const toReview = state.cases.filter(
    (item) => item.status === "submitted" || item.status === "under-review"
  )
  const pastGrace = rows.filter(
    (row) =>
      isInArrears(row) &&
      (row.info.standing === "delinquent" ||
        row.info.standing === "removal-review")
  )

  const tasks: Task[] = []
  if (pending.length) {
    tasks.push({
      icon: BanknoteIcon,
      title: `${plural(pending.length, "payment")} to approve`,
      detail: `${formatCad(round2(pending.reduce((sum, item) => sum + item.amount, 0)))} declared by members, not yet on any balance`,
      href: "/admin/payments",
    })
  }
  if (toReview.length) {
    tasks.push({
      icon: FolderOpenIcon,
      title: `${plural(toReview.length, "case")} to review`,
      detail: toReview.map((item) => item.subjectName).join(", "),
      href: "/admin/cases",
    })
  }
  if (totals.awaitingCount) {
    tasks.push({
      icon: HandCoinsIcon,
      title: `${plural(totals.awaitingCount, "approved case")} awaiting payout`,
      detail: `${formatCad(totals.awaitingPayout)} levied and ready to pay to the family`,
      href: "/admin/cases",
    })
  }
  if (pastGrace.length) {
    tasks.push({
      icon: AlarmClockIcon,
      title: `${plural(pastGrace.length, "member")} past grace`,
      detail: `${formatCad(round2(pastGrace.reduce((sum, row) => sum + row.info.shortfall, 0)))} owing, no longer covered`,
      href: "/admin/arrears?bucket=past",
    })
  }

  const active = rows.filter((row) => row.member.accountStatus === "active")
  const recent = [...state.journal].reverse().slice(0, 6)

  return (
    <>
      <PageHeader title="Home" description={formatDate(today)} />

      <Card>
        <CardHeader>
          <CardTitle>Needs attention</CardTitle>
          <CardDescription>
            {tasks.length
              ? "Work that is waiting on the office."
              : "The office is up to date."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tasks.length ? (
            <ul className="flex flex-col divide-y rounded-lg border">
              {tasks.map((task) => (
                <li key={task.title}>
                  <Link
                    href={task.href}
                    className="flex items-center gap-3 px-3 py-3 outline-none hover:bg-muted/50 focus-visible:bg-muted/50"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <task.icon className="size-4" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-sm font-medium">{task.title}</span>
                      <span className="truncate text-sm text-muted-foreground">
                        {task.detail}
                      </span>
                    </span>
                    <ChevronRightIcon className="size-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <CheckIcon />
                </EmptyMedia>
                <EmptyTitle>Nothing needs attention</EmptyTitle>
                <EmptyDescription>
                  No payments to approve, no cases waiting, nobody past grace.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Figure
          label="Held for members"
          value={formatCad(totals.held)}
          detail={`Across ${plural(totals.activeCount, "active member")}`}
        />
        <Figure
          label="Short of buffer"
          value={formatCad(totals.short)}
          detail={`Owed by ${plural(totals.shortCount, "member")}`}
        />
        <Figure
          label="Levied, awaiting payout"
          value={formatCad(totals.awaitingPayout)}
          detail={
            totals.awaitingCount
              ? plural(totals.awaitingCount, "approved case")
              : "No payouts outstanding"
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <FundChart />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Standing</CardTitle>
            <CardDescription>
              {plural(active.length, "active member")}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {standings.map((standing) => {
              const count = active.filter(
                (row) => row.info.standing === standing
              ).length
              const share = active.length ? (count / active.length) * 100 : 0
              return (
                <div key={standing} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between text-sm">
                    <span>{standingLabels[standing]}</span>
                    <span className="font-medium tabular-nums">{count}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={
                        standing === "paid-up"
                          ? "h-full rounded-full bg-primary"
                          : standing === "grace"
                            ? "h-full rounded-full bg-primary/50"
                            : "h-full rounded-full bg-destructive/70"
                      }
                      style={{ width: `${share}%` }}
                    />
                  </div>
                </div>
              )
            })}
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href="/admin/arrears" />}
            >
              Open arrears
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Latest entries</CardTitle>
          <CardDescription>The most recent lines posted</CardDescription>
          <CardAction>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href="/admin/ledger" />}
            >
              Open ledger
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col divide-y">
            {recent.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center gap-3 py-2.5 text-sm first:pt-0 last:pb-0"
              >
                <span className="w-14 shrink-0 text-muted-foreground">
                  {formatDay(entry.effectiveOn)}
                </span>
                <span className="flex min-w-0 flex-1 flex-col sm:flex-row sm:gap-2">
                  <Link
                    href={`/admin/members/${entry.memberId}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {memberName(state, entry.memberId)}
                  </Link>
                  <span className="truncate text-muted-foreground">
                    {describeEntry(entry)}
                  </span>
                </span>
                <span className="font-medium tabular-nums">
                  {entry.credit > 0
                    ? `+${formatCad(entry.credit)}`
                    : `-${formatCad(entry.debit)}`}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </>
  )
}

function Figure({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail: string
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <p className="text-2xl font-semibold tracking-tight tabular-nums">
          {value}
        </p>
        <p className="text-sm text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  )
}
