'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function CreditsRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/app/billing')
  }, [router])
  return <div className="flex flex-1 items-center justify-center p-12 text-sm text-muted-foreground">Redirecting to Billing...</div>
}
