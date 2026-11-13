"use client"

import { MemberShell } from "@/components/member-shell"
import { RoleGate } from "@/components/role-gate"

export default function MemberLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <RoleGate role="member">
      <MemberShell>{children}</MemberShell>
    </RoleGate>
  )
}
