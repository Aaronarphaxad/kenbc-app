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
import { Textarea } from "@/components/ui/textarea"
import { accountLabels, formatCad } from "@/lib/format"
import { addMember, setAccountStatus, updateMember } from "@/lib/fund"
import type { AccountStatus, Member } from "@/lib/types"

/** Add a member, or edit an existing member's contact details. */
export function MemberFormDialog({
  open,
  onOpenChange,
  member,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  member?: Member
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open ? (
          <MemberForm member={member} onClose={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function MemberForm({
  member,
  onClose,
}: {
  member?: Member
  onClose: () => void
}) {
  const { state, run } = useFund()
  const [name, setName] = React.useState(member?.name ?? "")
  const [email, setEmail] = React.useState(member?.email ?? "")
  const [phone, setPhone] = React.useState(member?.phone ?? "")
  const [city, setCity] = React.useState(member?.city ?? "")

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        const input = { name, email, phone, city }
        if (member) {
          if (run(updateMember, member.id, input)) toast.success("Profile updated")
          onClose()
          return
        }
        if (run(addMember, input)) {
          toast.success(`${name.trim()} added`)
          onClose()
        }
      }}
    >
      <DialogHeader>
        <DialogTitle>{member ? "Edit profile" : "Add a member"}</DialogTitle>
        <DialogDescription>
          {member
            ? "Contact details only. Money and standing come from the ledger."
            : `The member starts as invited and becomes active when their first ${formatCad(state.rules.buffer)} contribution is approved.`}
        </DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="member-name">Full name</FieldLabel>
          <Input
            id="member-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="member-email">Email</FieldLabel>
          <Input
            id="member-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="member-phone">Phone</FieldLabel>
            <Input
              id="member-phone"
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="member-city">City</FieldLabel>
            <Input
              id="member-city"
              value={city}
              onChange={(event) => setCity(event.target.value)}
            />
          </Field>
        </div>
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={!name.trim() || !email.trim()}>
          {member ? "Save changes" : "Add member"}
        </Button>
      </DialogFooter>
    </form>
  )
}

const statusOptions = (["active", "suspended", "invited"] as const).map(
  (value) => ({ value, label: accountLabels[value] })
)

/** Account status is the one thing the admin sets by hand, always with a reason. */
export function AccountStatusDialog({
  open,
  onOpenChange,
  member,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  member: Member
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open ? (
          <StatusForm member={member} onClose={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function StatusForm({
  member,
  onClose,
}: {
  member: Member
  onClose: () => void
}) {
  const { run } = useFund()
  const [status, setStatus] = React.useState<AccountStatus>(
    member.accountStatus === "active" ? "suspended" : "active"
  )
  const [reason, setReason] = React.useState("")
  const valid = status !== member.accountStatus && reason.trim().length > 0

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (valid && run(setAccountStatus, member.id, status, reason)) {
          toast.success(`${member.name} is now ${accountLabels[status].toLowerCase()}`)
          onClose()
        }
      }}
    >
      <DialogHeader>
        <DialogTitle>Change account status</DialogTitle>
        <DialogDescription>
          {member.name} is {accountLabels[member.accountStatus].toLowerCase()}.
          Only active members are levied and covered.
        </DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="status-next">New status</FieldLabel>
          <FilterSelect
            id="status-next"
            label="New status"
            value={status}
            onChange={setStatus}
            options={statusOptions}
            className="w-full"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="status-reason">Reason</FieldLabel>
          <Textarea
            id="status-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="For example: committee decision of 4 November"
            required
          />
          <FieldDescription>Kept in the member history.</FieldDescription>
        </Field>
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={!valid}>
          Change status
        </Button>
      </DialogFooter>
    </form>
  )
}
