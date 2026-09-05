'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Activity as ActivityIcon,
  Zap,
  ArrowUpRight,
  Radio,
  LineChart,
  Pencil,
  Lock,
  Globe,
  CreditCard,
  TrendingUp,
  Sparkles,
} from 'lucide-react'
import { useWorkspace } from '@/lib/workspace-store'
import { useSession, toast } from '@/lib/store'
import type { ActivityItem } from '@/mock/data'
import { MONTHLY_BACKTEST_LIMIT } from '@/lib/entitlements'
import { StatusBadge, Badge } from '@/components/ui/badge'
import { PillButton, PillLink } from '@/components/ui/pill-button'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { UpgradeNudge } from '@/components/ui/empty-state'
import { relativeTime } from '@/lib/utils'

const ACTIVITY_ICONS: Record<ActivityItem['kind'], typeof LineChart> = {
  backtest: LineChart,
  live: Radio,
  edit: Pencil,
  unlock: Lock,
  publish: Globe,
  payment: CreditCard,
}

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { listBots, createBot as createBotDB } from '@/lib/bots'
import type { Bot } from '@/mock/data'

export default function WorkspaceDashboard() {
  const router = useRouter()
  const [bots, setBots] = useState<Bot[]>([])
  const [loadingBots, setLoadingBots] = useState(true)
  const runs = useWorkspace((s) => s.runs)
  const activity = useWorkspace((s) => s.activity)
  const setBotStatus = useWorkspace((s) => s.setBotStatus)
  const credits = useSession((s) => s.credits)
  const plan = useSession((s) => s.plan)
  const [displayName, setDisplayName] = useState('Trader')

  useEffect(() => {
    async function loadData() {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setDisplayName(user.user_metadata?.full_name || user.email?.split('@')[0] || 'Trader')
        }

        const dbBots = await listBots()
        setBots(dbBots || [])
        useWorkspace.setState({ bots: dbBots || [] })
      } catch (err) {
        console.error('Failed to load dashboard data:', err)
      } finally {
        setLoadingBots(false)
      }
    }
    loadData()
  }, [])

  const activeBots = bots.filter((b) => b.status === 'live').length
  const totalBots = bots.length
  const totalRuns = runs.length

  const avgSharpe =
    runs.length > 0
      ? (runs.reduce((sum, r) => sum + r.metrics.sharpe, 0) / runs.length).toFixed(2)
      : '—'

  // Monthly backtest usage calculation for free plan upgrade nudge
  const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const usedThisMonth = runs.filter((r) => new Date(r.createdAt) >= currentMonthStart).length || runs.length
  const monthlyLimit = MONTHLY_BACKTEST_LIMIT[plan]
  const showUpgradeNudge = plan === 'free' && usedThisMonth >= monthlyLimit * 0.8

  const handleCreateBot = async () => {
    try {
      const bot = await createBotDB({ name: 'New Strategy Bot' })
      toast.success('Bot created', 'Opening strategy builder canvas...')
      router.push(`/app/builder/${bot.id}`)
    } catch (err: any) {
      toast.error('Failed to create bot', err?.message)
    }
  }

  return (
    <div className="flex flex-col gap-8 p-6 lg:p-8 max-w-[1400px] mx-auto w-full">
      {/* Upgrade Banner (Conditional) */}
      {showUpgradeNudge && (
        <UpgradeNudge
          message={`You have used ${usedThisMonth} of your ${monthlyLimit} free monthly backtests. Upgrade to Starter or Pro for unlimited simulations and multi-agent debate nodes.`}
        />
      )}

      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-r from-brand/10 via-secondary/40 to-background p-6 sm:p-8">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand">
              <Zap className="size-3.5" /> Aether Algorithmic Engine
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Welcome back, {displayName}
            </h1>
            <p className="text-sm text-muted-foreground max-w-xl">
              Manage your visual trading bots, run multi-layered backtests, and monitor execution across live venues.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <PillButton onClick={handleCreateBot} className="gap-2 shadow-lg shadow-brand/20">
              <Plus className="size-4" /> New Bot
            </PillButton>
            <PillLink href="/app/marketplace" variant="secondary" className="gap-2">
              Explore Market
            </PillLink>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1">
          <span className="text-xs text-muted-foreground font-medium flex items-center justify-between">
            Active Live Bots <Radio className="size-3.5 text-profit animate-pulse" />
          </span>
          <div className="text-2xl font-bold tracking-tight">
            {activeBots} <span className="text-xs text-muted-foreground font-normal">/ {totalBots} total</span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1">
          <span className="text-xs text-muted-foreground font-medium flex items-center justify-between">
            Simulations Executed <ActivityIcon className="size-3.5 text-brand" />
          </span>
          <div className="text-2xl font-bold tracking-tight">
            {totalRuns} <span className="text-xs text-muted-foreground font-normal">runs</span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1">
          <span className="text-xs text-muted-foreground font-medium flex items-center justify-between">
            Avg Sharpe Ratio <TrendingUp className="size-3.5 text-profit" />
          </span>
          <div className="text-2xl font-bold tracking-tight text-profit">{avgSharpe}</div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1">
          <span className="text-xs text-muted-foreground font-medium flex items-center justify-between">
            Credits Remaining <Sparkles className="size-3.5 text-gold" />
          </span>
          <div className="text-2xl font-bold tracking-tight text-gold">{credits}</div>
        </div>
      </div>

      {/* Bots Grid */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Your Trading Bots</h2>
            <p className="text-xs text-muted-foreground">Visual graph strategies wired with intelligence layers</p>
          </div>
          <Link href="/app/bots" className="text-xs text-brand hover:underline font-medium flex items-center gap-1">
            View all bots ({bots.length}) <ArrowUpRight className="size-3.5" />
          </Link>
        </div>

        {loadingBots ? (
          <div className="p-8 text-center text-xs text-muted-foreground animate-pulse font-mono border border-border rounded-xl">
            Loading strategy bots...
          </div>
        ) : bots.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/40 p-8 text-center flex flex-col items-center justify-center gap-3">
            <h3 className="text-sm font-semibold">No Strategy Bots Yet</h3>
            <p className="text-xs text-muted-foreground max-w-sm">
              Create your first visual trading strategy graph or explore pre-built templates in the community marketplace.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <PillButton size="sm" onClick={handleCreateBot}>
                <Plus className="size-3.5 mr-1" /> Create Bot
              </PillButton>
              <PillLink href="/app/marketplace" size="sm" variant="secondary">
                Explore Marketplace
              </PillLink>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bots.map((bot) => (
              <div
                key={bot.id}
                className="group relative flex flex-col justify-between rounded-xl border border-border bg-card p-5 hover:border-brand/40 transition-all duration-200"
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-1 min-w-0">
                      <Link
                        href={`/app/builder/${bot.id}`}
                        className="font-semibold text-base truncate hover:text-brand transition-colors"
                      >
                        {bot.name}
                      </Link>
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {bot.description || 'No description provided.'}
                      </p>
                    </div>
                    <StatusBadge status={bot.status} />
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {bot.tags.map((t) => (
                      <Badge key={t} variant="neutral" size="sm">
                        #{t}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-border flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[11px] text-muted-foreground">{bot.headlineMetric.label}</span>
                    <span
                      className={`text-sm font-bold ${
                        bot.headlineMetric.positive ? 'text-profit' : 'text-loss'
                      }`}
                    >
                      {bot.headlineMetric.value || 'N/A'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/app/builder/${bot.id}`}
                      className="inline-flex h-8 items-center justify-center rounded-lg border border-border px-3 text-xs font-medium hover:bg-secondary transition-colors"
                    >
                      Open Builder
                    </Link>
                    {bot.status === 'live' ? (
                      <button
                        onClick={() => {
                          setBotStatus(bot.id, 'paused')
                          toast.info('Bot paused', `${bot.name} has been paused.`)
                        }}
                        className="inline-flex h-8 items-center justify-center rounded-lg border border-warn/30 bg-warn/10 px-2.5 text-xs font-medium text-warn hover:bg-warn/20"
                      >
                        Pause
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setBotStatus(bot.id, 'live')
                          toast.success('Bot set to Live', `${bot.name} is now monitoring live markets.`)
                        }}
                        className="inline-flex h-8 items-center justify-center rounded-lg border border-profit/30 bg-profit/10 px-2.5 text-xs font-medium text-profit hover:bg-profit/20"
                      >
                        Go Live
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Activity Feed Section */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Recent Activity Feed</h2>
            <p className="text-xs text-muted-foreground">Historical actions across your strategies, simulations, and account</p>
          </div>
          <Link href="/app/notifications" className="text-xs text-brand hover:underline font-medium">
            Notifications Log &rarr;
          </Link>
        </div>

        <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-y-auto max-h-[640px]">
          {activity.map((act) => {
            const Icon = ACTIVITY_ICONS[act.kind] || ActivityIcon
            return (
              <Link
                key={act.id}
                href={act.href}
                className="flex items-start sm:items-center justify-between gap-4 p-4 hover:bg-secondary/40 transition-colors group"
              >
                <div className="flex items-start sm:items-center gap-3 min-w-0">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-brand group-hover:bg-brand group-hover:text-brand-foreground transition-colors">
                    <Icon className="size-4" />
                  </div>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-xs font-bold text-foreground group-hover:text-brand transition-colors truncate">
                      {act.title}
                    </span>
                    <span className="text-xs text-muted-foreground line-clamp-1">
                      {act.detail}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] text-tertiary">
                    {relativeTime(act.createdAt)}
                  </span>
                  <ArrowUpRight className="size-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Recent Backtests Table */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Recent Backtest Runs</h2>
            <p className="text-xs text-muted-foreground">Latest simulation outputs and performance metrics</p>
          </div>
          <Link href="/app/live" className="text-xs text-brand hover:underline font-medium">
            Live Execution Log &rarr;
          </Link>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <THead>
              <TR>
                <TH className="pl-4">Run ID</TH>
                <TH>Bot Name</TH>
                <TH>Simulation Type</TH>
                <TH>Total Return</TH>
                <TH>Win Rate</TH>
                <TH>Max DD</TH>
                <TH>Sharpe</TH>
                <TH className="pr-4 text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {runs.slice(0, 5).map((run) => (
                <TR key={run.id}>
                  <TD className="pl-4 font-mono text-tertiary text-xs">{run.id}</TD>
                  <TD className="font-semibold text-foreground">{run.botName}</TD>
                  <TD>
                    <Badge variant="outline" size="sm" className="capitalize">
                      {run.config.type}
                    </Badge>
                  </TD>
                  <TD
                    className={`font-bold ${
                      run.metrics.totalReturn >= 0 ? 'text-profit' : 'text-loss'
                    }`}
                  >
                    {run.metrics.totalReturn >= 0 ? '+' : ''}
                    {run.metrics.totalReturn}%
                  </TD>
                  <TD className="text-foreground">{run.metrics.winRate}%</TD>
                  <TD className="text-loss">{run.metrics.maxDrawdown}%</TD>
                  <TD className="text-foreground font-semibold">{run.metrics.sharpe}</TD>
                  <TD className="pr-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        href={`/app/bots/${run.botId}/backtest/${run.id}`}
                        className="text-xs font-medium text-brand hover:underline"
                      >
                        View report &rarr;
                      </Link>
                      <Link
                        href={`/app/builder/${run.botId}`}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        Graph &rarr;
                      </Link>
                    </div>
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
