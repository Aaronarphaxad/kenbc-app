"use client"

import { useRouter } from "next/navigation"
import * as React from "react"
import { LogOutIcon, RotateCcwIcon } from "lucide-react"
import { toast } from "sonner"

import { useFund } from "@/components/fund-provider"
import {
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import type { Role } from "@/lib/types"

// Signing out sends the user home; the gate must not also send them to sign in.
let leaving = false

/** Renders the portal only for a signed-in user with the right role. */
export function RoleGate({
  role,
  children,
}: {
  role: Role
  children: React.ReactNode
}) {
  const { ready, session, me } = useFund()
  const router = useRouter()
  const allowed =
    ready && session?.role === role && (role === "admin" || me !== null)

  React.useEffect(() => {
    if (!ready) return
    if (allowed) {
      leaving = false
      return
    }
    if (!leaving) router.replace(`/login?role=${role}`)
  }, [ready, allowed, role, router])

  if (!allowed) return <div className="min-h-svh bg-background" />
  return <>{children}</>
}

export function initialsOf(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
}

/** The same account menu in both portals: who you are, reset, sign out. */
export function UserMenuContent({
  name,
  detail,
  side,
}: {
  name: string
  detail: string
  side?: "bottom" | "right"
}) {
  const { signOut, reset } = useFund()
  const router = useRouter()

  return (
    <DropdownMenuContent
      className="min-w-56"
      side={side ?? "bottom"}
      align="end"
      sideOffset={4}
    >
      <DropdownMenuGroup>
        <DropdownMenuLabel className="flex flex-col font-normal">
          <span className="text-sm font-medium text-foreground">{name}</span>
          <span>{detail}</span>
        </DropdownMenuLabel>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onClick={() => {
          reset()
          toast.success("Sample data reset")
        }}
      >
        <RotateCcwIcon />
        Reset sample data
      </DropdownMenuItem>
      <DropdownMenuItem
        onClick={() => {
          leaving = true
          signOut()
          router.push("/")
        }}
      >
        <LogOutIcon />
        Sign out
      </DropdownMenuItem>
    </DropdownMenuContent>
  )
}
