'use client'

import { useParams, notFound } from 'next/navigation'
import Link from 'next/link'
import { SiteNav } from '@/components/marketing/site-nav'
import { SiteFooter } from '@/components/marketing/site-footer'
import { BLOG_POSTS } from '@/mock/data'
import { ArrowLeft, Clock, Calendar, User, Sparkles, Share2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { PillLink } from '@/components/ui/pill-button'
import { formatDate } from '@/lib/utils'

export default function BlogPostDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const post = BLOG_POSTS.find((p) => p.slug === slug)

  if (!post) {
    notFound()
  }

  return (
    <>
      <SiteNav />
      <main className="pt-24 pb-16 px-5 sm:px-8 max-w-[850px] mx-auto min-h-screen flex flex-col gap-8">
        <div>
          <Link
            href="/blog"
            className="text-xs font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="size-3.5" /> Back to All Articles
          </Link>
        </div>

        {/* Header */}
        <div className="flex flex-col gap-4 border-b border-border pb-8">
          <div className="flex items-center gap-2">
            <Badge variant="brand" size="md">
              {post.category}
            </Badge>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="size-3.5" /> {post.readingTime} read
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
            {post.title}
          </h1>

          <div className="flex items-center gap-3 pt-2 text-xs text-muted-foreground">
            <div className="flex size-7 items-center justify-center rounded-full bg-brand/10 text-brand font-bold text-xs">
              {post.author.slice(0, 2).toUpperCase()}
            </div>
            <span className="font-bold text-foreground">{post.author}</span>
            <span>·</span>
            <span>{formatDate(post.date, { withTime: true })}</span>
          </div>
        </div>

        {/* Article Body Content */}
        <div className="flex flex-col gap-6 text-sm sm:text-base leading-relaxed text-muted-foreground">
          <p className="text-base sm:text-lg font-medium text-foreground leading-relaxed">
            {post.excerpt}
          </p>

          <p>
            Systematic trading systems are fundamentally graphs of information flow. When we decompose an algorithmic strategy into modular components — data extraction, feature tensors, alpha generators, risk arbitration, and order gateways — we eliminate brittle monoliths and force rigorous statistical validation at every step.
          </p>

          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground mt-4">
            The Fundamental Problem of Overconfidence
          </h2>

          <p>
            Most retail and institutional strategies fail out-of-sample not because of bad signal logic, but because of lookahead bias, uncalibrated probability thresholds, and lack of stochastic slippage models. When a backtest looks too clean, it is almost certainly fitting the noise of the specific historical market regime rather than genuine edge.
          </p>

          <div className="rounded-2xl border border-brand/30 bg-brand/10 p-6 my-2 text-foreground flex flex-col gap-2">
            <h3 className="font-bold text-brand text-base">Key Insight from Aether Research</h3>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              &ldquo;Separating the Alpha Generation Layer from the Risk Gate Layer was our single most controversial architectural decision. By making it impossible for an execution node to receive raw signals without passing through a risk evaluation gate, our models reduced maximum peak-to-trough drawdowns by 34% across 40,000 simulations.&rdquo;
            </p>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground mt-4">
            Walk-Forward Optimization as the Ultimate Filter
          </h2>

          <p>
            Rather than optimizing on a single historical epoch, iterative train-test walk-forward splits simulate the reality of tomorrow: parameters calibrated on past windows must immediately survive forward out-of-sample periods before retraining.
          </p>

          <p>
            To begin building and backtesting strategies with these principles, launch the visual builder in your workspace.
          </p>
        </div>

        {/* CTA Card */}
        <div className="rounded-3xl border border-border bg-gradient-to-r from-brand/15 via-card to-background p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6 my-6">
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-bold text-foreground">Build your own visual trading bot</h3>
            <p className="text-xs text-muted-foreground">
              Connect real-time data feeds, alpha agents, and risk gates on a visual canvas.
            </p>
          </div>
          <PillLink href="/signup" size="lg" className="shrink-0">
            Get Started Free
          </PillLink>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
