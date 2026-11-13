"use client"

import * as React from "react"

import { ADMIN_NAME, memberById, type Ctx } from "@/lib/fund"
import { DEFAULT_RULES, todayIso } from "@/lib/rules"
import { createSeed, SEED_VERSION } from "@/lib/seed"
import type { FundState, Member, Role, Session } from "@/lib/types"

const FUND_KEY = "kenbc-fund"
const SESSION_KEY = "kenbc-session"

type Action<Args extends unknown[]> = (
  state: FundState,
  ctx: Ctx,
  ...args: Args
) => FundState

type FundContextValue = {
  ready: boolean
  state: FundState
  session: Session | null
  /** The signed-in member, when the session is a member session. */
  me: Member | null
  today: string
  signIn: (role: Role, memberId?: string) => void
  signOut: () => void
  /** Runs a ledger action as the signed-in user. Returns false when nothing changed. */
  run: <Args extends unknown[]>(action: Action<Args>, ...args: Args) => boolean
  reset: () => void
}

type Snapshot = {
  ready: boolean
  state: FundState
  session: Session | null
}

/* -------------------------------------------------------------------------- */
/* A small browser-only store. The sample fund lives in sessionStorage so a   */
/* refresh keeps your changes and closing the tab starts over.                */
/* -------------------------------------------------------------------------- */

const SERVER: Snapshot = {
  ready: false,
  session: null,
  state: {
    version: SEED_VERSION,
    rules: DEFAULT_RULES,
    bufferHistory: [],
    members: [],
    journal: [],
    payments: [],
    cases: [],
    audit: [],
  },
}

let snapshot = SERVER
const listeners = new Set<() => void>()

function saveFund(state: FundState) {
  sessionStorage.setItem(FUND_KEY, JSON.stringify(state))
  return state
}

function readFund(): FundState {
  try {
    const raw = sessionStorage.getItem(FUND_KEY)
    const parsed = raw ? (JSON.parse(raw) as FundState) : null
    if (parsed && parsed.version === SEED_VERSION) return parsed
  } catch {
    // Fall through to a fresh sample fund.
  }
  return saveFund(createSeed())
}

function readSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    const parsed = raw ? (JSON.parse(raw) as Session) : null
    if (parsed && (parsed.role === "admin" || parsed.role === "member")) {
      return parsed
    }
  } catch {
    // Treat an unreadable session as signed out.
  }
  return null
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot() {
  if (!snapshot.ready) {
    snapshot = { ready: true, state: readFund(), session: readSession() }
  }
  return snapshot
}

function getServerSnapshot() {
  return SERVER
}

function update(patch: Partial<Snapshot>) {
  snapshot = { ...getSnapshot(), ...patch }
  listeners.forEach((listener) => listener())
}

function signIn(role: Role, memberId?: string) {
  const session: Session = {
    role,
    memberId: role === "member" ? (memberId ?? null) : null,
  }
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
  update({ session })
}

function signOut() {
  sessionStorage.removeItem(SESSION_KEY)
  update({ session: null })
}

function run<Args extends unknown[]>(action: Action<Args>, ...args: Args) {
  const { state, session } = getSnapshot()
  const actor =
    session?.role === "member"
      ? (memberById(state, session.memberId)?.name ?? "Member")
      : ADMIN_NAME
  const next = action(state, { actor, on: todayIso() }, ...args)
  if (next === state) return false
  update({ state: saveFund(next) })
  return true
}

function reset() {
  update({ state: saveFund(createSeed()) })
}

const FundContext = React.createContext<FundContextValue | null>(null)

export function FundProvider({ children }: { children: React.ReactNode }) {
  const { ready, state, session } = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  )

  const value = React.useMemo<FundContextValue>(
    () => ({
      ready,
      state,
      session,
      me:
        session?.role === "member"
          ? (memberById(state, session.memberId) ?? null)
          : null,
      today: todayIso(),
      signIn,
      signOut,
      run,
      reset,
    }),
    [ready, state, session]
  )

  return <FundContext.Provider value={value}>{children}</FundContext.Provider>
}

export function useFund() {
  const context = React.useContext(FundContext)
  if (!context) {
    throw new Error("useFund must be used within FundProvider")
  }
  return context
}
