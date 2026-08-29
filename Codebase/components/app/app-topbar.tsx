'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Bell,
  Check,
  CreditCard,
  LogOut,
  Menu as MenuIcon,
  Moon,
  Plus,
  Search,
  Settings,
  Sparkles,
  Sun,
  User,
} from 'lucide-react'
import { cn, relativeTime } from '@/lib/utils'
import { toast, useSession } from '@/lib/store'
import { useUnreadCount, useWorkspace } from '@/lib/workspace-store'
import { Logo } from '@/components/brand/logo'
import { Avatar, Kbd } from '@/components/ui/misc'
import { Badge } from '@/components/ui/badge'
import { Tooltip } from '@/components/ui/tooltip'
import { PillButton } from '@/components/ui/pill-button'
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuLinkItem,
  MenuSeparator,
  MenuShortcut,
  MenuTrigger,
} from '@/components/ui/menu'
import { usePalette } from '@/components/app/command-palette'

const CRUMB_LABELS: Record<string, string> = {
  app: 'Dashboard',
  bots: 'My Bots',
  builder: 'Builder',
  live: 'Live',
  marketplace: 'Marketplace',
  billing: 'Billing',
  settings: 'Settings',
  credits: 'Credits',
  notifications: 'Notifications',
  backtest: 'Backtest',
  search: 'Search',
  new: 'New',
}

function Breadcrumbs() {
  const pathname = usePathname()
  const bots = useWorkspace((s) => s.bots)
  const parts = pathname.split('/').filter(Boolean)

  const crumbs = parts.map((part, i) => {
    const bot = bots.find((b) => b.id === part)
    return {
      label: bot?.name ?? CRUMB_LABELS[part] ?? part.replace(/-/g, ' '),
      href: `/${parts.slice(0, i + 1).join('/')}`,
    }
  })

  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 md:flex">
      {crumbs.map((c, i) => (
        <span key={c.href} className="flex min-w-0 items-center gap-1.5">
          {i > 0 ? <span className="text-tertiary">/</span> : null}
          {i === crumbs.length - 1 ? (
            <span className="truncate text-[13px] font-medium">{c.label}</span>
          ) : (
            <Link
              href={c.href}
              className="truncate text-[13px] text-muted-foreground transition-colors hover:text-foreground"
            >
              {c.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  )
}

function NotificationBell() {
  const notifications = useWorkspace((s) => s.notifications)
  const markAllRead = useWorkspace((s) => s.markAllRead)
  const markRead = useWorkspace((s) => s.markRead)
  const unread = useUnreadCount()
  const recent = notifications.slice(0, 6)

  return (
    <Menu>
      <MenuTrigger
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        className={cn(
          'relative flex size-8 cursor-pointer items-center justify-center rounded-full',
          'text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
        )}
      >
        <Bell className="size-4" />
        {unread > 0 ? (
          <span className="absolute top-1 right-1 flex size-2 rounded-full bg-brand ring-2 ring-[var(--glass-bg)]" />
        ) : null}
      </MenuTrigger>

      <MenuContent className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
          <span className="text-[13px] font-semibold">Notifications</span>
          {unread > 0 ? (
            <button
              onClick={markAllRead}
              className="cursor-pointer text-xs text-brand hover:underline"
            >
              Mark all read
            </button>
          ) : null}
        </div>

        <div className="max-h-80 overflow-y-auto p-1">
          {recent.length === 0 ? (
            <p className="px-3 py-8 text-center text-[13px] text-muted-foreground">
              Nothing yet. Run a backtest and results will land here.
            </p>
          ) : (
            recent.map((n) => (
              <MenuLinkItem
                key={n.id}
                href={n.href}
                onClick={() => markRead(n.id)}
                className="items-start gap-2.5 py-2"
              >
                <span
                  className={cn(
                    'mt-1.5 size-1.5 shrink-0 rounded-full',
                    n.read ? 'bg-transparent' : 'bg-brand',
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium">{n.title}</span>
                  <span className="mt-0.5 block line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {n.body}
                  </span>
                  <span className="mt-1 block text-[11px] text-tertiary">
                    {relativeTime(n.createdAt)}
                  </span>
                </span>
              </MenuLinkItem>
            ))
          )}
        </div>

        <div className="border-t border-border p-1">
          <MenuLinkItem href="/app/notifications" className="justify-center text-brand">
            View all
          </MenuLinkItem>
        </div>
      </MenuContent>
    </Menu>
  )
}

function AccountMenu() {
  const router = useRouter()
  const plan = useSession((s) => s.plan)
  const credits = useSession((s) => s.credits)
  const theme = useSession((s) => s.theme)
  const setTheme = useSession((s) => s.setTheme)
  const setAuthed = useSession((s) => s.setAuthed)
  const profile = useSession((s) => s.profile)

  return (
    <Menu>
      <MenuTrigger
        aria-label="Account menu"
        className="flex cursor-pointer items-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-brand/30"
      >
        <Avatar initials={profile.initials} size={28} />
      </MenuTrigger>

      <MenuContent className="w-64">
        <div className="flex items-center gap-3 px-2.5 py-2">
          <Avatar initials={profile.initials} size={36} />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium">{profile.name}</p>
            <p className="truncate text-xs text-muted-foreground">{profile.email}</p>
          </div>
        </div>

        <MenuSeparator />

        <div className="flex items-center justify-between px-2.5 py-1.5">
          <span className="text-[13px] text-muted-foreground">Plan</span>
          <Badge variant={plan === 'pro' ? 'gold' : plan === 'starter' ? 'brand' : 'outline'}>
            {plan === 'pro' ? 'Pro' : plan === 'starter' ? 'Starter' : 'Free'}
          </Badge>
        </div>
        <div className="flex items-center justify-between px-2.5 pb-1.5">
          <span className="text-[13px] text-muted-foreground">Credits</span>
          <span className="tabular text-[13px] font-medium">{credits}</span>
        </div>

        <MenuSeparator />

        <MenuLinkItem href="/app/settings">
          <User />
          Profile
        </MenuLinkItem>
        <MenuLinkItem href="/app/billing">
          <CreditCard />
          Billing
        </MenuLinkItem>
        <MenuLinkItem href="/app/settings">
          <Settings />
          Settings
        </MenuLinkItem>
        <MenuItem onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? <Sun /> : <Moon />}
          {theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </MenuItem>

        <MenuSeparator />

        <MenuLabel>Prototype</MenuLabel>
        <MenuItem
          onClick={() => {
            setAuthed(false)
            router.replace('/login')
            toast.info('Signed out', 'This is a prototype — nothing was actually revoked.')
          }}
          destructive
        >
          <LogOut />
          Sign out
        </MenuItem>
      </MenuContent>
    </Menu>
  )
}

export function AppTopbar() {
  const router = useRouter()
  const openPalette = usePalette((s) => s.toggle)
  const credits = useSession((s) => s.credits)
  const plan = useSession((s) => s.plan)
  const createBot = useWorkspace((s) => s.createBot)

  return (
    <header className="glass-chrome sticky top-0 z-40 flex h-14 items-center gap-3 px-4 lg:px-6">
      <div className="flex items-center gap-3 lg:hidden">
        <Logo href="/app" showWord={false} />
      </div>

      <Breadcrumbs />

      <div className="flex flex-1 items-center justify-end gap-1.5 sm:gap-2">
        <button
          onClick={openPalette}
          className={cn(
            'flex h-8 cursor-pointer items-center gap-2 rounded-[var(--radius-pill)] border border-border',
            'bg-secondary px-3 text-[13px] text-muted-foreground transition-colors hover:text-foreground',
          )}
        >
          <Search className="size-3.5" />
          <span className="hidden sm:inline">Search</span>
          <Kbd className="hidden bg-transparent sm:inline-flex">⌘K</Kbd>
        </button>

        <Tooltip content={`${credits} simulation credits left`}>
          <Link
            href="/app/billing/credits"
            className={cn(
              'hidden h-8 items-center gap-1.5 rounded-[var(--radius-pill)] border border-border px-3 sm:flex',
              'text-[13px] font-medium transition-colors hover:bg-secondary',
              credits < 20 ? 'text-warn' : 'text-foreground',
            )}
          >
            <Sparkles className="size-3.5" />
            <span className="tabular">{credits}</span>
          </Link>
        </Tooltip>

        {plan === 'free' ? (
          <Link
            href="/pricing"
            className="hidden h-8 items-center rounded-[var(--radius-pill)] border border-gold/30 bg-gold/10 px-3 text-[13px] font-medium text-gold transition-colors hover:bg-gold/20 md:flex"
          >
            Upgrade
          </Link>
        ) : null}

        <NotificationBell />

        <PillButton
          size="sm"
          className="gap-1.5"
          onClick={() => {
            const bot = createBot()
            router.push(`/app/builder/${bot.id}`)
            toast.success('New bot created', 'Start with a data feed from Layer I.')
          }}
        >
          <Plus className="size-3.5" />
          <span className="hidden sm:inline">New bot</span>
        </PillButton>

        <AccountMenu />
      </div>
    </header>
  )
}
