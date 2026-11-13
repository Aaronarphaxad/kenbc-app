"use client"

import * as React from "react"
import { toast } from "sonner"

import { AuditList } from "@/components/audit-list"
import { useFund } from "@/components/fund-provider"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { formatCad } from "@/lib/format"
import { auditFor, updateRules } from "@/lib/fund"
import type { Rules } from "@/lib/types"

const fields: {
  key: keyof Rules
  label: string
  unit: "dollars" | "days"
  help: (rules: Rules) => string
}[] = [
  {
    key: "buffer",
    label: "Buffer",
    unit: "dollars",
    help: () => "The balance every member keeps on account.",
  },
  {
    key: "levy",
    label: "Levy per case",
    unit: "dollars",
    help: () => "Charged to every active member when a case is approved.",
  },
  {
    key: "graceDays",
    label: "Grace period",
    unit: "days",
    help: () => "Days a member can be short and still be covered.",
  },
  {
    key: "delinquencyDays",
    label: "Delinquency limit",
    unit: "days",
    help: () => "Days short after which the member goes to removal review.",
  },
  {
    key: "waitingDays",
    label: "Waiting period",
    unit: "days",
    help: () => "Days after joining before a member is covered.",
  },
]

export default function RulesPage() {
  const { state } = useFund()
  // Remount when the rules change underneath the form, such as after a reset.
  return <RulesForm key={Object.values(state.rules).join("-")} />
}

function RulesForm() {
  const { state, run } = useFund()
  const [draft, setDraft] = React.useState<Record<keyof Rules, string>>(() => ({
    buffer: String(state.rules.buffer),
    levy: String(state.rules.levy),
    graceDays: String(state.rules.graceDays),
    delinquencyDays: String(state.rules.delinquencyDays),
    waitingDays: String(state.rules.waitingDays),
  }))

  const next: Rules = {
    buffer: Number(draft.buffer),
    levy: Number(draft.levy),
    graceDays: Number(draft.graceDays),
    delinquencyDays: Number(draft.delinquencyDays),
    waitingDays: Number(draft.waitingDays),
  }
  const errors: Partial<Record<keyof Rules, string>> = {}
  for (const field of fields) {
    const value = next[field.key]
    if (!(value > 0)) errors[field.key] = "Enter a number above zero."
    else if (field.unit === "days" && !Number.isInteger(value)) {
      errors[field.key] = "Enter whole days."
    }
  }
  if (!errors.delinquencyDays && next.delinquencyDays <= next.graceDays) {
    errors.delinquencyDays = "Must be longer than the grace period."
  }
  if (!errors.levy && next.levy > next.buffer) {
    errors.levy = "Cannot be more than the buffer."
  }
  const changed = fields.some(
    (field) => next[field.key] !== state.rules[field.key]
  )
  const valid = Object.keys(errors).length === 0
  const log = auditFor(state, (event) => event.tag === "rules")

  return (
    <>
      <PageHeader
        title="Rules"
        description="The five numbers the whole system runs on. Every screen reads them from here."
      />

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <form
            className="flex flex-col gap-6"
            noValidate
            onSubmit={(event) => {
              event.preventDefault()
              if (valid && run(updateRules, next)) {
                toast.success("Rules updated")
              }
            }}
          >
            <CardHeader>
              <CardTitle>Amounts and periods</CardTitle>
              <CardDescription>
                Changes apply from today. Posted entries are never rewritten, so
                past levies keep the amount they were charged at.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                {fields.map((field) => (
                  <Field
                    key={field.key}
                    orientation="responsive"
                    data-invalid={Boolean(errors[field.key])}
                  >
                    <div className="flex flex-1 flex-col gap-1">
                      <FieldLabel htmlFor={`rule-${field.key}`}>
                        {field.label}
                      </FieldLabel>
                      <FieldDescription
                        className={
                          errors[field.key] ? "text-destructive" : undefined
                        }
                      >
                        {errors[field.key] ?? field.help(next)}
                      </FieldDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        id={`rule-${field.key}`}
                        type="number"
                        inputMode="decimal"
                        min="1"
                        step={field.unit === "days" ? "1" : "0.01"}
                        value={draft[field.key]}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            [field.key]: event.target.value,
                          }))
                        }
                        aria-invalid={Boolean(errors[field.key])}
                        className="w-28 text-right tabular-nums"
                      />
                      <span className="w-12 text-sm text-muted-foreground">
                        {field.unit === "days" ? "days" : "CAD"}
                      </span>
                    </div>
                  </Field>
                ))}
              </FieldGroup>
            </CardContent>
            <CardFooter className="justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={!changed}
                onClick={() =>
                  setDraft({
                    buffer: String(state.rules.buffer),
                    levy: String(state.rules.levy),
                    graceDays: String(state.rules.graceDays),
                    delinquencyDays: String(state.rules.delinquencyDays),
                    waitingDays: String(state.rules.waitingDays),
                  })
                }
              >
                Discard
              </Button>
              <Button type="submit" disabled={!changed || !valid}>
                Save changes
              </Button>
            </CardFooter>
          </form>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>How the rules are applied</CardTitle>
              <CardDescription>
                Assumptions in this preview, to confirm with the committee
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="flex list-disc flex-col gap-2 pl-4 text-sm">
                <li>
                  An approved case levies {formatCad(state.rules.levy)} from
                  every active member, the bereaved member included. The payout
                  equals the levy total.
                </li>
                <li>
                  Days short start when a balance drops under{" "}
                  {formatCad(state.rules.buffer)} and reset only when the
                  buffer is fully restored.
                </li>
                <li>
                  A member in grace is still covered. A delinquent member is
                  not.
                </li>
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Change log</CardTitle>
              <CardDescription>Who changed a rule and when</CardDescription>
            </CardHeader>
            <CardContent>
              <AuditList events={log} empty="The rules have not been changed." />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
