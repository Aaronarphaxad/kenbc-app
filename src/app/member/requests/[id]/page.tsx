"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { ChevronLeftIcon, FileTextIcon } from "lucide-react"

import { CaseTimeline } from "@/components/case-timeline"
import { useFund } from "@/components/fund-provider"
import { Detail } from "@/components/page-header"
import { CaseBadge } from "@/components/status-badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { formatCad, formatDate, methodLabels } from "@/lib/format"
import type { BereavementCase } from "@/lib/types"

function statusSentence(item: BereavementCase) {
  if (item.status === "submitted") {
    return "We have your request. The committee will pick it up shortly."
  }
  if (item.status === "under-review") {
    return "The committee is reviewing your request."
  }
  if (item.status === "approved") {
    return `Approved. The fund is preparing a payment of ${formatCad(item.levy?.total ?? 0)} to you.`
  }
  if (item.status === "declined") {
    return "The committee was not able to approve this request."
  }
  if (item.disbursement) {
    return `${formatCad(item.disbursement.amount)} was paid to you by ${methodLabels[item.disbursement.method]} on ${formatDate(item.disbursement.paidOn)}.`
  }
  return ""
}

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { state, me, today } = useFund()
  if (!me) return null

  const item = state.cases.find(
    (entry) => entry.id === id && entry.memberId === me.id
  )

  return (
    <>
      <Link
        href="/member/requests"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeftIcon className="size-4" />
        Requests
      </Link>

      {item ? (
        <>
          <Card>
            <CardHeader>
              <CardDescription className="flex items-center gap-2">
                {item.id}
                <CaseBadge status={item.status} />
              </CardDescription>
              <CardTitle className="text-xl font-semibold text-balance">
                {statusSentence(item)}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              {item.status === "declined" ? (
                <Alert>
                  <AlertTitle>Reason given by the committee</AlertTitle>
                  <AlertDescription>{item.decisionReason}</AlertDescription>
                </Alert>
              ) : null}
              <CaseTimeline item={item} today={today} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>What you sent</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <dl className="flex flex-col gap-2">
                <Detail label="Person who died">{item.subjectName}</Detail>
                <Detail label="Relationship to you">
                  {item.relationship}
                </Detail>
                <Detail label="Date of death">
                  {formatDate(item.dateOfDeath)}
                </Detail>
                <Detail label="Submitted">
                  {formatDate(item.submittedOn)}
                </Detail>
                {item.disbursement?.reference ? (
                  <Detail label="Payment reference">
                    {item.disbursement.reference}
                  </Detail>
                ) : null}
              </dl>
              {item.documents.length ? (
                <ul className="flex flex-wrap gap-2">
                  {item.documents.map((name) => (
                    <li
                      key={name}
                      className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs"
                    >
                      <FileTextIcon className="size-3.5 text-muted-foreground" />
                      {name}
                    </li>
                  ))}
                </ul>
              ) : null}
            </CardContent>
          </Card>
        </>
      ) : (
        <Empty className="border bg-card">
          <EmptyHeader>
            <EmptyTitle>Request not found</EmptyTitle>
            <EmptyDescription>
              This request is not on your account.
            </EmptyDescription>
          </EmptyHeader>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/member/requests" />}
          >
            Back to requests
          </Button>
        </Empty>
      )}
    </>
  )
}
