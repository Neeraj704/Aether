'use client'

import type { LayerContribution } from '@/mock/data'
import { LAYER_MAP } from '@/mock/layers'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatPct } from '@/lib/utils'

export function ContributionPanel({ contributions }: { contributions: LayerContribution[] }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Layer Attribution & Alpha Breakdown</CardTitle>
          <Badge variant="outline" className="text-[10px] text-muted-foreground font-mono">
            Attribution Score
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Measures how each DAG layer (Data, Indicators, Agents, Risk Gate, Slippage) contributed to net strategy return.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {contributions.map((c, i) => {
          const layerDef = LAYER_MAP[c.layer]
          const isNeutral = c.impact === 0
          return (
            <div
              key={i}
              className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-secondary/30 hover:bg-secondary/50 transition-colors gap-4"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="size-3 rounded-full shrink-0"
                  style={{ backgroundColor: layerDef?.hue ?? 'var(--brand)' }}
                />
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground truncate">{c.label}</span>
                    {layerDef && (
                      <span className="text-[10px] font-mono text-tertiary uppercase">
                        [{layerDef.roman}]
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed truncate">{c.detail}</p>
                </div>
              </div>

              <div className="flex flex-col items-end shrink-0">
                <span className="text-[10px] uppercase text-tertiary font-semibold tracking-wider">
                  Alpha Impact
                </span>
                <span
                  className={`text-sm font-bold font-mono ${
                    isNeutral ? 'text-muted-foreground' : c.impact > 0 ? 'text-profit' : 'text-loss'
                  }`}
                >
                  {isNeutral ? '0.0%' : `${c.impact > 0 ? '+' : ''}${c.impact.toFixed(1)}%`}
                </span>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
