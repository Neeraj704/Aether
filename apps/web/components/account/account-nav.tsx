'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { User, Shield, Bell, KeyRound, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

const ACCOUNT_TABS = [
  { href: '/app/account/profile', label: 'Profile', icon: User },
  { href: '/app/account/security', label: 'Security & Sessions', icon: Shield },
  { href: '/app/account/notifications', label: 'Notification Matrix', icon: Bell },
  { href: '/app/account/api-keys', label: 'API Keys', icon: KeyRound },
  { href: '/app/account/danger-zone', label: 'Danger Zone', icon: AlertTriangle },
]

export function AccountNav() {
  const pathname = usePathname()

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border pb-3">
      {ACCOUNT_TABS.map((tab) => {
        const Icon = tab.icon
        const isActive = pathname === tab.href
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
