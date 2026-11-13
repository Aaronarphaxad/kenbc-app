"use client"

import Link from "next/link"
import * as React from "react"
import { PlusIcon, SearchIcon } from "lucide-react"

import {
  columnHelperFor,
  DataTable,
  type DataColumn,
} from "@/components/data-table"
import { FilterSelect } from "@/components/filter-select"
import { useFund } from "@/components/fund-provider"
import { MemberFormDialog } from "@/components/member-dialogs"
import { PageHeader } from "@/components/page-header"
import { AccountBadge, StandingBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  accountLabels,
  formatCad,
  formatDate,
  plural,
  standingLabels,
} from "@/lib/format"
import { memberRows, type MemberRow } from "@/lib/fund"
import type { AccountStatus, Standing } from "@/lib/types"

type Row = {
  id: string
  name: string
  account: AccountStatus
  shortDays: number
  balance: number
  eligible: boolean
  joinedOn: string
  source: MemberRow
}

const helper = columnHelperFor<Row>()

const standingOptions: { value: Standing | "all"; label: string }[] = [
  { value: "all", label: "Any standing" },
  ...(Object.keys(standingLabels) as Standing[]).map((value) => ({
    value,
    label: standingLabels[value],
  })),
]

const accountOptions: { value: AccountStatus | "all"; label: string }[] = [
  { value: "all", label: "Any account" },
  ...(Object.keys(accountLabels) as AccountStatus[]).map((value) => ({
    value,
    label: accountLabels[value],
  })),
]

const columns: DataColumn<Row>[] = helper.columns([
  helper.accessor("name", {
    header: "Member",
    cell: ({ row }) => (
      <Link
        href={`/admin/members/${row.original.id}`}
        className="group flex flex-col outline-none"
      >
        <span className="font-medium underline-offset-4 group-hover:underline group-focus-visible:underline">
          {row.original.name}
        </span>
        <span className="text-xs text-muted-foreground">{row.original.id}</span>
      </Link>
    ),
  }),
  helper.accessor("account", {
    header: "Account",
    cell: ({ row }) => <AccountBadge status={row.original.account} />,
  }),
  helper.accessor("shortDays", {
    header: "Standing",
    cell: ({ row }) => <StandingBadge row={row.original.source} />,
  }),
  helper.accessor("balance", {
    header: "Balance",
    cell: ({ row }) => formatCad(row.original.balance),
  }),
  helper.accessor("eligible", {
    header: "Covered",
    cell: ({ row }) => {
      const failed = row.original.source.eligibility.checks.find(
        (check) => !check.passed
      )
      return (
        <div className="flex flex-col">
          <span>{row.original.eligible ? "Yes" : "No"}</span>
          {failed ? (
            <span className="text-xs text-muted-foreground">
              {failed.label}
            </span>
          ) : null}
        </div>
      )
    },
  }),
  helper.accessor("joinedOn", {
    header: "Member since",
    cell: ({ row }) => (
      <span className="whitespace-nowrap">
        {formatDate(row.original.joinedOn)}
      </span>
    ),
  }),
])

export default function MembersPage() {
  const { state, today } = useFund()
  const [query, setQuery] = React.useState("")
  const [standing, setStanding] = React.useState<Standing | "all">("all")
  const [account, setAccount] = React.useState<AccountStatus | "all">("all")
  const [adding, setAdding] = React.useState(false)

  const rows = React.useMemo(
    () =>
      memberRows(state, today).map(
        (source): Row => ({
          id: source.member.id,
          name: source.member.name,
          account: source.member.accountStatus,
          shortDays: source.info.daysShort,
          balance: source.info.balance,
          eligible: source.eligibility.eligible,
          joinedOn: source.member.joinedOn,
          source,
        })
      ),
    [state, today]
  )
  const needle = query.trim().toLowerCase()
  const shown = rows.filter(
    (row) =>
      (standing === "all" ||
        (row.account !== "invited" && row.source.info.standing === standing)) &&
      (account === "all" || row.account === account) &&
      (!needle ||
        [row.name, row.id, row.source.member.email, row.source.member.city]
          .join(" ")
          .toLowerCase()
          .includes(needle))
  )

  return (
    <>
      <PageHeader
        title="Members"
        description={`${plural(rows.length, "member")}. Standing and cover are worked out from each member's statement.`}
      >
        <Button onClick={() => setAdding(true)}>
          <PlusIcon data-icon="inline-start" />
          Add member
        </Button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="w-full sm:w-64">
          <InputGroupInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, number, email or city"
            aria-label="Search members"
          />
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
        </InputGroup>
        <FilterSelect
          label="Standing"
          value={standing}
          onChange={setStanding}
          options={standingOptions}
        />
        <FilterSelect
          label="Account"
          value={account}
          onChange={setAccount}
          options={accountOptions}
        />
      </div>

      <DataTable
        data={shown}
        columns={columns}
        rowId={(row) => row.id}
        numeric={["balance"]}
        pageSize={12}
        initialSort={[{ id: "name", desc: false }]}
        noun="members"
        empty="No members match."
      />

      <MemberFormDialog open={adding} onOpenChange={setAdding} />
    </>
  )
}
