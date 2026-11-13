import type {
  AccountStatus,
  CaseStatus,
  EntryKind,
  PaymentMethod,
  PaymentStatus,
  Standing,
} from "@/lib/types"

const cad = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
})

export function formatCad(amount: number) {
  return cad.format(amount)
}

function toDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number)
  return new Date(year, month - 1, day)
}

export function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(toDate(iso))
}

export function formatDay(iso: string) {
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
  }).format(toDate(iso))
}

export function formatMonth(month: string, withYear = true) {
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
  }).format(toDate(`${month}-01`))
}

export function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`
}

export const standingLabels: Record<Standing, string> = {
  "paid-up": "Paid up",
  grace: "Grace",
  delinquent: "Delinquent",
  "removal-review": "Removal review",
}

export const accountLabels: Record<AccountStatus, string> = {
  invited: "Invited",
  active: "Active",
  suspended: "Suspended",
}

export const kindLabels: Record<EntryKind, string> = {
  opening: "Balance brought forward",
  contribution: "Contribution",
  "top-up": "Top-up",
  levy: "Levy",
  adjustment: "Adjustment",
  reversal: "Reversal",
}

export const methodLabels: Record<PaymentMethod, string> = {
  interac: "Interac e-Transfer",
  cash: "Cash",
  cheque: "Cheque",
  deposit: "Bank deposit",
}

export const paymentLabels: Record<PaymentStatus, string> = {
  pending: "Awaiting approval",
  approved: "Approved",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
}

export const caseLabels: Record<CaseStatus, string> = {
  submitted: "Submitted",
  "under-review": "Under review",
  approved: "Approved",
  disbursed: "Disbursed",
  closed: "Closed",
  declined: "Declined",
}

export const referenceLabels: Record<PaymentMethod, string> = {
  interac: "Interac reference",
  cash: "Receipt number",
  cheque: "Cheque number",
  deposit: "Deposit reference",
}
