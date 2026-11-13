import Link from "next/link";

import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function HomePage() {
  return (
    <main className="flex min-h-svh flex-col bg-muted">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-10 px-6 py-16">
        <div className="flex flex-col gap-4">
          <BrandMark />
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">
              Bereavement Fund
            </h1>
            <p className="max-w-xl text-muted-foreground">
              One ledger for membership, payments and bereavement cases. This
              preview runs on sample records so the office and members can walk
              through it before a live system is built.
            </p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Administrator</CardTitle>
              <CardDescription>
                Approve payments, keep the ledger, run cases and follow up
                arrears.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                nativeButton={false}
                render={<Link href="/login?role=admin" />}
              >
                Administrator sign in
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Member</CardTitle>
              <CardDescription>
                See where you stand, pay what you owe and follow your requests.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href="/login?role=member" />}
              >
                Member sign in
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
