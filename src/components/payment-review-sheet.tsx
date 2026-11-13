"use client"

import Link from "next/link"
import * as React from "react"
import { TriangleAlertIcon } from "lucide-react"
import { toast } from "sonner"

import { AuditList } from "@/components/audit-list"
import { useFund } from "@/components/fund-provider"
import { Detail } from "@/components/page-header"
import { PaymentBadge, StandingBadge } from "@/components/status-badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import {
  formatCad,
  formatDate,
  methodLabels,
  paymentLabels,
  referenceLabels,
} from "@/lib/format"
import {
  approvePayment,
  auditFor,
  duplicatesOf,
  memberById,
  memberName,
  memberRow,
  rejectPayment,
  reversalOf,
} from "@/lib/fund"
import { round2 } from "@/lib/rules"
import type { Payment } from "@/lib/types"

export function PaymentReviewSheet({
  paymentId,
  onClose,
}: {
  paymentId: string | null
  onClose: () => void
}) {
  const { state } = useFund()
  const payment = state.payments.find((item) => item.id === paymentId)

  return (
    <Sheet
      open={Boolean(payment)}
      onOpenChange={(open) => !open && onClose()}
    >
      <SheetContent className="w-full gap-0 data-[side=right]:sm:max-w-md">
        {payment ? (
          <Review key={payment.id} payment={payment} onClose={onClose} />
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function Review({
  payment,
  onClose,
}: {
  payment: Payment
  onClose: () => void
}) {
  const { state, run, today } = useFund()
  const member = memberById(state, payment.memberId)
  const [amount, setAmount] = React.useState(String(payment.amount))
  const [receivedOn, setReceivedOn] = React.useState(payment.paidOn)
  const [rejecting, setRejecting] = React.useState(false)
  const [reason, setReason] = React.useState("")

  if (!member) return null

  const row = memberRow(state, member, today)
  const pending = payment.status === "pending"
  const duplicates = duplicatesOf(state, payment)
  const value = Number(amount)
  const after = round2(row.info.balance + (value > 0 ? value : 0))
  const stillShort = round2(Math.max(0, state.rules.buffer - after))
  const reversedBy = payment.entryId
    ? reversalOf(state, payment.entryId)
    : undefined
  const history = auditFor(state, (event) => event.paymentId === payment.id)

  return (
    <>
      <SheetHeader className="border-b">
        <SheetTitle className="flex items-center gap-2">
          Payment {payment.id}
          <PaymentBadge status={payment.status} />
        </SheetTitle>
        <SheetDescription>
          {payment.submittedBy === "office"
            ? `Recorded by the office on ${formatDate(payment.submittedOn)}`
            : `Declared by ${member.name} on ${formatDate(payment.submittedOn)}`}
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
        {pending && duplicates.length ? (
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertTitle>This reference has been used before</AlertTitle>
            <AlertDescription>
              {duplicates
                .map(
                  (other) =>
                    `${other.id} from ${memberName(state, other.memberId)}, ${paymentLabels[other.status].toLowerCase()}`
                )
                .join("; ")}
              . Check the bank record before posting.
            </AlertDescription>
          </Alert>
        ) : null}

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">What was declared</h3>
          <dl className="flex flex-col gap-2">
            <Detail label="Amount">{formatCad(payment.amount)}</Detail>
            <Detail label="Method">{methodLabels[payment.method]}</Detail>
            <Detail label={referenceLabels[payment.method]}>
              <span className="font-mono text-xs">
                {payment.reference || "None given"}
              </span>
            </Detail>
            <Detail label="Paid on">{formatDate(payment.paidOn)}</Detail>
          </dl>
        </section>

        <Separator />

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Member</h3>
          <dl className="flex flex-col gap-2">
            <Detail label="Name">
              <Link
                href={`/admin/members/${member.id}`}
                className="underline underline-offset-4"
              >
                {member.name}
              </Link>
            </Detail>
            <Detail label="Standing">
              <StandingBadge row={row} />
            </Detail>
            <Detail label="Balance today">
              {formatCad(row.info.balance)}
            </Detail>
          </dl>
        </section>

        <Separator />

        {pending ? (
          rejecting ? (
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="reject-reason">
                  Reason for rejecting
                </FieldLabel>
                <Textarea
                  id="reject-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="For example: no transfer with this reference was received"
                />
                <FieldDescription>
                  {member.name.split(" ")[0]} will see this and can declare the
                  payment again.
                </FieldDescription>
              </Field>
            </FieldGroup>
          ) : (
            <FieldGroup>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="received-amount">
                    Amount received
                  </FieldLabel>
                  <Input
                    id="received-amount"
                    type="number"
                    inputMode="decimal"
                    min="0.01"
                    step="0.01"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="received-on">Date received</FieldLabel>
                  <Input
                    id="received-on"
                    type="date"
                    max={today}
                    value={receivedOn}
                    onChange={(event) => setReceivedOn(event.target.value)}
                  />
                </Field>
              </div>
              <FieldDescription>
                {value > 0
                  ? `Posting takes the balance from ${formatCad(row.info.balance)} to ${formatCad(after)}. ${
                      stillShort > 0
                        ? `Still ${formatCad(stillShort)} short of the buffer.`
                        : "Paid up after posting."
                    }`
                  : "Enter the amount that actually arrived."}
              </FieldDescription>
            </FieldGroup>
          )
        ) : (
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">Decision</h3>
            <dl className="flex flex-col gap-2">
              {payment.decidedOn ? (
                <Detail label={paymentLabels[payment.status]}>
                  {formatDate(payment.decidedOn)} by {payment.decidedBy}
                </Detail>
              ) : null}
              {payment.receivedAmount !== null ? (
                <Detail label="Amount posted">
                  {formatCad(payment.receivedAmount)}
                </Detail>
              ) : null}
              {payment.entryId ? (
                <Detail label="Ledger entry">
                  <Link
                    href={`/admin/ledger?q=${payment.entryId}`}
                    className="font-mono text-xs underline underline-offset-4"
                  >
                    {payment.entryId}
                  </Link>
                  {reversedBy ? `, reversed by ${reversedBy.id}` : ""}
                </Detail>
              ) : null}
            </dl>
            {payment.reason ? (
              <p className="rounded-xs border bg-muted/40 p-3 text-sm">
                {payment.reason}
              </p>
            ) : null}
          </section>
        )}

        <Separator />

        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-medium">History</h3>
          <AuditList events={history} />
        </section>
      </div>

      {pending ? (
        <SheetFooter className="flex-row justify-end border-t">
          {rejecting ? (
            <>
              <Button variant="outline" onClick={() => setRejecting(false)}>
                Back
              </Button>
              <Button
                variant="destructive"
                disabled={!reason.trim()}
                onClick={() => {
                  if (run(rejectPayment, payment.id, reason)) {
                    toast.success("Payment rejected")
                    onClose()
                  }
                }}
              >
                Reject payment
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setRejecting(true)}>
                Reject
              </Button>
              <Button
                disabled={!(value > 0) || !receivedOn || receivedOn > today}
                onClick={() => {
                  if (
                    run(approvePayment, payment.id, {
                      amount: value,
                      receivedOn,
                    })
                  ) {
                    toast.success(
                      `${formatCad(value)} posted for ${member.name}`
                    )
                    onClose()
                  }
                }}
              >
                Approve and post
              </Button>
            </>
          )}
        </SheetFooter>
      ) : null}
    </>
  )
}
