'use client'

import { Check, Minus } from 'lucide-react'
import { PLAN_COMPARISON, type ComparisonRow } from '@/mock/data'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { cn } from '@/lib/utils'

function CellValue({ value }: { value: string | boolean }) {
  if (typeof value === 'boolean') {
    return value ? (
      <Check className="size-4 text-profit mx-auto" />
    ) : (
      <Minus className="size-4 text-muted-foreground/40 mx-auto" />
    )
  }
  return <span className="text-xs text-foreground font-medium">{value}</span>
}

export function PlanComparisonMatrix({
  className,
}: {
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-6 rounded-2xl border border-border bg-card p-6', className)}>
      <div>
        <h2 className="text-lg font-bold tracking-tight">Feature & Entitlement Breakdown</h2>
        <p className="text-xs text-muted-foreground">
          Compare building capacity, quantitative layer access, simulation quotas, and live broker execution.
        </p>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <THead>
            <TR>
              <TH className="w-64 pl-4 text-left">Feature / Capability</TH>
              <TH className="text-center w-36">Free</TH>
              <TH className="text-center w-36">Starter (₹799)</TH>
              <TH className="text-center w-36">Pro (₹1,999)</TH>
              <TH className="text-center w-36 pr-4">Credits (PAYG)</TH>
            </TR>
          </THead>
          <TBody>
            {PLAN_COMPARISON.map((group) => (
              <>
                <TR key={group.group} className="bg-secondary/30">
                  <TD colSpan={5} className="pl-4 py-2 font-bold text-xs text-brand uppercase tracking-wider">
                    {group.group}
                  </TD>
                </TR>
                {group.rows.map((row) => (
                  <TR key={row.label}>
                    <TD className="pl-4 text-xs font-medium text-foreground">{row.label}</TD>
                    <TD className="text-center"><CellValue value={row.free} /></TD>
                    <TD className="text-center"><CellValue value={row.starter} /></TD>
                    <TD className="text-center"><CellValue value={row.pro} /></TD>
                    <TD className="text-center pr-4"><CellValue value={row.payg} /></TD>
                  </TR>
                ))}
              </>
            ))}
          </TBody>
        </Table>
      </div>
    </div>
  )
}
