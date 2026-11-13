"use client"

import * as React from "react"
import { toast } from "sonner"

import { FilterSelect } from "@/components/filter-select"
import { useFund } from "@/components/fund-provider"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { formatCad, methodLabels, referenceLabels } from "@/lib/format"
import { memberById, memberRow, recordPayment } from "@/lib/fund"
import { round2 } from "@/lib/rules"
import type { PaymentMethod } from "@/lib/types"

const methodOptions = (["cash", "cheque", "interac", "deposit"] as const).map(
  (value) => ({ value, label: methodLabels[value] })
)

/** Money received in person: recorded and posted to the ledger in one step. */
export function RecordPaymentDialog({
  open,
  onOpenChange,
  memberId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  memberId?: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open ? (
          <RecordForm
            fixedMemberId={memberId}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function RecordForm({
  fixedMemberId,
  onClose,
}: {
  fixedMemberId?: string
  onClose: () => void
}) {
  const { state, run, today } = useFund()
  const [memberId, setMemberId] = React.useState(fixedMemberId ?? "")
  const member = memberById(state, memberId)
  const row = member ? memberRow(state, member, today) : null
  const [amount, setAmount] = React.useState(() =>
    row && row.info.shortfall > 0 ? String(row.info.shortfall) : ""
  )
  const [method, setMethod] = React.useState<PaymentMethod>("cash")
  const [reference, setReference] = React.useState("")
  const [paidOn, setPaidOn] = React.useState(today)

  const value = Number(amount)
  const valid = Boolean(member) && value > 0 && paidOn <= today
  const memberOptions = React.useMemo(
    () => [
      { value: "none", label: "Choose a member" },
      ...state.members.map((item) => ({
        value: item.id,
        label: `${item.name} (${item.id})`,
      })),
    ],
    [state.members]
  )

  let outcome = "Choose a member to see the balance."
  if (row) {
    const after = round2(row.info.balance + (value > 0 ? value : 0))
    const stillShort = round2(Math.max(0, state.rules.buffer - after))
    outcome =
      value > 0
        ? `Balance goes from ${formatCad(row.info.balance)} to ${formatCad(after)}. ${
            stillShort > 0
              ? `Still ${formatCad(stillShort)} short of the buffer.`
              : "Paid up after posting."
          }`
        : `Balance today ${formatCad(row.info.balance)}${
            row.info.shortfall > 0
              ? `, ${formatCad(row.info.shortfall)} short of the buffer.`
              : "."
          }`
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (
          valid &&
          run(recordPayment, {
            memberId,
            amount: value,
            method,
            reference,
            paidOn,
          })
        ) {
          toast.success(
            `${formatCad(value)} posted for ${member?.name ?? "member"}`
          )
          onClose()
        }
      }}
    >
      <DialogHeader>
        <DialogTitle>Record a payment</DialogTitle>
        <DialogDescription>
          {fixedMemberId && member
            ? `From ${member.name} (${member.id}). `
            : ""}
          For money handed over in person or already confirmed. It is posted to
          the ledger straight away.
        </DialogDescription>
      </DialogHeader>
      <FieldGroup>
        {fixedMemberId ? null : (
          <Field>
            <FieldLabel htmlFor="record-member">Member</FieldLabel>
            <FilterSelect
              id="record-member"
              label="Member"
              value={memberId || "none"}
              onChange={(next) => {
                setMemberId(next === "none" ? "" : next)
                const picked = memberById(state, next)
                if (picked) {
                  const owing = memberRow(state, picked, today).info.shortfall
                  setAmount(owing > 0 ? String(owing) : "")
                }
              }}
              options={memberOptions}
              className="w-full"
            />
          </Field>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="record-amount">Amount received</FieldLabel>
            <Input
              id="record-amount"
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="record-date">Date received</FieldLabel>
            <Input
              id="record-date"
              type="date"
              max={today}
              value={paidOn}
              onChange={(event) => setPaidOn(event.target.value)}
              required
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="record-method">Method</FieldLabel>
            <FilterSelect
              id="record-method"
              label="Method"
              value={method}
              onChange={setMethod}
              options={methodOptions}
              className="w-full"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="record-reference">
              {referenceLabels[method]}
            </FieldLabel>
            <Input
              id="record-reference"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="Optional"
            />
          </Field>
        </div>
        <FieldDescription>{outcome}</FieldDescription>
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={!valid}>
          Record and post
        </Button>
      </DialogFooter>
    </form>
  )
}
