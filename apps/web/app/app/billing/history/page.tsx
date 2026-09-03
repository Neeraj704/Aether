'use client'

import { useEffect, useState } from 'react'
import { Download, Receipt } from 'lucide-react'
import { INVOICES, type Invoice } from '@/mock/data'
import { toast, useSession } from '@/lib/store'
import { BillingNav } from '@/components/billing/billing-nav'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Segmented } from '@/components/ui/tabs'
import { formatDate, formatINR } from '@/lib/utils'
import { getBillingState, type BillingPayment } from '@/lib/billing'

export default function BillingHistoryPage() {
  const profile = useSession((s) => s.profile)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [payments, setPayments] = useState<BillingPayment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getBillingState()
      .then((res) => {
        if (res && res.payments && res.payments.length > 0) {
          setPayments(res.payments)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  // Combine real database payments with initial fallback seed invoices
  const combinedInvoices: Invoice[] = [
    ...payments.map((p) => ({
      id: p.paymentId || p.orderId,
      date: p.createdAt,
      description:
        p.kind === 'subscription'
          ? `AETHER Pro Subscription (${formatINR(p.amount)})`
          : `Simulation Credits Top-up (${formatINR(p.amount)})`,
      amount: p.amount,
      status: (p.status === 'created' ? 'pending' : p.status) as 'paid' | 'pending' | 'failed' | 'refunded',
      pdfUrl: '#',
    })),
    ...(payments.length === 0 ? INVOICES : []),
  ]

  const filteredInvoices = combinedInvoices.filter((inv) => {
    return statusFilter === 'all' || inv.status === statusFilter
  })

  const handleDownloadReceipt = (inv: Invoice) => {
    const receiptContent = `================================================
AETHER QUANTITATIVE PLATFORM - TAX INVOICE
================================================
Invoice Number : ${inv.id}
Date           : ${formatDate(inv.date, { withTime: true })}
Description    : ${inv.description}
Amount (INR)   : ₹${inv.amount.toFixed(2)}
Payment Status : ${inv.status.toUpperCase()}
GSTIN          : 27AABCA1234F1Z5
SAC Code       : 998313 (IT Software & SaaS)
------------------------------------------------
Customer Name  : ${profile.name || 'Aether Trader'}
Email          : ${profile.email || 'trader@aether.dev'}
Workspace ID   : ws_live_${inv.id.slice(-6)}
------------------------------------------------
Thank you for building systematic algorithms with Aether.
Support: support@aether.dev | https://aether.dev
================================================`

    const blob = new Blob([receiptContent], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `receipt-${inv.id}.txt`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)

    toast.success('Receipt Downloaded', `Saved receipt-${inv.id}.txt`)
  }

  return (
    <div className="flex flex-col gap-8 p-6 lg:p-8 max-w-[1400px] mx-auto w-full">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Billing & Subscriptions</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          View past subscription payments, top-up invoices, and download tax receipts
        </p>
      </div>

      <BillingNav />

      {/* Invoice Table Section */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold">Past Invoices & Receipts</h2>
            <p className="text-xs text-muted-foreground">All transactions billed via Razorpay Checkout</p>
          </div>

          <Segmented<string>
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={[
              { value: 'all', label: `All (${combinedInvoices.length})` },
              { value: 'paid', label: 'Paid' },
              { value: 'pending', label: 'Pending' },
              { value: 'refunded', label: 'Refunded' },
              { value: 'failed', label: 'Failed' },
            ]}
          />
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <Table>
            <THead>
              <TR>
                <TH className="pl-4">Invoice / Order ID</TH>
                <TH>Date</TH>
                <TH>Description</TH>
                <TH>Amount</TH>
                <TH>Status</TH>
                <TH className="pr-4 text-right">Receipt</TH>
              </TR>
            </THead>
            <TBody>
              {filteredInvoices.map((inv) => (
                <TR key={inv.id}>
                  <TD className="pl-4 font-mono text-xs font-semibold text-foreground">
                    {inv.id}
                  </TD>
                  <TD className="text-xs text-muted-foreground">{formatDate(inv.date)}</TD>
                  <TD className="text-xs font-medium text-foreground">{inv.description}</TD>
                  <TD className="text-xs font-bold text-foreground">{formatINR(inv.amount)}</TD>
                  <TD>
                    <Badge
                      variant={
                        inv.status === 'paid'
                          ? 'profit'
                          : inv.status === 'pending'
                            ? 'gold'
                            : inv.status === 'refunded'
                              ? 'neutral'
                              : 'loss'
                      }
                      size="sm"
                      className="capitalize"
                    >
                      {inv.status}
                    </Badge>
                  </TD>
                  <TD className="pr-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleDownloadReceipt(inv)}
                      className="text-xs font-semibold text-brand hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Download className="size-3.5" /> Download .txt
                    </button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
