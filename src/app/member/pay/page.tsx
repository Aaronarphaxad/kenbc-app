"use client"

import { useRouter } from "next/navigation"
import * as React from "react"
import { toast } from "sonner"

import { useFund } from "@/components/fund-provider"
import { MemberPayments } from "@/components/member-payments"
import { Detail, PageHeader } from "@/components/page-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  formatCad,
  formatDate,
  methodLabels,
  referenceLabels,
} from "@/lib/format"
import { memberRow, submitPayment, type MemberRow } from "@/lib/fund"
import { round2 } from "@/lib/rules"
import type { PaymentMethod } from "@/lib/types"

const methods: { value: PaymentMethod; hint: string }[] = [
  { value: "interac", hint: "Send from your banking app" },
  { value: "deposit", hint: "Pay in at a branch or bank machine" },
  { value: "cheque", hint: "Hand or mail it to the treasurer" },
  { value: "cash", hint: "Hand it to the treasurer at a meeting" },
]

export default function PayPage() {
  const { state, me, today } = useFund()
  if (!me) return null
  return <PayForm row={memberRow(state, me, today)} />
}

function PayForm({ row }: { row: MemberRow }) {
  const { state, run, today } = useFund()
  const router = useRouter()
  const { rules } = state
  const { member, info, pendingTotal } = row
  const owed = round2(Math.max(0, info.shortfall - pendingTotal))

  const choices = [
    owed > 0
      ? {
          id: "owed",
          title: pendingTotal > 0 ? "What you still owe" : "What you owe",
          hint: "Brings your balance back to the full buffer",
          amount: owed,
        }
      : null,
    owed !== rules.levy
      ? {
          id: "levy",
          title: "One levy",
          hint: "The amount charged for one bereavement",
          amount: rules.levy,
        }
      : null,
    owed !== rules.buffer
      ? {
          id: "buffer",
          title: "Full buffer",
          hint: "The balance every member keeps on account",
          amount: rules.buffer,
        }
      : null,
    {
      id: "other",
      title: "Another amount",
      hint: "Pay part now, or pay ahead",
      amount: null,
    },
  ].filter((choice) => choice !== null)

  const [choice, setChoice] = React.useState(choices[0].id)
  const [other, setOther] = React.useState("")
  const [method, setMethod] = React.useState<PaymentMethod>("interac")
  const [reference, setReference] = React.useState("")
  const [paidOn, setPaidOn] = React.useState(today)
  const [tried, setTried] = React.useState(false)
  const [reviewing, setReviewing] = React.useState(false)

  const picked = choices.find((item) => item.id === choice) ?? choices[0]
  const amount = picked.amount ?? Number(other)
  const amountValid = amount > 0
  const referenceNeeded = method !== "cash"
  const referenceValid = !referenceNeeded || reference.trim().length > 0
  const dateValid = Boolean(paidOn) && paidOn <= today
  const history = state.payments
    .filter((payment) => payment.memberId === member.id)
    .reverse()
    .slice(0, 6)

  const instructions: Record<PaymentMethod, React.ReactNode> = {
    interac: (
      <>
        Send {amountValid ? formatCad(amount) : "your payment"} to{" "}
        <strong className="font-medium text-foreground">pay@kenbc.test</strong>{" "}
        and put your member number{" "}
        <strong className="font-medium text-foreground">{member.id}</strong> in
        the message. Your bank shows a reference number once it is sent.
      </>
    ),
    deposit: (
      <>
        Deposit to{" "}
        <strong className="font-medium text-foreground">
          KenBC Bereavement Fund
        </strong>
        , transit 00012, account 345-678 (sample details). Keep the slip and
        enter its reference below.
      </>
    ),
    cheque: (
      <>
        Make it payable to{" "}
        <strong className="font-medium text-foreground">
          KenBC Bereavement Fund
        </strong>{" "}
        and write {member.id} on the back. It is approved once the treasurer
        has it in hand.
      </>
    ),
    cash: (
      <>
        Hand it to the treasurer and ask for a receipt. Telling us here lets
        you track it until the treasurer confirms it.
      </>
    ),
  }

  return (
    <>
      <PageHeader
        title="Pay"
        description="Tell us what you paid and how. The treasurer confirms it, then it shows on your balance."
      />

      {info.shortfall === 0 ? (
        <Alert>
          <AlertTitle>You are paid up</AlertTitle>
          <AlertDescription>
            Nothing is due. You can still pay ahead if you want to.
          </AlertDescription>
        </Alert>
      ) : owed === 0 ? (
        <Alert>
          <AlertTitle>
            {formatCad(pendingTotal)} is already awaiting approval
          </AlertTitle>
          <AlertDescription>
            That covers what you owe. You do not need to pay again.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <form
          className="flex flex-col gap-6"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            setTried(true)
            if (amountValid && referenceValid && dateValid) setReviewing(true)
          }}
        >
          <CardContent>
            <FieldGroup>
              <FieldSet>
                <FieldLegend>How much are you paying?</FieldLegend>
                <RadioGroup
                  value={choice}
                  onValueChange={(next) => setChoice(String(next))}
                  className="sm:grid-cols-2"
                >
                  {choices.map((item) => (
                    <FieldLabel key={item.id} htmlFor={`amount-${item.id}`}>
                      <Field orientation="horizontal">
                        <FieldContent>
                          <FieldTitle>
                            {item.title}
                            {item.amount !== null ? (
                              <span className="ml-auto tabular-nums">
                                {formatCad(item.amount)}
                              </span>
                            ) : null}
                          </FieldTitle>
                          <FieldDescription>{item.hint}</FieldDescription>
                        </FieldContent>
                        <RadioGroupItem
                          value={item.id}
                          id={`amount-${item.id}`}
                        />
                      </Field>
                    </FieldLabel>
                  ))}
                </RadioGroup>
                {choice === "other" ? (
                  <Field data-invalid={tried && !amountValid}>
                    <FieldLabel htmlFor="other-amount">Amount</FieldLabel>
                    <Input
                      id="other-amount"
                      type="number"
                      inputMode="decimal"
                      min="0.01"
                      step="0.01"
                      value={other}
                      onChange={(event) => setOther(event.target.value)}
                      placeholder="0.00"
                      aria-invalid={tried && !amountValid}
                      className="sm:max-w-40"
                    />
                    {tried && !amountValid ? (
                      <FieldDescription className="text-destructive">
                        Enter the amount you paid.
                      </FieldDescription>
                    ) : null}
                  </Field>
                ) : null}
              </FieldSet>

              <FieldSeparator />

              <FieldSet>
                <FieldLegend>How did you pay?</FieldLegend>
                <RadioGroup
                  value={method}
                  onValueChange={(next) => setMethod(next as PaymentMethod)}
                  className="sm:grid-cols-2"
                >
                  {methods.map((item) => (
                    <FieldLabel key={item.value} htmlFor={`method-${item.value}`}>
                      <Field orientation="horizontal">
                        <FieldContent>
                          <FieldTitle>{methodLabels[item.value]}</FieldTitle>
                          <FieldDescription>{item.hint}</FieldDescription>
                        </FieldContent>
                        <RadioGroupItem
                          value={item.value}
                          id={`method-${item.value}`}
                        />
                      </Field>
                    </FieldLabel>
                  ))}
                </RadioGroup>
                <p className="rounded-xs border bg-muted/40 p-3 text-sm text-muted-foreground">
                  {instructions[method]}
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field data-invalid={tried && !referenceValid}>
                    <FieldLabel htmlFor="pay-reference">
                      {referenceLabels[method]}
                      {referenceNeeded ? "" : " (optional)"}
                    </FieldLabel>
                    <Input
                      id="pay-reference"
                      value={reference}
                      onChange={(event) => setReference(event.target.value)}
                      aria-invalid={tried && !referenceValid}
                      autoComplete="off"
                    />
                    {tried && !referenceValid ? (
                      <FieldDescription className="text-destructive">
                        The treasurer needs this to match your payment.
                      </FieldDescription>
                    ) : null}
                  </Field>
                  <Field data-invalid={tried && !dateValid}>
                    <FieldLabel htmlFor="pay-date">Date you paid</FieldLabel>
                    <Input
                      id="pay-date"
                      type="date"
                      max={today}
                      value={paidOn}
                      onChange={(event) => setPaidOn(event.target.value)}
                      aria-invalid={tried && !dateValid}
                    />
                  </Field>
                </div>
              </FieldSet>
            </FieldGroup>
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit" size="lg">
              Review payment
            </Button>
          </CardFooter>
        </form>
      </Card>

      {history.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Your recent payments</CardTitle>
            <CardDescription>
              Each payment stays here until the treasurer approves or rejects
              it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MemberPayments payments={history} />
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={reviewing} onOpenChange={setReviewing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Check and send</DialogTitle>
            <DialogDescription>
              This tells the treasurer to look for your payment. Your balance
              changes when it is approved.
            </DialogDescription>
          </DialogHeader>
          <dl className="flex flex-col gap-2 rounded-xs border bg-muted/40 p-3">
            <Detail label="Amount">{formatCad(amount)}</Detail>
            <Detail label="Method">{methodLabels[method]}</Detail>
            {reference.trim() ? (
              <Detail label={referenceLabels[method]}>{reference.trim()}</Detail>
            ) : null}
            <Detail label="Date paid">
              {paidOn ? formatDate(paidOn) : ""}
            </Detail>
            <Detail label="Balance once approved">
              {formatCad(round2(info.balance + pendingTotal + amount))}
            </Detail>
          </dl>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewing(false)}>
              Go back
            </Button>
            <Button
              onClick={() => {
                if (
                  run(submitPayment, {
                    memberId: member.id,
                    amount,
                    method,
                    reference,
                    paidOn,
                  })
                ) {
                  toast.success("Payment sent for approval")
                  router.push("/member")
                }
              }}
            >
              Send for approval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
