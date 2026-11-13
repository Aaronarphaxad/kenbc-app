"use client"

import Link from "next/link"
import * as React from "react"
import { DownloadIcon, EllipsisIcon, PrinterIcon } from "lucide-react"
import { cn } from "cn"

import { ReverseEntryDialog } from "@/components/entry-dialogs"
import { useFund } from "@/components/fund-provider"
import { downloadCsv } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { formatCad, formatDate, kindLabels, methodLabels } from "@/lib/format"
import {
  canReverse,
  describeEntry,
  periodLabels,
  periodStart,
  reversalOf,
  statementFor,
  type Period,
} from "@/lib/fund"
import type { JournalEntry } from "@/lib/types"

const periodItems = (Object.keys(periodLabels) as Period[]).map((value) => ({
  value,
  label: periodLabels[value],
}))

export function PeriodSelect({
  value,
  onChange,
}: {
  value: Period
  onChange: (value: Period) => void
}) {
  return (
    <Select
      value={value}
      onValueChange={(next) => next && onChange(next as Period)}
      items={periodItems}
    >
      <SelectTrigger className="w-40" aria-label="Period">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {periodItems.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

function money(value: number) {
  return value > 0 ? formatCad(value) : ""
}

/**
 * A member's statement: opening balance, every posted line with a running
 * balance, and a closing balance. Admins see debit and credit and can reverse
 * a line; members see money out and money in.
 */
export function StatementTable({
  memberId,
  mode,
}: {
  memberId: string
  mode: "admin" | "member"
}) {
  const { state, today } = useFund()
  const [period, setPeriod] = React.useState<Period>("3-months")
  const [reversing, setReversing] = React.useState<JournalEntry | null>(null)

  const admin = mode === "admin"
  const from = periodStart(period, today)
  const statement = React.useMemo(
    () => statementFor(state, memberId, from, null),
    [state, memberId, from]
  )
  const pending = admin
    ? []
    : state.payments.filter(
        (payment) =>
          payment.memberId === memberId && payment.status === "pending"
      )
  const columns = admin ? 8 : 6
  const lead = admin ? 4 : 3

  function exportCsv() {
    downloadCsv(`statement-${memberId}-${today}.csv`, [
      ["Date", "Entry", "Description", "Reference", "Debit", "Credit", "Balance"],
      [from ?? "", "", "Opening balance", "", "", "", statement.opening.toFixed(2)],
      ...statement.rows.map(({ entry, balance }) => [
        entry.effectiveOn,
        entry.id,
        describeEntry(entry),
        entry.reference,
        entry.debit ? entry.debit.toFixed(2) : "",
        entry.credit ? entry.credit.toFixed(2) : "",
        balance.toFixed(2),
      ]),
      [
        today,
        "",
        "Closing balance",
        "",
        statement.debit.toFixed(2),
        statement.credit.toFixed(2),
        statement.closing.toFixed(2),
      ],
    ])
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <PeriodSelect value={period} onChange={setPeriod} />
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <DownloadIcon data-icon="inline-start" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <PrinterIcon data-icon="inline-start" />
            Print
          </Button>
        </div>
      </div>

      <div
        className={cn(
          "overflow-hidden rounded-lg border bg-card",
          !admin && "hidden md:block print:block"
        )}
      >
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Date</TableHead>
              {admin ? <TableHead>Entry</TableHead> : null}
              <TableHead>Description</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead className="text-right">
                {admin ? "Debit" : "Money out"}
              </TableHead>
              <TableHead className="text-right">
                {admin ? "Credit" : "Money in"}
              </TableHead>
              <TableHead className="text-right">Balance</TableHead>
              {admin ? (
                <TableHead className="w-10 print:hidden">
                  <span className="sr-only">Actions</span>
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="text-muted-foreground hover:bg-transparent">
              <TableCell>{from ? formatDate(from) : ""}</TableCell>
              <TableCell colSpan={lead - 1}>Opening balance</TableCell>
              <TableCell />
              <TableCell />
              <TableCell className="text-right tabular-nums">
                {formatCad(statement.opening)}
              </TableCell>
              {admin ? <TableCell className="print:hidden" /> : null}
            </TableRow>
            {statement.rows.map(({ entry, balance }) => {
              const reversedBy = reversalOf(state, entry.id)
              return (
                <TableRow key={entry.id}>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(entry.effectiveOn)}
                  </TableCell>
                  {admin ? (
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger className="cursor-default font-mono text-xs underline decoration-dotted underline-offset-4">
                          {entry.id}
                        </TooltipTrigger>
                        <TooltipContent>
                          Posted by {entry.postedBy} on{" "}
                          {formatDate(entry.postedOn)}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                  ) : null}
                  <TableCell className="whitespace-normal">
                    <span>{describeEntry(entry)}</span>
                    {reversedBy ? (
                      <span className="block text-xs text-muted-foreground">
                        Reversed by {reversedBy.id}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {entry.reference}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {money(entry.debit)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {money(entry.credit)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatCad(balance)}
                  </TableCell>
                  {admin ? (
                    <TableCell className="print:hidden">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={<Button variant="ghost" size="icon-sm" />}
                        >
                          <EllipsisIcon />
                          <span className="sr-only">
                            Actions for {entry.id}
                          </span>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem
                            disabled={!canReverse(state, entry)}
                            onClick={() => setReversing(entry)}
                          >
                            Reverse entry
                          </DropdownMenuItem>
                          {entry.source?.type === "payment" ? (
                            <DropdownMenuItem
                              render={
                                <Link
                                  href={`/admin/payments?payment=${entry.source.id}`}
                                />
                              }
                            >
                              Open payment
                            </DropdownMenuItem>
                          ) : null}
                          {entry.source?.type === "case" ? (
                            <DropdownMenuItem
                              render={
                                <Link
                                  href={`/admin/cases?case=${entry.source.id}`}
                                />
                              }
                            >
                              Open case
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  ) : null}
                </TableRow>
              )
            })}
            {statement.rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columns}
                  className="h-16 text-center text-muted-foreground"
                >
                  No entries in this period.
                </TableCell>
              </TableRow>
            ) : null}
            {pending.map((payment) => (
              <TableRow key={payment.id} className="text-muted-foreground">
                <TableCell className="whitespace-nowrap">
                  {formatDate(payment.paidOn)}
                </TableCell>
                <TableCell>
                  <span className="flex items-center gap-2">
                    Payment · {methodLabels[payment.method]}
                    <Badge variant="secondary">Awaiting approval</Badge>
                  </span>
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {payment.reference}
                </TableCell>
                <TableCell />
                <TableCell className="text-right tabular-nums">
                  {formatCad(payment.amount)}
                </TableCell>
                <TableCell className="text-right text-xs">
                  Not yet counted
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell>{formatDate(today)}</TableCell>
              <TableCell colSpan={lead - 1}>Closing balance</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCad(statement.debit)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCad(statement.credit)}
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {formatCad(statement.closing)}
              </TableCell>
              {admin ? <TableCell className="print:hidden" /> : null}
            </TableRow>
          </TableFooter>
        </Table>
      </div>

      {admin ? null : (
        <ul className="flex flex-col divide-y rounded-lg border bg-card md:hidden print:hidden">
          <li className="flex items-center justify-between gap-3 bg-muted/50 px-4 py-3 text-sm font-medium">
            <span>Balance today</span>
            <span className="tabular-nums">{formatCad(statement.closing)}</span>
          </li>
          {pending.map((payment) => (
            <li
              key={payment.id}
              className="flex items-start justify-between gap-3 px-4 py-3"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <span className="text-sm font-medium">
                  Payment · {methodLabels[payment.method]}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(payment.paidOn)}
                </span>
                <Badge variant="secondary">Awaiting approval</Badge>
              </div>
              <span className="text-sm text-muted-foreground tabular-nums">
                {formatCad(payment.amount)}
              </span>
            </li>
          ))}
          {[...statement.rows].reverse().map(({ entry, balance }) => (
            <li
              key={entry.id}
              className="flex items-start justify-between gap-3 px-4 py-3"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-medium">
                  {kindLabels[entry.kind]}
                </span>
                <span className="text-xs text-muted-foreground">
                  {[
                    formatDate(entry.effectiveOn),
                    entry.memo ||
                      (entry.method ? methodLabels[entry.method] : ""),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-0.5">
                <span className="text-sm font-medium tabular-nums">
                  {entry.credit > 0
                    ? `+${formatCad(entry.credit)}`
                    : `-${formatCad(entry.debit)}`}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatCad(balance)}
                </span>
              </div>
            </li>
          ))}
          <li className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-muted-foreground">
            <span>
              Opening balance{from ? `, ${formatDate(from)}` : ""}
            </span>
            <span className="tabular-nums">{formatCad(statement.opening)}</span>
          </li>
        </ul>
      )}

      <ReverseEntryDialog entry={reversing} onClose={() => setReversing(null)} />
    </div>
  )
}
