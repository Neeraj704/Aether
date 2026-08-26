'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function BotDetailRedirect() {
  const { botId } = useParams<{ botId: string }>()
  const router = useRouter()

  useEffect(() => {
    if (botId) {
      router.replace(`/app/builder/${botId}`)
    }
  }, [botId, router])

  return <div className="flex flex-1 items-center justify-center p-12 text-sm text-muted-foreground">Loading builder...</div>
}
