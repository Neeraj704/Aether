'use client'

import { useState, useEffect } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { Bot as BotIcon } from 'lucide-react'
import { useBot, useHydrated } from '@/lib/workspace-store'
import { BotHeader } from '@/components/bot/bot-header'
import { OverviewTab } from '@/components/bot/overview-tab'
import { BacktestsTab } from '@/components/bot/backtests-tab'
import { LiveTab } from '@/components/bot/live-tab'
import { SettingsTab } from '@/components/bot/settings-tab'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'

export default function BotDetailPage() {
  const { botId } = useParams<{ botId: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()

  const hydrated = useHydrated()
  const bot = useBot(botId)

  const tabFromUrl = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState<string>(
    tabFromUrl && ['overview', 'backtests', 'live', 'settings'].includes(tabFromUrl)
      ? tabFromUrl
      : 'overview'
  )

  useEffect(() => {
    if (tabFromUrl && ['overview', 'backtests', 'live', 'settings'].includes(tabFromUrl)) {
      setActiveTab(tabFromUrl)
    }
  }, [tabFromUrl])

  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    const newParams = new URLSearchParams(searchParams.toString())
    newParams.set('tab', tab)
    router.replace(`/app/bots/${botId}?${newParams.toString()}`)
  }

  if (!hydrated) {
    return (
      <div className="flex flex-col gap-6 p-6 lg:p-8 max-w-[1400px] mx-auto w-full">
        <Skeleton className="h-20 w-full rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-44 w-full rounded-xl" />
          <Skeleton className="h-44 lg:col-span-2 w-full rounded-xl" />
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  if (!bot) {
    return (
      <div className="flex flex-col items-center justify-center p-12 max-w-[1400px] mx-auto w-full">
        <EmptyState
          icon={BotIcon}
          title="Bot not found"
          description="The requested strategy bot could not be found or may have been deleted."
          action={{ label: 'Back to all bots', href: '/app/bots' }}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-full">
      <BotHeader bot={bot} activeTab={activeTab} onTabChange={handleTabChange} />

      <main className="flex-1 p-6 lg:p-8 max-w-[1400px] mx-auto w-full">
        {activeTab === 'overview' && <OverviewTab bot={bot} />}
        {activeTab === 'backtests' && <BacktestsTab bot={bot} />}
        {activeTab === 'live' && <LiveTab bot={bot} onSwitchTab={handleTabChange} />}
        {activeTab === 'settings' && <SettingsTab bot={bot} />}
      </main>
    </div>
  )
}
