"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import * as React from "react"
import { EllipsisIcon } from "lucide-react"
import { toast } from "sonner"
import { cn } from "cn"

import {
  columnHelperFor,
  DataTable,
  type DataColumn,
} from "@/components/data-table"
import { useFund } from "@/components/fund-provider"
import { PageHeader } from "@/components/page-header"
import { RecordPaymentDialog } from "@/components/record-payment-dialog"
import { AccountBadge, StandingBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { TableCell, TableRow } from "@/components/ui/table"
import { formatCad, formatDate, plural } from "@/lib/format"
import {
  isInArrears,
  markReminderSent,
  memberRows,
  type MemberRow,
} from "@/lib/fund"
import { round2 } from "@/lib/rules"
import type { Rules, Standing } from "@/lib/types"

type Row = {
  id: string
  name: string
  daysShort: number
  shortfall: number
  pending: number
  lastReminderOn: string
  source: MemberRow
}

type Bucket = Exclude<Standing, "paid-up">

const helper = columnHelperFor<Row>()

function reminderText(row: MemberRow, rules: Rules) {
  const first = row.member.name.split(" ")[0]
  const due = row.info.graceEndsOn ? formatDate(row.info.graceEndsOn) : ""
  const deadline =
    row.info.standing === "grace"
      ? `Please top up by ${due} to stay in good standing.`
      : `Your grace period ended on ${due}, so you are not covered until this is paid.`
  return `Hello ${first}, this is a reminder from the KenBC Bereavement Fund. Your balance is ${formatCad(row.info.balance)}, which is ${formatCad(row.info.shortfall)} below the ${formatCad(rules.buffer)} buffer. ${deadline} You can pay by Interac e-Transfer to pay@kenbc.test, or sign in to tell us about a payment. Thank you.`
}

export default function ArrearsPage() {
  return (
    <React.Suspense fallback={null}>
      <Arrears />
    </React.Suspense>
  )
}

function Arrears() {
  const { state, today, run } = useFund()
  const params = useSearchParams()
  const [selected, setSelected] = React.useState<Bucket[]>(
    params.get("bucket") === "past" ? ["delinquent", "removal-review"] : []
  )
  const [payFor, setPayFor] = React.useState<string | null>(null)
  const { rules } = state

  const arrears = React.useMemo(
    () => memberRows(state, today).filter(isInArrears),
    [state, today]
  )
  const buckets: { id: Bucket; title: string; range: string }[] = [
    {
      id: "grace",
      title: "In grace",
      range: `Up to ${rules.graceDays} days short`,
    },
    {
      id: "delinquent",
      title: "Delinquent",
      range: `${rules.graceDays + 1} to ${rules.delinquencyDays} days short`,
    },
    {
      id: "removal-review",
      title: "Removal review",
      range: `Over ${rules.delinquencyDays} days short`,
    },
  ]

  const rows = arrears
    .filter(
      (row) =>
        selected.length === 0 || selected.includes(row.info.standing as Bucket)
    )
    .map(
      (source): Row => ({
        id: source.member.id,
        name: source.member.name,
        daysShort: source.info.daysShort,
        shortfall: source.info.shortfall,
        pending: source.pendingTotal,
        lastReminderOn: source.lastReminderOn ?? "",
        source,
      })
    )
  const total = round2(rows.reduce((sum, row) => sum + row.shortfall, 0))
  const pendingTotal = round2(rows.reduce((sum, row) => sum + row.pending, 0))

  const columns = React.useMemo<DataColumn<Row>[]>(
    () =>
      helper.columns([
        helper.accessor("name", {
          header: "Member",
          cell: ({ row }) => (
            <div className="flex flex-col gap-1">
              <Link
                href={`/admin/members/${row.original.id}`}
                className="font-medium whitespace-nowrap underline-offset-4 hover:underline"
              >
                {row.original.name}
              </Link>
              {row.original.source.member.accountStatus === "suspended" ? (
                <span>
                  <AccountBadge status="suspended" />
                </span>
              ) : null}
            </div>
          ),
        }),
        helper.accessor("daysShort", {
          header: "Days short",
          cell: ({ row }) => (
            <div className="flex flex-col items-end gap-0.5">
              <span>{row.original.daysShort}</span>
              <span className="text-xs text-muted-foreground">
                since{" "}
                {row.original.source.info.shortSince
                  ? formatDate(row.original.source.info.shortSince)
                  : ""}
              </span>
            </div>
          ),
        }),
        helper.display({
          id: "standing",
          header: "Standing",
          cell: ({ row }) => (
            <StandingBadge row={row.original.source} detail={false} />
          ),
        }),
        helper.accessor("shortfall", {
          header: "Owes",
          cell: ({ row }) => (
            <span className="font-medium">
              {formatCad(row.original.shortfall)}
            </span>
          ),
        }),
        helper.accessor("pending", {
          header: "Awaiting approval",
          cell: ({ row }) =>
            row.original.pending ? formatCad(row.original.pending) : "",
        }),
        helper.accessor("lastReminderOn", {
          header: "Last reminder",
          cell: ({ row }) =>
            row.original.lastReminderOn ? (
              <span className="whitespace-nowrap">
                {formatDate(row.original.lastReminderOn)}
              </span>
            ) : (
              <span className="text-muted-foreground">None sent</span>
            ),
        }),
        helper.display({
          id: "actions",
          header: () => <span className="sr-only">Actions</span>,
          cell: ({ row }) => (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="ghost" size="icon-sm" />}
              >
                <EllipsisIcon />
                <span className="sr-only">
                  Actions for {row.original.name}
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={() => setPayFor(row.original.id)}>
                  Record payment
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    const text = reminderText(row.original.source, rules)
                    navigator.clipboard
                      .writeText(text)
                      .then(() => toast.success("Reminder text copied"))
                      .catch(() => toast.error("Could not copy the reminder"))
                  }}
                >
                  Copy reminder text
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    if (run(markReminderSent, row.original.id)) {
                      toast.success(
                        `Reminder logged for ${row.original.name}`
                      )
                    }
                  }}
                >
                  Mark reminder sent
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ),
        }),
      ]),
    [rules, run]
  )

  return (
    <>
      <PageHeader
        title="Arrears"
        description="Members under the buffer, aged from the day their balance dropped. Nothing here is typed in."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {buckets.map((bucket) => {
          const members = arrears.filter(
            (row) => row.info.standing === bucket.id
          )
          const owing = round2(
            members.reduce((sum, row) => sum + row.info.shortfall, 0)
          )
          const pressed = selected.includes(bucket.id)
          return (
            <button
              key={bucket.id}
              type="button"
              aria-pressed={pressed}
              onClick={() =>
                setSelected((current) =>
                  current.includes(bucket.id)
                    ? current.filter((item) => item !== bucket.id)
                    : [...current, bucket.id]
                )
              }
              className={cn(
                "flex flex-col gap-1 rounded-xs border bg-card p-4 text-left outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50",
                pressed && "border-primary/40 bg-primary/5 hover:bg-primary/5"
              )}
            >
              <span className="text-sm text-muted-foreground">
                {bucket.title}
              </span>
              <span className="text-2xl font-semibold tabular-nums">
                {formatCad(owing)}
              </span>
              <span className="text-sm text-muted-foreground">
                {plural(members.length, "member")} · {bucket.range}
              </span>
            </button>
          )
        })}
      </div>

      <DataTable
        data={rows}
        columns={columns}
        rowId={(row) => row.id}
        numeric={["daysShort", "shortfall", "pending"]}
        pageSize={12}
        initialSort={[{ id: "daysShort", desc: true }]}
        noun="members"
        empty={
          arrears.length
            ? "Nobody in the selected age range."
            : "Every member is paid up."
        }
        footer={
          <TableRow>
            <TableCell colSpan={3}>
              Total owing, {plural(rows.length, "member")}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatCad(total)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {pendingTotal ? formatCad(pendingTotal) : ""}
            </TableCell>
            <TableCell colSpan={2} />
          </TableRow>
        }
      />

      <RecordPaymentDialog
        key={payFor ?? "none"}
        open={Boolean(payFor)}
        onOpenChange={(open) => !open && setPayFor(null)}
        memberId={payFor ?? undefined}
      />
    </>
  )
}
