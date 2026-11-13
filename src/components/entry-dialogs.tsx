"use client"

import * as React from "react"
import { toast } from "sonner"

import { useFund } from "@/components/fund-provider"
import { Detail } from "@/components/page-header"
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
import { Textarea } from "@/components/ui/textarea"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { formatCad, formatDate } from "@/lib/format"
import {
  balanceOf,
  describeEntry,
  memberName,
  postAdjustment,
  reverseEntry,
} from "@/lib/fund"
import { round2 } from "@/lib/rules"
import type { JournalEntry } from "@/lib/types"

export function ReverseEntryDialog({
  entry,
  onClose,
}: {
  entry: JournalEntry | null
  onClose: () => void
}) {
  return (
    <Dialog open={Boolean(entry)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {entry ? (
          <ReverseForm key={entry.id} entry={entry} onClose={onClose} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function ReverseForm({
  entry,
  onClose,
}: {
  entry: JournalEntry
  onClose: () => void
}) {
  const { state, run } = useFund()
  const [reason, setReason] = React.useState("")
  const balance = balanceOf(state, entry.memberId)
  const after = round2(balance - entry.credit + entry.debit)

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (run(reverseEntry, entry.id, reason)) {
          toast.success(`${entry.id} reversed`)
          onClose()
        }
      }}
    >
      <DialogHeader>
        <DialogTitle>Reverse {entry.id}</DialogTitle>
        <DialogDescription>
          Posted entries are never edited or deleted. This posts an equal and
          opposite line dated today, and links the two.
        </DialogDescription>
      </DialogHeader>
      <dl className="flex flex-col gap-2 rounded-xs border bg-muted/40 p-3">
        <Detail label="Member">{memberName(state, entry.memberId)}</Detail>
        <Detail label="Entry">
          {describeEntry(entry)}, {formatDate(entry.effectiveOn)}
        </Detail>
        <Detail label="Reversing line">
          {entry.credit > 0
            ? `Debit ${formatCad(entry.credit)}`
            : `Credit ${formatCad(entry.debit)}`}
        </Detail>
        <Detail label="Balance after">
          {formatCad(balance)} to {formatCad(after)}
        </Detail>
      </dl>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="reverse-reason">Reason</FieldLabel>
          <Textarea
            id="reverse-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="For example: same receipt entered twice"
            required
          />
          <FieldDescription>
            Shown on both lines and in the member history.
          </FieldDescription>
        </Field>
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={!reason.trim()}>
          Post reversal
        </Button>
      </DialogFooter>
    </form>
  )
}

export function AdjustmentDialog({
  memberId,
  open,
  onOpenChange,
}: {
  memberId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open ? (
          <AdjustmentForm
            memberId={memberId}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function AdjustmentForm({
  memberId,
  onClose,
}: {
  memberId: string
  onClose: () => void
}) {
  const { state, run } = useFund()
  const [direction, setDirection] = React.useState<"increase" | "decrease">(
    "increase"
  )
  const [amount, setAmount] = React.useState("")
  const [reason, setReason] = React.useState("")
  const value = Number(amount)
  const valid = value > 0 && reason.trim().length > 0
  const balance = balanceOf(state, memberId)
  const after = round2(balance + (direction === "increase" ? value : -value))

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (
          valid &&
          run(postAdjustment, { memberId, direction, amount: value, reason })
        ) {
          toast.success("Adjustment posted")
          onClose()
        }
      }}
    >
      <DialogHeader>
        <DialogTitle>Post an adjustment</DialogTitle>
        <DialogDescription>
          For corrections that are not a payment or a levy.{" "}
          {memberName(state, memberId)} has {formatCad(balance)} today.
        </DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <Field>
          <FieldLabel>Effect on the balance</FieldLabel>
          <ToggleGroup
            variant="outline"
            value={[direction]}
            onValueChange={(next) => {
              const picked = next[0]
              if (picked === "increase" || picked === "decrease") {
                setDirection(picked)
              }
            }}
            className="w-full"
          >
            <ToggleGroupItem value="increase" className="flex-1">
              Increase (credit)
            </ToggleGroupItem>
            <ToggleGroupItem value="decrease" className="flex-1">
              Decrease (debit)
            </ToggleGroupItem>
          </ToggleGroup>
        </Field>
        <Field>
          <FieldLabel htmlFor="adjust-amount">Amount</FieldLabel>
          <Input
            id="adjust-amount"
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0.00"
            required
          />
          <FieldDescription>
            {value > 0
              ? `Balance goes from ${formatCad(balance)} to ${formatCad(after)}.`
              : "Enter a positive amount. The choice above sets the direction."}
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="adjust-reason">Reason</FieldLabel>
          <Textarea
            id="adjust-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="What is being corrected and why"
            required
          />
        </Field>
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={!valid}>
          Post adjustment
        </Button>
      </DialogFooter>
    </form>
  )
}
