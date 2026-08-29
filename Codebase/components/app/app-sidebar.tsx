'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'motion/react'
import {
  Bot,
  ChevronLeft,
  CreditCard,
  LayoutDashboard,
  LifeBuoy,
  Radio,
  Settings,
  Store,
  Wrench,
  Bookmark,
  GitCompareArrows,
  BookMarked,
  BookOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSession } from '@/lib/store'
import { Tooltip } from '@/components/ui/tooltip'
import { Logo, LogoMark } from '@/components/brand/logo'

const NAV = [
  { href: '/app', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/app/bots', label: 'My Bots', icon: Bot },
  { href: '/app/builder', label: 'Builder', icon: Wrench },
  { href: '/app/presets', label: 'Presets', icon: Bookmark },
  { href: '/app/marketplace', label: 'Marketplace', icon: Store },
  { href: '/app/compare', label: 'Compare', icon: GitCompareArrows },
  { href: '/app/library', label: 'Library', icon: BookMarked },
  { href: '/app/live', label: 'Live', icon: Radio },
]

const FOOTER_NAV = [
  { href: '/app/billing', label: 'Billing', icon: CreditCard },
  { href: '/app/account/profile', label: 'Settings', icon: Settings },
  { href: '/app/help', label: 'Help', icon: LifeBuoy },
  { href: '/docs', label: 'Docs', icon: BookOpen },
]

const MOBILE_NAV = [
  { href: '/app', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/app/bots', label: 'My Bots', icon: Bot },
  { href: '/app/builder', label: 'Builder', icon: Wrench },
  { href: '/app/live', label: 'Live', icon: Radio },
  { href: '/app/marketplace', label: 'Marketplace', icon: Store },
]

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
}: {
  href: string
  label: string
  icon: typeof Bot
  active: boolean
  collapsed: boolean
}) {
  const content = (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex h-9 items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 text-[13px] font-medium transition-colors',
        collapsed && 'justify-center px-0',
        active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {active ? (
        <motion.span
          layoutId="sidebar-active"
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          className="absolute inset-0 rounded-[var(--radius-sm)] bg-secondary"
        />
      ) : null}
      <Icon className="relative size-4 shrink-0" strokeWidth={active ? 2.2 : 1.8} />
      {!collapsed ? <span className="relative truncate">{label}</span> : null}
    </Link>
  )

  return collapsed ? (
    <Tooltip content={label} side="right">
      {content}
    </Tooltip>
  ) : (
    content
  )
}

export function AppSidebar() {
  const pathname = usePathname()
  const collapsed = useSession((s) => s.sidebarCollapsed)
  const toggle = useSession((s) => s.toggleSidebar)

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)

  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-sidebar-border bg-sidebar backdrop-blur-2xl lg:flex',
        'transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
        collapsed ? 'w-[68px]' : 'w-[228px]',
      )}
    >
      <div className={cn('flex h-14 items-center px-4', collapsed && 'justify-center px-0')}>
        {collapsed ? (
          <Link href="/app" aria-label="Aether home">
            <LogoMark />
          </Link>
        ) : (
          <Logo href="/app" />
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-2.5 pt-2">
        {NAV.map((item) => (
          <NavItem
            key={item.href}
            {...item}
            collapsed={collapsed}
            active={isActive(item.href, item.exact)}
          />
        ))}
      </nav>

      <div className="flex flex-col gap-0.5 border-t border-sidebar-border px-2.5 py-2.5">
        {FOOTER_NAV.map((item) => (
          <NavItem key={item.href} {...item} collapsed={collapsed} active={isActive(item.href)} />
        ))}

        <button
          onClick={toggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn(
            'mt-1 flex h-8 cursor-pointer items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5',
            'text-[13px] text-tertiary transition-colors hover:bg-secondary hover:text-foreground',
            collapsed && 'justify-center px-0',
          )}
        >
          <ChevronLeft
            className={cn('size-4 transition-transform duration-300', collapsed && 'rotate-180')}
          />
          {!collapsed ? <span>Collapse</span> : null}
        </button>
      </div>
    </aside>
  )
}

/** Bottom tab bar — the mobile counterpart to the sidebar. */
export function MobileTabBar() {
  const pathname = usePathname()

  return (
    <nav className="glass-chrome fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t lg:hidden">
      {MOBILE_NAV.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors',
              active ? 'text-brand' : 'text-muted-foreground',
            )}
          >
            <Icon className="size-[18px]" strokeWidth={active ? 2.2 : 1.8} />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
