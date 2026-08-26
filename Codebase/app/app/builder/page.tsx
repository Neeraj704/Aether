'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useWorkspace, useHydrated } from '@/lib/workspace-store'

export default function BuilderIndexRedirect() {
  const router = useRouter()
  const bots = useWorkspace((s) => s.bots)
  const hydrated = useHydrated()
  const createBot = useWorkspace((s) => s.createBot)

  useEffect(() => {
    if (!hydrated) return
    if (bots.length > 0) {
      router.replace(`/app/builder/${bots[0].id}`)
    } else {
      const newBot = createBot({ name: 'First Trading Bot' })
      router.replace(`/app/builder/${newBot.id}`)
    }
  }, [hydrated, bots, router, createBot])

  return <div className="flex flex-1 items-center justify-center p-12 text-sm text-muted-foreground">Opening strategy builder...</div>
}
