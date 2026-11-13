"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import * as React from "react"
import {
  BanknoteIcon,
  HeartHandshakeIcon,
  HomeIcon,
  ReceiptTextIcon,
} from "lucide-react"
import { cn } from "cn"

import { BrandMark } from "@/components/brand-mark"
import { useFund } from "@/components/fund-provider"
import { initialsOf, UserMenuContent } from "@/components/role-gate"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const tabs = [
  { title: "Home", href: "/member", icon: HomeIcon },
  { title: "Pay", href: "/member/pay", icon: BanknoteIcon },
  { title: "Activity", href: "/member/activity", icon: ReceiptTextIcon },
  { title: "Requests", href: "/member/requests", icon: HeartHandshakeIcon },
]

/** Four destinations: a top bar on desktop, a bottom tab bar on phones. */
export function MemberShell({ children }: { children: React.ReactNode }) {
  const { me } = useFund()
  const pathname = usePathname()
  const isActive = (href: string) =>
    href === "/member"
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`)

  return (
    <div className="flex min-h-svh flex-col bg-muted/40">
      <header className="sticky top-0 z-20 border-b bg-background print:hidden">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center gap-6 px-4">
          <Link href="/member" className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <BrandMark />
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {tabs.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={isActive(tab.href) ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
                  isActive(tab.href) && "bg-muted text-foreground"
                )}
              >
                {tab.title}
              </Link>
            ))}
          </nav>
          <div className="ml-auto">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="ghost" className="h-9 gap-2 px-1.5" />}
              >
                <Avatar className="size-7">
                  <AvatarFallback className="text-xs">
                    {initialsOf(me?.name ?? "")}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden text-sm sm:inline">{me?.name}</span>
              </DropdownMenuTrigger>
              <UserMenuContent
                name={me?.name ?? ""}
                detail={`Member ${me?.id ?? ""}`}
              />
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 pb-24 md:pb-10">
        {children}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden print:hidden"
        aria-label="Main"
      >
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive(tab.href) ? "page" : undefined}
            className={cn(
              "flex flex-col items-center gap-1 py-2 text-xs font-medium text-muted-foreground",
              isActive(tab.href) && "text-primary"
            )}
          >
            <tab.icon className="size-5" />
            {tab.title}
          </Link>
        ))}
      </nav>
    </div>
  )
}
