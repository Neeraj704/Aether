'use client'

import { useParams, notFound } from 'next/navigation'
import Link from 'next/link'
import { SiteNav } from '@/components/marketing/site-nav'
import { SiteFooter } from '@/components/marketing/site-footer'
import { DOC_SECTIONS } from '@/mock/data'
import { ArrowLeft, BookOpen, Clock, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export default function DocDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const doc = DOC_SECTIONS.find((d) => d.slug === slug)

  if (!doc) {
    notFound()
  }

  // Categories
  const categories = Array.from(new Set(DOC_SECTIONS.map((d) => d.category)))

  return (
    <>
      <SiteNav />
      <main className="pt-24 pb-16 px-5 sm:px-8 max-w-[1280px] mx-auto min-h-screen">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
          {/* Docs Navigation Sidebar */}
          <aside className="hidden lg:flex flex-col gap-6 border-r border-border pr-6">
            <Link
              href="/docs"
              className="text-xs font-semibold text-brand hover:underline inline-flex items-center gap-1"
            >
              <ArrowLeft className="size-3.5" /> All Documentation
            </Link>

            <div className="flex flex-col gap-6">
              {categories.map((cat) => (
                <div key={cat} className="flex flex-col gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-tertiary">
                    {cat}
                  </span>
                  <div className="flex flex-col gap-1">
                    {DOC_SECTIONS.filter((d) => d.category === cat).map((item) => {
                      const isActive = item.slug === slug
                      return (
                        <Link
                          key={item.slug}
                          href={`/docs/${item.slug}`}
                          className={cn(
                            'text-xs py-1.5 px-2.5 rounded-lg transition-colors font-medium',
                            isActive
                              ? 'bg-brand/10 text-brand font-bold'
                              : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60',
                          )}
                        >
                          {item.title}
                        </Link>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </aside>

          {/* Doc Content Area */}
          <article className="lg:col-span-3 flex flex-col gap-6 max-w-3xl">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand">
              <BookOpen className="size-3.5" /> {doc.category}
            </div>

            <div className="flex flex-col gap-2 border-b border-border pb-6">
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">{doc.title}</h1>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">{doc.summary}</p>
              <div className="flex items-center gap-2 text-xs text-tertiary pt-2">
                <Clock className="size-3.5" /> {doc.readingTime} read
              </div>
            </div>

            {/* Structured Blocks */}
            <div className="flex flex-col gap-5 leading-relaxed">
              {doc.blocks.map((b, i) => {
                if (b.type === 'p') {
                  return (
                    <p key={i} className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                      {b.text}
                    </p>
                  )
                }
                if (b.type === 'h2') {
                  return (
                    <h2 key={i} className="text-xl font-bold tracking-tight text-foreground mt-4 mb-1">
                      {b.text}
                    </h2>
                  )
                }
                if (b.type === 'h3') {
                  return (
                    <h3 key={i} className="text-base font-bold text-foreground mt-3 mb-1">
                      {b.text}
                    </h3>
                  )
                }
                if (b.type === 'list' && b.items) {
                  return (
                    <ul key={i} className="list-disc pl-5 text-sm sm:text-base text-muted-foreground flex flex-col gap-2">
                      {b.items.map((item, j) => (
                        <li key={j}>{item}</li>
                      ))}
                    </ul>
                  )
                }
                if (b.type === 'code') {
                  return (
                    <pre
                      key={i}
                      className="rounded-xl border border-border bg-card p-4 font-mono text-xs overflow-x-auto text-foreground shadow-xs my-2"
                    >
                      <code>{b.text}</code>
                    </pre>
                  )
                }
                if (b.type === 'note') {
                  return (
                    <div
                      key={i}
                      className="rounded-xl border border-brand/30 bg-brand/10 p-4 text-xs sm:text-sm text-brand leading-relaxed my-2"
                    >
                      <strong>Important:</strong> {b.text}
                    </div>
                  )
                }
                return null
              })}
            </div>
          </article>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
