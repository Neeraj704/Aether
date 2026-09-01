'use client'

import { LANDING_STATS } from '@/mock/data'
import { useCountUp } from '@/lib/use-reveal'

function Stat({ label, value }: { label: string; value: number }) {
  const ref = useCountUp(value)
  return (
    <div className="flex flex-col items-center gap-1 px-4 py-6 sm:py-8">
      <p className="text-[clamp(1.75rem,4vw,2.5rem)] font-semibold tabular-nums tracking-[-0.03em]">
        <span ref={ref}>0</span>
      </p>
      <p className="text-[13px] text-muted-foreground">{label}</p>
    </div>
  )
}

export function StatsBar() {
  return (
    <section aria-label="Platform usage" className="border-y border-border bg-elevated/40">
      <div className="mx-auto grid max-w-[1120px] grid-cols-1 divide-y divide-border px-5 sm:grid-cols-3 sm:divide-x sm:divide-y-0 lg:px-8">
        {LANDING_STATS.map((s) => (
          <Stat key={s.label} label={s.label} value={s.value} />
        ))}
      </div>
    </section>
  )
}
