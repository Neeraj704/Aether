'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { listBots, createBot } from '@/lib/bots'

export default function BuilderIndexRedirect() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    const initBuilder = async () => {
      try {
        const bots = await listBots()
        if (!active) return

        if (bots.length > 0) {
          router.replace(`/app/builder/${bots[0].id}`)
        } else {
          const newBot = await createBot({ name: 'First Trading Bot' })
          if (!active) return
          router.replace(`/app/builder/${newBot.id}`)
        }
      } catch (err: any) {
        console.error('Failed to initialize builder bot:', err)
        if (active) setError(err?.message || 'Failed to open builder')
      }
    }

    initBuilder()

    return () => {
      active = false
    }
  }, [router])

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-12 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 rounded-full border border-border px-4 py-1.5 text-xs text-foreground hover:bg-secondary"
        >
          Try Again
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-1 items-center justify-center p-12 text-sm text-muted-foreground">
      Opening strategy builder...
    </div>
  )
}
