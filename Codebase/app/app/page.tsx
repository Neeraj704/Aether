'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Bot as BotIcon,
  Plus,
  Play,
  TrendingUp,
  Activity,
  Zap,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  Radio,
} from 'lucide-react'
import { useWorkspace } from '@/lib/workspace-store'
import { useSession, toast } from '@/lib/store'
import { CURRENT_USER } from '@/mock/data'
import { StatusBadge, Badge } from '@/components/ui/badge'
import { PillButton, PillLink } from '@/components/ui/pill-button'

export default function WorkspaceDashboard() {
  const router = useRouter()
  const bots = useWorkspace((s) => s.bots)
  const runs = useWorkspace((s) => s.runs)
  const createBot = useWorkspace((s) => s.createBot)
  const setBotStatus = useWorkspace((s) => s.setBotStatus)
  const credits = useSession((s) => s.credits)

  const activeBots = bots.filter((b) => b.status === 'live').length
  const totalBots = bots.length
  const totalRuns = runs.length

  const handleCreateBot = () => {
    const bot = createBot({ name: 'New Strategy Bot' })
    toast.success('Bot created', 'Opening strategy builder canvas...')
    router.push(`/app/builder/${bot.id}`)
  }

  return (
    <div className="flex flex-col gap-8 p-6 lg:p-8 max-w-[1400px] mx-auto w-full">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-r from-brand/10 via-secondary/40 to-background p-6 sm:p-8">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand">
              <Zap className="size-3.5" /> Aether Algorithmic Engine
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Welcome back, {CURRENT_USER.name}
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
          <div className="text-2xl font-bold tracking-tight">{activeBots} <span className="text-xs text-muted-foreground font-normal">/ {totalBots} total</span></div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1">
          <span className="text-xs text-muted-foreground font-medium flex items-center justify-between">
            Simulations Executed <Activity className="size-3.5 text-brand" />
          </span>
          <div className="text-2xl font-bold tracking-tight">{totalRuns} <span className="text-xs text-muted-foreground font-normal">runs</span></div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1">
          <span className="text-xs text-muted-foreground font-medium flex items-center justify-between">
            Avg Sharpe Ratio <TrendingUp className="size-3.5 text-profit" />
          </span>
          <div className="text-2xl font-bold tracking-tight text-profit">1.64</div>
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
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-secondary/50 font-medium text-muted-foreground">
                <tr>
                  <th className="p-3 pl-4">Run ID</th>
                  <th className="p-3">Bot Name</th>
                  <th className="p-3">Simulation Type</th>
                  <th className="p-3">Total Return</th>
                  <th className="p-3">Win Rate</th>
                  <th className="p-3">Max DD</th>
                  <th className="p-3">Sharpe</th>
                  <th className="p-3 pr-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {runs.slice(0, 5).map((run) => (
                  <tr key={run.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="p-3 pl-4 font-mono text-tertiary">{run.id}</td>
                    <td className="p-3 font-semibold text-foreground">{run.botName}</td>
                    <td className="p-3">
                      <Badge variant="outline" size="sm" className="capitalize">
                        {run.config.type}
                      </Badge>
                    </td>
                    <td
                      className={`p-3 font-bold ${
                        run.metrics.totalReturn >= 0 ? 'text-profit' : 'text-loss'
                      }`}
                    >
                      {run.metrics.totalReturn >= 0 ? '+' : ''}
                      {run.metrics.totalReturn}%
                    </td>
                    <td className="p-3 text-foreground">{run.metrics.winRate}%</td>
                    <td className="p-3 text-loss">{run.metrics.maxDrawdown}%</td>
                    <td className="p-3 text-foreground font-semibold">{run.metrics.sharpe}</td>
                    <td className="p-3 pr-4 text-right">
                      <Link
                        href={`/app/builder/${run.botId}`}
                        className="text-brand hover:underline font-medium"
                      >
                        View Graph &rarr;
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
