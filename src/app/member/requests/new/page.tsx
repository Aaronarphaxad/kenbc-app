"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import * as React from "react"
import { ChevronLeftIcon } from "lucide-react"
import { toast } from "sonner"

import { FilterSelect } from "@/components/filter-select"
import { useFund } from "@/components/fund-provider"
import { PageHeader } from "@/components/page-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { formatCad, formatDate } from "@/lib/format"
import { levyMembers, memberRow, submitCase } from "@/lib/fund"
import { round2 } from "@/lib/rules"

const relationships = [
  "Spouse",
  "Child",
  "Parent",
  "Sibling",
  "Other relative",
].map((value) => ({ value, label: value }))

export default function NewRequestPage() {
  const { state, me, today, run } = useFund()
  const router = useRouter()
  const [subjectName, setSubjectName] = React.useState("")
  const [relationship, setRelationship] = React.useState("Parent")
  const [dateOfDeath, setDateOfDeath] = React.useState("")
  const [documents, setDocuments] = React.useState<string[]>([])
  const [tried, setTried] = React.useState(false)

  if (!me) return null

  const { rules } = state
  const { info, eligibility } = memberRow(state, me, today)
  const waiting = today < eligibility.waitingEndsOn
  const standingOk = info.standing === "paid-up" || info.standing === "grace"
  const nameValid = subjectName.trim().length > 0
  const dateValid = Boolean(dateOfDeath) && dateOfDeath <= today
  const payout = round2(levyMembers(state).length * rules.levy)

  return (
    <>
      <Link
        href="/member/requests"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeftIcon className="size-4" />
        Requests
      </Link>
      <PageHeader
        title="New bereavement request"
        description="We are sorry for your loss. Tell us what happened and the committee will review it."
      />

      {eligibility.eligible ? null : (
        <Alert>
          <AlertTitle>
            {me.accountStatus !== "active"
              ? "Your account is not active"
              : waiting && standingOk
                ? `Your waiting period ends on ${formatDate(eligibility.waitingEndsOn)}`
                : `You owe ${formatCad(info.shortfall)} and your grace period has ended`}
          </AlertTitle>
          <AlertDescription>
            {me.accountStatus !== "active"
              ? "Requests from accounts that are not active are usually declined. You can still submit, and the committee will decide."
              : waiting && standingOk
                ? `New members are covered ${rules.waitingDays} days after joining. You can still submit, and the committee will see that the waiting period was not complete.`
                : "Members who are past the grace period are not covered. You can still submit, and the committee will decide."}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <form
          className="flex flex-col gap-6"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            setTried(true)
            if (!nameValid || !dateValid) return
            if (
              run(submitCase, {
                memberId: me.id,
                subjectName,
                relationship,
                dateOfDeath,
                documents,
              })
            ) {
              toast.success("Request submitted")
              router.push("/member/requests")
            }
          }}
        >
          <CardContent>
            <FieldGroup>
              <Field data-invalid={tried && !nameValid}>
                <FieldLabel htmlFor="request-name">
                  Full name of the person who died
                </FieldLabel>
                <Input
                  id="request-name"
                  value={subjectName}
                  onChange={(event) => setSubjectName(event.target.value)}
                  aria-invalid={tried && !nameValid}
                  autoComplete="off"
                />
                {tried && !nameValid ? (
                  <FieldDescription className="text-destructive">
                    Enter their full name.
                  </FieldDescription>
                ) : null}
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="request-relationship">
                    Who they were to you
                  </FieldLabel>
                  <FilterSelect
                    id="request-relationship"
                    label="Who they were to you"
                    value={relationship}
                    onChange={setRelationship}
                    options={relationships}
                    className="w-full"
                  />
                </Field>
                <Field data-invalid={tried && !dateValid}>
                  <FieldLabel htmlFor="request-date">Date of death</FieldLabel>
                  <Input
                    id="request-date"
                    type="date"
                    max={today}
                    value={dateOfDeath}
                    onChange={(event) => setDateOfDeath(event.target.value)}
                    aria-invalid={tried && !dateValid}
                  />
                  {tried && !dateValid ? (
                    <FieldDescription className="text-destructive">
                      Choose a date that is not in the future.
                    </FieldDescription>
                  ) : null}
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="request-documents">
                  Supporting documents
                </FieldLabel>
                <Input
                  id="request-documents"
                  type="file"
                  multiple
                  onChange={(event) =>
                    setDocuments(
                      Array.from(event.target.files ?? []).map(
                        (file) => file.name
                      )
                    )
                  }
                />
                <FieldDescription>
                  A death certificate, burial permit or funeral programme. You
                  can also bring these to the treasurer later.
                </FieldDescription>
              </Field>
              <p className="rounded-xs border bg-muted/40 p-3 text-sm text-muted-foreground">
                If the committee approves, every active member is levied{" "}
                {formatCad(rules.levy)} and the total, about{" "}
                {formatCad(payout)} today, is paid to you.
              </p>
            </FieldGroup>
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              nativeButton={false}
              render={<Link href="/member/requests" />}
            >
              Cancel
            </Button>
            <Button type="submit">Submit request</Button>
          </CardFooter>
        </form>
      </Card>
    </>
  )
}
