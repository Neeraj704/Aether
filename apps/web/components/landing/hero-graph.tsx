'use client'

import { motion } from 'motion/react'
import { EASE_AETHER } from '@/lib/utils'

const NODES = [
  { id: 'data', label: 'OHLCV feed', sub: 'Data', x: 20, y: 34, color: '#2997ff' },
  { id: 'feat', label: 'Indicators', sub: 'Features', x: 152, y: 14, color: '#00b8c4' },
  { id: 'agent', label: 'Technical analyst', sub: 'Agents', x: 152, y: 108, color: '#ff9f0a' },
  { id: 'risk', label: 'Risk gate', sub: 'Risk', x: 292, y: 60, color: '#ff6ac1' },
  { id: 'exec', label: 'Paper executor', sub: 'Execution', x: 424, y: 60, color: '#30d158' },
]

const EDGES = [
  { from: 'data', to: 'feat', d: 'M116 46 C136 46 132 26 148 26' },
  { from: 'data', to: 'agent', d: 'M116 46 C136 46 132 120 148 120' },
  { from: 'feat', to: 'risk', d: 'M248 26 C268 26 272 72 288 72' },
  { from: 'agent', to: 'risk', d: 'M248 120 C268 120 272 72 288 72' },
  { from: 'risk', to: 'exec', d: 'M388 72 C404 72 404 68 420 68' },
]

const NODE_W = 96
const NODE_H = 44

/** Pulse tint follows the edge's destination node, so signal reads directional. */
const PULSE_COLORS = ['#00b8c4', '#ff9f0a', '#ff6ac1', '#ff6ac1', '#30d158']
const pulseColor = (i: number) => PULSE_COLORS[i] ?? '#2997ff'

/**
 * The hero visual: nodes settle in, connectors draw themselves via
 * stroke-dashoffset, then a signal pulse loops along the graph. Decorative, so
 * it is hidden from assistive tech.
 */
export function HeroGraph() {
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-[620px]">
      <svg viewBox="0 0 540 166" className="w-full overflow-visible">
        <defs>
          {/* userSpaceOnUse with fixed viewBox coordinates  objectBoundingBox
              degenerates to a zero-height matrix on a perfectly horizontal
              path (like risk -> exec) and silently drops the stroke in some
              browsers, so we anchor the gradient to the SVG canvas instead. */}
          <linearGradient id="edge-grad" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="540" y2="0">
            <stop offset="0%" stopColor="#2997ff" />
            <stop offset="55%" stopColor="#7b61ff" />
            <stop offset="100%" stopColor="#ff6ac1" />
          </linearGradient>
        </defs>

        {EDGES.map((e, i) => (
          <g key={`${e.from}-${e.to}`}>
            <motion.path
              d={e.d}
              fill="none"
              stroke="url(#edge-grad)"
              strokeWidth={1.5}
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.75 }}
              transition={{ duration: 1.1, delay: 0.5 + i * 0.14, ease: EASE_AETHER }}
            />
            {/* SMIL drives the pulse: it follows the exact same path string as
                the connector, so the dot can never drift off the line. */}
            <circle r={2.6} fill={pulseColor(i)} opacity={0}>
              <animateMotion
                dur="2.6s"
                begin={`${1.8 + i * 0.2}s`}
                repeatCount="indefinite"
                path={e.d}
                keyPoints="0;1"
                keyTimes="0;1"
                calcMode="linear"
              />
              <animate
                attributeName="opacity"
                values="0;1;1;0"
                keyTimes="0;0.12;0.82;1"
                dur="2.6s"
                begin={`${1.8 + i * 0.2}s`}
                repeatCount="indefinite"
              />
            </circle>
          </g>
        ))}

        {NODES.map((n, i) => (
          <motion.g
            key={n.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 + i * 0.1, ease: EASE_AETHER }}
          >
            <rect
              x={n.x}
              y={n.y}
              width={NODE_W}
              height={NODE_H}
              rx={11}
              className="fill-card"
              stroke="var(--glass-border)"
              strokeWidth={1}
            />
            <motion.rect
              x={n.x}
              y={n.y}
              width={NODE_W}
              height={NODE_H}
              rx={11}
              fill="none"
              stroke={n.color}
              strokeWidth={1}
              animate={{ opacity: [0.15, 0.5, 0.15] }}
              transition={{
                duration: 3.2,
                delay: i * 0.4,
                repeat: Number.POSITIVE_INFINITY,
                ease: 'easeInOut',
              }}
            />
            <circle cx={n.x + 11} cy={n.y + 14} r={3} fill={n.color} />
            <text
              x={n.x + 20}
              y={n.y + 17}
              className="fill-current text-[7px] font-semibold uppercase tracking-[0.08em]"
              style={{ fill: n.color }}
            >
              {n.sub}
            </text>
            <text x={n.x + 11} y={n.y + 32} className="text-[9px] font-medium" style={{ fill: 'var(--foreground)' }}>
              {n.label}
            </text>
          </motion.g>
        ))}
      </svg>
    </div>
  )
}
