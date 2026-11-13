"use client"

import * as React from "react"
import {
  createColumnHelper,
  createPaginatedRowModel,
  createSortedRowModel,
  FlexRender,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
  type RowData,
  type SortingState,
} from "@tanstack/react-table"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  ChevronsUpDownIcon,
} from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const features = tableFeatures({
  rowPaginationFeature,
  rowSortingFeature,
  paginatedRowModel: createPaginatedRowModel(),
  sortedRowModel: createSortedRowModel(),
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DataColumn<Row extends RowData> = ColumnDef<typeof features, Row, any>

export function columnHelperFor<Row extends RowData>() {
  return createColumnHelper<typeof features, Row>()
}

/** Sortable, paginated table. Column ids listed in `numeric` are right-aligned. */
export function DataTable<Row extends RowData>({
  data,
  columns,
  rowId,
  numeric = [],
  pageSize = 10,
  initialSort = [],
  footer,
  empty = "Nothing to show.",
  noun = "rows",
}: {
  data: Row[]
  columns: DataColumn<Row>[]
  rowId: (row: Row) => string
  numeric?: string[]
  pageSize?: number
  initialSort?: SortingState
  footer?: React.ReactNode
  empty?: React.ReactNode
  noun?: string
}) {
  const [sorting, setSorting] = React.useState<SortingState>(initialSort)
  const [page, setPagination] = React.useState({
    pageIndex: 0,
    pageSize,
  })
  // Filtering can leave the current page past the end, so clamp it.
  const lastPage = Math.max(0, Math.ceil(data.length / page.pageSize) - 1)
  const pagination = {
    ...page,
    pageIndex: Math.min(page.pageIndex, lastPage),
  }

  const table = useTable({
    features,
    data,
    columns,
    state: { sorting, pagination },
    getRowId: rowId,
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
  })

  const rows = table.getRowModel().rows
  const pageCount = lastPage + 1
  const first = data.length ? pagination.pageIndex * pagination.pageSize + 1 : 0
  const last = Math.min(data.length, first + pagination.pageSize - 1)

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-xs border bg-card">
        <Table>
          <TableHeader className="bg-muted/50">
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => {
                  const right = numeric.includes(header.column.id)
                  const sorted = header.column.getIsSorted()
                  return (
                    <TableHead
                      key={header.id}
                      className={cn(right && "text-right")}
                      aria-sort={
                        sorted === "asc"
                          ? "ascending"
                          : sorted === "desc"
                            ? "descending"
                            : undefined
                      }
                    >
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-sm outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
                            right && "flex-row-reverse"
                          )}
                        >
                          <FlexRender header={header} />
                          {sorted === "asc" ? (
                            <ArrowUpIcon className="size-3.5" />
                          ) : sorted === "desc" ? (
                            <ArrowDownIcon className="size-3.5" />
                          ) : (
                            <ChevronsUpDownIcon className="size-3.5 opacity-40" />
                          )}
                        </button>
                      ) : (
                        <FlexRender header={header} />
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getAllCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        numeric.includes(cell.column.id) &&
                          "text-right tabular-nums"
                      )}
                    >
                      <FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {empty}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          {footer && rows.length ? <TableFooter>{footer}</TableFooter> : null}
        </Table>
      </div>
      {data.length > pagination.pageSize ? (
        <div className="flex items-center justify-between gap-4 print:hidden">
          <p className="text-sm text-muted-foreground">
            {first} to {last} of {data.length} {noun}
          </p>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              Page {pagination.pageIndex + 1} of {pageCount}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              className="hidden sm:inline-flex"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronsLeftIcon />
              <span className="sr-only">First page</span>
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeftIcon />
              <span className="sr-only">Previous page</span>
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRightIcon />
              <span className="sr-only">Next page</span>
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              className="hidden sm:inline-flex"
              onClick={() => table.setPageIndex(pageCount - 1)}
              disabled={!table.getCanNextPage()}
            >
              <ChevronsRightIcon />
              <span className="sr-only">Last page</span>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
