'use client'

import Link from 'next/link'
import { SearchX, Search } from 'lucide-react'
import { PillButton, PillLink } from '@/components/ui/pill-button'
import { usePalette } from '@/components/app/command-palette'
import { useSession } from '@/lib/store'
import { Logo } from '@/components/brand/logo'

export default function NotFound() {
  const authed = useSession((s) => s.authed)
  const setPaletteOpen = usePalette((s) => s.setOpen)

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center p-6 bg-background text-center">
      {/* Decorative background glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-1/3 size-[30rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--brand)_14%,transparent),transparent_65%)] blur-[90px]" />
      </div>

      <div className="mb-6">
        <Logo href={authed ? '/app' : '/'} />
      </div>

      <div className="glass max-w-md w-full rounded-[var(--radius-xl)] p-8 sm:p-10 flex flex-col items-center gap-5 border border-border float-shadow-lg">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-secondary border border-border text-muted-foreground">
          <SearchX className="size-7 text-brand" strokeWidth={1.75} />
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">This page doesn't exist.</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The link might be old, or the page hasn't been built yet.
          </p>
        </div>

        {/* Global search trigger */}
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-pill)] border border-border bg-secondary/70 px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
        >
          <Search className="size-3.5" />
          <span>Search instead</span>
          <span className="ml-1 rounded bg-background/80 px-1.5 py-0.5 text-[10px] font-mono text-tertiary">
            ⌘K
          </span>
        </button>

        <div className="flex w-full flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          {authed ? (
            <PillLink href="/app" className="w-full justify-center">
              Back to dashboard
            </PillLink>
          ) : (
            <PillLink href="/" className="w-full justify-center">
              Back home
            </PillLink>
          )}
        </div>
      </div>
    </div>
  )
}
