'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AccountIndexRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/app/account/profile')
  }, [router])
  return null
}
