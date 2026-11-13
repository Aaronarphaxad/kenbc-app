import type {
  FundState,
  JournalEntry,
  Member,
  Rules,
  Standing,
} from "@/lib/types";

export const DEFAULT_RULES: Rules = {
  buffer: 105,
  levy: 35,
  graceDays: 30,
  delinquencyDays: 60,
  waitingDays: 90,
};

function utc(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

export function todayIso() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function addDays(iso: string, days: number) {
  return new Date(utc(iso) + days * 86_400_000).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string) {
  return Math.round((utc(to) - utc(from)) / 86_400_000);
}

export function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export function byEffective(a: JournalEntry, b: JournalEntry) {
  if (a.effectiveOn === b.effectiveOn) return a.id.localeCompare(b.id);
  return a.effectiveOn.localeCompare(b.effectiveOn);
}

type LedgerSlice = Pick<FundState, "rules" | "bufferHistory" | "journal">;

export type StandingInfo = {
  balance: number;
  shortfall: number;
  shortSince: string | null;
  daysShort: number;
  graceEndsOn: string | null;
  standing: Standing;
};

/**
 * Standing is never stored. It is worked out from the member's posted entries:
 * the clock starts on the entry that takes the balance under the buffer and
 * stops only when the buffer is fully restored.
 */
export function standingOf(
  slice: LedgerSlice,
  member: Member,
  asOf: string,
): StandingInfo {
  const { rules } = slice;
  const posted = slice.journal.filter(
    (entry) => entry.memberId === member.id && entry.effectiveOn <= asOf,
  );
  // A line that was later reversed never counted: it and its reversal are left
  // out, so a payment posted in error does not restart the member's clock.
  const reversed = new Set(posted.map((entry) => entry.reverses));
  const steps = [
    ...slice.bufferHistory
      .filter((change) => change.from <= asOf)
      .map((change) => ({ on: change.from, order: 0, change, entry: null })),
    ...posted
      .filter((entry) => !entry.reverses && !reversed.has(entry.id))
      .sort(byEffective)
      .map((entry) => ({
        on: entry.effectiveOn,
        order: 1,
        change: null,
        entry,
      })),
  ].sort((a, b) =>
    a.on === b.on ? a.order - b.order : a.on.localeCompare(b.on),
  );

  let buffer = slice.bufferHistory[0]?.buffer ?? rules.buffer;
  let balance = 0;
  let shortSince: string | null = member.joinedOn;

  for (const step of steps) {
    if (step.change) buffer = step.change.buffer;
    if (step.entry) {
      balance = round2(balance + step.entry.credit - step.entry.debit);
    }
    if (balance >= buffer) shortSince = null;
    else if (shortSince === null) shortSince = step.on;
  }

  const shortfall = Math.max(0, round2(buffer - balance));
  if (shortfall === 0 || shortSince === null) {
    return {
      balance,
      shortfall: 0,
      shortSince: null,
      daysShort: 0,
      graceEndsOn: null,
      standing: "paid-up",
    };
  }

  const daysShort = Math.max(0, daysBetween(shortSince, asOf));
  const standing: Standing =
    daysShort <= rules.graceDays
      ? "grace"
      : daysShort <= rules.delinquencyDays
        ? "delinquent"
        : "removal-review";

  return {
    balance,
    shortfall,
    shortSince,
    daysShort,
    graceEndsOn: addDays(shortSince, rules.graceDays),
    standing,
  };
}

export type EligibilityCheck = {
  label: string;
  passed: boolean;
};

export type Eligibility = {
  eligible: boolean;
  checks: EligibilityCheck[];
  waitingEndsOn: string;
};

const standingText: Record<Standing, string> = {
  "paid-up": "Paid up",
  grace: "In grace",
  delinquent: "Delinquent",
  "removal-review": "Under removal review",
};

/** Eligible for benefit: active, paid up or in grace, and past the waiting period. */
export function eligibilityOf(
  slice: LedgerSlice,
  member: Member,
  asOf: string,
): Eligibility {
  const info = standingOf(slice, member, asOf);
  const waitingEndsOn = addDays(member.joinedOn, slice.rules.waitingDays);
  const active = member.accountStatus === "active";
  const goodStanding = info.standing === "paid-up" || info.standing === "grace";
  const waited = asOf >= waitingEndsOn;

  const checks: EligibilityCheck[] = [
    {
      label: active
        ? "Account is active"
        : `Account is ${member.accountStatus}`,
      passed: active,
    },
    {
      label:
        info.standing === "paid-up"
          ? standingText[info.standing]
          : info.daysShort === 0
            ? `${standingText[info.standing]}, short since that day`
            : `${standingText[info.standing]}, ${info.daysShort} ${info.daysShort === 1 ? "day" : "days"} short`,
      passed: goodStanding,
    },
    {
      label: waited
        ? `${slice.rules.waitingDays}-day waiting period complete`
        : `${slice.rules.waitingDays}-day waiting period not complete`,
      passed: waited,
    },
  ];

  return {
    eligible: checks.every((check) => check.passed),
    checks,
    waitingEndsOn,
  };
}
