"use client"

import { AdminShell } from "@/components/app-shell"
import { RoleGate } from "@/components/role-gate"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <RoleGate role="admin">
      <AdminShell>{children}</AdminShell>
    </RoleGate>
  )
}
