'use client'

import { useState } from 'react'
import {
  HelpCircle,
  Search,
  Mail,
  ChevronDown,
  Send,
  BookOpen,
} from 'lucide-react'
import { FAQS } from '@/mock/data'
import { toast } from '@/lib/store'
import { PillButton, PillLink } from '@/components/ui/pill-button'
import { Input, Textarea, Field } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export default function HelpPage() {
  const [query, setQuery] = useState('')
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')

  const filteredFaqs = FAQS.filter(
    (faq) =>
      faq.q.toLowerCase().includes(query.toLowerCase()) ||
      faq.a.toLowerCase().includes(query.toLowerCase()),
  )

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!subject.trim() || !message.trim()) return
    toast.success('Message Sent!', 'Our quant engineering support team will respond to your registered email within 24 hours.')
    setSubject('')
    setMessage('')
  }

  return (
    <div className="flex flex-col gap-8 p-6 lg:p-8 max-w-[1200px] mx-auto w-full">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-r from-brand/10 via-secondary/40 to-background p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand">
            <HelpCircle className="size-3.5" /> Quant Support & Knowledge Base
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            How can we help you build?
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-xl">
            Search our quantitative FAQ, inspect platform infrastructure telemetry, or dispatch a message directly to our engineering desk.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <PillLink href="/docs/welcome" variant="secondary" className="gap-2">
            <BookOpen className="size-4" /> Documentation
          </PillLink>
        </div>
      </div>

      {/* System Operational Status Widget */}
      <div className="rounded-2xl border border-border bg-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative flex size-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-profit opacity-75" />
            <span className="relative inline-flex rounded-full size-3 bg-profit" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-foreground">All Systems Fully Operational</span>
            <span className="text-[11px] text-muted-foreground">
              99.98% Backtest Cluster Uptime · Tick Engine Latency: 4.2ms
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <Badge variant="profit" size="sm">
            NSE Feed: Online
          </Badge>
          <Badge variant="brand" size="sm">
            Simulation Gas: Normal
          </Badge>
        </div>
      </div>

      {/* FAQ & Contact Form Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* FAQs Left 2 Cols */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold">Frequently Asked Questions</h2>
              <p className="text-xs text-muted-foreground">General mechanics, risk layer requirements, and pricing</p>
            </div>
          </div>

          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search frequently asked questions..."
              className="pl-9 text-xs"
            />
          </div>

          <div className="flex flex-col gap-3">
            {filteredFaqs.map((faq, idx) => {
              const isOpen = openIndex === idx
              return (
                <div
                  key={faq.q}
                  className="rounded-xl border border-border bg-card overflow-hidden transition-all"
                >
                  <button
                    type="button"
                    onClick={() => setOpenIndex(isOpen ? null : idx)}
                    className="w-full p-4 flex items-center justify-between gap-3 text-left font-bold text-sm text-foreground hover:text-brand transition-colors cursor-pointer"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={cn('size-4 text-muted-foreground transition-transform shrink-0', isOpen && 'rotate-180 text-foreground')}
                    />
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4 text-xs leading-relaxed text-muted-foreground border-t border-border/50 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Contact Form Right Col */}
        <div className="flex flex-col gap-5">
          <form onSubmit={handleSendMessage} className="rounded-2xl border border-border bg-card p-6 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Mail className="size-4 text-brand" />
              <h2 className="text-base font-bold">Contact Support</h2>
            </div>
            <p className="text-xs text-muted-foreground">
              Have questions about custom node formulas or execution broker connections?
            </p>

            <Field label="Subject" htmlFor="subject">
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Monte Carlo convergence query"
                required
              />
            </Field>

            <Field label="Message & Diagnostic Details" htmlFor="message">
              <Textarea
                id="message"
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe your question or attach strategy IDs..."
                required
              />
            </Field>

            <PillButton type="submit" size="sm" className="w-full justify-center gap-2 mt-2">
              <Send className="size-3.5" /> Dispatch Inquiry
            </PillButton>
          </form>
        </div>
      </div>
    </div>
  )
}
