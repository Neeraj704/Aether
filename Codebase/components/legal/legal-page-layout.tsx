'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { SiteNav } from '@/components/marketing/site-nav'
import { SiteFooter } from '@/components/marketing/site-footer'
import { ArrowLeft, ArrowUpRight, ShieldCheck, Scale, AlertTriangle, RefreshCw } from 'lucide-react'

const LEGAL_PAGES = [
  {
    href: '/legal/terms',
    title: 'Terms of Service',
    description: 'Platform rules, account terms, and creator revenue sharing.',
    icon: Scale,
  },
  {
    href: '/legal/privacy',
    title: 'Privacy Policy',
    description: 'How your strategy data, logs, and account info are protected.',
    icon: ShieldCheck,
  },
  {
    href: '/legal/risk-disclosure',
    title: 'Risk Disclosure',
    description: 'Trading risks, backtest limitations, and simulation disclaimers.',
    icon: AlertTriangle,
  },
  {
    href: '/legal/refund-policy',
    title: 'Refund Policy',
    description: 'Subscription satisfaction guarantees and credit terms.',
    icon: RefreshCw,
  },
]

export function LegalPageLayout({
  title,
  lastUpdated,
  children,
}: {
  title: string
  lastUpdated: string
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const otherPages = LEGAL_PAGES.filter((p) => p.href !== pathname)

  return (
    <>
      <SiteNav />
      <main className="min-h-screen bg-background pt-24 pb-20 sm:pt-28 sm:pb-24">
        <div className="mx-auto max-w-[720px] px-5 sm:px-8">
          {/* Header */}
          <div className="mb-10">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              <span>Back to home</span>
            </Link>

            <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              {title}
            </h1>

            <div className="mt-3 flex items-center gap-2 text-xs text-tertiary">
              <span>Last updated:</span>
              <time className="font-medium text-muted-foreground">{lastUpdated}</time>
            </div>
          </div>

          {/* Prose Content */}
          <article className="prose-content flex flex-col gap-6 text-[14.5px] leading-relaxed text-muted-foreground [&_h2]:text-[18px] [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-foreground [&_h2]:mt-8 [&_h2]:pt-5 [&_h2]:border-t [&_h2]:border-border/60 [&_h3]:text-[15px] [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mt-4 [&_p]:leading-7 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-2 [&_li]:leading-6 [&_strong]:text-foreground [&_strong]:font-semibold [&_a]:text-brand [&_a]:underline [&_a]:underline-offset-2">
            {children}
          </article>

          {/* In-page Cross-Navigation */}
          <div className="mt-16 border-t border-border pt-10">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Other Legal Policies
            </h3>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {otherPages.map((page) => {
                const Icon = page.icon
                return (
                  <Link
                    key={page.href}
                    href={page.href}
                    className="group flex flex-col justify-between rounded-xl border border-border bg-card p-4 transition-colors hover:border-brand/40 hover:bg-accent/40"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <Icon className="size-4 text-brand" />
                        <ArrowUpRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground" />
                      </div>
                      <h4 className="mt-2.5 text-sm font-semibold text-foreground group-hover:text-brand">
                        {page.title}
                      </h4>
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                        {page.description}
                      </p>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
