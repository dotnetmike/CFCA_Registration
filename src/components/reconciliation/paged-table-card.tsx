"use client"

import type { ReactNode } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export const PAGE_SIZE = 100

export const paginate = <T,>(rows: T[], page: number) => {
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const currentPage = Math.min(Math.max(1, page), totalPages)
  const pageStart = (currentPage - 1) * PAGE_SIZE
  return {
    totalPages,
    currentPage,
    pageRows: rows.slice(pageStart, pageStart + PAGE_SIZE),
    rangeStart: rows.length === 0 ? 0 : pageStart + 1,
    rangeEnd: Math.min(pageStart + PAGE_SIZE, rows.length),
  }
}

type PagedTableCardProps = {
  title: string
  tableLabel: string
  total: number
  page: number
  minWidthClass?: string
  onPageChange: (page: number) => void
  header: ReactNode
  children: ReactNode
}

export const PagedTableCard = ({
  title,
  tableLabel,
  total,
  page,
  minWidthClass,
  onPageChange,
  header,
  children,
}: PagedTableCardProps) => {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const currentPage = Math.min(Math.max(1, page), totalPages)
  const rangeStart = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, total)

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>{title}</CardTitle>
        <p className="text-sm text-gray-600" aria-live="polite">
          Showing {rangeStart}–{rangeEnd} of {total}
          {" · "}
          Page {currentPage} of {totalPages}
          {" · "}
          {PAGE_SIZE} per page
        </p>
      </CardHeader>
      <CardContent className="space-y-0 p-0">
        <p className="border-b border-[color:var(--line)] px-6 py-2 text-xs text-ink-soft sm:hidden">
          Swipe horizontally to see all columns and actions.
        </p>
        <div
          className="cfca-registrations-table-wrap"
          tabIndex={0}
          role="region"
          aria-label={`${tableLabel}, scroll horizontally for more columns`}
        >
          <table className={`cfca-registrations-table ${minWidthClass ?? ""}`}>
            <thead>{header}</thead>
            <tbody>{children}</tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--line)] px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            aria-label="Previous page"
          >
            Previous
          </Button>
          <p className="text-sm text-gray-600">
            Page {currentPage} of {totalPages}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
            aria-label="Next page"
          >
            Next
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export const EmptyRow = ({ colSpan, message }: { colSpan: number; message: string }) => (
  <tr>
    <td className="p-6 text-ink-soft" colSpan={colSpan}>
      {message}
    </td>
  </tr>
)
