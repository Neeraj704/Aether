'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppSidebar, MobileTabBar } from '@/components/app/app-sidebar'
import { AppTopbar } from '@/components/app/app-topbar'
import { CommandPalette } from '@/components/app/command-palette'
import { useSession } from '@/lib/store'
import { Skeleton } from '@/components/ui/skeleton'
import { createClient } from '@/lib/supabase/client'
import { getBillingState } from '@/lib/billing'

function FullPageSkeleton() {
  return (
    <div className="flex min-h-dvh w-full bg-background">
      {/* Sidebar skeleton */}
      <div className="hidden lg:flex w-64 flex-col gap-4 border-r border-border p-4 bg-card/40">
        <div className="flex items-center gap-3 px-2 py-3">
          <Skeleton className="size-8 rounded-lg" />
          <Skeleton className="h-4 w-24 rounded" />
        </div>
        <div className="flex flex-col gap-2 mt-4">
          <Skeleton className="h-8 w-full rounded-lg" />
          <Skeleton className="h-8 w-full rounded-lg" />
          <Skeleton className="h-8 w-full rounded-lg" />
          <Skeleton className="h-8 w-full rounded-lg" />
        </div>
      </div>

      {/* Main content skeleton */}
      <div className="flex flex-1 flex-col">
        <div className="h-14 border-b border-border flex items-center justify-between px-6 bg-card/20">
          <Skeleton className="h-4 w-32 rounded" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-24 rounded-full" />
            <Skeleton className="size-8 rounded-full" />
          </div>
        </div>
        <div className="p-6 lg:p-8 flex flex-col gap-6 max-w-[1400px] mx-auto w-full">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    </div>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  const authed = useSession((s) => s.authed)
  const onboardingComplete = useSession((s) => s.onboardingComplete)
  const syncUserSession = useSession((s) => s.syncUserSession)
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
    const supabase = createClient()

    // Initial auth check
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        syncUserSession(user)
        getBillingState().then((bState) => {
          if (bState) {
            if (bState.plan) useSession.getState().setPlan(bState.plan)
            if (typeof bState.creditBalance === 'number') useSession.getState().setCredits(bState.creditBalance)
          }
        }).catch(() => {})
      } else {
        syncUserSession(null)
        router.replace('/login')
      }
    }).catch(() => {
      syncUserSession(null)
      router.replace('/login')
    })

    // Listen to real auth events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        syncUserSession(session.user)
        getBillingState().then((bState) => {
          if (bState) {
            if (bState.plan) useSession.getState().setPlan(bState.plan)
            if (typeof bState.creditBalance === 'number') useSession.getState().setCredits(bState.creditBalance)
          }
        }).catch(() => {})
      } else if (event === 'SIGNED_OUT') {
        syncUserSession(null)
        router.replace('/login')
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [router, syncUserSession])

  useEffect(() => {
    if (!mounted) return
    if (!onboardingComplete) {
      router.replace('/onboarding')
    }
  }, [mounted, onboardingComplete, router])

  if (!mounted) {
    return <FullPageSkeleton />
  }

  if (!onboardingComplete) {
    return null
  }

  return (
    <TooltipProvider>
      <div className="flex min-h-dvh">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppTopbar />
          <main className="flex-1 pb-20 lg:pb-0">{children}</main>
        </div>
      </div>
      <MobileTabBar />
      <CommandPalette />
    </TooltipProvider>
  )
}
