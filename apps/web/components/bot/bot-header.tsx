'use client'

import Link from 'next/link'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import type { Bot } from '@/mock/data'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PillLink } from '@/components/ui/pill-button'
import { Tooltip } from '@/components/ui/tooltip'
import { relativeTime } from '@/lib/utils'

export function BotHeader({
  bot,
  activeTab,
  onTabChange,
}: {
  bot: Bot
  activeTab?: string
  onTabChange?: (tab: string) => void
}) {
  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'backtests', label: 'Backtests' },
    { id: 'live', label: 'Live' },
    { id: 'settings', label: 'Settings' },
  ]

  const hasTabs = Boolean(activeTab && onTabChange)

  return (
    <div
      className={`border-b border-border bg-card/60 px-6 lg:px-8 backdrop-blur-xl ${
        hasTabs ? 'pt-6 pb-0' : 'py-4 lg:py-5'
      }`}
    >
      <div className="max-w-[1400px] mx-auto w-full flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Tooltip content="Back to bots">
              <Button render={<Link href="/app/bots" />} variant="ghost" size="icon-sm">
                <ArrowLeft />
                <span className="sr-only">Back to bots</span>
              </Button>
            </Tooltip>
            <div className="flex flex-col">
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold tracking-tight text-foreground">{bot.name}</h1>
                <StatusBadge status={bot.status} />
              </div>
              <span className="text-xs text-tertiary">
                Updated {relativeTime(bot.updatedAt)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <PillLink href={`/app/builder/${bot.id}`} variant="primary" size="sm">
              Open in builder <ExternalLink className="size-3 ml-1" />
            </PillLink>
          </div>
        </div>

        {hasTabs && (
          <div className="flex items-center gap-1 border-b border-border -mb-px pt-1">
            {tabs.map((t) => {
              const isSelected = activeTab === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onTabChange!(t.id)}
                  className={`relative cursor-pointer px-4 pb-2.5 text-xs font-semibold transition-colors outline-none ${
                    isSelected
                      ? 'text-foreground border-b-2 border-brand'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t.label}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
