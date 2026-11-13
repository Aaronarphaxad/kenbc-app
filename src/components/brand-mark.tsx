import { cn } from "cn"

export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2 font-medium", className)}>
      <span className="flex size-6 items-center justify-center rounded-xs bg-primary text-xs font-semibold text-primary-foreground">
        K
      </span>
      KenBC
    </span>
  )
}
