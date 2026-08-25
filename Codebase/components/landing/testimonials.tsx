'use client'

import { TESTIMONIALS } from '@/mock/data'
import { useReveal } from '@/lib/use-reveal'

export function Testimonials() {
  const ref = useReveal<HTMLDivElement>()

  return (
    <section className="bg-elevated/40 py-20 sm:py-28">
      <div ref={ref} className="mx-auto max-w-[1120px] px-5 lg:px-8">
        <p data-reveal className="eyebrow text-brand">
          From the desk
        </p>
        <h2
          data-reveal
          className="mt-3 max-w-2xl text-balance text-[clamp(1.875rem,4.5vw,3rem)] font-semibold leading-[1.08] tracking-[-0.03em]"
        >
          What people found out about their own strategies.
        </h2>

        <ul className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {TESTIMONIALS.map((t) => (
            <li
              key={t.author}
              data-reveal
              className="glass flex flex-col rounded-[var(--radius-md)] p-7"
            >
              <blockquote className="text-[15px] leading-relaxed text-foreground/90">
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              <footer className="mt-6 flex items-center gap-3">
                <span
                  aria-hidden
                  className="flex size-9 items-center justify-center rounded-full bg-secondary text-[12px] font-semibold text-muted-foreground"
                >
                  {t.initials}
                </span>
                <div>
                  <p className="text-[13px] font-semibold">{t.author}</p>
                  <p className="text-[12px] text-tertiary">{t.role}</p>
                </div>
              </footer>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
