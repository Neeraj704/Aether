'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CreditCard, Sparkles, History, Layers } from 'lucide-react'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/app/billing', label: 'Subscription Plans', icon: Layers },
  { href: '/app/billing/topup', label: 'Top-up Credits', icon: Sparkles },
  { href: '/app/billing/payment-methods', label: 'Payment Methods', icon: CreditCard },
  { href: '/app/billing/history', label: 'Invoice History', icon: History },
]

export function BillingNav() {
  const pathname = usePathname()

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border pb-3">
      {TABS.map((tab) => {
        const Icon = tab.icon
        const isActive =
          pathname === tab.href ||
          (tab.href === '/app/billing' && (pathname === '/app/billing' || pathname === '/app/billing/plans'))
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              'flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all whitespace-nowrap',
              isActive
                ? 'bg-brand text-brand-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
            )}
          >
            <Icon className="size-3.5" />
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
