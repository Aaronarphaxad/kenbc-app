import {
  ADMIN_NAME,
  approveCase,
  approvePayment,
  closeCase,
  declineCase,
  disburseCase,
  logEvent,
  markReminderSent,
  postAdjustment,
  postOpening,
  recordPayment,
  rejectPayment,
  reverseEntry,
  saveCaseNotes,
  setAccountStatus,
  startReview,
  submitCase,
  submitPayment,
  type Ctx,
} from "@/lib/fund"
import { DEFAULT_RULES, addDays, todayIso } from "@/lib/rules"
import type { FundState, Member, PaymentMethod } from "@/lib/types"

export const SEED_VERSION = 2

export const ADMIN_EMAIL = "admin@kenbc.test"

/** Three members to sign in as, one for each situation worth showing. */
export const SAMPLE_MEMBERS = [
  { id: "KEN-1009", note: "Paid up" },
  { id: "KEN-1008", note: "In grace, owes one levy" },
  { id: "KEN-1013", note: "Delinquent, owes two levies" },
] as const

/** The journal was started this many days ago from the paper ledger. */
const LAUNCH = 170

/** Days ago on which each approved case levied the membership. */
const LEVIES = [150, 115, 80, 45, 12]

type Profile = {
  name: string
  city: string
  /** Days ago the member joined. Before LAUNCH means a brought-forward balance. */
  joined: number
  method: PaymentMethod
  /** Days each levy took to be topped up; null means it was never paid. */
  lags: (number | null)[]
}

const PROFILES: Profile[] = [
  { name: "James Kariuki", city: "Vancouver", joined: 1140, method: "interac", lags: [3, 4, 2, 5, 2] },
  { name: "Grace Wanjiku", city: "Surrey", joined: 1085, method: "interac", lags: [5, null, 6, 3, 4] },
  { name: "Peter Otieno", city: "Burnaby", joined: 1012, method: "interac", lags: [7, 9, 12, 8, null] },
  { name: "Mary Achieng", city: "Richmond", joined: 960, method: "cash", lags: [8, 12, 9, null, null] },
  { name: "David Mwangi", city: "Coquitlam", joined: 40, method: "interac", lags: [null, null, null, null, 4] },
  { name: "Faith Njeri", city: "Langley", joined: 905, method: "cheque", lags: [6, null, null, null, null] },
  { name: "Samuel Kimani", city: "Vancouver", joined: 880, method: "deposit", lags: [2, 3, 4, 2, 3] },
  { name: "Amina Yusuf", city: "Surrey", joined: 822, method: "interac", lags: [4, 6, 3, 5, null] },
  { name: "Joseph Kamau", city: "Burnaby", joined: 790, method: "interac", lags: [3, 5, 2, 4, 3] },
  { name: "Lucy Chebet", city: "Abbotsford", joined: 745, method: "cheque", lags: [10, 7, 11, 9, null] },
  { name: "Brian Omondi", city: "New Westminster", joined: 6, method: "interac", lags: [] },
  { name: "Hannah Mutua", city: "Vancouver", joined: 701, method: "interac", lags: [4, 5, 6, 7, null] },
  { name: "Daniel Kiprop", city: "Delta", joined: 655, method: "interac", lags: [10, 14, 20, null, null] },
  { name: "Esther Nyambura", city: "Surrey", joined: 610, method: "cash", lags: [6, 4, 5, 6, 5] },
  { name: "Michael Ochieng", city: "Richmond", joined: 55, method: "interac", lags: [null, null, null, 6, null] },
  { name: "Catherine Wairimu", city: "North Vancouver", joined: 540, method: "interac", lags: [3, 2, 4, 3, 2] },
  { name: "Patrick Langat", city: "Burnaby", joined: 498, method: "interac", lags: [9, 8, 10, 12, null] },
  { name: "Naomi Cherono", city: "Maple Ridge", joined: 455, method: "cash", lags: [5, 9, null, null, null] },
  { name: "Eric Maina", city: "Vancouver", joined: 410, method: "interac", lags: [4, 6, 5, 4, 6] },
  { name: "Ruth Atieno", city: "Surrey", joined: 362, method: "deposit", lags: [5, 3, 7, 5, 4] },
  { name: "Collins Barasa", city: "Port Moody", joined: 100, method: "deposit", lags: [null, null, 5, 7, null] },
  { name: "Mercy Jepkoech", city: "Langley", joined: 22, method: "interac", lags: [null, null, null, null, 3] },
  { name: "Stephen Njoroge", city: "Coquitlam", joined: 318, method: "cash", lags: [6, 5, null, 4, 5] },
  { name: "Irene Moraa", city: "Vancouver", joined: 130, method: "interac", lags: [null, 8, 6, 5, 7] },
]

type Step = {
  ago: number
  actor: string
  run: (state: FundState, ctx: Ctx) => FundState
}

export function createSeed(): FundState {
  const today = todayIso()
  const day = (ago: number) => addDays(today, -ago)

  // A small fixed generator so references look real but never change.
  let seed = 20240611
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
  const letters = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"
  let receipt = 1040
  let cheque = 212
  const reference = (method: PaymentMethod) => {
    if (method === "cash") return `R-${(receipt += 1)}`
    if (method === "cheque") return String((cheque += 3)).padStart(6, "0")
    if (method === "deposit") {
      return `DEP-${String(Math.floor(random() * 900000) + 100000)}`
    }
    let code = "CA"
    for (let index = 0; index < 6; index += 1) {
      code += letters[Math.floor(random() * letters.length)]
    }
    return code
  }

  const members: Member[] = PROFILES.map((profile, index) => {
    const [first, last] = profile.name.toLowerCase().split(" ")
    const founding = profile.joined > LAUNCH
    return {
      id: `KEN-${1001 + index}`,
      name: profile.name,
      email: `${first}.${last}@kenbc.test`,
      phone: `604-555-01${String(index + 1).padStart(2, "0")}`,
      city: profile.city,
      joinedOn: day(profile.joined),
      accountStatus: founding ? "active" : "invited",
      statusReason: founding ? "" : "Awaiting first contribution",
    }
  })
  const idOf = (name: string) =>
    members.find((member) => member.name === name)?.id ?? ""

  const steps: Step[] = []
  const admin = (ago: number, run: Step["run"]) =>
    steps.push({ ago, actor: ADMIN_NAME, run })
  const member = (ago: number, memberId: string, run: Step["run"]) =>
    steps.push({
      ago,
      actor: members.find((item) => item.id === memberId)?.name ?? memberId,
      run,
    })

  const decideOldest = (
    state: FundState,
    memberId: string,
    decide: (state: FundState, paymentId: string, amount: number, paidOn: string) => FundState
  ) => {
    const pending = state.payments.find(
      (payment) => payment.memberId === memberId && payment.status === "pending"
    )
    return pending
      ? decide(state, pending.id, pending.amount, pending.paidOn)
      : state
  }

  /** Cash is taken and recorded by the office; everything else is declared, then approved. */
  const pay = (
    memberId: string,
    ago: number,
    amount: number,
    method: PaymentMethod,
    ref = reference(method)
  ) => {
    if (ago < 1) return
    if (method === "cash") {
      admin(ago, (state, ctx) =>
        recordPayment(state, ctx, {
          memberId,
          amount,
          method,
          reference: ref,
          paidOn: ctx.on,
        })
      )
      return
    }
    member(ago, memberId, (state, ctx) =>
      submitPayment(state, ctx, {
        memberId,
        amount,
        method,
        reference: ref,
        paidOn: ctx.on,
      })
    )
    admin(ago - 1, (state, ctx) =>
      decideOldest(state, memberId, (current, paymentId, declared, paidOn) =>
        approvePayment(current, ctx, paymentId, {
          amount: declared,
          receivedOn: paidOn,
        })
      )
    )
  }

  const declare = (
    memberId: string,
    ago: number,
    amount: number,
    method: PaymentMethod,
    ref = reference(method)
  ) =>
    member(ago, memberId, (state, ctx) =>
      submitPayment(state, ctx, {
        memberId,
        amount,
        method,
        reference: ref,
        paidOn: ctx.on,
      })
    )

  // Opening balances and first contributions.
  PROFILES.forEach((profile, index) => {
    const memberId = members[index].id
    if (profile.joined > LAUNCH) {
      admin(LAUNCH, (state, ctx) =>
        postOpening(state, ctx, memberId, DEFAULT_RULES.buffer)
      )
      return
    }
    admin(profile.joined, (state, ctx) =>
      logEvent(
        state,
        ctx,
        "Added to the fund and invited to make a first contribution",
        { memberId }
      )
    )
    if (profile.lags.length) {
      pay(memberId, profile.joined, DEFAULT_RULES.buffer, profile.method)
    }
  })

  // Top-ups after each levy, each member at their own pace.
  PROFILES.forEach((profile, index) => {
    const memberId = members[index].id
    profile.lags.forEach((lag, levy) => {
      if (lag === null) return
      const double = profile.name === "Catherine Wairimu" && levy === 1
      pay(
        memberId,
        LEVIES[levy] - lag,
        DEFAULT_RULES.levy * (double ? 2 : 1),
        profile.method
      )
    })
  })

  // The five approved cases behind the levies, and the rest of the case list.
  const cases: {
    member: string
    subject: string
    relationship: string
    submitted: number
    review?: number
    approved?: number
    disbursed?: number
    closed?: number
    declined?: number
    reason?: string
    notes?: string
    payout?: PaymentMethod
    documents: string[]
  }[] = [
    {
      member: "Amina Yusuf",
      subject: "Hassan Yusuf",
      relationship: "Parent",
      submitted: 156,
      review: 154,
      approved: LEVIES[0],
      disbursed: 148,
      closed: 145,
      payout: "interac",
      notes: "Death certificate confirmed with the family. Committee approved unanimously.",
      documents: ["death-certificate.pdf", "burial-permit.pdf"],
    },
    {
      member: "James Kariuki",
      subject: "Anne Kariuki",
      relationship: "Parent",
      submitted: 120,
      review: 118,
      approved: LEVIES[1],
      disbursed: 113,
      closed: 110,
      payout: "cheque",
      notes: "Funeral held in Nyeri. Programme and certificate received.",
      documents: ["death-certificate.pdf", "funeral-programme.pdf"],
    },
    {
      member: "Samuel Kimani",
      subject: "Joseph Kimani",
      relationship: "Sibling",
      submitted: 85,
      review: 84,
      approved: LEVIES[2],
      disbursed: 77,
      closed: 75,
      payout: "interac",
      notes: "Verified by two committee members.",
      documents: ["death-certificate.pdf"],
    },
    {
      member: "Esther Nyambura",
      subject: "John Nyambura",
      relationship: "Other relative",
      submitted: 62,
      review: 60,
      declined: 58,
      reason:
        "A cousin is outside the immediate family the fund covers (spouse, child, parent or sibling).",
      notes: "Relationship confirmed as cousin with the member by phone.",
      documents: ["funeral-programme.pdf"],
    },
    {
      member: "Ruth Atieno",
      subject: "Daudi Atieno",
      relationship: "Spouse",
      submitted: 49,
      review: 48,
      approved: LEVIES[3],
      disbursed: 43,
      closed: 40,
      payout: "deposit",
      notes: "Committee visited the family. Approved the same week.",
      documents: ["death-certificate.pdf", "marriage-certificate.pdf"],
    },
    {
      member: "Eric Maina",
      subject: "Wanjiru Maina",
      relationship: "Parent",
      submitted: 15,
      review: 14,
      approved: LEVIES[4],
      notes: "Approved. Waiting on banking details for the payout.",
      documents: ["death-certificate.pdf"],
    },
    {
      member: "Grace Wanjiku",
      subject: "Margaret Wanjiku",
      relationship: "Parent",
      submitted: 4,
      review: 3,
      notes: "Waiting for the death certificate from Nairobi.",
      documents: ["funeral-programme.pdf"],
    },
    {
      member: "Catherine Wairimu",
      subject: "Paul Wairimu",
      relationship: "Parent",
      submitted: 1,
      documents: ["death-certificate.pdf", "burial-permit.pdf"],
    },
    {
      member: "David Mwangi",
      subject: "Peter Mwangi",
      relationship: "Parent",
      submitted: 0,
      documents: ["death-certificate.pdf"],
    },
  ]

  cases.forEach((item, index) => {
    const caseId = `CASE-${String(index + 1).padStart(3, "0")}`
    const memberId = idOf(item.member)
    member(item.submitted, memberId, (state, ctx) =>
      submitCase(state, ctx, {
        memberId,
        subjectName: item.subject,
        relationship: item.relationship,
        dateOfDeath: addDays(ctx.on, -3),
        documents: item.documents,
      })
    )
    if (item.review !== undefined) {
      admin(item.review, (state, ctx) => {
        const started = startReview(state, ctx, caseId)
        return item.notes
          ? saveCaseNotes(started, ctx, caseId, item.notes)
          : started
      })
    }
    if (item.approved !== undefined) {
      admin(item.approved, (state, ctx) => approveCase(state, ctx, caseId))
    }
    if (item.declined !== undefined) {
      admin(item.declined, (state, ctx) =>
        declineCase(state, ctx, caseId, item.reason ?? "")
      )
    }
    if (item.disbursed !== undefined) {
      admin(item.disbursed, (state, ctx) => {
        const levy = state.cases.find((entry) => entry.id === caseId)?.levy
        const method = item.payout ?? "interac"
        return disburseCase(state, ctx, caseId, {
          amount: levy?.total ?? 0,
          method,
          paidOn: ctx.on,
          reference: reference(method),
        })
      })
    }
    if (item.closed !== undefined) {
      admin(item.closed, (state, ctx) => closeCase(state, ctx, caseId))
    }
  })

  // The exceptions an accountant would expect to find in a real ledger.
  const grace = idOf("Grace Wanjiku")
  admin(100, (state, ctx) =>
    postAdjustment(state, ctx, {
      memberId: grace,
      direction: "increase",
      amount: DEFAULT_RULES.levy,
      reason: "Top-up paid in cash to the treasurer, missed from the ledger",
    })
  )

  const stephen = idOf("Stephen Njoroge")
  const stephenReceipt = reference("cash")
  pay(stephen, 75, DEFAULT_RULES.levy, "cash", stephenReceipt)
  pay(stephen, 74, DEFAULT_RULES.levy, "cash", stephenReceipt)
  admin(72, (state, ctx) => {
    const duplicate = state.journal
      .filter((entry) => entry.memberId === stephen && entry.credit > 0)
      .pop()
    return duplicate
      ? reverseEntry(state, ctx, duplicate.id, "Same cash receipt entered twice")
      : state
  })

  const mary = idOf("Mary Achieng")
  pay(mary, 30, 20, "cash")

  const faith = idOf("Faith Njeri")
  admin(85, (state, ctx) => markReminderSent(state, ctx, faith))
  admin(70, (state, ctx) => markReminderSent(state, ctx, faith))
  admin(48, (state, ctx) =>
    setAccountStatus(
      state,
      ctx,
      faith,
      "suspended",
      "No response to two reminders. Suspended by the committee pending removal review."
    )
  )

  const naomi = idOf("Naomi Cherono")
  admin(50, (state, ctx) => markReminderSent(state, ctx, naomi))
  admin(20, (state, ctx) => markReminderSent(state, ctx, naomi))
  admin(35, (state, ctx) => markReminderSent(state, ctx, mary))
  admin(14, (state, ctx) =>
    markReminderSent(state, ctx, idOf("Daniel Kiprop"))
  )

  const hannah = idOf("Hannah Mutua")
  const hannahReference = "CAx9Tm4W"
  declare(hannah, 10, DEFAULT_RULES.levy, "interac", "CA7hK2pQ")
  admin(9, (state, ctx) =>
    decideOldest(state, hannah, (current, paymentId) =>
      rejectPayment(
        current,
        ctx,
        paymentId,
        "No e-Transfer with this reference reached the fund inbox. Please check the reference and declare it again."
      )
    )
  )
  pay(hannah, 8, DEFAULT_RULES.levy, "interac", hannahReference)

  // Waiting in the approval queue today.
  declare(idOf("Collins Barasa"), 3, DEFAULT_RULES.levy, "deposit")
  declare(idOf("Peter Otieno"), 2, DEFAULT_RULES.levy, "interac")
  declare(idOf("Lucy Chebet"), 1, DEFAULT_RULES.levy, "cheque")
  declare(idOf("Patrick Langat"), 1, DEFAULT_RULES.levy, "interac", hannahReference)

  const initial: FundState = {
    version: SEED_VERSION,
    rules: DEFAULT_RULES,
    bufferHistory: [{ from: "2000-01-01", buffer: DEFAULT_RULES.buffer }],
    members,
    journal: [],
    payments: [],
    cases: [],
    audit: [],
  }

  return steps
    .map((step, index) => ({ step, index }))
    .sort((a, b) => b.step.ago - a.step.ago || a.index - b.index)
    .reduce(
      (state, { step }) =>
        step.run(state, { actor: step.actor, on: day(step.ago) }),
      initial
    )
}
