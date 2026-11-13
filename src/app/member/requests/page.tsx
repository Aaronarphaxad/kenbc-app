"use client"

import Link from "next/link"
import { ChevronRightIcon, HeartHandshakeIcon } from "lucide-react"

import { useFund } from "@/components/fund-provider"
import { PageHeader } from "@/components/page-header"
import { CaseBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { formatDate } from "@/lib/format"

export default function RequestsPage() {
  const { state, me } = useFund()
  if (!me) return null

  const cases = state.cases
    .filter((item) => item.memberId === me.id)
    .reverse()

  return (
    <>
      <PageHeader
        title="Requests"
        description="Ask the fund for support after a death in your immediate family."
      >
        {cases.length ? (
          <Button
            nativeButton={false}
            render={<Link href="/member/requests/new" />}
          >
            New request
          </Button>
        ) : null}
      </PageHeader>

      {cases.length ? (
        <ul className="flex flex-col divide-y rounded-xs border bg-card">
          {cases.map((item) => (
            <li key={item.id}>
              <Link
                href={`/member/requests/${item.id}`}
                className="flex items-center gap-3 px-4 py-4 outline-none hover:bg-muted/50 focus-visible:bg-muted/50"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-sm font-medium">
                    {item.subjectName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {item.relationship} · submitted{" "}
                    {formatDate(item.submittedOn)}
                  </span>
                </span>
                <CaseBadge status={item.status} />
                <ChevronRightIcon className="size-4 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Empty className="border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HeartHandshakeIcon />
            </EmptyMedia>
            <EmptyTitle>No requests</EmptyTitle>
            <EmptyDescription>
              If you lose a spouse, child, parent or sibling, you can ask the
              fund for support here.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              nativeButton={false}
              render={<Link href="/member/requests/new" />}
            >
              New request
            </Button>
          </EmptyContent>
        </Empty>
      )}
    </>
  )
}
