"use client"

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type Option<Value extends string> = {
  value: Value
  label: string
}

/** A labelled dropdown that always shows the option label, never the raw value. */
export function FilterSelect<Value extends string>({
  label,
  value,
  onChange,
  options,
  className = "w-44",
  id,
}: {
  label: string
  value: Value
  onChange: (value: Value) => void
  options: Option<Value>[]
  className?: string
  id?: string
}) {
  return (
    <Select
      value={value}
      onValueChange={(next) => next && onChange(next as Value)}
      items={options}
    >
      <SelectTrigger id={id} className={className} aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
