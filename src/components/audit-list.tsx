import { formatDate } from "@/lib/format"
import type { AuditEvent } from "@/lib/types"

/** Who did what and when, newest first. */
export function AuditList({
  events,
  empty = "Nothing recorded yet.",
}: {
  events: AuditEvent[]
  empty?: string
}) {
  if (!events.length) {
    return <p className="text-sm text-muted-foreground">{empty}</p>
  }
  return (
    <ol className="flex flex-col">
      {events.map((event) => (
        <li
          key={event.id}
          className="relative flex flex-col gap-0.5 border-l py-2 pl-4"
        >
          <span className="absolute top-3.5 -left-[3px] size-[5px] rounded-full bg-muted-foreground/60" />
          <span className="text-sm">{event.text}</span>
          <span className="text-xs text-muted-foreground">
            {event.actor} · {formatDate(event.on)}
          </span>
        </li>
      ))}
    </ol>
  )
}
