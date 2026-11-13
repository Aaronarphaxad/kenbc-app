"use client"

import Link from "next/link"
import { CircleCheckIcon, CircleXIcon } from "lucide-react"

import { useFund } from "@/components/fund-provider"
import { MemberPayments } from "@/components/member-payments"
import { CaseBadge } from "@/components/status-badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  formatCad,
  formatDate,
  formatDay,
  kindLabels,
  methodLabels,
} from "@/lib/format"
import { entriesFor, memberRow, type MemberRow } from "@/lib/fund"
import { round2 } from "@/lib/rules"
import type { Rules } from "@/lib/types"

/** One plain sentence that tells the member where they stand. */
function standingSentence(row: MemberRow, rules: Rules) {
  const { info, member } = row
  const owes = formatCad(info.shortfall)
  const graceEnd = info.graceEndsOn ? formatDay(info.graceEndsOn) : ""

  if (member.accountStatus === "invited") {
    return {
      title: `Pay ${formatCad(rules.buffer)} to start your membership.`,
      detail:
        "Your membership becomes active when the treasurer approves your first contribution.",
    }
  }
  if (info.standing === "paid-up") {
    return {
      title: "You are paid up.",
      detail:
        info.balance > rules.buffer
          ? `You are ${formatCad(round2(info.balance - rules.buffer))} ahead of the ${formatCad(rules.buffer)} buffer.`
          : `Your balance covers the full ${formatCad(rules.buffer)} buffer. Nothing is due.`,
    }
  }
  if (info.standing === "grace") {
    return {
      title: `You owe ${owes}. Pay by ${graceEnd} to stay in good standing.`,
      detail: `A levy took your balance under the ${formatCad(rules.buffer)} buffer. You are still covered until ${graceEnd}.`,
    }
  }
  if (info.standing === "delinquent") {
    return {
      title: `You owe ${owes}. Your grace period ended on ${graceEnd}.`,
      detail: "You are not covered for the benefit until this is paid.",
    }
  }
  return {
    title: `You owe ${owes}, and your membership is under review.`,
    detail: `You have been short for ${info.daysShort} days. Pay now or speak to the treasurer to keep your membership.`,
  }
}

export default function MemberHomePage() {
  const { state, me, today } = useFund()
  if (!me) return null

  const row = memberRow(state, me, today)
  const { info, eligibility, pendingTotal } = row
  const { rules } = state
  const sentence = standingSentence(row, rules)
  const owed = round2(Math.max(0, info.shortfall - pendingTotal))
  const standingOk = info.standing === "paid-up" || info.standing === "grace"

  const payments = state.payments.filter(
    (payment) => payment.memberId === me.id
  )
  const pending = payments.filter((payment) => payment.status === "pending")
  const latest = payments[payments.length - 1]
  const rejected = latest?.status === "rejected" ? latest : null

  const recent = entriesFor(state, me.id).reverse().slice(0, 5)
  const openCases = state.cases.filter(
    (item) =>
      item.memberId === me.id &&
      item.status !== "closed" &&
      item.status !== "declined"
  )

  return (
    <>
      {me.accountStatus === "suspended" ? (
        <Alert variant="destructive">
          <AlertTitle>Your account is suspended</AlertTitle>
          <AlertDescription>
            {me.statusReason} Speak to the treasurer to restore it.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardDescription>Hello, {me.name.split(" ")[0]}</CardDescription>
          <CardTitle className="text-2xl leading-snug font-semibold text-balance">
            {sentence.title}
          </CardTitle>
          <CardDescription>{sentence.detail}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-sm text-muted-foreground">
                Your balance
              </span>
              <span className="text-sm text-muted-foreground tabular-nums">
                Buffer {formatCad(rules.buffer)}
              </span>
            </div>
            <span className="text-4xl font-semibold tracking-tight tabular-nums">
              {formatCad(info.balance)}
            </span>
            <Progress
              value={Math.min(100, (info.balance / rules.buffer) * 100)}
              aria-label="Balance against the buffer"
            />
          </div>

          {pendingTotal > 0 ? (
            <p className="text-sm">
              {formatCad(pendingTotal)} is awaiting approval and is not counted
              yet.
              {info.shortfall > 0 && owed === 0
                ? " That covers what you owe."
                : ""}
            </p>
          ) : null}

          {owed > 0 ? (
            <div>
              <Button
                size="lg"
                nativeButton={false}
                render={<Link href="/member/pay" />}
              >
                Pay {formatCad(owed)}
              </Button>
            </div>
          ) : null}

          {me.accountStatus === "invited" ? null : (
            <p className="flex items-start gap-2 border-t pt-4 text-sm">
              {eligibility.eligible ? (
                <CircleCheckIcon className="mt-0.5 size-4 shrink-0 text-primary" />
              ) : (
                <CircleXIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
              )}
              <span>
                {eligibility.eligible
                  ? "You are covered for the bereavement benefit."
                  : me.accountStatus !== "active"
                    ? "You are not covered while your account is suspended."
                    : standingOk
                      ? `You are not covered yet. Your ${rules.waitingDays}-day waiting period ends on ${formatDate(eligibility.waitingEndsOn)}.`
                      : `You are not covered until you pay the ${formatCad(info.shortfall)} you owe.`}
              </span>
            </p>
          )}
        </CardContent>
      </Card>

      {rejected ? (
        <Card>
          <CardHeader>
            <CardTitle>Your last payment was not accepted</CardTitle>
            <CardDescription>
              Check the details and tell us about it again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MemberPayments payments={[rejected]} />
          </CardContent>
        </Card>
      ) : null}

      {pending.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Awaiting approval</CardTitle>
            <CardDescription>
              The treasurer checks each payment against the bank record.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MemberPayments payments={pending} />
          </CardContent>
        </Card>
      ) : null}

      {openCases.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Your bereavement request</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y">
              {openCases.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/member/requests/${item.id}`}
                    className="flex items-center justify-between gap-3 py-2 text-sm first:pt-0 last:pb-0 hover:underline"
                  >
                    <span>
                      {item.subjectName}, submitted{" "}
                      {formatDate(item.submittedOn)}
                    </span>
                    <CaseBadge status={item.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
          <CardAction>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href="/member/activity" />}
            >
              See all
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {recent.length ? (
            <ul className="flex flex-col divide-y">
              {recent.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="text-sm font-medium">
                      {kindLabels[entry.kind]}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {[
                        formatDate(entry.effectiveOn),
                        entry.memo ||
                          (entry.method ? methodLabels[entry.method] : ""),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </div>
                  <span className="text-sm font-medium tabular-nums">
                    {entry.credit > 0
                      ? `+${formatCad(entry.credit)}`
                      : `-${formatCad(entry.debit)}`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nothing yet. Your payments and levies will show here.
            </p>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-sm text-muted-foreground">
        Lost a family member?{" "}
        <Link
          href="/member/requests/new"
          className="text-foreground underline underline-offset-4"
        >
          Ask the fund for support
        </Link>
      </p>
    </>
  )
}
