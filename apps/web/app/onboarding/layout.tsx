'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Logo } from '@/components/brand/logo'
import { useSession } from '@/lib/store'
import { cn } from '@/lib/utils'

const STEPS = [
  { id: 'welcome', path: '/onboarding/welcome', label: 'Experience' },
  { id: 'start', path: '/onboarding/start', label: 'Starting Point' },
  { id: 'tour', path: '/onboarding/tour', label: 'Interface Tour' },
  { id: 'first-node', path: '/onboarding/first-node', label: 'First Node' },
  { id: 'done', path: '/onboarding/done', label: 'Ready' },
]

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const setOnboardingComplete = useSession((s) => s.setOnboardingComplete)

  const currentStepIndex = STEPS.findIndex((s) => pathname.startsWith(s.path))
  const activeIndex = currentStepIndex >= 0 ? currentStepIndex : 0

  const handleSkip = () => {
    setOnboardingComplete(true)
    router.push('/app')
  }

  const isTourStep = pathname.includes('/onboarding/tour') || pathname.includes('/onboarding/first-node')

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      {/* Onboarding Header */}
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 sm:px-8 backdrop-blur-xl">
        <div className="flex items-center gap-6">
          <Logo href="/app" />
          {/* 5-segment Progress bar */}
          <div className="hidden sm:flex items-center gap-1.5">
            {STEPS.map((step, idx) => (
              <div key={step.id} className="flex items-center gap-1.5">
                <div
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-300',
                    idx === activeIndex
                      ? 'w-8 bg-brand'
                      : idx < activeIndex
                        ? 'w-6 bg-brand/50'
                        : 'w-4 bg-secondary',
                  )}
                  title={`Step ${idx + 1}: ${step.label}`}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleSkip}
            className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Skip onboarding &rarr;
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className={cn('flex flex-1 flex-col', isTourStep ? 'p-0 overflow-hidden' : 'p-4 sm:p-8 items-center justify-center')}>
        {children}
      </main>
    </div>
  )
}
