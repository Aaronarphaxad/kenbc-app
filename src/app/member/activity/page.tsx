"use client"

import { useFund } from "@/components/fund-provider"
import { PageHeader } from "@/components/page-header"
import { StatementTable } from "@/components/statement-table"

export default function ActivityPage() {
  const { me } = useFund()
  if (!me) return null

  return (
    <>
      <PageHeader
        title="Activity"
        description="Every payment and levy on your account, with your balance after each one."
      />
      <StatementTable memberId={me.id} mode="member" />
    </>
  )
}
