"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { SearchIcon } from "lucide-react";

import { useFund } from "@/components/fund-provider";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCad, standingLabels } from "@/lib/format";
import { memberRows } from "@/lib/fund";

/** Jump straight to any member's record from anywhere in the admin desk. */
export function MemberSearch() {
  const { state, today } = useFund();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const rows = React.useMemo(
    () => (open ? memberRows(state, today) : []),
    [open, state, today],
  );

  React.useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="w-9 justify-start px-0 text-muted-foreground sm:w-56 sm:px-2.5"
        onClick={() => setOpen(true)}
      >
        <SearchIcon data-icon="inline-start" className="mx-auto sm:mx-0" />
        <span className="hidden sm:inline">Find a member</span>
        <kbd className="ml-auto hidden rounded border bg-muted px-1.5 font-mono text-[10px] sm:inline">
          ⌘K
        </kbd>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="top-1/3 translate-y-0 overflow-hidden rounded-xl! p-0"
          showCloseButton={false}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Find a member</DialogTitle>
            <DialogDescription>
              Search by name, member number or email
            </DialogDescription>
          </DialogHeader>
          <Command>
            <CommandInput placeholder="Name, member number or email" />
            <CommandList>
              <CommandEmpty>No member found.</CommandEmpty>
              <CommandGroup heading="Members">
                {rows.map((row) => (
                  <CommandItem
                    key={row.member.id}
                    value={`${row.member.name} ${row.member.id} ${row.member.email}`}
                    onSelect={() => {
                      setOpen(false);
                      router.push(`/admin/members/${row.member.id}`);
                    }}
                  >
                    <span className="font-medium">{row.member.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {row.member.id}
                    </span>
                    <CommandShortcut className="tracking-normal">
                      {row.member.accountStatus === "invited"
                        ? "Invited"
                        : row.info.shortfall > 0
                          ? `${standingLabels[row.info.standing]} · ${formatCad(row.info.shortfall)} short`
                          : standingLabels[row.info.standing]}
                    </CommandShortcut>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
