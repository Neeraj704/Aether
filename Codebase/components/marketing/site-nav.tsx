'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import { Menu, X } from 'lucide-react'
import { Logo } from '@/components/brand/logo'
import { PillLink } from '@/components/ui/pill-button'
import { useSession } from '@/lib/store'
import { cn, EASE_AETHER } from '@/lib/utils'

const LINKS = [
  { href: '/how-it-works', label: 'Product' },
  { href: '/pricing', label: 'Pricing' },
  // TODO(phase5): point at public /marketplace once built
  { href: '/app/marketplace', label: 'Marketplace' },
  { href: '/docs', label: 'Docs' },
]

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()
  const authed = useSession((s) => s.authed)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => setMenuOpen(false), [pathname])

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-300',
        scrolled
          ? 'glass-chrome'
          : 'border-b border-transparent bg-transparent',
      )}
    >
      <nav
        aria-label="Main"
        className="mx-auto flex h-14 max-w-[1120px] items-center gap-8 px-5 sm:h-[56px] lg:px-8"
      >
        <Logo />

        <ul className="hidden flex-1 items-center gap-7 md:flex">
          {LINKS.map((l) => {
            const active = pathname === l.href || pathname.startsWith(`${l.href}/`)
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className={cn(
                    'text-[13px] font-medium transition-colors',
                    active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {l.label}
                </Link>
              </li>
            )
          })}
        </ul>

        <div className="ml-auto hidden items-center gap-4 md:flex">
          {authed ? (
            <PillLink href="/app" size="sm">
              Open app
            </PillLink>
          ) : (
            <>
              <Link
                href="/login"
                className="text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Log in
              </Link>
              <PillLink href="/signup" size="sm">
                Sign up free
              </PillLink>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          className="ml-auto rounded-full p-2 text-foreground md:hidden"
        >
          {menuOpen ? <X className="size-5" strokeWidth={1.5} /> : <Menu className="size-5" strokeWidth={1.5} />}
        </button>
      </nav>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE_AETHER }}
            className="glass-chrome overflow-hidden md:hidden"
          >
            <ul className="flex flex-col gap-1 px-5 pb-4 pt-2">
              {LINKS.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="block rounded-[10px] px-3 py-2.5 text-[15px] font-medium text-foreground hover:bg-secondary"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
              <li className="mt-2 flex gap-3 px-1">
                {authed ? (
                  <PillLink href="/app" className="flex-1">
                    Open app
                  </PillLink>
                ) : (
                  <>
                    <PillLink href="/login" variant="secondary" className="flex-1">
                      Log in
                    </PillLink>
                    <PillLink href="/signup" className="flex-1">
                      Sign up
                    </PillLink>
                  </>
                )}
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
