import type React from 'react'
import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider, ThemeScript } from '@/components/providers/theme-provider'
import { ToastViewport } from '@/components/ui/toast'
import { DevPanel } from '@/components/dev/dev-panel'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Aether  Build a trading agent by dragging boxes',
    template: '%s · Aether',
  },
  description:
    'Aether is a visual builder for algorithmic trading agents. Assemble data, risk, execution and self-learning layers on a canvas, backtest instantly, and share what works. Paper trading by default.',
  generator: 'v0.app',
  openGraph: {
    title: 'Aether  Build a trading agent by dragging boxes',
    description:
      'Assemble a trading agent from toggleable layers, backtest instantly, and share what works. Paper trading by default.',
    type: 'website',
  },
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f5f7' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
  width: 'device-width',
  initialScale: 1,
}

// Dev panel is enabled in local dev, or when NEXT_PUBLIC_ENABLE_DEV_PANEL=true is explicitly set in production
const DEV_PANEL_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_DEV_PANEL === 'true' || process.env.NODE_ENV !== 'production'

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${inter.variable} bg-background`} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-dvh antialiased">
        <ThemeProvider>
          {children}
          <ToastViewport />
          {DEV_PANEL_ENABLED && <DevPanel />}
        </ThemeProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
