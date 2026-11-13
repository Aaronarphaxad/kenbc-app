"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import * as React from "react"
import {
  AlarmClockIcon,
  BanknoteIcon,
  BookOpenIcon,
  FolderOpenIcon,
  HomeIcon,
  SlidersHorizontalIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react"

import { BrandMark } from "@/components/brand-mark"
import { useFund } from "@/components/fund-provider"
import { MemberSearch } from "@/components/member-search"
import { initialsOf, UserMenuContent } from "@/components/role-gate"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { ADMIN_NAME } from "@/lib/fund"
import { ADMIN_EMAIL } from "@/lib/seed"

type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  count?: number
}

/** The admin desk: sidebar with work counts, member search, capped content width. */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const { state } = useFund()
  const pathname = usePathname()

  const nav: NavItem[] = [
    { title: "Home", href: "/admin", icon: HomeIcon },
    {
      title: "Payments",
      href: "/admin/payments",
      icon: BanknoteIcon,
      count: state.payments.filter((item) => item.status === "pending").length,
    },
    { title: "Members", href: "/admin/members", icon: UsersIcon },
    { title: "Ledger", href: "/admin/ledger", icon: BookOpenIcon },
    {
      title: "Cases",
      href: "/admin/cases",
      icon: FolderOpenIcon,
      count: state.cases.filter(
        (item) => item.status !== "closed" && item.status !== "declined"
      ).length,
    },
    { title: "Arrears", href: "/admin/arrears", icon: AlarmClockIcon },
    { title: "Rules", href: "/admin/rules", icon: SlidersHorizontalIcon },
  ]
  const current =
    [...nav]
      .reverse()
      .find((item) =>
        item.href === "/admin"
          ? pathname === "/admin"
          : pathname === item.href || pathname.startsWith(`${item.href}/`)
      ) ?? nav[0]

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 60)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <Sidebar collapsible="offcanvas" variant="inset">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton className="h-10" render={<Link href="/admin" />}>
                <BrandMark />
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {nav.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    active={item.href === current.href}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <AdminMenu />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="min-w-0">
        <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b print:hidden">
          <div className="flex w-full items-center gap-1 px-4 lg:px-6">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mx-2 h-4 data-vertical:self-auto"
            />
            <h1 className="text-base font-medium">{current.title}</h1>
            <div className="ml-auto">
              <MemberSearch />
            </div>
          </div>
        </header>
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 lg:px-6">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const { isMobile, setOpenMobile } = useSidebar()

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={active}
        tooltip={item.title}
        render={
          <Link
            href={item.href}
            onClick={() => {
              if (isMobile) setOpenMobile(false)
            }}
          />
        }
      >
        <item.icon />
        <span>{item.title}</span>
      </SidebarMenuButton>
      {item.count ? <SidebarMenuBadge>{item.count}</SidebarMenuBadge> : null}
    </SidebarMenuItem>
  )
}

function AdminMenu() {
  const { isMobile } = useSidebar()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton size="lg" className="aria-expanded:bg-muted" />
            }
          >
            <Avatar className="size-8 rounded-lg">
              <AvatarFallback className="rounded-lg">
                {initialsOf(ADMIN_NAME)}
              </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{ADMIN_NAME}</span>
              <span className="truncate text-xs text-muted-foreground">
                Treasurer
              </span>
            </div>
          </DropdownMenuTrigger>
          <UserMenuContent
            name={ADMIN_NAME}
            detail={ADMIN_EMAIL}
            side={isMobile ? "bottom" : "right"}
          />
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
