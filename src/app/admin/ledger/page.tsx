"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import * as React from "react"
import { DownloadIcon, EllipsisIcon, SearchIcon } from "lucide-react"

import {
  columnHelperFor,
  DataTable,
  type DataColumn,
} from "@/components/data-table"
import { ReverseEntryDialog } from "@/components/entry-dialogs"
import { FilterSelect } from "@/components/filter-select"
import { useFund } from "@/components/fund-provider"
import { downloadCsv, PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  formatCad,
  formatDate,
  formatMonth,
  kindLabels,
  methodLabels,
} from "@/lib/format"
import {
  canReverse,
  describeEntry,
  memberName,
  monthlySummary,
  periodLabels,
  periodStart,
  reversalOf,
  type Period,
} from "@/lib/fund"
import { round2 } from "@/lib/rules"
import type { EntryKind, JournalEntry, PaymentMethod } from "@/lib/types"

type LedgerRow = JournalEntry & {
  member: string
  description: string
}

const helper = columnHelperFor<LedgerRow>()

const periodOptions = (Object.keys(periodLabels) as Period[]).map((value) => ({
  value,
  label: periodLabels[value],
}))

const kindOptions: { value: EntryKind | "all"; label: string }[] = [
  { value: "all", label: "All kinds" },
  ...(Object.keys(kindLabels) as EntryKind[]).map((value) => ({
    value,
    label: kindLabels[value],
  })),
]

const methodOptions: { value: PaymentMethod | "all"; label: string }[] = [
  { value: "all", label: "All methods" },
  ...(Object.keys(methodLabels) as PaymentMethod[]).map((value) => ({
    value,
    label: methodLabels[value],
  })),
]

export default function LedgerPage() {
  return (
    <React.Suspense fallback={null}>
      <Ledger />
    </React.Suspense>
  )
}

function Ledger() {
  const { state, today } = useFund()
  const params = useSearchParams()
  const [period, setPeriod] = React.useState<Period>("all")
  const [kind, setKind] = React.useState<EntryKind | "all">("all")
  const [method, setMethod] = React.useState<PaymentMethod | "all">("all")
  const [member, setMember] = React.useState(params.get("member") ?? "all")
  const [query, setQuery] = React.useState(params.get("q") ?? "")
  const [reversing, setReversing] = React.useState<JournalEntry | null>(null)

  const memberOptions = React.useMemo(
    () => [
      { value: "all", label: "All members" },
      ...state.members.map((item) => ({ value: item.id, label: item.name })),
    ],
    [state.members]
  )

  const rows = React.useMemo(() => {
    const from = periodStart(period, today)
    const needle = query.trim().toLowerCase()
    return state.journal
      .map(
        (entry): LedgerRow => ({
          ...entry,
          member: memberName(state, entry.memberId),
          description: describeEntry(entry),
        })
      )
      .filter(
        (row) =>
          (!from || row.effectiveOn >= from) &&
          (kind === "all" || row.kind === kind) &&
          (method === "all" || row.method === method) &&
          (member === "all" || row.memberId === member) &&
          (!needle ||
            [row.id, row.member, row.description, row.reference]
              .join(" ")
              .toLowerCase()
              .includes(needle))
      )
  }, [state, today, period, kind, method, member, query])

  const totals = React.useMemo(
    () => ({
      debit: round2(rows.reduce((sum, row) => sum + row.debit, 0)),
      credit: round2(rows.reduce((sum, row) => sum + row.credit, 0)),
    }),
    [rows]
  )

  const columns = React.useMemo<DataColumn<LedgerRow>[]>(
    () =>
      helper.columns([
        helper.accessor("effectiveOn", {
          header: "Date",
          cell: ({ row }) => (
            <span className="whitespace-nowrap">
              {formatDate(row.original.effectiveOn)}
            </span>
          ),
        }),
        helper.accessor("id", {
          header: "Entry",
          cell: ({ row }) => (
            <span
              className="font-mono text-xs"
              title={`Posted by ${row.original.postedBy} on ${formatDate(row.original.postedOn)}`}
            >
              {row.original.id}
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
        helper.accessor("description", {
          header: "Description",
          enableSorting: false,
          cell: ({ row }) => {
            const reversedBy = reversalOf(state, row.original.id)
            return (
              <div className="max-w-80 whitespace-normal">
                {row.original.description}
                {reversedBy ? (
                  <span className="block text-xs text-muted-foreground">
                    Reversed by {reversedBy.id}
                  </span>
                ) : null}
              </div>
            )
          },
        }),
        helper.accessor("reference", {
          header: "Reference",
          enableSorting: false,
          cell: ({ row }) => (
            <span className="font-mono text-xs">{row.original.reference}</span>
          ),
        }),
        helper.accessor("debit", {
          header: "Debit",
          cell: ({ row }) =>
            row.original.debit ? formatCad(row.original.debit) : "",
        }),
        helper.accessor("credit", {
          header: "Credit",
          cell: ({ row }) =>
            row.original.credit ? formatCad(row.original.credit) : "",
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
                <span className="sr-only">Actions for {row.original.id}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem
                  disabled={!canReverse(state, row.original)}
                  onClick={() => setReversing(row.original)}
                >
                  Reverse entry
                </DropdownMenuItem>
                <DropdownMenuItem
                  render={
                    <Link href={`/admin/members/${row.original.memberId}`} />
                  }
                >
                  Open statement
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ),
        }),
      ]),
    [state]
  )

  const summary = React.useMemo(
    () => monthlySummary(state, today),
    [state, today]
  )
  const summaryTotals = summary.reduce(
    (sum, row) => ({
      broughtForward: sum.broughtForward + row.broughtForward,
      receipts: sum.receipts + row.receipts,
      levies: sum.levies + row.levies,
      adjustments: sum.adjustments + row.adjustments,
    }),
    { broughtForward: 0, receipts: 0, levies: 0, adjustments: 0 }
  )

  function exportCsv() {
    downloadCsv(`kenbc-ledger-${today}.csv`, [
      ["Date", "Entry", "Member no.", "Member", "Description", "Reference", "Debit", "Credit", "Posted by", "Posted on"],
      ...[...rows]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((row) => [
          row.effectiveOn,
          row.id,
          row.memberId,
          row.member,
          row.description,
          row.reference,
          row.debit ? row.debit.toFixed(2) : "",
          row.credit ? row.credit.toFixed(2) : "",
          row.postedBy,
          row.postedOn,
        ]),
    ])
  }

  return (
    <>
      <PageHeader
        title="Ledger"
        description="Every posted line for every member. Lines are never edited; mistakes are reversed."
      >
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <DownloadIcon data-icon="inline-start" />
          Export CSV
        </Button>
      </PageHeader>

      <Tabs defaultValue="journal">
        <TabsList>
          <TabsTrigger value="journal">Journal</TabsTrigger>
          <TabsTrigger value="summary">Monthly summary</TabsTrigger>
        </TabsList>

        <TabsContent value="journal" className="flex flex-col gap-3 pt-2">
          <div className="flex flex-wrap items-center gap-2">
            <InputGroup className="w-full sm:w-56">
              <InputGroupInput
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Entry, reference, case"
                aria-label="Search the ledger"
              />
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
            </InputGroup>
            <FilterSelect
              label="Period"
              value={period}
              onChange={setPeriod}
              options={periodOptions}
              className="w-40"
            />
            <FilterSelect
              label="Kind"
              value={kind}
              onChange={setKind}
              options={kindOptions}
            />
            <FilterSelect
              label="Method"
              value={method}
              onChange={setMethod}
              options={methodOptions}
            />
            <FilterSelect
              label="Member"
              value={member}
              onChange={setMember}
              options={memberOptions}
            />
          </div>
          <DataTable
            data={rows}
            columns={columns}
            rowId={(row) => row.id}
            numeric={["debit", "credit"]}
            pageSize={15}
            initialSort={[{ id: "id", desc: true }]}
            noun="entries"
            empty="No entries match these filters."
            footer={
              <TableRow>
                <TableCell colSpan={5}>
                  Total for {rows.length}{" "}
                  {rows.length === 1 ? "entry" : "entries"}
                  <span className="ml-2 font-normal text-muted-foreground">
                    Net {formatCad(round2(totals.credit - totals.debit))}
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCad(totals.debit)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCad(totals.credit)}
                </TableCell>
                <TableCell />
              </TableRow>
            }
          />
        </TabsContent>

        <TabsContent value="summary" className="flex flex-col gap-3 pt-2">
          <p className="text-sm text-muted-foreground">
            Opening, plus balances brought forward and receipts, less levies,
            plus or minus adjustments, equals closing.
          </p>
          <div className="overflow-hidden rounded-lg border bg-card">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Opening</TableHead>
                  <TableHead className="text-right">Brought forward</TableHead>
                  <TableHead className="text-right">Receipts</TableHead>
                  <TableHead className="text-right">Levies</TableHead>
                  <TableHead className="text-right">Adjustments</TableHead>
                  <TableHead className="text-right">Closing</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.map((row) => (
                  <TableRow key={row.month}>
                    <TableCell className="font-medium">
                      {formatMonth(row.month)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCad(row.opening)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.broughtForward ? formatCad(row.broughtForward) : ""}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCad(row.receipts)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCad(row.levies)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.adjustments ? formatCad(row.adjustments) : ""}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatCad(row.closing)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>Total</TableCell>
                  <TableCell />
                  <TableCell className="text-right tabular-nums">
                    {formatCad(summaryTotals.broughtForward)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCad(summaryTotals.receipts)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCad(summaryTotals.levies)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCad(summaryTotals.adjustments)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCad(summary[summary.length - 1]?.closing ?? 0)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <ReverseEntryDialog entry={reversing} onClose={() => setReversing(null)} />
    </>
  )
}
