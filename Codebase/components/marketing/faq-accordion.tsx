'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Plus } from 'lucide-react'
import { FAQS } from '@/mock/data'
import { cn, EASE_AETHER } from '@/lib/utils'

export interface FaqItem {
  q: string
  a: string
}

export function FaqAccordion({ items = FAQS }: { items?: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <ul className="divide-y divide-border border-y border-border w-full">
      {items.map((item, i) => {
        const isOpen = open === i
        return (
          <li key={item.q}>
            <h3>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                aria-controls={`faq-panel-${i}`}
                className="flex w-full items-center justify-between gap-4 py-5 text-left cursor-pointer"
              >
                <span className="text-[16px] font-medium tracking-[-0.01em]">{item.q}</span>
                <span
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground transition-transform duration-300',
                    isOpen && 'rotate-45',
                  )}
                >
                  <Plus className="size-4" strokeWidth={1.75} />
                </span>
              </button>
            </h3>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  id={`faq-panel-${i}`}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.32, ease: EASE_AETHER }}
                  className="overflow-hidden"
                >
                  <p className="pb-5 pr-11 text-[15px] leading-relaxed text-muted-foreground">
                    {item.a}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </li>
        )
      })}
    </ul>
  )
}
