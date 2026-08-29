'use client'

import { useState } from 'react'
import { Sparkles, Check, Zap, ArrowRight, ShieldCheck, Loader2 } from 'lucide-react'
import { useSession, toast } from '@/lib/store'
import { CREDIT_BUNDLES } from '@/mock/data'
import { PillButton } from '@/components/ui/pill-button'
import { Input, Field } from '@/components/ui/input'
import { BillingNav } from '@/components/billing/billing-nav'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { cn, formatINR } from '@/lib/utils'

export default function TopupCreditsPage() {
  const credits = useSession((s) => s.credits)
  const addCredits = useSession((s) => s.addCredits)

  const [customCredits, setCustomCredits] = useState('250')
  const [checkoutTarget, setCheckoutTarget] = useState<{ amount: number; price: number } | null>(null)
  const [processing, setProcessing] = useState(false)

  const customNum = parseInt(customCredits) || 0
  const customPrice = Math.round(customNum >= 1000 ? customNum * 0.9 : customNum >= 500 ? customNum * 0.95 : customNum)

  const handleStartCheckout = (amount: number, price: number) => {
    setCheckoutTarget({ amount, price })
  }

  const handleConfirmPayment = () => {
    if (!checkoutTarget) return
    setProcessing(true)
    setTimeout(() => {
      addCredits(checkoutTarget.amount)
      toast.success('Credits Added!', `Successfully added ${checkoutTarget.amount} credits for ${formatINR(checkoutTarget.price)}.`)
      setProcessing(false)
      setCheckoutTarget(null)
    }, 800)
  }

  return (
    <div className="flex flex-col gap-8 p-6 lg:p-8 max-w-[1400px] mx-auto w-full">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Billing & Subscriptions</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Top-up simulation credits on-demand for heavy compute, Monte Carlo runs, and component unlocks
        </p>
      </div>

      <BillingNav />

      {/* Balance Banner */}
      <div className="rounded-2xl border border-gold/30 bg-gradient-to-r from-gold/15 via-card to-background p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-gold/20 text-gold shrink-0">
            <Sparkles className="size-6" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-gold">Available Balance</span>
            <div className="text-3xl sm:text-4xl font-extrabold text-foreground">{credits} Credits</div>
            <p className="text-xs text-muted-foreground max-w-lg leading-relaxed">
              Credits never expire. Each historical backtest costs 2–8 credits depending on node depth and duration.
            </p>
          </div>
        </div>
      </div>

      {/* Pre-configured Bundles */}
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-bold">Standard Credit Bundles</h2>
          <p className="text-xs text-muted-foreground">Select a discounted pack to refill your computation balance</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {CREDIT_BUNDLES.map((bundle) => (
            <div
              key={bundle.credits}
              className={cn(
                'flex flex-col justify-between rounded-2xl border bg-card p-6 relative transition-all',
                bundle.popular
                  ? 'border-gold/60 bg-gradient-to-b from-gold/10 via-card to-card shadow-lg shadow-gold/5 ring-1 ring-gold/30'
                  : 'border-border',
              )}
            >
              {bundle.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gold px-3 py-0.5 text-[10px] font-bold text-black uppercase tracking-wider">
                  Most Popular
                </span>
              )}

              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xl font-bold">{bundle.credits} Credits</span>
                  <span className="text-lg font-extrabold text-gold">{formatINR(bundle.price)}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{bundle.blurb}</p>

                <div className="flex flex-col gap-1.5 pt-3 text-xs text-muted-foreground border-t border-border">
                  <div className="flex items-center gap-1.5">
                    <Check className="size-3.5 text-profit" /> Instant compute allocation
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check className="size-3.5 text-profit" /> No recurring commitment
                  </div>
                </div>
              </div>

              <div className="pt-6">
                <PillButton
                  onClick={() => handleStartCheckout(bundle.credits, bundle.price)}
                  variant={bundle.popular ? 'primary' : 'secondary'}
                  className="w-full justify-center"
                >
                  Buy {bundle.credits} Credits
                </PillButton>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Custom Credit Calculator */}
      <div className="rounded-2xl border border-border bg-card p-6 flex flex-col gap-4">
        <div>
          <h2 className="text-base font-bold">Custom Credit Calculator</h2>
          <p className="text-xs text-muted-foreground">Order precise quantities for specific research projects</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <Field label="Desired Credits Amount" htmlFor="custom-credits">
            <Input
              id="custom-credits"
              type="number"
              min="50"
              max="50000"
              step="50"
              value={customCredits}
              onChange={(e) => setCustomCredits(e.target.value)}
              className="text-sm font-bold"
            />
          </Field>

          <div className="flex flex-col gap-1 rounded-xl border border-border bg-background/50 p-3">
            <span className="text-[11px] text-muted-foreground">Calculated Price</span>
            <span className="text-lg font-extrabold text-foreground">{formatINR(customPrice)}</span>
          </div>

          <div>
            <PillButton
              onClick={() => handleStartCheckout(customNum, customPrice)}
              disabled={customNum <= 0}
              className="w-full justify-center"
            >
              Purchase Custom Credits
            </PillButton>
          </div>
        </div>
      </div>

      {/* Checkout Gateway Simulation Modal */}
      {checkoutTarget && (
        <Dialog open={Boolean(checkoutTarget)} onOpenChange={(open) => !open && !processing && setCheckoutTarget(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Complete Credits Purchase</DialogTitle>
              <DialogDescription>
                Review your order details and confirm payment via your default payment method.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4 py-2">
              <div className="rounded-xl border border-border bg-secondary/40 p-4 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-sm font-bold">{checkoutTarget.amount} Simulation Credits</span>
                  <span className="text-xs text-muted-foreground">Instant workspace top-up</span>
                </div>
                <span className="text-xl font-extrabold text-gold">{formatINR(checkoutTarget.price)}</span>
              </div>

              <div className="rounded-xl border border-border bg-card p-3 flex flex-col gap-1 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Payment Method:</span>
                <span>HDFC Bank ·· 4291 (Visa)</span>
              </div>
            </div>

            <DialogFooter>
              <PillButton
                variant="secondary"
                onClick={() => setCheckoutTarget(null)}
                disabled={processing}
              >
                Cancel
              </PillButton>
              <PillButton
                onClick={handleConfirmPayment}
                disabled={processing}
                className="gap-2 min-w-32 justify-center"
              >
                {processing ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Processing...
                  </>
                ) : (
                  `Pay ${formatINR(checkoutTarget.price)}`
                )}
              </PillButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
