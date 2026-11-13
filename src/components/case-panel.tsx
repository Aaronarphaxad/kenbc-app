"use client"

import Link from "next/link"
import * as React from "react"
import { CheckIcon, FileTextIcon, XIcon } from "lucide-react"
import { toast } from "sonner"

import { AuditList } from "@/components/audit-list"
import { CaseTimeline } from "@/components/case-timeline"
import { FilterSelect } from "@/components/filter-select"
import { useFund } from "@/components/fund-provider"
import { Detail } from "@/components/page-header"
import { CaseBadge } from "@/components/status-badge"
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
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import {
  formatCad,
  formatDate,
  methodLabels,
  referenceLabels,
} from "@/lib/format"
import {
  approveCase,
  auditFor,
  closeCase,
  declineCase,
  disburseCase,
  levyMembers,
  memberById,
  saveCaseNotes,
  startReview,
} from "@/lib/fund"
import { eligibilityOf, round2 } from "@/lib/rules"
import type { BereavementCase, PaymentMethod } from "@/lib/types"

const payoutOptions = (["interac", "cheque", "deposit", "cash"] as const).map(
  (value) => ({ value, label: methodLabels[value] })
)

export function CasePanel({
  caseId,
  onClose,
}: {
  caseId: string | null
  onClose: () => void
}) {
  const { state } = useFund()
  const item = state.cases.find((entry) => entry.id === caseId)

  return (
    <Sheet open={Boolean(item)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 data-[side=right]:sm:max-w-lg">
        {item ? <Panel key={item.id} item={item} /> : null}
      </SheetContent>
    </Sheet>
  )
}

function Panel({ item }: { item: BereavementCase }) {
  const { state, today } = useFund()
  const member = memberById(state, item.memberId)
  if (!member) return null

  const eligibility = eligibilityOf(state, member, item.submittedOn)
  const history = auditFor(state, (event) => event.caseId === item.id)

  return (
    <>
      <SheetHeader className="border-b">
        <SheetTitle className="flex flex-wrap items-center gap-2">
          {item.id} · {item.subjectName}
          <CaseBadge status={item.status} />
        </SheetTitle>
        <SheetDescription>
          {item.relationship} of{" "}
          <Link
            href={`/admin/members/${member.id}`}
            className="underline underline-offset-4"
          >
            {member.name}
          </Link>
          , submitted {formatDate(item.submittedOn)}
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
        <NextStep
          key={item.status}
          item={item}
          eligible={eligibility.eligible}
        />

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">
            Was {member.name.split(" ")[0]} eligible on{" "}
            {formatDate(item.submittedOn)}?
          </h3>
          <ul className="flex flex-col gap-1.5">
            {eligibility.checks.map((check) => (
              <li key={check.label} className="flex items-center gap-2 text-sm">
                {check.passed ? (
                  <CheckIcon className="size-4 text-primary" />
                ) : (
                  <XIcon className="size-4 text-destructive" />
                )}
                {check.label}
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">
            {eligibility.eligible
              ? "Eligible for the benefit when the request came in."
              : "Not eligible under the rules when the request came in."}
          </p>
        </section>

        <Separator />

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Request</h3>
          <dl className="flex flex-col gap-2">
            <Detail label="Person who died">{item.subjectName}</Detail>
            <Detail label="Relationship to member">{item.relationship}</Detail>
            <Detail label="Date of death">
              {formatDate(item.dateOfDeath)}
            </Detail>
            {item.levy ? (
              <Detail label="Levy posted">
                <Link
                  href={`/admin/ledger?q=${item.id}`}
                  className="underline underline-offset-4"
                >
                  {item.levy.count} x {formatCad(item.levy.amount)} ={" "}
                  {formatCad(item.levy.total)}
                </Link>
              </Detail>
            ) : null}
            {item.disbursement ? (
              <Detail label="Paid out">
                {formatCad(item.disbursement.amount)} by{" "}
                {methodLabels[item.disbursement.method]}
                {item.disbursement.reference
                  ? ` (${item.disbursement.reference})`
                  : ""}
              </Detail>
            ) : null}
          </dl>
          {item.documents.length ? (
            <ul className="flex flex-wrap gap-2 pt-1">
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
          ) : (
            <p className="text-sm text-muted-foreground">
              No documents attached.
            </p>
          )}
        </section>

        <Separator />

        <Notes item={item} />

        <Separator />

        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-medium">Progress</h3>
          <CaseTimeline item={item} today={today} />
        </section>

        <Separator />

        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-medium">History</h3>
          <AuditList events={history} />
        </section>
      </div>
    </>
  )
}

function ActionBox({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xs border bg-muted/40 p-4">
      <h3 className="text-sm font-medium">{title}</h3>
      {children}
    </section>
  )
}

/** Only the step that is valid from the current status is ever offered. */
function NextStep({
  item,
  eligible,
}: {
  item: BereavementCase
  eligible: boolean
}) {
  const { state, run, today } = useFund()
  const [mode, setMode] = React.useState<"idle" | "approve" | "decline">(
    "idle"
  )
  const [reason, setReason] = React.useState("")
  const [amount, setAmount] = React.useState(String(item.levy?.total ?? ""))
  const [method, setMethod] = React.useState<PaymentMethod>("interac")
  const [paidOn, setPaidOn] = React.useState(today)
  const [reference, setReference] = React.useState("")

  if (item.status === "submitted") {
    return (
      <ActionBox title="Next step: start the review">
        <p className="text-sm text-muted-foreground">
          Marks the request as under review so the member can see the committee
          has picked it up.
        </p>
        <div>
          <Button
            onClick={() => {
              if (run(startReview, item.id)) toast.success("Review started")
            }}
          >
            Start review
          </Button>
        </div>
      </ActionBox>
    )
  }

  if (item.status === "under-review") {
    const count = levyMembers(state).length
    const total = round2(count * state.rules.levy)

    if (mode === "approve") {
      return (
        <ActionBox title="Approve and post the levy">
          <p className="text-2xl font-semibold tracking-tight tabular-nums">
            {count} active members x {formatCad(state.rules.levy)} ={" "}
            {formatCad(total)}
          </p>
          <p className="text-sm text-muted-foreground">
            One levy line is posted to every active member today, linked to
            this case. Anyone it takes under the buffer starts their grace
            period today. The payout to the family is {formatCad(total)}.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                if (run(approveCase, item.id)) {
                  toast.success(
                    `Approved. Levy posted to ${count} members.`
                  )
                  setMode("idle")
                }
              }}
            >
              Approve and post levy
            </Button>
            <Button variant="outline" onClick={() => setMode("idle")}>
              Cancel
            </Button>
          </div>
        </ActionBox>
      )
    }

    if (mode === "decline") {
      return (
        <ActionBox title="Decline the request">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="decline-reason">Reason</FieldLabel>
              <Textarea
                id="decline-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Write this for the member. They will read it."
              />
              <FieldDescription>
                No levy is posted when a request is declined.
              </FieldDescription>
            </Field>
          </FieldGroup>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="destructive"
              disabled={!reason.trim()}
              onClick={() => {
                if (run(declineCase, item.id, reason)) {
                  toast.success("Request declined")
                  setMode("idle")
                }
              }}
            >
              Decline request
            </Button>
            <Button variant="outline" onClick={() => setMode("idle")}>
              Cancel
            </Button>
          </div>
        </ActionBox>
      )
    }

    return (
      <ActionBox title="Next step: decide">
        <p className="text-sm text-muted-foreground">
          {eligible
            ? `Approving posts a levy of ${formatCad(state.rules.levy)} to ${count} active members (${formatCad(total)}).`
            : "The member was not eligible when this came in. Check the points below before deciding."}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setMode("approve")}>Approve</Button>
          <Button variant="outline" onClick={() => setMode("decline")}>
            Decline
          </Button>
        </div>
      </ActionBox>
    )
  }

  if (item.status === "approved") {
    const value = Number(amount)
    return (
      <ActionBox title="Next step: record the payout">
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="payout-amount">Amount paid</FieldLabel>
              <Input
                id="payout-amount"
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="payout-date">Date paid</FieldLabel>
              <Input
                id="payout-date"
                type="date"
                max={today}
                value={paidOn}
                onChange={(event) => setPaidOn(event.target.value)}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="payout-method">Method</FieldLabel>
              <FilterSelect
                id="payout-method"
                label="Method"
                value={method}
                onChange={setMethod}
                options={payoutOptions}
                className="w-full"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="payout-reference">
                {referenceLabels[method]}
              </FieldLabel>
              <Input
                id="payout-reference"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
              />
            </Field>
          </div>
          <FieldDescription>
            The levy for this case raised {formatCad(item.levy?.total ?? 0)}.
          </FieldDescription>
        </FieldGroup>
        <div>
          <Button
            disabled={!(value > 0) || !paidOn || paidOn > today}
            onClick={() => {
              if (
                run(disburseCase, item.id, {
                  amount: value,
                  method,
                  paidOn,
                  reference,
                })
              ) {
                toast.success("Payout recorded")
              }
            }}
          >
            Record payout
          </Button>
        </div>
      </ActionBox>
    )
  }

  if (item.status === "disbursed") {
    return (
      <ActionBox title="Next step: close the case">
        <p className="text-sm text-muted-foreground">
          The payout is recorded. Close the case once the family has confirmed
          they received it.
        </p>
        <div>
          <Button
            onClick={() => {
              if (run(closeCase, item.id)) toast.success("Case closed")
            }}
          >
            Close case
          </Button>
        </div>
      </ActionBox>
    )
  }

  if (item.status === "declined") {
    return (
      <ActionBox title="Declined">
        <p className="text-sm">{item.decisionReason}</p>
      </ActionBox>
    )
  }

  return null
}

function Notes({ item }: { item: BereavementCase }) {
  const { run } = useFund()
  const [notes, setNotes] = React.useState(item.notes)
  const changed = notes.trim() !== item.notes

  return (
    <section className="flex flex-col gap-2">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="case-notes">Committee notes</FieldLabel>
          <Textarea
            id="case-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Private to the committee"
          />
          <FieldDescription>
            Saving notes never changes the status.
          </FieldDescription>
        </Field>
      </FieldGroup>
      <div>
        <Button
          variant="outline"
          size="sm"
          disabled={!changed}
          onClick={() => {
            if (run(saveCaseNotes, item.id, notes)) toast.success("Notes saved")
          }}
        >
          Save notes
        </Button>
      </div>
    </section>
  )
}
