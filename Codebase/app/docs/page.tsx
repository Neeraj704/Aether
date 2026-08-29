'use client'

import { SiteNav } from '@/components/marketing/site-nav'
import { SiteFooter } from '@/components/marketing/site-footer'
import { DOC_SECTIONS } from '@/mock/data'
import { BookOpen, ChevronRight } from 'lucide-react'
import Link from 'next/link'

export default function DocsPage() {
  return (
    <>
      <SiteNav />
      <main className="pt-24 pb-16 px-5 sm:px-8 max-w-[1200px] mx-auto flex flex-col gap-10">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-brand uppercase tracking-wider">
            <BookOpen className="size-4" /> Documentation & Knowledge Base
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Learn Aether Strategy Building
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
            Detailed guides on wiring data feeds, setting up multi-agent debate layers, backtesting configs, and risk gates.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {DOC_SECTIONS.map((doc) => (
            <Link
              key={doc.slug}
              href={`/docs/${doc.slug}`}
              className="rounded-xl border border-border bg-card p-6 flex flex-col justify-between gap-4 hover:border-brand/40 transition-all group"
            >
              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-semibold text-brand uppercase tracking-wide">
                  {doc.category}
                </span>
                <h3 className="text-lg font-bold group-hover:text-brand transition-colors">{doc.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{doc.summary}</p>
              </div>

              <div className="pt-4 border-t border-border flex items-center justify-between text-xs font-semibold text-brand">
                <span>Read guide ({doc.readingTime})</span>
                <ChevronRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
