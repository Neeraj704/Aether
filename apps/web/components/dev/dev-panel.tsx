'use client'

import { useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'
import { useDev, useSession, type ThemeMode } from '@/lib/store'
import { TIER_LABEL, type PlanTier } from '@/mock/layers'
import { cn, EASE_AETHER, formatNumber } from '@/lib/utils'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-[12px] font-medium text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">{children}</div>
    </div>
  )
}

function Seg({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-[7px] px-2 py-1 text-[12px] font-medium transition-colors',
        active
          ? 'bg-brand text-primary-foreground'
          : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

const PLANS: PlanTier[] = ['free', 'starter', 'pro']
const THEMES: ThemeMode[] = ['light', 'dark', 'system']
const FORCE_STATES = ['normal', 'loading', 'empty', 'error'] as const

export function DevPanel() {
  const { open, setOpen, toggle, forceState, setForceState } = useDev()
  const s = useSession()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.shiftKey && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        toggle()
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle, setOpen])

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ opacity: 0, y: 12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.97 }}
          transition={{ duration: 0.28, ease: EASE_AETHER }}
          aria-label="Developer state switcher"
          className="glass fixed bottom-4 left-4 z-[110] w-72 rounded-[var(--radius-md)] p-4"
        >
          <header className="mb-1 flex items-center justify-between">
            <p className="eyebrow text-tertiary">Dev switcher</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close dev switcher"
              className="rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <X className="size-3.5" strokeWidth={1.5} />
            </button>
          </header>

          <div className="divide-y divide-border">
            <Row label="Signed in">
              <Seg active={s.authed} onClick={() => s.setAuthed(true)}>
                Yes
              </Seg>
              <Seg active={!s.authed} onClick={() => s.setAuthed(false)}>
                No
              </Seg>
            </Row>

            <Row label="Plan">
              {PLANS.map((p) => (
                <Seg key={p} active={s.plan === p} onClick={() => s.setPlan(p)}>
                  {TIER_LABEL[p]}
                </Seg>
              ))}
            </Row>

            <Row label="Onboarded">
              <Seg active={s.onboardingComplete} onClick={() => s.setOnboardingComplete(true)}>
                Yes
              </Seg>
              <Seg active={!s.onboardingComplete} onClick={() => s.setOnboardingComplete(false)}>
                No
              </Seg>
            </Row>

            <Row label="Theme">
              {THEMES.map((t) => (
                <Seg key={t} active={s.theme === t} onClick={() => s.setTheme(t)}>
                  {t === 'system' ? 'Auto' : t === 'light' ? 'Light' : 'Dark'}
                </Seg>
              ))}
            </Row>

            <Row label="Force state">
              {FORCE_STATES.map((f) => (
                <Seg key={f} active={forceState === f} onClick={() => setForceState(f)}>
                  {f === 'normal' ? 'Off' : f[0].toUpperCase() + f.slice(1, 4)}
                </Seg>
              ))}
            </Row>

            <Row label={`Credits · ${formatNumber(s.credits)}`}>
              <Seg active={false} onClick={() => s.addCredits(250)}>
                +250
              </Seg>
              <Seg active={false} onClick={() => s.setCredits(0)}>
                Zero
              </Seg>
            </Row>
          </div>

          <button
            type="button"
            onClick={s.reset}
            className="mt-3 w-full rounded-[9px] bg-secondary py-1.5 text-[12px] font-medium text-secondary-foreground transition-colors hover:bg-muted"
          >
            Reset mock state
          </button>
          <p className="mt-2 text-[11px] leading-4 text-tertiary">
            Toggle with{' '}
            <kbd className="rounded bg-secondary px-1 py-0.5 font-sans">Ctrl+Shift+D</kbd>
          </p>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
