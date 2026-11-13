export type Role = "admin" | "member"

export type AccountStatus = "invited" | "active" | "suspended"

export type Standing = "paid-up" | "grace" | "delinquent" | "removal-review"

export type EntryKind =
  | "opening"
  | "contribution"
  | "top-up"
  | "levy"
  | "adjustment"
  | "reversal"

export type PaymentMethod = "interac" | "cash" | "cheque" | "deposit"

export type PaymentStatus = "pending" | "approved" | "rejected" | "withdrawn"

export type CaseStatus =
  | "submitted"
  | "under-review"
  | "approved"
  | "disbursed"
  | "closed"
  | "declined"

export type Rules = {
  buffer: number
  levy: number
  graceDays: number
  delinquencyDays: number
  waitingDays: number
}

export type BufferChange = {
  from: string
  buffer: number
}

export type Member = {
  id: string
  name: string
  email: string
  phone: string
  city: string
  joinedOn: string
  accountStatus: AccountStatus
  statusReason: string
}

export type EntrySource = {
  type: "payment" | "case"
  id: string
}

export type JournalEntry = {
  id: string
  memberId: string
  postedOn: string
  effectiveOn: string
  kind: EntryKind
  debit: number
  credit: number
  method: PaymentMethod | null
  reference: string
  memo: string
  postedBy: string
  source: EntrySource | null
  reverses: string | null
}

export type Payment = {
  id: string
  memberId: string
  amount: number
  method: PaymentMethod
  reference: string
  paidOn: string
  submittedOn: string
  submittedBy: "member" | "office"
  status: PaymentStatus
  receivedAmount: number | null
  decidedOn: string | null
  decidedBy: string | null
  reason: string
  entryId: string | null
}

export type Disbursement = {
  amount: number
  method: PaymentMethod
  paidOn: string
  reference: string
}

export type CaseLevy = {
  count: number
  amount: number
  total: number
}

export type BereavementCase = {
  id: string
  memberId: string
  subjectName: string
  relationship: string
  dateOfDeath: string
  submittedOn: string
  status: CaseStatus
  documents: string[]
  notes: string
  reviewStartedOn: string | null
  decidedOn: string | null
  decisionReason: string
  levy: CaseLevy | null
  disbursement: Disbursement | null
  closedOn: string | null
}

export type AuditEvent = {
  id: string
  on: string
  actor: string
  text: string
  memberId?: string
  paymentId?: string
  caseId?: string
  tag?: "rules" | "reminder"
}

export type FundState = {
  version: number
  rules: Rules
  bufferHistory: BufferChange[]
  members: Member[]
  journal: JournalEntry[]
  payments: Payment[]
  cases: BereavementCase[]
  audit: AuditEvent[]
}

export type Session = {
  role: Role
  memberId: string | null
}
