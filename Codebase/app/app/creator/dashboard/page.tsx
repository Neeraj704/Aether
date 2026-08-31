'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Wallet,
  TrendingUp,
  ArrowUpRight,
  Sparkles,
  DollarSign,
  Calendar,
  Layers,
  Store,
  CheckCircle2,
} from 'lucide-react'
import { useWorkspace, useHydrated } from '@/lib/workspace-store'
import { toast } from '@/lib/store'
import { PillButton, PillLink } from '@/components/ui/pill-button'
import { Badge } from '@/components/ui/badge'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { formatDate, formatINR } from '@/lib/utils'

export default function CreatorDashboardPage() {
  const hydrated = useHydrated()
  const publishedPresets = useWorkspace((s) => s.publishedPresets)
  const creatorEarnings = useWorkspace((s) => s.creatorEarnings)
  const requestCreatorPayout = useWorkspace((s) => s.requestCreatorPayout)
  const deletePublishedPreset = useWorkspace((s) => s.deletePublishedPreset)

  const [payoutDialogOpen, setPayoutDialogOpen] = useState(false)

  if (!hydrated) {
    return (
      <div className="flex flex-1 items-center justify-center p-12 text-xs text-muted-foreground animate-pulse font-mono">
        Loading creator ledger...
      </div>
    )
  }

  const handleRequestPayout = () => {
    const amount = creatorEarnings.pendingPayout
    requestCreatorPayout()
    toast.success('Payout Requested', `₹${amount.toLocaleString('en-IN')} is scheduled for transfer to your HDFC bank account.`)
    setPayoutDialogOpen(false)
  }

  return (
    <div className="flex flex-col gap-8 p-6 lg:p-8 max-w-[1400px] mx-auto w-full">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-r from-brand/10 via-secondary/40 to-background p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand">
            <Store className="size-3.5" /> Creator Monetization & Royalties
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Creator Earnings & Presets
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-xl">
            Monitor revenue distributions from your published strategy blocks and request direct bank payouts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <PillLink href="/app/marketplace" variant="secondary">
            View Marketplace
          </PillLink>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-1">
          <span className="text-xs text-muted-foreground font-medium flex items-center justify-between">
            All-Time Revenue <TrendingUp className="size-4 text-profit" />
          </span>
          <div className="text-2xl font-bold text-profit">
            {formatINR(creatorEarnings.total)}
          </div>
          <span className="text-[11px] text-tertiary">80% creator net share</span>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-1">
          <span className="text-xs text-muted-foreground font-medium flex items-center justify-between">
            This Month <DollarSign className="size-4 text-brand" />
          </span>
          <div className="text-2xl font-bold text-foreground">
            {formatINR(creatorEarnings.thisMonth)}
          </div>
          <span className="text-[11px] text-tertiary">Accruing for next cycle</span>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-1">
          <span className="text-xs text-muted-foreground font-medium flex items-center justify-between">
            Pending Balance <Wallet className="size-4 text-gold" />
          </span>
          <div className="text-2xl font-bold text-gold">
            {formatINR(creatorEarnings.pendingPayout)}
          </div>
          <button
            onClick={() => setPayoutDialogOpen(true)}
            disabled={creatorEarnings.pendingPayout <= 0}
            className="text-xs font-semibold text-brand hover:underline text-left mt-1 disabled:opacity-50 disabled:no-underline cursor-pointer"
          >
            Request Payout &rarr;
          </button>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-1">
          <span className="text-xs text-muted-foreground font-medium flex items-center justify-between">
            Last Payout <Calendar className="size-4 text-tertiary" />
          </span>
          <div className="text-xl font-bold text-foreground">
            {formatINR(creatorEarnings.lastPayout.amount)}
          </div>
          <span className="text-[11px] text-tertiary">
            Processed {formatDate(creatorEarnings.lastPayout.date)}
          </span>
        </div>
      </div>

      {/* Published Presets Table */}
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Your Published Strategy Presets</h2>
          <p className="text-xs text-muted-foreground">Manage public templates and track clone distributions</p>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <THead>
              <TR>
                <TH className="pl-4">Preset Name</TH>
                <TH>Price</TH>
                <TH>Forks / Clones</TH>
                <TH>Community Rating</TH>
                <TH>Net Earnings</TH>
                <TH>Published Date</TH>
                <TH className="pr-4 text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {publishedPresets.map((preset) => (
                <TR key={preset.id}>
                  <TD className="pl-4 font-bold text-foreground">{preset.name}</TD>
                  <TD>
                    <Badge variant={preset.price > 0 ? 'gold' : 'neutral'} size="sm">
                      {preset.price > 0 ? `₹${preset.price}` : 'Free'}
                    </Badge>
                  </TD>
                  <TD className="text-foreground">{preset.clones.toLocaleString()} forks</TD>
                  <TD className="text-foreground">
                    ★ {preset.rating} ({preset.reviews} reviews)
                  </TD>
                  <TD className="font-bold text-profit">
                    {preset.revenue > 0 ? formatINR(preset.revenue) : '—'}
                  </TD>
                  <TD className="text-tertiary text-xs">{formatDate(preset.publishedAt)}</TD>
                  <TD className="pr-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        href={`/app/marketplace/${preset.id}`}
                        className="text-xs font-semibold text-brand hover:underline inline-flex items-center gap-1"
                      >
                        View in Market <ArrowUpRight className="size-3.5" />
                      </Link>
                      <button
                        onClick={() => {
                          deletePublishedPreset(preset.id)
                          toast.info('Strategy Delisted', `"${preset.name}" was removed from the marketplace.`)
                        }}
                        className="text-xs text-muted-foreground hover:text-loss transition-colors cursor-pointer"
                      >
                        Delist
                      </button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      </div>

      {/* Payout Modal */}
      {payoutDialogOpen && (
        <Dialog open={payoutDialogOpen} onOpenChange={setPayoutDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Request Creator Payout</DialogTitle>
              <DialogDescription>
                Transfer your pending earnings balance to your registered Indian bank account.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4 py-2">
              <div className="rounded-xl border border-border bg-secondary/40 p-4 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Transfer Amount</span>
                <span className="text-xl font-bold text-profit">
                  {formatINR(creatorEarnings.pendingPayout)}
                </span>
              </div>

              <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Beneficiary Account:</span>
                <span>HDFC Bank ·· 4291 (NEFT / IMPS)</span>
                <span>IFSC: HDFC0000128</span>
              </div>
            </div>

            <DialogFooter>
              <PillButton variant="secondary" onClick={() => setPayoutDialogOpen(false)}>
                Cancel
              </PillButton>
              <PillButton onClick={handleRequestPayout}>
                Confirm Payout Transfer
              </PillButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
