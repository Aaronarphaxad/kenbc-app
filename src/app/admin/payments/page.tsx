"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import * as React from "react"
import { PlusIcon, TriangleAlertIcon } from "lucide-react"

import {
  columnHelperFor,
  DataTable,
  type DataColumn,
} from "@/components/data-table"
import { useFund } from "@/components/fund-provider"
import { PageHeader } from "@/components/page-header"
import { PaymentReviewSheet } from "@/components/payment-review-sheet"
import { RecordPaymentDialog } from "@/components/record-payment-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatCad, formatDate, methodLabels, plural } from "@/lib/format"
import { duplicatesOf, memberName } from "@/lib/fund"
import { round2 } from "@/lib/rules"
import type { Payment } from "@/lib/types"

type PaymentRow = Payment & {
  member: string
  duplicate: boolean
}

type Tab = "pending" | "approved" | "rejected"

const helper = columnHelperFor<PaymentRow>()

export default function PaymentsPage() {
  return (
    <React.Suspense fallback={null}>
      <Payments />
    </React.Suspense>
  )
}

function Payments() {
  const { state } = useFund()
  const params = useSearchParams()
  const linked = params.get("payment")
  const [openId, setOpenId] = React.useState<string | null>(linked)
  const [recording, setRecording] = React.useState(false)
  const linkedStatus = state.payments.find((item) => item.id === linked)?.status
  const [tab, setTab] = React.useState<Tab>(
    linkedStatus === "approved"
      ? "approved"
      : linkedStatus === "rejected" || linkedStatus === "withdrawn"
        ? "rejected"
        : "pending"
  )

  const rows = React.useMemo(
    () =>
      state.payments.map(
        (payment): PaymentRow => ({
          ...payment,
          member: memberName(state, payment.memberId),
          duplicate:
            payment.status === "pending" &&
            duplicatesOf(state, payment).length > 0,
        })
      ),
    [state]
  )
  const byTab: Record<Tab, PaymentRow[]> = {
    pending: rows.filter((row) => row.status === "pending"),
    approved: rows.filter((row) => row.status === "approved"),
    rejected: rows.filter(
      (row) => row.status === "rejected" || row.status === "withdrawn"
    ),
  }
  const pendingTotal = round2(
    byTab.pending.reduce((sum, row) => sum + row.amount, 0)
  )

  const columns = React.useMemo(() => {
    const shared = [
      helper.accessor("submittedOn", {
        header: "Declared",
        cell: ({ row }) => (
          <span className="whitespace-nowrap">
            {formatDate(row.original.submittedOn)}
          </span>
        ),
      }),
      helper.accessor("member", {
        header: "Member",
        cell: ({ row }) => (
          <Link
            href={`/admin/members/${row.original.memberId}`}
            className="font-medium whitespace-nowrap underline-offset-4 hover:underline"
          >
            {row.original.member}
          </Link>
        ),
      }),
      helper.accessor("amount", {
        header: "Amount",
        cell: ({ row }) =>
          formatCad(row.original.receivedAmount ?? row.original.amount),
      }),
      helper.accessor("method", {
        header: "Method",
        cell: ({ row }) => methodLabels[row.original.method],
      }),
      helper.accessor("reference", {
        header: "Reference",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1.5 font-mono text-xs">
            {row.original.reference}
            {row.original.duplicate ? (
              <Badge variant="destructive" className="font-sans">
                <TriangleAlertIcon data-icon="inline-start" />
                Used before
              </Badge>
            ) : null}
          </span>
        ),
      }),
    ]
    const open = (label: string) =>
      helper.display({
        id: "open",
        header: () => <span className="sr-only">Open</span>,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              variant={label === "Review" ? "default" : "outline"}
              size="sm"
              onClick={() => setOpenId(row.original.id)}
            >
              {label}
            </Button>
          </div>
        ),
      })

    const sets: Record<Tab, DataColumn<PaymentRow>[]> = {
      pending: helper.columns([...shared, open("Review")]),
      approved: helper.columns([
        ...shared,
        helper.accessor("decidedOn", {
          header: "Posted",
          cell: ({ row }) =>
            row.original.decidedOn ? formatDate(row.original.decidedOn) : "",
        }),
        helper.accessor("entryId", {
          header: "Entry",
          cell: ({ row }) => (
            <span className="font-mono text-xs">{row.original.entryId}</span>
          ),
        }),
        open("View"),
      ]),
      rejected: helper.columns([
        ...shared,
        helper.accessor("reason", {
          header: "Reason",
          enableSorting: false,
          cell: ({ row }) => (
            <div className="max-w-72 whitespace-normal text-muted-foreground">
              {row.original.status === "withdrawn"
                ? "Withdrawn by the member"
                : row.original.reason}
            </div>
          ),
        }),
        open("View"),
      ]),
    }
    return sets
  }, [])

  return (
    <>
      <PageHeader
        title="Payments"
        description={
          byTab.pending.length
            ? `${plural(byTab.pending.length, "payment")} to approve, ${formatCad(pendingTotal)} in total. Nothing reaches a balance until it is approved.`
            : "Nothing is waiting for approval."
        }
      >
        <Button onClick={() => setRecording(true)}>
          <PlusIcon data-icon="inline-start" />
          Record a payment
        </Button>
      </PageHeader>

      <Tabs value={tab} onValueChange={(next) => setTab(next as Tab)}>
        <TabsList>
          <TabsTrigger value="pending">
            To approve
            {byTab.pending.length ? (
              <Badge variant="secondary">{byTab.pending.length}</Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>
        {(Object.keys(byTab) as Tab[]).map((key) => (
          <TabsContent key={key} value={key} className="pt-2">
            <DataTable
              data={byTab[key]}
              columns={columns[key]}
              rowId={(row) => row.id}
              numeric={["amount"]}
              initialSort={[
                {
                  id: key === "approved" ? "decidedOn" : "submittedOn",
                  desc: key !== "pending",
                },
              ]}
              noun="payments"
              empty={
                key === "pending"
                  ? "Nothing is waiting for approval."
                  : "No payments here yet."
              }
            />
          </TabsContent>
        ))}
      </Tabs>

      <PaymentReviewSheet paymentId={openId} onClose={() => setOpenId(null)} />
      <RecordPaymentDialog open={recording} onOpenChange={setRecording} />
    </>
  )
}
