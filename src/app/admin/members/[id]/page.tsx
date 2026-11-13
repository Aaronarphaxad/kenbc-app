"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import * as React from "react";
import { CheckIcon, ChevronLeftIcon, EllipsisIcon, XIcon } from "lucide-react";

import { AuditList } from "@/components/audit-list";
import { AdjustmentDialog } from "@/components/entry-dialogs";
import { useFund } from "@/components/fund-provider";
import {
  AccountStatusDialog,
  MemberFormDialog,
} from "@/components/member-dialogs";
import { Detail } from "@/components/page-header";
import { PaymentReviewSheet } from "@/components/payment-review-sheet";
import { RecordPaymentDialog } from "@/components/record-payment-dialog";
import { StatementTable } from "@/components/statement-table";
import {
  AccountBadge,
  CaseBadge,
  PaymentBadge,
  StandingBadge,
} from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  accountLabels,
  formatCad,
  formatDate,
  methodLabels,
  plural,
} from "@/lib/format";
import { auditFor, memberById, memberRow } from "@/lib/fund";

export default function MemberRecordPage() {
  const { id } = useParams<{ id: string }>();
  const { state, today } = useFund();
  const [recording, setRecording] = React.useState(false);
  const [adjusting, setAdjusting] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [changingStatus, setChangingStatus] = React.useState(false);
  const [paymentId, setPaymentId] = React.useState<string | null>(null);

  const member = memberById(state, id);
  if (!member) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>Member not found</EmptyTitle>
          <EmptyDescription>
            There is no member with the number {id}.
          </EmptyDescription>
        </EmptyHeader>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href="/admin/members" />}
        >
          Back to members
        </Button>
      </Empty>
    );
  }

  const row = memberRow(state, member, today);
  const { info, eligibility } = row;
  const payments = state.payments
    .filter((payment) => payment.memberId === member.id)
    .reverse();
  const pending = payments.filter((payment) => payment.status === "pending");
  const cases = state.cases
    .filter((item) => item.memberId === member.id)
    .reverse();
  const history = auditFor(state, (event) => event.memberId === member.id);
  const failed = eligibility.checks.find((check) => !check.passed);

  return (
    <>
      <div className="flex flex-col gap-3">
        <Link
          href="/admin/members"
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground print:hidden"
        >
          <ChevronLeftIcon className="size-4" />
          Members
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-2">
            <h2 className="text-xl font-semibold tracking-tight">
              {member.name}
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{member.id}</span>
              <AccountBadge status={member.accountStatus} />
              {member.accountStatus === "invited" ? null : (
                <StandingBadge row={row} />
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Button onClick={() => setRecording(true)}>Record payment</Button>
            <Button variant="outline" onClick={() => setAdjusting(true)}>
              Post adjustment
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="outline" size="icon" />}
              >
                <EllipsisIcon />
                <span className="sr-only">More actions</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={() => setEditing(true)}>
                  Edit profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setChangingStatus(true)}>
                  Change account status
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {member.accountStatus === "suspended" ? (
        <Alert variant="destructive">
          <AlertTitle>Account suspended</AlertTitle>
          <AlertDescription>{member.statusReason}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Fact
          label="Balance"
          value={formatCad(info.balance)}
          detail={`Buffer is ${formatCad(state.rules.buffer)}`}
        />
        <Fact
          label="Owes"
          value={formatCad(info.shortfall)}
          detail={
            info.shortfall === 0
              ? "Nothing due"
              : info.shortSince
                ? info.daysShort === 0
                  ? "Short since today"
                  : `Short for ${plural(info.daysShort, "day")}, since ${formatDate(info.shortSince)}`
                : ""
          }
        />
        <Fact
          label="Covered for benefit"
          value={eligibility.eligible ? "Yes" : "No"}
          detail={failed ? failed.label : "Active, in good standing, waited"}
        />
        <Fact
          label="Member since"
          value={formatDate(member.joinedOn)}
          detail={
            today >= eligibility.waitingEndsOn
              ? "Waiting period complete"
              : `Waiting period ends ${formatDate(eligibility.waitingEndsOn)}`
          }
        />
      </div>

      <Tabs defaultValue="statement">
        <TabsList className="max-w-full justify-start overflow-x-auto print:hidden">
          <TabsTrigger value="statement">Statement</TabsTrigger>
          <TabsTrigger value="payments">
            Payments
            {pending.length ? (
              <Badge variant="secondary">{pending.length}</Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="cases">Cases</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="statement" className="pt-2">
          <StatementTable memberId={member.id} mode="admin" />
        </TabsContent>

        <TabsContent value="payments" className="pt-2">
          {payments.length ? (
            <div className="overflow-hidden rounded-lg border bg-card">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Declared</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>
                      <span className="sr-only">Open</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(payment.submittedOn)}
                      </TableCell>
                      <TableCell>{methodLabels[payment.method]}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {payment.reference}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCad(payment.receivedAmount ?? payment.amount)}
                      </TableCell>
                      <TableCell>
                        <PaymentBadge status={payment.status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <Button
                            variant={
                              payment.status === "pending"
                                ? "default"
                                : "outline"
                            }
                            size="sm"
                            onClick={() => setPaymentId(payment.id)}
                          >
                            {payment.status === "pending" ? "Review" : "View"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <Empty className="border">
              <EmptyHeader>
                <EmptyTitle>No payments yet</EmptyTitle>
                <EmptyDescription>
                  Payments {member.name.split(" ")[0]} declares, and payments
                  you record, appear here.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </TabsContent>

        <TabsContent value="cases" className="pt-2">
          {cases.length ? (
            <ul className="flex flex-col divide-y rounded-lg border bg-card">
              {cases.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/admin/cases?case=${item.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 outline-none hover:bg-muted/50 focus-visible:bg-muted/50"
                  >
                    <span className="flex flex-col">
                      <span className="text-sm font-medium">
                        {item.subjectName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {item.id} · {item.relationship} · submitted{" "}
                        {formatDate(item.submittedOn)}
                      </span>
                    </span>
                    <CaseBadge status={item.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty className="border">
              <EmptyHeader>
                <EmptyTitle>No bereavement requests</EmptyTitle>
                <EmptyDescription>
                  {member.name.split(" ")[0]} has not submitted a request.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </TabsContent>

        <TabsContent value="profile" className="pt-2">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Contact</CardTitle>
                <CardDescription>How to reach this member</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <dl className="flex flex-col gap-2">
                  <Detail label="Email">{member.email}</Detail>
                  <Detail label="Phone">{member.phone || "Not given"}</Detail>
                  <Detail label="City">{member.city || "Not given"}</Detail>
                </dl>
                <div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditing(true)}
                  >
                    Edit profile
                  </Button>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Account</CardTitle>
                <CardDescription>
                  Set by the office. Standing and cover are worked out.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <dl className="flex flex-col gap-2">
                  <Detail label="Status">
                    {accountLabels[member.accountStatus]}
                  </Detail>
                  {member.statusReason ? (
                    <Detail label="Reason">{member.statusReason}</Detail>
                  ) : null}
                  <Detail label="Covered for benefit">
                    {eligibility.eligible ? "Yes" : "No"}
                  </Detail>
                </dl>
                <ul className="flex flex-col gap-1.5">
                  {eligibility.checks.map((check) => (
                    <li
                      key={check.label}
                      className="flex items-center gap-2 text-sm"
                    >
                      {check.passed ? (
                        <CheckIcon className="size-4 text-primary" />
                      ) : (
                        <XIcon className="size-4 text-destructive" />
                      )}
                      {check.label}
                    </li>
                  ))}
                </ul>
                <div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setChangingStatus(true)}
                  >
                    Change account status
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="history" className="pt-2">
          <Card>
            <CardHeader>
              <CardTitle>History</CardTitle>
              <CardDescription>
                Everything done on this account, newest first
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AuditList events={history} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <RecordPaymentDialog
        open={recording}
        onOpenChange={setRecording}
        memberId={member.id}
      />
      <AdjustmentDialog
        memberId={member.id}
        open={adjusting}
        onOpenChange={setAdjusting}
      />
      <MemberFormDialog
        open={editing}
        onOpenChange={setEditing}
        member={member}
      />
      <AccountStatusDialog
        open={changingStatus}
        onOpenChange={setChangingStatus}
        member={member}
      />
      <PaymentReviewSheet
        paymentId={paymentId}
        onClose={() => setPaymentId(null)}
      />
    </>
  );
}

function Fact({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <p className="text-xl font-semibold tracking-tight tabular-nums">
          {value}
        </p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}
