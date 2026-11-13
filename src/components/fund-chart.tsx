"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { useFund } from "@/components/fund-provider"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { formatMonth } from "@/lib/format"
import { monthlySummary } from "@/lib/fund"

const chartConfig = {
  moneyIn: {
    label: "Money in",
    color: "var(--chart-1)",
  },
  moneyOut: {
    label: "Levies",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig

/** What members paid in against what was levied, month by month. */
export function FundChart() {
  const { state, today } = useFund()
  const data = monthlySummary(state, today)
    .slice(-6)
    .map((row) => ({
      month: row.month,
      moneyIn: row.receipts,
      moneyOut: row.levies,
    }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Money in and levies</CardTitle>
        <CardDescription>
          Payments received against levies charged, last six months
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-56 w-full"
        >
          <BarChart data={data} barGap={2}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value: string) => formatMonth(value, false)}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={44}
              tickFormatter={(value: number) => `$${value}`}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  indicator="dot"
                  labelFormatter={(value) => formatMonth(String(value))}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="moneyIn" fill="var(--color-moneyIn)" radius={3} />
            <Bar dataKey="moneyOut" fill="var(--color-moneyOut)" radius={3} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
