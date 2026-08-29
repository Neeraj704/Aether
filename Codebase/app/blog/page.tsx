'use client'

import Link from 'next/link'
import { SiteNav } from '@/components/marketing/site-nav'
import { SiteFooter } from '@/components/marketing/site-footer'
import { BLOG_POSTS } from '@/mock/data'
import { BookOpen, Clock, ChevronRight, Sparkles, User } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'

export default function BlogIndexPage() {
  return (
    <>
      <SiteNav />
      <main className="pt-24 pb-16 px-5 sm:px-8 max-w-[1200px] mx-auto flex flex-col gap-10 min-h-screen">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-brand uppercase tracking-wider">
            <BookOpen className="size-4" /> Quantitative Research & Engineering
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
            The Aether Engineering Blog
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl leading-relaxed">
            Deep-dives into algorithmic graph architectures, risk gates, Monte Carlo analysis, and multi-agent debate dynamics.
          </p>
        </div>

        {/* Featured Post */}
        {BLOG_POSTS[0] && (
          <Link
            href={`/blog/${BLOG_POSTS[0].slug}`}
            className="group relative flex flex-col justify-between rounded-3xl border border-border bg-gradient-to-br from-brand/15 via-card to-background p-8 sm:p-10 hover:border-brand/50 transition-all shadow-md"
          >
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <Badge variant="brand" size="md">
                  Featured · {BLOG_POSTS[0].category}
                </Badge>
                <span className="text-xs text-muted-foreground">{BLOG_POSTS[0].readingTime} read</span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground group-hover:text-brand transition-colors">
                {BLOG_POSTS[0].title}
              </h2>

              <p className="text-sm sm:text-base text-muted-foreground max-w-3xl leading-relaxed">
                {BLOG_POSTS[0].excerpt}
              </p>
            </div>

            <div className="mt-8 pt-6 border-t border-border/60 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{BLOG_POSTS[0].author}</span>
                <span>·</span>
                <span>{formatDate(BLOG_POSTS[0].date)}</span>
              </div>

              <span className="text-xs font-bold text-brand flex items-center gap-1 group-hover:underline">
                Read Article &rarr;
              </span>
            </div>
          </Link>
        )}

        {/* Rest of posts grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {BLOG_POSTS.slice(1).map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group rounded-2xl border border-border bg-card p-6 flex flex-col justify-between hover:border-brand/40 transition-all shadow-xs"
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="neutral" size="sm">
                    {post.category}
                  </Badge>
                  <span className="text-[11px] text-tertiary">{post.readingTime}</span>
                </div>

                <h3 className="text-base font-bold tracking-tight group-hover:text-brand transition-colors line-clamp-2">
                  {post.title}
                </h3>

                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                  {post.excerpt}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-border flex items-center justify-between text-[11px] text-tertiary">
                <span>By {post.author}</span>
                <span>{formatDate(post.date)}</span>
              </div>
            </Link>
          ))}
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
