'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, Coins, CreditCard, Loader2, Lock, ShieldCheck } from 'lucide-react'
import type { ComponentDef } from '@/mock/layers'
import { LAYER_MAP } from '@/mock/layers'
import { toast, useSession } from '@/lib/store'
import { useWorkspace } from '@/lib/workspace-store'
import { TIER_RANK } from '@/lib/entitlements'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/misc'
import { delay, formatINR } from '@/lib/utils'

type Phase = 'choose' | 'paying' | 'done'

/**
 * Component paywall. Two exits: spend credits (instant) or buy outright
 * through a simulated Razorpay sheet. Never touches a real gateway.
 */
export function UnlockDialog({
  comp,
  onClose,
  onUnlocked,
}: {
  comp: ComponentDef | null
  onClose: () => void
  onUnlocked?: (comp: ComponentDef) => void
}) {
  const { credits, plan, spendCredits, unlock } = useSession()
  const pushActivity = useWorkspace((s) => s.pushActivity)
  const pushNotification = useWorkspace((s) => s.pushNotification)
  const [phase, setPhase] = useState<Phase>('choose')

  useEffect(() => {
    if (comp) setPhase('choose')
  }, [comp])

  if (!comp) return null

  const layer = LAYER_MAP[comp.layer]
  const creditCost = Math.max(4, Math.round(comp.price / 25))
  const canAfford = credits >= creditCost
  const planWouldCover = TIER_RANK[plan] < TIER_RANK[comp.tier]

  const finish = () => {
    unlock(comp.id)
    setPhase('done')
    onUnlocked?.(comp)
  }

  const payWithCredits = () => {
    if (!spendCredits(creditCost)) {
      toast.error('Not enough credits', `You need ${creditCost - credits} more to unlock this.`)
      return
    }
    pushActivity({
      kind: 'unlock',
      title: `Unlocked ${comp.name}`,
      detail: `${creditCost} credits · ${layer.name} layer`,
      href: `/app/library/${comp.id}`,
    })
    pushNotification({
      kind: 'system',
      title: `Unlocked ${comp.name}`,
      body: `${creditCost} credits spent. Ready to use on any canvas.`,
      href: `/app/library/${comp.id}`,
    })
    toast.unlock(`${comp.name} unlocked`, `${creditCost} credits spent.`)
    finish()
  }

  const payWithCard = async () => {
    setPhase('paying')
    await delay(1600)
    pushActivity({
      kind: 'unlock',
      title: `Unlocked ${comp.name}`,
      detail: `${formatINR(comp.price)} · ${layer.name} layer`,
      href: `/app/library/${comp.id}`,
    })
    pushNotification({
      kind: 'payment',
      title: `Unlocked ${comp.name}`,
      body: `${formatINR(comp.price)} paid — added to your node library.`,
      href: `/app/library/${comp.id}`,
    })
    toast.unlock(`${comp.name} unlocked`, `${formatINR(comp.price)} paid — added to your library.`)
    finish()
  }

  return (
    <Dialog open={Boolean(comp)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="mb-3 flex items-center gap-2">
            <span
              className="flex size-7 items-center justify-center rounded-[var(--radius-sm)] text-[11px] font-semibold"
              style={{ background: `${layer.hue}1f`, color: layer.hue }}
            >
              {layer.roman}
            </span>
            <Badge variant="outline">{layer.name}</Badge>
            <Badge variant="warning">{comp.tier}</Badge>
          </div>
          <DialogTitle>
            {phase === 'done' ? `${comp.name} is yours` : `Unlock ${comp.name}`}
          </DialogTitle>
          <DialogDescription>
            {phase === 'done' ? 'It is now available on the canvas and in every bot.' : comp.tagline}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          {phase === 'done' ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-success/12 text-success">
                <Check className="size-6" />
              </span>
              <p className="max-w-sm text-[13px] leading-relaxed text-muted-foreground">
                {comp.useCase}
              </p>
            </div>
          ) : phase === 'paying' ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <Loader2 className="size-6 animate-spin text-brand" />
              <p className="text-[13px] font-medium">Contacting payment gateway…</p>
              <p className="flex items-center gap-1.5 text-xs text-tertiary">
                <ShieldCheck className="size-3.5" />
                Simulated Razorpay — no real charge
              </p>
            </div>
          ) : (
            <>
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                {comp.description}
              </p>

              <div className="mt-4 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={payWithCredits}
                  disabled={!canAfford}
                  className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border p-3 text-left transition-colors hover:border-brand disabled:pointer-events-none disabled:opacity-50"
                >
                  <Coins className="size-4 shrink-0 text-brand" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium">
                      Unlock with {creditCost} credits
                    </span>
                    <span className="block text-xs text-tertiary">
                      {canAfford
                        ? `You have ${credits}. Instant, keeps it forever.`
                        : `You only have ${credits} credits.`}
                    </span>
                  </span>
                  <ArrowRight className="size-3.5 shrink-0 text-tertiary" />
                </button>

                <button
                  type="button"
                  onClick={payWithCard}
                  className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border p-3 text-left transition-colors hover:border-brand"
                >
                  <CreditCard className="size-4 shrink-0 text-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium">
                      Buy for {formatINR(comp.price)}
                    </span>
                    <span className="block text-xs text-tertiary">
                      One-time, billed to your account.
                    </span>
                  </span>
                  <ArrowRight className="size-3.5 shrink-0 text-tertiary" />
                </button>
              </div>

              {planWouldCover ? (
                <>
                  <Separator className="my-4" />
                  <div className="flex items-center gap-3">
                    <Lock className="size-4 shrink-0 text-tertiary" />
                    <p className="min-w-0 flex-1 text-xs leading-relaxed text-muted-foreground">
                      The <span className="font-medium capitalize">{comp.tier}</span> plan includes
                      this node and everything else at its tier.
                    </p>
                    <Button
                      render={<Link href="/pricing" />}
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                    >
                      Compare plans
                    </Button>
                  </div>
                </>
              ) : null}
            </>
          )}
        </DialogBody>

        {phase !== 'paying' ? (
          <DialogFooter>
            <Button variant="ghost" onClick={onClose}>
              {phase === 'done' ? 'Back to canvas' : 'Not now'}
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
