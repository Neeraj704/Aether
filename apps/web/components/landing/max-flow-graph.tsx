'use client'

import { motion } from 'motion/react'
import { EASE_AETHER } from '@/lib/utils'

type Node = { id: string; label: string; sub: string; x: number; y: number; color: string }

const NODE_W = 108
const NODE_H = 40

const NODES: Node[] = [
  { id: 'ohlcv', label: 'OHLCV feed', sub: 'Data', x: 12, y: 22, color: '#2997ff' },
  { id: 'altdata', label: 'Alt data', sub: 'Data', x: 12, y: 128, color: '#2997ff' },
  { id: 'onchain', label: 'On-chain flow', sub: 'Data', x: 12, y: 234, color: '#2997ff' },

  { id: 'indicators', label: 'Indicators', sub: 'Features', x: 168, y: 58, color: '#00b8c4' },
  { id: 'sentiment-score', label: 'Sentiment score', sub: 'Features', x: 168, y: 188, color: '#00b8c4' },

  { id: 'technical', label: 'Technical analyst', sub: 'Agents', x: 324, y: 4, color: '#ff9f0a' },
  { id: 'fundamental', label: 'Fundamental analyst', sub: 'Agents', x: 324, y: 92, color: '#ff9f0a' },
  { id: 'sentiment-agent', label: 'Sentiment agent', sub: 'Agents', x: 324, y: 180, color: '#ff9f0a' },
  { id: 'macro', label: 'Macro agent', sub: 'Agents', x: 324, y: 268, color: '#ff9f0a' },

  { id: 'debate', label: 'Bull vs. bear debate', sub: 'Debate', x: 484, y: 136, color: '#7b61ff' },

  { id: 'sizing', label: 'Position sizing', sub: 'Risk', x: 640, y: 60, color: '#ff6ac1' },
  { id: 'risk-gate', label: 'Risk gate', sub: 'Risk', x: 640, y: 148, color: '#ff6ac1' },
  { id: 'allocator', label: 'Allocator', sub: 'Portfolio', x: 640, y: 236, color: '#ff6ac1' },

  { id: 'router', label: 'Smart router', sub: 'Execution', x: 796, y: 92, color: '#30d158' },
  { id: 'alerts', label: 'Broadcast alert', sub: 'Monitor', x: 796, y: 200, color: '#30d158' },
]

const EDGES: [string, string][] = [
  ['ohlcv', 'indicators'],
  ['ohlcv', 'sentiment-score'],
  ['altdata', 'sentiment-score'],
  ['onchain', 'sentiment-score'],
  ['indicators', 'technical'],
  ['indicators', 'fundamental'],
  ['sentiment-score', 'sentiment-agent'],
  ['sentiment-score', 'macro'],
  ['technical', 'debate'],
  ['fundamental', 'debate'],
  ['sentiment-agent', 'debate'],
  ['macro', 'debate'],
  ['debate', 'sizing'],
  ['debate', 'risk-gate'],
  ['debate', 'allocator'],
  ['sizing', 'router'],
  ['risk-gate', 'router'],
  ['allocator', 'alerts'],
]

const VIEW_W = 940
const VIEW_H = 300

const nodeById = (id: string) => NODES.find((n) => n.id === id)!
const anchorRight = (n: Node) => ({ x: n.x + NODE_W, y: n.y + NODE_H / 2 })
const anchorLeft = (n: Node) => ({ x: n.x, y: n.y + NODE_H / 2 })

function edgePath(fromId: string, toId: string) {
  const a = anchorRight(nodeById(fromId))
  const b = anchorLeft(nodeById(toId))
  const bend = Math.max(28, (b.x - a.x) * 0.4)
  return `M ${a.x} ${a.y} C ${a.x + bend} ${a.y}, ${b.x - bend} ${b.y}, ${b.x} ${b.y}`
}

/**
 * The "full pipeline" counterpart to HeroGraph  every layer represented at
 * once, spread across a wide canvas so the split panel reads as "this is
 * what it looks like maxed out." Static-ish (entrance only, no looping
 * pulses) since fifteen nodes animating forever would be noisy.
 */
export function MaxFlowGraph() {
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-[940px]">
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="w-full overflow-visible">
        <defs>
          <linearGradient id="max-edge-grad" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={VIEW_W} y2="0">
            <stop offset="0%" stopColor="#2997ff" />
            <stop offset="35%" stopColor="#00b8c4" />
            <stop offset="60%" stopColor="#7b61ff" />
            <stop offset="82%" stopColor="#ff6ac1" />
            <stop offset="100%" stopColor="#30d158" />
          </linearGradient>
        </defs>

        {EDGES.map(([from, to], i) => {
          const pathD = edgePath(from, to)
          const targetNode = nodeById(to)
          return (
            <g key={`${from}-${to}`}>
              <motion.path
                d={pathD}
                fill="none"
                stroke="url(#max-edge-grad)"
                strokeWidth={1.25}
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 0.55 }}
                transition={{ duration: 0.9, delay: 0.2 + i * 0.035, ease: EASE_AETHER }}
              />
              <circle r={2.4} fill={targetNode.color} opacity={0}>
                <animateMotion
                  dur="2.8s"
                  begin={`${1.0 + (i * 0.12) % 2}s`}
                  repeatCount="indefinite"
                  path={pathD}
                  keyPoints="0;1"
                  keyTimes="0;1"
                  calcMode="linear"
                />
                <animate
                  attributeName="opacity"
                  values="0;0.9;0.9;0"
                  keyTimes="0;0.12;0.82;1"
                  dur="2.8s"
                  begin={`${1.0 + (i * 0.12) % 2}s`}
                  repeatCount="indefinite"
                />
              </circle>
            </g>
          )
        })}

        {NODES.map((n, i) => (
          <motion.g
            key={n.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 + i * 0.045, ease: EASE_AETHER }}
          >
            <rect x={n.x} y={n.y} width={NODE_W} height={NODE_H} rx={10} className="fill-card" stroke="var(--glass-border)" strokeWidth={1} />
            <motion.rect
              x={n.x}
              y={n.y}
              width={NODE_W}
              height={NODE_H}
              rx={10}
              fill="none"
              stroke={n.color}
              strokeWidth={1}
              animate={{ opacity: [0.15, 0.55, 0.15] }}
              transition={{
                duration: 3,
                delay: (i * 0.18) % 2,
                repeat: Number.POSITIVE_INFINITY,
                ease: 'easeInOut',
              }}
            />
            <circle cx={n.x + 11} cy={n.y + 13} r={2.6} fill={n.color} />
            <text
              x={n.x + 19}
              y={n.y + 15.5}
              className="fill-current text-[6.5px] font-semibold uppercase tracking-[0.08em]"
              style={{ fill: n.color }}
            >
              {n.sub}
            </text>
            <text x={n.x + 10} y={n.y + 29} className="text-[8.5px] font-medium" style={{ fill: 'var(--foreground)' }}>
              {n.label}
            </text>
          </motion.g>
        ))}
      </svg>
    </div>
  )
}
