import Link from 'next/link'
import { Logo } from '@/components/brand/logo'

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { href: '/how-it-works', label: 'How it works' },
      { href: '/pricing', label: 'Pricing' },
      { href: '/marketplace', label: 'Marketplace' },
      { href: '/app/library', label: 'Component library' },
      { href: '/app/compare', label: 'Compare bots' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { href: '/docs', label: 'Documentation' },
      { href: '/docs/getting-started', label: 'Getting started' },
      { href: '/docs/layer-reference', label: 'Layer reference' },
      { href: '/docs/api-reference', label: 'API reference' },
      { href: '/blog', label: 'Blog' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: '/how-it-works', label: 'About' },
      // Changelog placeholder pointing to docs until real changelog exists
      { href: '/docs', label: 'Changelog' },
      { href: '/app/help', label: 'Support' },
      { href: '/app/marketplace', label: 'Creator program' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/legal/terms', label: 'Terms of service' },
      { href: '/legal/privacy', label: 'Privacy policy' },
      { href: '/legal/risk-disclosure', label: 'Risk disclosure' },
      { href: '/legal/refund-policy', label: 'Refund policy' },
    ],
  },
]

const SOCIALS = [
  { href: '#', label: 'X', full: 'Aether on X' },
  { href: '#', label: 'GitHub', full: 'Aether on GitHub' },
  { href: '#', label: 'LinkedIn', full: 'Aether on LinkedIn' },
  { href: '#', label: 'YouTube', full: 'Aether on YouTube' },
]

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-[1120px] px-5 py-14 lg:px-8">
        <div className="flex flex-col gap-12 lg:flex-row lg:justify-between">
          <div className="max-w-xs">
            <Logo />
            <p className="mt-4 text-[13px] leading-6 text-muted-foreground">
              A visual builder for algorithmic trading agents. Assemble layers, backtest instantly,
              and keep what survives contact with the data.
            </p>
            <ul className="mt-5 flex flex-wrap items-center gap-2">
              {SOCIALS.map(({ href, label, full }) => (
                <li key={label}>
                  <Link
                    href={href}
                    aria-label={full}
                    className="flex h-8 items-center rounded-[var(--radius-pill)] border border-border px-3 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <nav aria-label="Footer" className="grid flex-1 grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4 lg:max-w-2xl">
            {COLUMNS.map((col) => (
              <div key={col.title}>
                <h2 className="text-[13px] font-semibold text-foreground">{col.title}</h2>
                <ul className="mt-3 flex flex-col gap-2.5">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <Link
                        href={l.href}
                        className="text-[13px] leading-5 text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-12 border-t border-border pt-6">
          <p className="text-[12px] leading-5 text-tertiary">
            Aether is a research and simulation tool. It is not investment advice and we do not
            manage money. Bots run in paper trading mode by default with simulated fills. Trading
            involves substantial risk of loss  read the{' '}
            <Link href="/legal/risk-disclosure" className="text-muted-foreground underline underline-offset-2 hover:text-foreground">
              full risk disclosure
            </Link>
            . Past backtest performance never guarantees future results.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[12px] text-tertiary">
              &copy; {new Date().getFullYear()} Aether Systems Pvt. Ltd. All rights reserved.
            </p>
            <p className="text-[12px] text-tertiary">Mumbai, India</p>
          </div>
        </div>
      </div>
    </footer>
  )
}
