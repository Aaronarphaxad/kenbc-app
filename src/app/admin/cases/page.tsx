"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import * as React from "react"

import { CasePanel } from "@/components/case-panel"
import { turnaroundText } from "@/components/case-timeline"
import {
  columnHelperFor,
  DataTable,
  type DataColumn,
} from "@/components/data-table"
import { useFund } from "@/components/fund-provider"
import { PageHeader } from "@/components/page-header"
import { CaseBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatCad, formatDate, plural } from "@/lib/format"
import { memberName } from "@/lib/fund"
import type { BereavementCase } from "@/lib/types"

type CaseRow = BereavementCase & {
  member: string
  levyTotal: number
  turnaround: string
}

type View = "open" | "finished" | "all"

const helper = columnHelperFor<CaseRow>()

const nextStep: Record<BereavementCase["status"], string> = {
  submitted: "Start review",
  "under-review": "Decide",
  approved: "Record payout",
  disbursed: "Close",
  closed: "",
  declined: "",
}

export default function CasesPage() {
  return (
    <React.Suspense fallback={null}>
      <Cases />
    </React.Suspense>
  )
}

function Cases() {
  const { state, today } = useFund()
  const params = useSearchParams()
  const [openId, setOpenId] = React.useState<string | null>(params.get("case"))
  const [view, setView] = React.useState<View>(
    params.get("case") ? "all" : "open"
  )

  const rows = React.useMemo(
    () =>
      state.cases.map(
        (item): CaseRow => ({
          ...item,
          member: memberName(state, item.memberId),
          levyTotal: item.levy?.total ?? 0,
          turnaround: turnaroundText(item, today),
        })
      ),
    [state, today]
  )
  const open = rows.filter(
    (row) => row.status !== "closed" && row.status !== "declined"
  )
  const shown =
    view === "open"
      ? open
      : view === "finished"
        ? rows.filter(
            (row) => row.status === "closed" || row.status === "declined"
          )
        : rows

  const columns = React.useMemo<DataColumn<CaseRow>[]>(
    () =>
      helper.columns([
        helper.accessor("id", {
          header: "Case",
          cell: ({ row }) => (
            <span className="font-mono text-xs">{row.original.id}</span>
          ),
        }),
        helper.accessor("subjectName", {
          header: "Person who died",
          cell: ({ row }) => (
            <div className="flex flex-col">
              <span className="font-medium">{row.original.subjectName}</span>
              <span className="text-xs text-muted-foreground">
                {row.original.relationship}
              </span>
            </div>
          ),
        }),
        helper.accessor("member", {
          header: "Member",
          cell: ({ row }) => (
            <Link
              href={`/admin/members/${row.original.memberId}`}
              className="whitespace-nowrap underline-offset-4 hover:underline"
            >
              {row.original.member}
            </Link>
          ),
        }),
        helper.accessor("submittedOn", {
          header: "Submitted",
          cell: ({ row }) => (
            <div className="flex flex-col">
              <span className="whitespace-nowrap">
                {formatDate(row.original.submittedOn)}
              </span>
              <span className="text-xs text-muted-foreground">
                {row.original.turnaround}
              </span>
            </div>
          ),
        }),
        helper.accessor("status", {
          header: "Status",
          cell: ({ row }) => <CaseBadge status={row.original.status} />,
        }),
        helper.accessor("levyTotal", {
          header: "Levy",
          cell: ({ row }) =>
            row.original.levy ? formatCad(row.original.levy.total) : "",
        }),
        helper.display({
          id: "open",
          header: () => <span className="sr-only">Open</span>,
          cell: ({ row }) => {
            const step = nextStep[row.original.status]
            return (
              <div className="flex justify-end">
                <Button
                  variant={step ? "default" : "outline"}
                  size="sm"
                  onClick={() => setOpenId(row.original.id)}
                >
                  {step || "View"}
                </Button>
              </div>
            )
          },
        }),
      ]),
    []
  )

  return (
    <>
      <PageHeader
        title="Cases"
        description={
          open.length
            ? `${plural(open.length, "case")} in progress. Approving a case posts the levy to every active member.`
            : "No cases in progress."
        }
      />

      <Tabs value={view} onValueChange={(next) => setView(next as View)}>
        <TabsList>
          <TabsTrigger value="open">
            In progress
            {open.length ? (
              <Badge variant="secondary">{open.length}</Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="finished">Finished</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      <DataTable
        key={view}
        data={shown}
        columns={columns}
        rowId={(row) => row.id}
        numeric={["levyTotal"]}
        initialSort={[{ id: "submittedOn", desc: true }]}
        noun="cases"
        empty="No cases here."
      />

      <CasePanel caseId={openId} onClose={() => setOpenId(null)} />
    </>
  )
}
