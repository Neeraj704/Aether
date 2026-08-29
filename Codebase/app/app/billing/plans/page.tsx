'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function BillingPlansRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/app/billing')
  }, [router])

  return null
}
