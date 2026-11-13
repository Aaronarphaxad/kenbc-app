"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { useFund } from "@/components/fund-provider"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { memberById } from "@/lib/fund"
import { ADMIN_EMAIL, SAMPLE_MEMBERS } from "@/lib/seed"
import type { Role } from "@/lib/types"

export function LoginForm() {
  const params = useSearchParams()
  const router = useRouter()
  const { ready, state, signIn } = useFund()
  const initialRole: Role = params.get("role") === "member" ? "member" : "admin"
  const [role, setRole] = React.useState<Role>(initialRole)
  const [memberId, setMemberId] = React.useState<string>(SAMPLE_MEMBERS[0].id)
  const [email, setEmail] = React.useState(ADMIN_EMAIL)
  const [password, setPassword] = React.useState("")
  const [error, setError] = React.useState("")

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (role === "member") {
      signIn("member", memberId)
      router.push("/member")
      return
    }
    if (email.trim().toLowerCase() !== ADMIN_EMAIL || password.length === 0) {
      setError("Use the sample email shown and any password.")
      return
    }
    signIn("admin")
    router.push("/admin")
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Sign in</CardTitle>
        <CardDescription>
          Sample access for the KenBC fund preview.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel>Sign in as</FieldLabel>
              <ToggleGroup
                value={[role]}
                onValueChange={(value) => {
                  const next = value[0]
                  if (next === "admin" || next === "member") {
                    setRole(next)
                    setError("")
                  }
                }}
                variant="outline"
                spacing={0}
                className="w-full"
              >
                <ToggleGroupItem value="admin" className="flex-1">
                  Administrator
                </ToggleGroupItem>
                <ToggleGroupItem value="member" className="flex-1">
                  Member
                </ToggleGroupItem>
              </ToggleGroup>
            </Field>

            {role === "member" ? (
              <FieldSet>
                <FieldLegend variant="label">Choose a sample member</FieldLegend>
                <RadioGroup
                  value={memberId}
                  onValueChange={(next) => setMemberId(String(next))}
                >
                  {SAMPLE_MEMBERS.map((sample) => (
                    <FieldLabel key={sample.id} htmlFor={`sample-${sample.id}`}>
                      <Field orientation="horizontal">
                        <FieldContent>
                          <FieldTitle>
                            {ready
                              ? (memberById(state, sample.id)?.name ?? sample.id)
                              : sample.id}
                          </FieldTitle>
                          <FieldDescription>{sample.note}</FieldDescription>
                        </FieldContent>
                        <RadioGroupItem
                          value={sample.id}
                          id={`sample-${sample.id}`}
                        />
                      </Field>
                    </FieldLabel>
                  ))}
                </RadioGroup>
              </FieldSet>
            ) : (
              <>
                <Field data-invalid={error ? true : undefined}>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    aria-invalid={error ? true : undefined}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </Field>
                <Field data-invalid={error ? true : undefined}>
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    aria-invalid={error ? true : undefined}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                  <FieldDescription
                    className={error ? "text-destructive" : undefined}
                  >
                    {error || "Any password works in this preview."}
                  </FieldDescription>
                </Field>
              </>
            )}

            <Field>
              <Button type="submit" disabled={!ready}>
                Continue
              </Button>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
