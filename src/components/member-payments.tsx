"use client"

import { toast } from "sonner"

import { useFund } from "@/components/fund-provider"
import { PaymentBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { formatCad, formatDate, methodLabels } from "@/lib/format"
import { withdrawPayment } from "@/lib/fund"
import type { Payment } from "@/lib/types"

/** A member's own payments with where each one stands. */
export function MemberPayments({ payments }: { payments: Payment[] }) {
  const { run } = useFund()

  return (
    <ul className="flex flex-col divide-y">
      {payments.map((payment) => (
        <li
          key={payment.id}
          className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-sm font-medium">
                {formatCad(payment.receivedAmount ?? payment.amount)} by{" "}
                {methodLabels[payment.method]}
              </span>
              <span className="text-xs text-muted-foreground">
                {payment.submittedBy === "office" ? "Recorded" : "Declared"}{" "}
                {formatDate(payment.submittedOn)}
                {payment.reference ? ` · ${payment.reference}` : ""}
              </span>
            </div>
            <PaymentBadge status={payment.status} />
          </div>
          {payment.status === "pending" ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                Your balance changes once the treasurer confirms it arrived.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (run(withdrawPayment, payment.id)) {
                    toast.success("Payment withdrawn")
                  }
                }}
              >
                Withdraw
              </Button>
            </div>
          ) : null}
          {payment.status === "rejected" && payment.reason ? (
            <p className="rounded-xs border border-destructive/30 bg-destructive/5 p-3 text-sm">
              {payment.reason}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
