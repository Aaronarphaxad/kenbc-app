import { formatCad, kindLabels, methodLabels } from "@/lib/format"
import {
  addDays,
  byEffective,
  daysBetween,
  eligibilityOf,
  round2,
  standingOf,
  todayIso,
  type Eligibility,
  type StandingInfo,
} from "@/lib/rules"
import type {
  AccountStatus,
  AuditEvent,
  BereavementCase,
  Disbursement,
  EntryKind,
  FundState,
  JournalEntry,
  Member,
  Payment,
  PaymentMethod,
  Rules,
} from "@/lib/types"

export const ADMIN_NAME = "Daniel Okello"

/** Who is acting and on which date. The sample history replays past dates. */
export type Ctx = {
  actor: string
  on: string
}

/* -------------------------------------------------------------------------- */
/* Reading the books                                                          */
/* -------------------------------------------------------------------------- */

export function memberById(state: FundState, id: string | null | undefined) {
  return state.members.find((member) => member.id === id)
}

export function memberName(state: FundState, id: string) {
  return memberById(state, id)?.name ?? id
}

export function entriesFor(state: FundState, memberId: string) {
  return state.journal
    .filter((entry) => entry.memberId === memberId)
    .sort(byEffective)
}

export function balanceOf(state: FundState, memberId: string) {
  return round2(
    state.journal.reduce(
      (sum, entry) =>
        entry.memberId === memberId ? sum + entry.credit - entry.debit : sum,
      0
    )
  )
}

/** The entry that reverses the given one, if any. */
export function reversalOf(state: FundState, entryId: string) {
  return state.journal.find((entry) => entry.reverses === entryId)
}

export function describeEntry(entry: JournalEntry) {
  if (entry.kind === "reversal") {
    return [`Reversal of ${entry.reverses}`, entry.memo]
      .filter(Boolean)
      .join(" · ")
  }
  const detail = entry.memo || (entry.method ? methodLabels[entry.method] : "")
  return [kindLabels[entry.kind], detail].filter(Boolean).join(" · ")
}

export type StatementRow = {
  entry: JournalEntry
  balance: number
}

export type Statement = {
  opening: number
  rows: StatementRow[]
  closing: number
  debit: number
  credit: number
}

export function statementFor(
  state: FundState,
  memberId: string,
  from: string | null,
  to: string | null
): Statement {
  let balance = 0
  let opening = 0
  let debit = 0
  let credit = 0
  const rows: StatementRow[] = []

  for (const entry of entriesFor(state, memberId)) {
    if (to && entry.effectiveOn > to) break
    balance = round2(balance + entry.credit - entry.debit)
    if (from && entry.effectiveOn < from) {
      opening = balance
      continue
    }
    rows.push({ entry, balance })
    debit = round2(debit + entry.debit)
    credit = round2(credit + entry.credit)
  }

  return {
    opening,
    rows,
    closing: rows.length ? rows[rows.length - 1].balance : opening,
    debit,
    credit,
  }
}

export type Period = "all" | "month" | "3-months" | "6-months" | "year"

export const periodLabels: Record<Period, string> = {
  all: "All dates",
  month: "This month",
  "3-months": "Last 3 months",
  "6-months": "Last 6 months",
  year: "This year",
}

export function periodStart(period: Period, today = todayIso()) {
  if (period === "month") return `${today.slice(0, 7)}-01`
  if (period === "3-months") return addDays(today, -90)
  if (period === "6-months") return addDays(today, -180)
  if (period === "year") return `${today.slice(0, 4)}-01-01`
  return null
}

export type MemberRow = {
  member: Member
  info: StandingInfo
  eligibility: Eligibility
  pendingTotal: number
  lastReminderOn: string | null
}

export function memberRow(
  state: FundState,
  member: Member,
  asOf = todayIso()
): MemberRow {
  const reminders = state.audit.filter(
    (event) => event.tag === "reminder" && event.memberId === member.id
  )
  return {
    member,
    info: standingOf(state, member, asOf),
    eligibility: eligibilityOf(state, member, asOf),
    pendingTotal: round2(
      state.payments
        .filter(
          (payment) =>
            payment.memberId === member.id && payment.status === "pending"
        )
        .reduce((sum, payment) => sum + payment.amount, 0)
    ),
    lastReminderOn: reminders.length
      ? reminders[reminders.length - 1].on
      : null,
  }
}

export function memberRows(state: FundState, asOf = todayIso()) {
  return state.members.map((member) => memberRow(state, member, asOf))
}

/** Members who count toward arrears: short of the buffer and not just invited. */
export function isInArrears(row: MemberRow) {
  return row.member.accountStatus !== "invited" && row.info.shortfall > 0
}

export function fundTotals(state: FundState, rows: MemberRow[]) {
  const arrears = rows.filter(isInArrears)
  const awaiting = state.cases.filter((item) => item.status === "approved")
  return {
    held: round2(rows.reduce((sum, row) => sum + row.info.balance, 0)),
    short: round2(arrears.reduce((sum, row) => sum + row.info.shortfall, 0)),
    shortCount: arrears.length,
    awaitingPayout: round2(
      awaiting.reduce((sum, item) => sum + (item.levy?.total ?? 0), 0)
    ),
    awaitingCount: awaiting.length,
    activeCount: rows.filter((row) => row.member.accountStatus === "active")
      .length,
  }
}

export type MonthRow = {
  month: string
  opening: number
  broughtForward: number
  receipts: number
  levies: number
  adjustments: number
  closing: number
}

/** Opening + brought forward + receipts - levies + adjustments = closing. */
export function monthlySummary(state: FundState, today = todayIso()) {
  if (!state.journal.length) return []
  const first = state.journal.reduce(
    (min, entry) => (entry.effectiveOn < min ? entry.effectiveOn : min),
    today
  )
  const months: string[] = []
  let [year, month] = first.split("-").map(Number)
  const last = today.slice(0, 7)
  for (;;) {
    const key = `${year}-${String(month).padStart(2, "0")}`
    months.push(key)
    if (key >= last) break
    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
  }

  let running = 0
  return months.map((key): MonthRow => {
    const row: MonthRow = {
      month: key,
      opening: running,
      broughtForward: 0,
      receipts: 0,
      levies: 0,
      adjustments: 0,
      closing: 0,
    }
    for (const entry of state.journal) {
      if (entry.effectiveOn.slice(0, 7) !== key) continue
      const net = entry.credit - entry.debit
      if (entry.kind === "opening") row.broughtForward += net
      else if (entry.kind === "levy") row.levies -= net
      else if (entry.kind === "adjustment" || entry.kind === "reversal")
        row.adjustments += net
      else row.receipts += net
    }
    row.broughtForward = round2(row.broughtForward)
    row.receipts = round2(row.receipts)
    row.levies = round2(row.levies)
    row.adjustments = round2(row.adjustments)
    row.closing = round2(
      row.opening +
        row.broughtForward +
        row.receipts -
        row.levies +
        row.adjustments
    )
    running = row.closing
    return row
  })
}

function normaliseReference(reference: string) {
  return reference.trim().toLowerCase()
}

/** Other live payments that carry the same reference. */
export function duplicatesOf(state: FundState, payment: Payment) {
  const reference = normaliseReference(payment.reference)
  if (!reference) return []
  return state.payments.filter(
    (other) =>
      other.id !== payment.id &&
      (other.status === "pending" || other.status === "approved") &&
      normaliseReference(other.reference) === reference
  )
}

export function auditFor(
  state: FundState,
  match: (event: AuditEvent) => boolean
) {
  return state.audit.filter(match).reverse()
}

export type TimelineStep = {
  label: string
  on: string
  detail: string
}

export function caseTimeline(item: BereavementCase): TimelineStep[] {
  const steps: TimelineStep[] = [
    { label: "Submitted", on: item.submittedOn, detail: "" },
  ]
  if (item.reviewStartedOn) {
    steps.push({ label: "Under review", on: item.reviewStartedOn, detail: "" })
  }
  if (item.decidedOn && item.status === "declined") {
    steps.push({
      label: "Declined",
      on: item.decidedOn,
      detail: item.decisionReason,
    })
  } else if (item.decidedOn) {
    steps.push({
      label: "Approved",
      on: item.decidedOn,
      detail: item.levy
        ? `Levy of ${formatCad(item.levy.amount)} posted to ${item.levy.count} active members`
        : "",
    })
  }
  if (item.disbursement) {
    steps.push({
      label: "Disbursed",
      on: item.disbursement.paidOn,
      detail: `${formatCad(item.disbursement.amount)} by ${methodLabels[item.disbursement.method]}`,
    })
  }
  if (item.closedOn) {
    steps.push({ label: "Closed", on: item.closedOn, detail: "" })
  }
  return steps
}

/** Days from submission to payout or decline, or days open so far. */
export function caseTurnaround(item: BereavementCase, today = todayIso()) {
  const end =
    item.disbursement?.paidOn ??
    (item.status === "declined" ? item.decidedOn : null)
  return {
    days: daysBetween(item.submittedOn, end ?? today),
    done: Boolean(end),
  }
}

/* -------------------------------------------------------------------------- */
/* Writing to the books                                                       */
/* -------------------------------------------------------------------------- */

function nextId(ids: string[], prefix: string, width: number) {
  const top = ids.reduce(
    (max, id) => Math.max(max, Number(id.slice(prefix.length)) || 0),
    0
  )
  return `${prefix}${String(top + 1).padStart(width, "0")}`
}

type Links = Pick<AuditEvent, "memberId" | "paymentId" | "caseId" | "tag">

export function logEvent(
  state: FundState,
  ctx: Ctx,
  text: string,
  links: Links = {}
): FundState {
  const event: AuditEvent = {
    id: nextId(
      state.audit.map((item) => item.id),
      "EV-",
      4
    ),
    on: ctx.on,
    actor: ctx.actor,
    text,
    ...links,
  }
  return { ...state, audit: [...state.audit, event] }
}

type EntryDraft = {
  memberId: string
  kind: EntryKind
  debit?: number
  credit?: number
  effectiveOn?: string
  method?: PaymentMethod | null
  reference?: string
  memo?: string
  source?: JournalEntry["source"]
  reverses?: string | null
}

function buildEntries(state: FundState, ctx: Ctx, drafts: EntryDraft[]) {
  const top = state.journal.reduce(
    (max, entry) => Math.max(max, Number(entry.id.slice(3)) || 0),
    0
  )
  return drafts.map(
    (draft, index): JournalEntry => ({
      id: `JE-${String(top + index + 1).padStart(4, "0")}`,
      memberId: draft.memberId,
      postedOn: ctx.on,
      effectiveOn: draft.effectiveOn ?? ctx.on,
      kind: draft.kind,
      debit: round2(draft.debit ?? 0),
      credit: round2(draft.credit ?? 0),
      method: draft.method ?? null,
      reference: draft.reference ?? "",
      memo: draft.memo ?? "",
      postedBy: ctx.actor,
      source: draft.source ?? null,
      reverses: draft.reverses ?? null,
    })
  )
}

function patchMember(
  state: FundState,
  id: string,
  patch: Partial<Member>
): FundState {
  return {
    ...state,
    members: state.members.map((member) =>
      member.id === id ? { ...member, ...patch } : member
    ),
  }
}

function patchPayment(
  state: FundState,
  id: string,
  patch: Partial<Payment>
): FundState {
  return {
    ...state,
    payments: state.payments.map((payment) =>
      payment.id === id ? { ...payment, ...patch } : payment
    ),
  }
}

function patchCase(
  state: FundState,
  id: string,
  patch: Partial<BereavementCase>
): FundState {
  return {
    ...state,
    cases: state.cases.map((item) =>
      item.id === id ? { ...item, ...patch } : item
    ),
  }
}

/** Balance carried over from the paper ledger when the journal was started. */
export function postOpening(
  state: FundState,
  ctx: Ctx,
  memberId: string,
  amount: number
): FundState {
  const [entry] = buildEntries(state, ctx, [
    { memberId, kind: "opening", credit: amount },
  ])
  return logEvent(
    { ...state, journal: [...state.journal, entry] },
    ctx,
    `Opening balance of ${formatCad(amount)} brought forward from the paper ledger (${entry.id})`,
    { memberId }
  )
}

/* Payments ----------------------------------------------------------------- */

export type PaymentInput = {
  memberId: string
  amount: number
  method: PaymentMethod
  reference: string
  paidOn: string
}

export function submitPayment(
  state: FundState,
  ctx: Ctx,
  input: PaymentInput
): FundState {
  if (!(input.amount > 0) || !memberById(state, input.memberId)) return state
  const payment: Payment = {
    id: nextId(
      state.payments.map((item) => item.id),
      "PAY-",
      4
    ),
    memberId: input.memberId,
    amount: round2(input.amount),
    method: input.method,
    reference: input.reference.trim(),
    paidOn: input.paidOn,
    submittedOn: ctx.on,
    submittedBy: "member",
    status: "pending",
    receivedAmount: null,
    decidedOn: null,
    decidedBy: null,
    reason: "",
    entryId: null,
  }
  return logEvent(
    { ...state, payments: [...state.payments, payment] },
    ctx,
    `Declared a ${formatCad(payment.amount)} payment by ${methodLabels[payment.method]}`,
    { memberId: payment.memberId, paymentId: payment.id }
  )
}

export function withdrawPayment(
  state: FundState,
  ctx: Ctx,
  paymentId: string
): FundState {
  const payment = state.payments.find((item) => item.id === paymentId)
  if (!payment || payment.status !== "pending") return state
  return logEvent(
    patchPayment(state, paymentId, {
      status: "withdrawn",
      decidedOn: ctx.on,
      decidedBy: ctx.actor,
    }),
    ctx,
    `Withdrew the ${formatCad(payment.amount)} payment before approval`,
    { memberId: payment.memberId, paymentId }
  )
}

function postPayment(
  state: FundState,
  ctx: Ctx,
  payment: Payment,
  amount: number,
  receivedOn: string
) {
  const member = memberById(state, payment.memberId)
  const firstPayment = !state.journal.some(
    (entry) => entry.memberId === payment.memberId && entry.credit > 0
  )
  const [entry] = buildEntries(state, ctx, [
    {
      memberId: payment.memberId,
      kind: firstPayment ? "contribution" : "top-up",
      credit: amount,
      effectiveOn: receivedOn,
      method: payment.method,
      reference: payment.reference,
      source: { type: "payment", id: payment.id },
    },
  ])
  let next: FundState = { ...state, journal: [...state.journal, entry] }
  if (member?.accountStatus === "invited") {
    next = logEvent(
      patchMember(next, member.id, {
        accountStatus: "active",
        statusReason: "First contribution received",
        joinedOn: receivedOn,
      }),
      ctx,
      "Account activated on first contribution",
      { memberId: member.id }
    )
  }
  return { state: next, entry }
}

export function approvePayment(
  state: FundState,
  ctx: Ctx,
  paymentId: string,
  received: { amount: number; receivedOn: string }
): FundState {
  const payment = state.payments.find((item) => item.id === paymentId)
  if (!payment || payment.status !== "pending" || !(received.amount > 0)) {
    return state
  }
  const amount = round2(received.amount)
  const posted = postPayment(state, ctx, payment, amount, received.receivedOn)
  const changed =
    amount === payment.amount
      ? ""
      : `, received ${formatCad(amount)} against ${formatCad(payment.amount)} declared`
  return logEvent(
    patchPayment(posted.state, paymentId, {
      status: "approved",
      receivedAmount: amount,
      decidedOn: ctx.on,
      decidedBy: ctx.actor,
      entryId: posted.entry.id,
    }),
    ctx,
    `Approved and posted as ${posted.entry.id}${changed}`,
    { memberId: payment.memberId, paymentId }
  )
}

export function rejectPayment(
  state: FundState,
  ctx: Ctx,
  paymentId: string,
  reason: string
): FundState {
  const payment = state.payments.find((item) => item.id === paymentId)
  if (!payment || payment.status !== "pending" || !reason.trim()) return state
  return logEvent(
    patchPayment(state, paymentId, {
      status: "rejected",
      decidedOn: ctx.on,
      decidedBy: ctx.actor,
      reason: reason.trim(),
    }),
    ctx,
    `Rejected the ${formatCad(payment.amount)} payment: ${reason.trim()}`,
    { memberId: payment.memberId, paymentId }
  )
}

/** Money taken in person by the office: recorded and posted in one step. */
export function recordPayment(
  state: FundState,
  ctx: Ctx,
  input: PaymentInput
): FundState {
  if (!(input.amount > 0) || !memberById(state, input.memberId)) return state
  const draft: Payment = {
    id: nextId(
      state.payments.map((item) => item.id),
      "PAY-",
      4
    ),
    memberId: input.memberId,
    amount: round2(input.amount),
    method: input.method,
    reference: input.reference.trim(),
    paidOn: input.paidOn,
    submittedOn: ctx.on,
    submittedBy: "office",
    status: "approved",
    receivedAmount: round2(input.amount),
    decidedOn: ctx.on,
    decidedBy: ctx.actor,
    reason: "",
    entryId: null,
  }
  const posted = postPayment(state, ctx, draft, draft.amount, input.paidOn)
  const payment = { ...draft, entryId: posted.entry.id }
  return logEvent(
    { ...posted.state, payments: [...posted.state.payments, payment] },
    ctx,
    `Recorded a ${formatCad(payment.amount)} payment by ${methodLabels[payment.method]}, posted as ${posted.entry.id}`,
    { memberId: payment.memberId, paymentId: payment.id }
  )
}

/* Corrections -------------------------------------------------------------- */

export function canReverse(state: FundState, entry: JournalEntry) {
  return entry.kind !== "reversal" && !reversalOf(state, entry.id)
}

export function reverseEntry(
  state: FundState,
  ctx: Ctx,
  entryId: string,
  reason: string
): FundState {
  const original = state.journal.find((entry) => entry.id === entryId)
  if (!original || !canReverse(state, original) || !reason.trim()) return state
  const [entry] = buildEntries(state, ctx, [
    {
      memberId: original.memberId,
      kind: "reversal",
      debit: original.credit,
      credit: original.debit,
      reference: original.reference,
      memo: reason.trim(),
      source: original.source,
      reverses: original.id,
    },
  ])
  return logEvent(
    { ...state, journal: [...state.journal, entry] },
    ctx,
    `Reversed ${original.id} with ${entry.id}: ${reason.trim()}`,
    {
      memberId: original.memberId,
      paymentId:
        original.source?.type === "payment" ? original.source.id : undefined,
      caseId: original.source?.type === "case" ? original.source.id : undefined,
    }
  )
}

export type AdjustmentInput = {
  memberId: string
  direction: "increase" | "decrease"
  amount: number
  reason: string
}

export function postAdjustment(
  state: FundState,
  ctx: Ctx,
  input: AdjustmentInput
): FundState {
  if (!(input.amount > 0) || !input.reason.trim()) return state
  const [entry] = buildEntries(state, ctx, [
    {
      memberId: input.memberId,
      kind: "adjustment",
      credit: input.direction === "increase" ? input.amount : 0,
      debit: input.direction === "decrease" ? input.amount : 0,
      memo: input.reason.trim(),
    },
  ])
  return logEvent(
    { ...state, journal: [...state.journal, entry] },
    ctx,
    `Posted adjustment ${entry.id}: ${input.direction} of ${formatCad(input.amount)}. ${input.reason.trim()}`,
    { memberId: input.memberId }
  )
}

/* Members ------------------------------------------------------------------ */

export type ProfileInput = Pick<Member, "name" | "email" | "phone" | "city">

export function addMember(
  state: FundState,
  ctx: Ctx,
  input: ProfileInput
): FundState {
  if (!input.name.trim()) return state
  const member: Member = {
    id: nextId(
      state.members.map((item) => item.id),
      "KEN-",
      4
    ),
    name: input.name.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
    city: input.city.trim(),
    joinedOn: ctx.on,
    accountStatus: "invited",
    statusReason: "Awaiting first contribution",
  }
  return logEvent(
    { ...state, members: [...state.members, member] },
    ctx,
    "Added to the fund and invited to make a first contribution",
    { memberId: member.id }
  )
}

export function updateMember(
  state: FundState,
  ctx: Ctx,
  memberId: string,
  input: ProfileInput
): FundState {
  const member = memberById(state, memberId)
  if (!member || !input.name.trim()) return state
  const labels: Record<keyof ProfileInput, string> = {
    name: "name",
    email: "email",
    phone: "phone",
    city: "city",
  }
  const changed = (Object.keys(labels) as (keyof ProfileInput)[]).filter(
    (key) => member[key] !== input[key].trim()
  )
  if (!changed.length) return state
  return logEvent(
    patchMember(state, memberId, {
      name: input.name.trim(),
      email: input.email.trim(),
      phone: input.phone.trim(),
      city: input.city.trim(),
    }),
    ctx,
    `Updated profile: ${changed.map((key) => labels[key]).join(", ")}`,
    { memberId }
  )
}

export function setAccountStatus(
  state: FundState,
  ctx: Ctx,
  memberId: string,
  status: AccountStatus,
  reason: string
): FundState {
  const member = memberById(state, memberId)
  if (!member || member.accountStatus === status || !reason.trim()) return state
  return logEvent(
    patchMember(state, memberId, {
      accountStatus: status,
      statusReason: reason.trim(),
    }),
    ctx,
    `Account changed from ${member.accountStatus} to ${status}: ${reason.trim()}`,
    { memberId }
  )
}

export function markReminderSent(
  state: FundState,
  ctx: Ctx,
  memberId: string
): FundState {
  const member = memberById(state, memberId)
  if (!member) return state
  const info = standingOf(state, member, ctx.on)
  return logEvent(
    state,
    ctx,
    `Reminder sent for ${formatCad(info.shortfall)} owing`,
    { memberId, tag: "reminder" }
  )
}

/* Cases -------------------------------------------------------------------- */

export type CaseInput = {
  memberId: string
  subjectName: string
  relationship: string
  dateOfDeath: string
  documents: string[]
}

export function submitCase(
  state: FundState,
  ctx: Ctx,
  input: CaseInput
): FundState {
  if (!input.subjectName.trim()) return state
  const item: BereavementCase = {
    id: nextId(
      state.cases.map((entry) => entry.id),
      "CASE-",
      3
    ),
    memberId: input.memberId,
    subjectName: input.subjectName.trim(),
    relationship: input.relationship,
    dateOfDeath: input.dateOfDeath,
    submittedOn: ctx.on,
    status: "submitted",
    documents: input.documents,
    notes: "",
    reviewStartedOn: null,
    decidedOn: null,
    decisionReason: "",
    levy: null,
    disbursement: null,
    closedOn: null,
  }
  return logEvent(
    { ...state, cases: [...state.cases, item] },
    ctx,
    `Submitted a bereavement request for ${item.subjectName}`,
    { memberId: item.memberId, caseId: item.id }
  )
}

export function startReview(
  state: FundState,
  ctx: Ctx,
  caseId: string
): FundState {
  const item = state.cases.find((entry) => entry.id === caseId)
  if (!item || item.status !== "submitted") return state
  return logEvent(
    patchCase(state, caseId, {
      status: "under-review",
      reviewStartedOn: ctx.on,
    }),
    ctx,
    "Review started",
    { memberId: item.memberId, caseId }
  )
}

export function saveCaseNotes(
  state: FundState,
  ctx: Ctx,
  caseId: string,
  notes: string
): FundState {
  const item = state.cases.find((entry) => entry.id === caseId)
  if (!item || item.notes === notes.trim()) return state
  return logEvent(
    patchCase(state, caseId, { notes: notes.trim() }),
    ctx,
    "Committee notes updated",
    { memberId: item.memberId, caseId }
  )
}

/** Members a levy would be posted to right now. */
export function levyMembers(state: FundState) {
  return state.members.filter((member) => member.accountStatus === "active")
}

export function approveCase(
  state: FundState,
  ctx: Ctx,
  caseId: string
): FundState {
  const item = state.cases.find((entry) => entry.id === caseId)
  if (!item || item.status !== "under-review") return state
  const members = levyMembers(state)
  const amount = state.rules.levy
  const entries = buildEntries(
    state,
    ctx,
    members.map((member) => ({
      memberId: member.id,
      kind: "levy" as const,
      debit: amount,
      reference: item.id,
      memo: `Bereavement of ${item.subjectName}`,
      source: { type: "case" as const, id: item.id },
    }))
  )
  const total = round2(amount * members.length)
  const next = patchCase(
    { ...state, journal: [...state.journal, ...entries] },
    caseId,
    {
      status: "approved",
      decidedOn: ctx.on,
      levy: { count: members.length, amount, total },
    }
  )
  return logEvent(
    next,
    ctx,
    `Approved. Levy of ${formatCad(amount)} posted to ${members.length} active members (${formatCad(total)})`,
    { memberId: item.memberId, caseId }
  )
}

export function declineCase(
  state: FundState,
  ctx: Ctx,
  caseId: string,
  reason: string
): FundState {
  const item = state.cases.find((entry) => entry.id === caseId)
  if (!item || item.status !== "under-review" || !reason.trim()) return state
  return logEvent(
    patchCase(state, caseId, {
      status: "declined",
      decidedOn: ctx.on,
      decisionReason: reason.trim(),
    }),
    ctx,
    `Declined: ${reason.trim()}`,
    { memberId: item.memberId, caseId }
  )
}

export function disburseCase(
  state: FundState,
  ctx: Ctx,
  caseId: string,
  disbursement: Disbursement
): FundState {
  const item = state.cases.find((entry) => entry.id === caseId)
  if (!item || item.status !== "approved" || !(disbursement.amount > 0)) {
    return state
  }
  return logEvent(
    patchCase(state, caseId, {
      status: "disbursed",
      disbursement: {
        ...disbursement,
        amount: round2(disbursement.amount),
        reference: disbursement.reference.trim(),
      },
    }),
    ctx,
    `Disbursed ${formatCad(disbursement.amount)} by ${methodLabels[disbursement.method]}`,
    { memberId: item.memberId, caseId }
  )
}

export function closeCase(
  state: FundState,
  ctx: Ctx,
  caseId: string
): FundState {
  const item = state.cases.find((entry) => entry.id === caseId)
  if (!item || item.status !== "disbursed") return state
  return logEvent(
    patchCase(state, caseId, { status: "closed", closedOn: ctx.on }),
    ctx,
    "Case closed",
    { memberId: item.memberId, caseId }
  )
}

/* Rules -------------------------------------------------------------------- */

export function updateRules(
  state: FundState,
  ctx: Ctx,
  rules: Rules
): FundState {
  const describe: Record<keyof Rules, (value: number) => string> = {
    buffer: formatCad,
    levy: formatCad,
    graceDays: (value) => `${value} days`,
    delinquencyDays: (value) => `${value} days`,
    waitingDays: (value) => `${value} days`,
  }
  const names: Record<keyof Rules, string> = {
    buffer: "Buffer",
    levy: "Levy per case",
    graceDays: "Grace period",
    delinquencyDays: "Delinquency limit",
    waitingDays: "Waiting period",
  }
  const changed = (Object.keys(names) as (keyof Rules)[]).filter(
    (key) => state.rules[key] !== rules[key]
  )
  if (!changed.length) return state

  let next: FundState = { ...state, rules }
  if (changed.includes("buffer")) {
    next = {
      ...next,
      bufferHistory: [
        ...state.bufferHistory.filter((change) => change.from !== ctx.on),
        { from: ctx.on, buffer: rules.buffer },
      ],
    }
  }
  for (const key of changed) {
    next = logEvent(
      next,
      ctx,
      `${names[key]} changed from ${describe[key](state.rules[key])} to ${describe[key](rules[key])}`,
      { tag: "rules" }
    )
  }
  return next
}
