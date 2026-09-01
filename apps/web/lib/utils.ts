import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Apple-style easing used across both motion languages. */
export const EASE_AETHER = [0.16, 1, 0.3, 1] as const
export const EASE_CSS = 'cubic-bezier(0.16, 1, 0.3, 1)'

export function delay(ms = 600) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

/** Random latency in a realistic band, so skeletons are actually visible. */
export function fakeLatency(min = 400, max = 900) {
  return delay(min + Math.random() * (max - min))
}

export function formatINR(value: number, opts: { compact?: boolean; signed?: boolean } = {}) {
  const { compact, signed } = opts
  const abs = Math.abs(value)
  const sign = signed && value > 0 ? '+' : value < 0 ? '-' : ''

  if (compact) {
    if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(2)}Cr`
    if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(2)}L`
    if (abs >= 1_000) return `${sign}₹${(abs / 1_000).toFixed(1)}K`
  }

  return `${sign}₹${abs.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

export function formatPct(value: number, digits = 2) {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(digits)}%`
}

export function formatNumber(value: number) {
  return value.toLocaleString('en-IN')
}

/** 1240 -> "1.2k", 2_400_000 -> "2.4M". Used for fork/like counts. */
export function formatCompact(value: number) {
  if (Math.abs(value) < 1000) return String(value)
  if (Math.abs(value) < 1_000_000) {
    const n = value / 1000
    return `${n % 1 === 0 ? n : n.toFixed(1)}k`
  }
  const n = value / 1_000_000
  return `${n % 1 === 0 ? n : n.toFixed(1)}M`
}

export function formatDate(iso: string, opts: { withTime?: boolean } = {}) {
  const d = new Date(iso)
  const date = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  if (!opts.withTime) return date
  return `${date}, ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
}

export function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

/** Deterministic seeded PRNG (mulberry32) so a backtest config always yields the same run. */
export function seededRandom(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hashString(str: string) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function slugId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}

/** Simple subsequence fuzzy match with a score, for the command palette. */
export function fuzzyScore(query: string, target: string): number {
  if (!query) return 1
  const q = query.toLowerCase()
  const t = target.toLowerCase()
  if (t.includes(q)) return 100 - t.indexOf(q)

  let qi = 0
  let score = 0
  let streak = 0
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      qi++
      streak++
      score += streak
    } else {
      streak = 0
    }
  }
  return qi === q.length ? score : 0
}
