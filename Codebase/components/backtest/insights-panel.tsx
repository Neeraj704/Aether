'use client'

import { Lightbulb, AlertTriangle } from 'lucide-react'
import type { BacktestRun } from '@/mock/data'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function InsightsPanel({ insights }: { insights: BacktestRun['insights'] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="size-4 text-gold" /> Self-Learning Insights & Post-Mortems
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Automated rules and diagnostic post-mortems generated from trade outcome patterns.
        </p>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {insights.map((item, i) => {
          const isRule = item.kind === 'rule'
          return (
            <div
              key={i}
              className="flex flex-col gap-2.5 p-4 rounded-xl border border-border bg-card hover:border-brand/30 transition-all duration-200"
            >
              <div className="flex items-center justify-between">
                <Badge variant={isRule ? 'brand' : 'warning'} size="sm">
                  {isRule ? 'Candidate Rule' : 'Post-Mortem'}
                </Badge>
                {!isRule && <AlertTriangle className="size-3.5 text-warn" />}
              </div>
              <h4 className="text-xs font-bold text-foreground leading-snug">{item.title}</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.body}</p>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
