import { seededRandom, hashString } from '@/lib/utils'
import type { LayerId, PlanTier } from './layers'

/* ------------------------------------------------------------------ */
/* Graph types                                                         */
/* ------------------------------------------------------------------ */

export interface BotNode {
  id: string
  componentId: string
  x: number
  y: number
  enabled: boolean
  config: Record<string, unknown>
  /** Missing required fields make the node render amber. */
  needsConfig?: boolean
}

export interface BotEdge {
  id: string
  source: string
  target: string
}

/** Sticky note or pinned comment placed on the builder canvas. */
export interface CanvasNote {
  id: string
  kind: 'note' | 'comment'
  x: number
  y: number
  text: string
  color: 'amber' | 'blue' | 'green' | 'pink' | 'slate'
  createdAt: string
  resolved?: boolean
}

/** Labelled section drawn behind the nodes to group part of a strategy. */
export interface CanvasFrame {
  id: string
  x: number
  y: number
  w: number
  h: number
  label: string
  hue: string
}

/**
 * The single canonical shape for "a strategy graph as it exists on a canvas."
 * Every entity that can be dragged onto, saved from, or restored onto the
 * Builder canvas stores exactly this shape — not a partial or optional
 * subset of it. Bot, BotVersion, Preset, MyPreset, and PublishedPreset all
 * embed one of these rather than duplicating nodes/edges/notes/frames as
 * separate optional fields.
 */
export interface BotGraph {
  nodes: BotNode[]
  edges: BotEdge[]
  notes: CanvasNote[]
  frames: CanvasFrame[]
  /**
   * Bumped whenever the shape of BotNode/BotEdge/CanvasNote/CanvasFrame
   * changes in a way that requires migration. Current value: 2.
   * (1 = pre-Phase-7 shape with y-as-lane-index legacy fixtures and no
   * notes/frames guarantee. 2 = this phase: pixel-space y, notes/frames
   * always present as arrays, never undefined.)
   */
  schemaVersion: number
}

export const CURRENT_GRAPH_SCHEMA_VERSION = 2

/** An empty, valid graph — use this instead of hand-rolling `{ nodes: [], edges: [], ... }` anywhere. */
export function emptyGraph(): BotGraph {
  return { nodes: [], edges: [], notes: [], frames: [], schemaVersion: CURRENT_GRAPH_SCHEMA_VERSION }
}

export type BotStatus = 'draft' | 'backtested' | 'live' | 'paused' | 'error'

export interface BotVersion {
  id: string
  label: string
  createdAt: string
  note: string
  nodeCount: number
  graph: BotGraph
}

export interface Bot {
  id: string
  name: string
  description: string
  status: BotStatus
  updatedAt: string
  createdAt: string
  tags: string[]
  graph: BotGraph
  headlineMetric: { label: string; value: string; positive: boolean }
  visibility: 'private' | 'unlisted' | 'public'
  archived?: boolean
  versions: BotVersion[]
  runIds: string[]
}

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

export interface MockUser {
  id: string
  name: string
  email: string
  initials: string
  bio: string
  publicProfile: boolean
  joinedAt: string
  plan: PlanTier
  /** Simulation credits; each backtest run spends some. */
  credits: number
  /** Ids of premium components the user has unlocked. */
  unlockedComponents: string[]
}

export const CURRENT_USER: MockUser = {
  id: 'u-1',
  name: 'Neeraj Sharma',
  email: 'arjun@aether.dev',
  initials: 'AM',
  bio: 'Systematic trader. Building slow, boring bots that survive.',
  publicProfile: true,
  joinedAt: '2025-11-04T09:12:00.000Z',
  plan: 'pro',
  credits: 240,
  unlockedComponents: ['regime-filter', 'kelly-sizing', 'vol-target'],
}

/* ------------------------------------------------------------------ */
/* Bot graphs                                                          */
/* ------------------------------------------------------------------ */

/** Node positions are laid out per layer band; x spreads siblings horizontally. */
function n(id: string, componentId: string, x: number, y: number, enabled = true, needsConfig = false): BotNode {
  return { id, componentId, x, y, enabled, config: {}, needsConfig }
}

function e(source: string, target: string): BotEdge {
  return { id: `e-${source}-${target}`, source, target }
}

const momentumNodes: BotNode[] = [
  n('n1', 'ohlcv-feed', 80, 0),
  n('n2', 'macro-calendar', 420, 0),
  n('n3', 'ta-indicators', 80, 1),
  n('n4', 'normalizer', 420, 1),
  n('n5', 'technical-agent', 80, 2),
  n('n6', 'gbdt-forecast', 80, 3),
  n('n7', 'vol-forecast', 420, 3),
  n('n8', 'calibrator', 80, 6),
  n('n9', 'confidence-gate', 420, 6),
  n('n10', 'position-cap', 80, 7),
  n('n11', 'risk-gate', 420, 7),
  n('n12', 'drawdown-brake', 760, 7),
  n('n13', 'paper-executor', 80, 8),
  n('n14', 'pnl-tracker', 80, 9),
  n('n15', 'decision-log', 420, 9),
]

const momentumEdges: BotEdge[] = [
  e('n1', 'n3'),
  e('n3', 'n4'),
  e('n4', 'n5'),
  e('n4', 'n6'),
  e('n4', 'n7'),
  e('n5', 'n8'),
  e('n6', 'n8'),
  e('n7', 'n9'),
  e('n8', 'n9'),
  e('n9', 'n10'),
  e('n9', 'n11'),
  e('n2', 'n11'),
  e('n10', 'n11'),
  e('n11', 'n13'),
  e('n12', 'n11'),
  e('n13', 'n14'),
  e('n13', 'n15'),
]

const sentimentNodes: BotNode[] = [
  n('s1', 'news-stream', 80, 0),
  n('s2', 'ohlcv-feed', 420, 0),
  n('s3', 'social-sentiment', 760, 0, false),
  n('s4', 'nlp-embedder', 80, 1),
  n('s5', 'ta-indicators', 420, 1),
  n('s6', 'sentiment-agent', 80, 2),
  n('s7', 'technical-agent', 420, 2),
  n('s8', 'bull-bear', 80, 5),
  n('s9', 'moderator', 420, 5),
  n('s10', 'agreement-score', 80, 6),
  n('s11', 'risk-gate', 80, 7),
  n('s12', 'event-blackout', 420, 7),
  n('s13', 'paper-executor', 80, 8),
  n('s14', 'pnl-tracker', 80, 9),
  n('s15', 'post-mortem', 80, 10),
  n('s16', 'outcome-store', 420, 11),
]

const sentimentEdges: BotEdge[] = [
  e('s1', 's4'),
  e('s2', 's5'),
  e('s4', 's6'),
  e('s5', 's7'),
  e('s6', 's8'),
  e('s7', 's8'),
  e('s8', 's9'),
  e('s9', 's10'),
  e('s10', 's11'),
  e('s12', 's11'),
  e('s11', 's13'),
  e('s13', 's14'),
  e('s14', 's15'),
  e('s15', 's16'),
]

const meanRevNodes: BotNode[] = [
  n('m1', 'ohlcv-feed', 80, 0),
  n('m2', 'ta-indicators', 80, 1),
  n('m3', 'regime-tagger', 420, 1),
  n('m4', 'technical-agent', 80, 2),
  n('m5', 'meta-labeler', 80, 3, true, true),
  n('m6', 'confidence-gate', 80, 6),
  n('m7', 'risk-gate', 80, 7),
  n('m8', 'daily-loss-limit', 420, 7),
  n('m9', 'limit-ladder', 80, 8),
  n('m10', 'pnl-tracker', 80, 9),
]

const meanRevEdges: BotEdge[] = [
  e('m1', 'm2'),
  e('m2', 'm3'),
  e('m3', 'm4'),
  e('m4', 'm5'),
  e('m5', 'm6'),
  e('m6', 'm7'),
  e('m8', 'm7'),
  e('m7', 'm9'),
  e('m9', 'm10'),
]

const optionsNodes: BotNode[] = [
  n('o1', 'options-chain', 80, 0),
  n('o2', 'ohlcv-feed', 420, 0),
  n('o3', 'microstructure', 80, 1),
  n('o4', 'cross-asset', 420, 1),
  n('o5', 'flow-agent', 80, 2),
  n('o6', 'event-agent', 420, 2),
  n('o7', 'vol-forecast', 80, 3),
  n('o8', 'uncertainty-bands', 80, 6),
  n('o9', 'var-monitor', 80, 7),
  n('o10', 'position-cap', 420, 7),
  n('o11', 'risk-gate', 760, 7),
  n('o12', 'twap-vwap', 80, 8),
  n('o13', 'pnl-tracker', 80, 9),
  n('o14', 'attribution', 420, 9),
]

const optionsEdges: BotEdge[] = [
  e('o1', 'o3'),
  e('o2', 'o4'),
  e('o3', 'o5'),
  e('o4', 'o6'),
  e('o4', 'o7'),
  e('o5', 'o8'),
  e('o6', 'o8'),
  e('o7', 'o8'),
  e('o8', 'o11'),
  e('o9', 'o11'),
  e('o10', 'o11'),
  e('o11', 'o12'),
  e('o12', 'o13'),
  e('o13', 'o14'),
]

const brokenNodes: BotNode[] = [
  n('b1', 'ohlcv-feed', 80, 0),
  n('b2', 'ta-indicators', 80, 1),
  n('b3', 'market-order', 80, 8),
  n('b4', 'pnl-tracker', 80, 9),
]

const brokenEdges: BotEdge[] = [e('b1', 'b2'), e('b2', 'b3'), e('b3', 'b4')]

const momentumNotes: CanvasNote[] = [
  {
    id: 'mn-1',
    kind: 'note',
    x: 420,
    y: 120,
    text: 'Scale position size by volatility forecast and enforce hard drawdown brake.',
    color: 'amber',
    createdAt: '2026-06-15T10:00:00.000Z',
  },
]

const momentumFrames: CanvasFrame[] = [
  {
    id: 'mf-1',
    x: 60,
    y: 40,
    w: 640,
    h: 380,
    label: 'Signal & Forecasting Engine',
    hue: 'rgba(41, 151, 255, 0.08)',
  },
]

export const momentumGraph: BotGraph = {
  nodes: momentumNodes,
  edges: momentumEdges,
  notes: momentumNotes,
  frames: momentumFrames,
  schemaVersion: CURRENT_GRAPH_SCHEMA_VERSION,
}

export const sentimentGraph: BotGraph = {
  nodes: sentimentNodes,
  edges: sentimentEdges,
  notes: [],
  frames: [],
  schemaVersion: CURRENT_GRAPH_SCHEMA_VERSION,
}

export const meanRevGraph: BotGraph = {
  nodes: meanRevNodes,
  edges: meanRevEdges,
  notes: [],
  frames: [],
  schemaVersion: CURRENT_GRAPH_SCHEMA_VERSION,
}

export const optionsGraph: BotGraph = {
  nodes: optionsNodes,
  edges: optionsEdges,
  notes: [],
  frames: [],
  schemaVersion: CURRENT_GRAPH_SCHEMA_VERSION,
}

export const brokenGraph: BotGraph = {
  nodes: brokenNodes,
  edges: brokenEdges,
  notes: [],
  frames: [],
  schemaVersion: CURRENT_GRAPH_SCHEMA_VERSION,
}

export const BOTS: Bot[] = [
  {
    id: 'bot-nifty-momentum',
    name: 'Nifty Momentum v4',
    description:
      'Trend-following on Nifty futures with a volatility-scaled position size and a hard drawdown brake. My most-tested bot.',
    status: 'live',
    updatedAt: '2026-08-23T14:32:00.000Z',
    createdAt: '2026-02-11T10:00:00.000Z',
    tags: ['momentum', 'index', 'intraday'],
    graph: momentumGraph,
    headlineMetric: { label: 'Return, 90d', value: '+18.4%', positive: true },
    visibility: 'public',
    versions: [
      { id: 'v-7', label: 'v7', createdAt: '2026-08-23T14:32:00.000Z', note: 'Tightened drawdown brake to 15%', nodeCount: 15, graph: momentumGraph },
      { id: 'v-6', label: 'v6', createdAt: '2026-08-14T09:10:00.000Z', note: 'Added volatility forecast into sizing', nodeCount: 15, graph: momentumGraph },
      { id: 'v-5', label: 'v5', createdAt: '2026-07-30T16:45:00.000Z', note: 'Swapped ensemble for single GBDT', nodeCount: 13, graph: { ...momentumGraph, nodes: momentumNodes.slice(0, 13) } },
      { id: 'v-4', label: 'v4', createdAt: '2026-06-21T11:20:00.000Z', note: 'Calibration layer added', nodeCount: 12, graph: { ...momentumGraph, nodes: momentumNodes.slice(0, 12) } },
    ],
    runIds: ['run-1041', 'run-1032', 'run-1019'],
  },
  {
    id: 'bot-news-reversal',
    name: 'Headline Reversal',
    description:
      'Fades overreactions to single-stock news when technicals disagree with the narrative. Runs the debate layer on every candidate.',
    status: 'backtested',
    updatedAt: '2026-08-21T08:05:00.000Z',
    createdAt: '2026-04-02T13:30:00.000Z',
    tags: ['news', 'mean-reversion', 'equities'],
    graph: sentimentGraph,
    headlineMetric: { label: 'Sharpe', value: '1.42', positive: true },
    visibility: 'unlisted',
    versions: [
      { id: 'v-3', label: 'v3', createdAt: '2026-08-21T08:05:00.000Z', note: 'Disabled social firehose  too noisy', nodeCount: 16, graph: sentimentGraph },
      { id: 'v-2', label: 'v2', createdAt: '2026-07-11T15:00:00.000Z', note: 'Added event blackout windows', nodeCount: 16, graph: sentimentGraph },
      { id: 'v-1', label: 'v1', createdAt: '2026-04-02T13:30:00.000Z', note: 'Initial build', nodeCount: 12, graph: { ...sentimentGraph, nodes: sentimentNodes.slice(0, 12) } },
    ],
    runIds: ['run-1038', 'run-1021'],
  },
  {
    id: 'bot-bank-meanrev',
    name: 'Bank Nifty Mean Reversion',
    description: 'Intraday fade of stretched moves in Bank Nifty, gated by regime so it stands down in strong trends.',
    status: 'paused',
    updatedAt: '2026-08-19T17:44:00.000Z',
    createdAt: '2026-05-18T10:15:00.000Z',
    tags: ['mean-reversion', 'index'],
    graph: meanRevGraph,
    headlineMetric: { label: 'Return, 90d', value: '-2.1%', positive: false },
    visibility: 'private',
    versions: [
      { id: 'v-2', label: 'v2', createdAt: '2026-08-19T17:44:00.000Z', note: 'Added meta labeler (needs config)', nodeCount: 10, graph: meanRevGraph },
      { id: 'v-1', label: 'v1', createdAt: '2026-05-18T10:15:00.000Z', note: 'Initial build', nodeCount: 9, graph: { ...meanRevGraph, nodes: meanRevNodes.slice(0, 9) } },
    ],
    runIds: ['run-1029'],
  },
  {
    id: 'bot-vol-harvest',
    name: 'Expiry Vol Harvest',
    description: 'Sells expiry-week volatility with a VaR monitor and event blackouts. Highest capital requirement of my bots.',
    status: 'backtested',
    updatedAt: '2026-08-12T12:00:00.000Z',
    createdAt: '2026-03-07T09:00:00.000Z',
    tags: ['options', 'volatility', 'expiry'],
    graph: optionsGraph,
    headlineMetric: { label: 'Return, 90d', value: '+11.7%', positive: true },
    visibility: 'private',
    versions: [
      { id: 'v-4', label: 'v4', createdAt: '2026-08-12T12:00:00.000Z', note: 'VWAP slicing on exits', nodeCount: 14, graph: optionsGraph },
      { id: 'v-3', label: 'v3', createdAt: '2026-06-28T14:20:00.000Z', note: 'Added VaR monitor', nodeCount: 13, graph: { ...optionsGraph, nodes: optionsNodes.slice(0, 13) } },
    ],
    runIds: ['run-1035'],
  },
  {
    id: 'bot-smallcap-scan',
    name: 'Small Cap Scanner',
    description: 'Work in progress. Screens small caps on fundamentals then waits for a technical trigger. Not wired up properly yet.',
    status: 'error',
    updatedAt: '2026-08-08T19:22:00.000Z',
    createdAt: '2026-08-08T19:00:00.000Z',
    tags: ['equities', 'wip'],
    graph: brokenGraph,
    headlineMetric: { label: 'Never run', value: '', positive: false },
    visibility: 'private',
    versions: [{ id: 'v-1', label: 'v1', createdAt: '2026-08-08T19:22:00.000Z', note: 'Initial sketch', nodeCount: 4, graph: brokenGraph }],
    runIds: [],
  },
]

/* ------------------------------------------------------------------ */
/* Backtest runs                                                       */
/* ------------------------------------------------------------------ */

export interface EquityPoint {
  date: string
  equity: number
  benchmark: number
  drawdown: number
}

export interface TradeExecutionStep {
  stepIndex: number
  layer: LayerId
  nodeId: string
  nodeName: string
  status: 'completed' | 'skipped' | 'vetoed'
  input: Record<string, any>
  computation: string
  output: Record<string, any>
}

export interface TradeExecutionFlow {
  tradeId: string
  symbol: string
  side: 'long' | 'short'
  summary: {
    entryTime: string
    exitTime: string
    entryPrice: number
    exitPrice: number
    size: number
    grossPnl: number
    netPnl: number
    pnlPct: number
    exitReason: string
    feesPaid: number
    confidence: number
  }
  steps: TradeExecutionStep[]
}

export interface Trade {
  id: string
  symbol: string
  side: 'long' | 'short'
  entryTime: string
  exitTime: string
  size: number
  pnl: number
  pnlPct: number
  triggerNode: string
  confidence: number
  executionFlow?: TradeExecutionFlow
}

export interface BacktestMetrics {
  totalReturn: number
  winRate: number
  maxDrawdown: number
  sharpe: number
  trades: number
  avgR: number
  profitFactor: number
  exposure: number
}

export interface LayerContribution {
  layer: LayerId
  label: string
  detail: string
  impact: number
  positive: boolean
}

export interface BacktestRun {
  id: string
  botId: string
  botName: string
  createdAt: string
  config: {
    from: string
    to: string
    symbols: string
    capital: number
    fees: number
    slippage: number
    seed: number
    type: 'historical' | 'walk-forward' | 'monte-carlo' | 'paper' | 'ab'
  }
  metrics: BacktestMetrics
  equity: EquityPoint[]
  trades: Trade[]
  contributions: LayerContribution[]
  insights: { title: string; body: string; kind: 'rule' | 'postmortem' }[]
}

const SYMBOLS = ['NIFTY', 'BANKNIFTY', 'RELIANCE', 'HDFCBANK', 'INFY', 'TCS', 'ICICIBANK', 'ITC']
const TRIGGER_NODES = [
  'Technical Analyst',
  'Gradient Boosting Forecast',
  'Sentiment Analyst',
  'Moderator',
  'Meta Labeler',
  'Flow Analyst',
]

/**
 * Generates a plausible, bounded equity curve and trade log from a seed, so
 * repeated runs of the same config match but different configs feel alive.
 */
export function generateBacktest(params: {
  id: string
  botId: string
  botName: string
  from: string
  to: string
  symbols: string
  capital: number
  fees: number
  slippage: number
  seed: number
  type: BacktestRun['config']['type']
  bias?: number
  createdAt?: string
}): BacktestRun {
  const rand = seededRandom(params.seed + hashString(params.botId))
  const bias = params.bias ?? 0.00035 + rand() * 0.0006

  const start = new Date(params.from)
  const end = new Date(params.to)
  const days = Math.max(30, Math.round((end.getTime() - start.getTime()) / 86400000))
  const steps = Math.min(days, 260)

  const vol = 0.006 + rand() * 0.008
  let equity = params.capital
  let benchmark = params.capital
  let peak = params.capital
  let maxDD = 0
  const equitySeries: EquityPoint[] = []

  for (let i = 0; i <= steps; i++) {
    const d = new Date(start.getTime() + (i * (end.getTime() - start.getTime())) / steps)
    // Box-Muller for normal-ish shocks
    const u1 = Math.max(rand(), 1e-9)
    const u2 = rand()
    const shock = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)

    if (i > 0) {
      equity *= 1 + bias + shock * vol
      benchmark *= 1 + 0.00018 + shock * vol * 0.72
    }
    peak = Math.max(peak, equity)
    const dd = ((equity - peak) / peak) * 100
    maxDD = Math.min(maxDD, dd)

    equitySeries.push({
      date: d.toISOString().slice(0, 10),
      equity: Math.round(equity),
      benchmark: Math.round(benchmark),
      drawdown: Number(dd.toFixed(2)),
    })
  }

  const totalReturn = ((equity - params.capital) / params.capital) * 100
  const tradeCount = 34 + Math.floor(rand() * 120)
  const winRate = 41 + rand() * 24

  const trades: Trade[] = Array.from({ length: Math.min(tradeCount, 60) }, (_, i) => {
    const win = rand() * 100 < winRate
    const magnitude = params.capital * (0.002 + rand() * 0.02)
    const pnl = Math.round(win ? magnitude : -magnitude * (0.55 + rand() * 0.5))
    const entry = new Date(start.getTime() + rand() * (end.getTime() - start.getTime()))
    const holdMs = (30 + rand() * 900) * 60000
    const exit = new Date(entry.getTime() + holdMs)
    const size = Math.round(params.capital * (0.03 + rand() * 0.12))
    const side = (rand() > 0.38 ? 'long' : 'short') as Trade['side']
    const symbol = SYMBOLS[Math.floor(rand() * SYMBOLS.length)]
    const confidence = Number((0.55 + rand() * 0.40).toFixed(2))
    const basePrice = symbol.includes('NIFTY') ? 24500 : symbol === 'RELIANCE' ? 2950 : 1650
    const entryPrice = Number((basePrice * (1 + (rand() - 0.5) * 0.04)).toFixed(2))
    const priceShift = (pnl / size) * entryPrice
    const exitPrice = Number((entryPrice + (side === 'long' ? priceShift : -priceShift)).toFixed(2))
    const rsiVal = side === 'long' ? Number((22 + rand() * 7).toFixed(1)) : Number((72 + rand() * 8).toFixed(1))
    const exitReason = win ? 'Target Profit & Momentum Deceleration' : 'Stop Loss Trigger Hit'

    const tradeId = `t-${params.id}-${i}`

    const executionFlow: TradeExecutionFlow = {
      tradeId,
      symbol,
      side,
      summary: {
        entryTime: entry.toISOString(),
        exitTime: exit.toISOString(),
        entryPrice,
        exitPrice,
        size,
        grossPnl: pnl + Math.round(size * 0.001),
        netPnl: pnl,
        pnlPct: Number(((pnl / size) * 100).toFixed(2)),
        exitReason,
        feesPaid: Math.round(size * 0.001),
        confidence,
      },
      steps: [
        {
          stepIndex: 1,
          layer: 'data',
          nodeId: 'ohlcv-feed',
          nodeName: 'OHLCV Price Feed',
          status: 'completed',
          input: {
            symbol,
            resolution: '15m',
            timestamp: entry.toISOString(),
            dataset: 'Binance Historical 15m Verified',
          },
          computation: `Ingested latest 15m candle with 200-bar memory window for ${symbol}. Checked volume & high-low bounds.`,
          output: {
            open: entryPrice,
            high: Number((entryPrice * 1.008).toFixed(2)),
            low: Number((entryPrice * 0.994).toFixed(2)),
            close: entryPrice,
            volume: Math.round(1500 + rand() * 8000),
          },
        },
        {
          stepIndex: 2,
          layer: 'features',
          nodeId: 'ta-indicators',
          nodeName: 'Technical Indicators',
          status: 'completed',
          input: {
            priceClose: entryPrice,
            rsiPeriod: 14,
            macdFast: 20,
            macdSlow: 50,
          },
          computation: `Calculated rolling momentum and moving averages. Triggered ${side === 'long' ? 'oversold' : 'overbought'} condition at RSI ${rsiVal}.`,
          output: {
            rsi: rsiVal,
            emaFast: Number((entryPrice * (side === 'long' ? 1.002 : 0.998)).toFixed(2)),
            emaSlow: Number((entryPrice * (side === 'long' ? 0.996 : 1.004)).toFixed(2)),
            macd: Number(((rand() - 0.4) * 15).toFixed(2)),
            trend: side === 'long' ? 'Bullish Alignment (Fast EMA > Slow EMA)' : 'Bearish Alignment (Fast EMA < Slow EMA)',
          },
        },
        {
          stepIndex: 3,
          layer: 'agents',
          nodeId: 'technical-agent',
          nodeName: 'Technical Analyst',
          status: 'completed',
          input: {
            features: { rsi: rsiVal, close: entryPrice },
            model: { providerId: 'openai', modelId: 'gpt-5-mini', temperature: 0.3 },
            systemPrompt: 'You are a disciplined technical analyst. Given the feature vector, form a directional view based on price structure and momentum.',
          },
          computation: `Evaluated momentum criteria: ${side === 'long' ? 'Oversold bounce' : 'Overbought reversal'} detected. Confidence scored at ${Math.round(confidence * 100)}% via conviction formula.`,
          output: {
            direction: side,
            confidence,
            confidencePct: `${Math.round(confidence * 100)}%`,
            rationale: `${side === 'long' ? 'Oversold bounce' : 'Overbought reversal'} on RSI (${rsiVal}) with directional trend consensus.`,
          },
        },
        {
          stepIndex: 4,
          layer: 'risk',
          nodeId: 'risk-gate',
          nodeName: 'Risk Gate',
          status: 'completed',
          input: {
            signal: side,
            confidence,
            portfolioCapital: params.capital,
            maxPositionCapPct: 20,
            stopLossPct: 2.5,
          },
          computation: `Passed minimum confidence gate (threshold 65%). Sized position to ₹${size.toLocaleString('en-IN')} with 2.5% stop-loss guard.`,
          output: {
            approved: true,
            sizedCapital: size,
            stopPrice: Number((entryPrice * (side === 'long' ? 0.975 : 1.025)).toFixed(2)),
            reason: `Approved: Conviction (${Math.round(confidence * 100)}%) exceeded risk requirement.`,
          },
        },
        {
          stepIndex: 5,
          layer: 'execution',
          nodeId: 'paper-executor',
          nodeName: 'Paper Executor',
          status: 'completed',
          input: {
            orderSide: side,
            orderSize: size,
            slippageBps: params.slippage,
            feesBps: params.fees,
          },
          computation: `Filled entry @ ₹${entryPrice.toLocaleString('en-IN')}. Exited @ ₹${exitPrice.toLocaleString('en-IN')} on: ${exitReason}. Realized P&L: ₹${pnl.toLocaleString('en-IN')} (${((pnl / size) * 100).toFixed(2)}%).`,
          output: {
            entryPrice,
            exitPrice,
            realizedPnl: pnl,
            pnlPct: Number(((pnl / size) * 100).toFixed(2)),
            feesPaid: Math.round(size * 0.001),
            exitReason,
          },
        },
      ],
    }

    return {
      id: tradeId,
      symbol,
      side,
      entryTime: entry.toISOString(),
      exitTime: exit.toISOString(),
      size,
      pnl,
      pnlPct: Number(((pnl / size) * 100).toFixed(2)),
      triggerNode: 'Technical Analyst',
      confidence,
      executionFlow,
    }
  }).sort((a, b) => +new Date(b.entryTime) - +new Date(a.entryTime))

  const blocked = 6 + Math.floor(rand() * 20)
  const avoided = Math.round(params.capital * (0.01 + rand() * 0.05))

  const contributions: LayerContribution[] = [
    {
      layer: 'risk',
      label: 'Risk Gate',
      detail: `Blocked ${blocked} trades. Estimated avoided loss ₹${avoided.toLocaleString('en-IN')}.`,
      impact: avoided,
      positive: true,
    },
    {
      layer: 'confidence',
      label: 'Confidence Gate',
      detail: `Filtered ${Math.floor(blocked * 1.8)} low-conviction signals below the 0.60 threshold.`,
      impact: Math.round(avoided * 0.42),
      positive: true,
    },
    {
      layer: 'ml',
      label: 'Gradient Boosting Forecast',
      detail: `Drove ${Math.round(tradeCount * 0.46)} entries at ${(winRate + 3).toFixed(0)}% hit rate.`,
      impact: Math.round(params.capital * (totalReturn / 100) * 0.5),
      positive: totalReturn > 0,
    },
    {
      layer: 'execution',
      label: 'Paper Executor',
      detail: `Slippage and fees cost ₹${Math.round(params.capital * 0.004).toLocaleString('en-IN')} across all fills.`,
      impact: -Math.round(params.capital * 0.004),
      positive: false,
    },
    {
      layer: 'agents',
      label: 'Technical Analyst',
      detail: `Agreed with the model on ${(62 + rand() * 20).toFixed(0)}% of candidates.`,
      impact: Math.round(params.capital * (totalReturn / 100) * 0.22),
      positive: totalReturn > 0,
    },
  ]

  const insights: BacktestRun['insights'] = [
    {
      kind: 'rule',
      title: 'Candidate rule: skip entries in the last 25 minutes',
      body: `Trades opened after 15:05 lost money ${(58 + rand() * 15).toFixed(0)}% of the time across this window. Consider a time-of-day filter in the risk layer.`,
    },
    {
      kind: 'rule',
      title: 'Candidate rule: require agreement above 0.7 in high-vol regimes',
      body: 'In the top volatility quartile, signals below 0.7 agreement were roughly coin flips after costs.',
    },
    {
      kind: 'postmortem',
      title: `Largest loss: ${trades.find((t) => t.pnl < 0)?.symbol ?? 'RELIANCE'}`,
      body: 'Entered on a momentum signal minutes before a scheduled policy event. An event blackout node would have blocked this entry.',
    },
    {
      kind: 'postmortem',
      title: 'Cluster of correlated losses',
      body: 'Four simultaneous long positions were effectively one index bet. A correlation guard would have capped this exposure.',
    },
  ]

  return {
    id: params.id,
    botId: params.botId,
    botName: params.botName,
    createdAt: params.createdAt ?? new Date().toISOString(),
    config: {
      from: params.from,
      to: params.to,
      symbols: params.symbols,
      capital: params.capital,
      fees: params.fees,
      slippage: params.slippage,
      seed: params.seed,
      type: params.type,
    },
    metrics: {
      totalReturn: Number(totalReturn.toFixed(2)),
      winRate: Number(winRate.toFixed(1)),
      maxDrawdown: Number(maxDD.toFixed(2)),
      sharpe: Number((0.4 + rand() * 1.9).toFixed(2)),
      trades: tradeCount,
      avgR: Number((0.6 + rand() * 1.1).toFixed(2)),
      profitFactor: Number((0.9 + rand() * 1.3).toFixed(2)),
      exposure: Number((28 + rand() * 50).toFixed(1)),
    },
    equity: equitySeries,
    trades,
    contributions,
    insights,
  }
}

export const BACKTEST_RUNS: BacktestRun[] = [
  generateBacktest({
    id: 'run-1041',
    botId: 'bot-nifty-momentum',
    botName: 'Nifty Momentum v4',
    from: '2026-05-01',
    to: '2026-08-20',
    symbols: 'NIFTY',
    capital: 500000,
    fees: 3,
    slippage: 8,
    seed: 1041,
    type: 'historical',
    bias: 0.0012,
    createdAt: '2026-08-23T14:40:00.000Z',
  }),
  generateBacktest({
    id: 'run-1038',
    botId: 'bot-news-reversal',
    botName: 'Headline Reversal',
    from: '2026-02-01',
    to: '2026-08-15',
    symbols: 'RELIANCE, HDFCBANK, INFY',
    capital: 300000,
    fees: 4,
    slippage: 12,
    seed: 1038,
    type: 'walk-forward',
    bias: 0.0008,
    createdAt: '2026-08-21T08:20:00.000Z',
  }),
  generateBacktest({
    id: 'run-1035',
    botId: 'bot-vol-harvest',
    botName: 'Expiry Vol Harvest',
    from: '2026-01-01',
    to: '2026-08-10',
    symbols: 'NIFTY options',
    capital: 1000000,
    fees: 5,
    slippage: 15,
    seed: 1035,
    type: 'monte-carlo',
    bias: 0.0006,
    createdAt: '2026-08-12T12:15:00.000Z',
  }),
  generateBacktest({
    id: 'run-1032',
    botId: 'bot-nifty-momentum',
    botName: 'Nifty Momentum v4',
    from: '2026-04-01',
    to: '2026-08-01',
    symbols: 'NIFTY',
    capital: 500000,
    fees: 3,
    slippage: 8,
    seed: 1032,
    type: 'historical',
    bias: 0.0009,
    createdAt: '2026-08-14T09:30:00.000Z',
  }),
  generateBacktest({
    id: 'run-1029',
    botId: 'bot-bank-meanrev',
    botName: 'Bank Nifty Mean Reversion',
    from: '2026-03-01',
    to: '2026-08-05',
    symbols: 'BANKNIFTY',
    capital: 400000,
    fees: 3,
    slippage: 10,
    seed: 1029,
    type: 'historical',
    bias: -0.00025,
    createdAt: '2026-08-19T17:50:00.000Z',
  }),
  generateBacktest({
    id: 'run-1021',
    botId: 'bot-news-reversal',
    botName: 'Headline Reversal',
    from: '2026-01-01',
    to: '2026-06-30',
    symbols: 'RELIANCE, HDFCBANK',
    capital: 300000,
    fees: 4,
    slippage: 12,
    seed: 1021,
    type: 'historical',
    bias: 0.0004,
    createdAt: '2026-07-11T15:10:00.000Z',
  }),
  generateBacktest({
    id: 'run-1019',
    botId: 'bot-nifty-momentum',
    botName: 'Nifty Momentum v4',
    from: '2026-02-01',
    to: '2026-06-30',
    symbols: 'NIFTY',
    capital: 500000,
    fees: 3,
    slippage: 8,
    seed: 1019,
    type: 'ab',
    bias: 0.0005,
    createdAt: '2026-07-02T10:00:00.000Z',
  }),
]

/* ------------------------------------------------------------------ */
/* Marketplace presets                                                 */
/* ------------------------------------------------------------------ */

export interface Review {
  id: string
  author: string
  initials: string
  rating: number
  createdAt: string
  body: string
}

export interface Preset {
  id: string
  name: string
  tagline: string
  description: string
  authorNotes: string
  author: { name: string; initials: string; handle: string }
  price: number
  forks: number
  rating: number
  reviewCount: number
  layers: LayerId[]
  nodeCount: number
  tier: PlanTier
  headline: { label: string; value: string; positive: boolean }
  createdAt: string
  category: string
  tags: string[]
  graph: BotGraph
  reviews: Review[]
  sampleRunId: string
  trending: boolean
}

export const trendStarterNotes: CanvasNote[] = [
  {
    id: 'pn-1',
    kind: 'note',
    x: 400,
    y: 100,
    text: 'Baseline 5-node setup. Paper execution only.',
    color: 'blue',
    createdAt: '2026-03-14T10:00:00.000Z',
  },
]

export const trendStarterFrames: CanvasFrame[] = [
  {
    id: 'pf-1',
    x: 60,
    y: 40,
    w: 520,
    h: 560,
    label: 'Core Pipeline',
    hue: 'rgba(48, 209, 88, 0.08)',
  },
]

export const MARKETPLACE_PRESETS: Preset[] = [
  {
    id: 'preset-trend-starter',
    name: 'Trend Starter',
    tagline: 'The simplest trend bot that is not stupid.',
    description:
      'Five nodes: candles, indicators, one analyst, a risk gate and paper execution. Built as a teaching graph  every node is free tier, so you can run it on day one without unlocking anything.',
    authorNotes:
      'I use this as the baseline for every new idea. If a fancier graph cannot beat this on the same period, the complexity is not paying for itself.',
    author: { name: 'Priya Raman', initials: 'PR', handle: '@praman' },
    price: 0,
    forks: 4820,
    rating: 4.8,
    reviewCount: 214,
    layers: ['data', 'features', 'agents', 'risk', 'execution'],
    nodeCount: 6,
    tier: 'free',
    headline: { label: 'Return, 1y backtest', value: '+14.2%', positive: true },
    createdAt: '2026-03-14T10:00:00.000Z',
    category: 'Starter',
    tags: ['beginner', 'trend', 'free'],
    graph: {
      nodes: [
        n('p1', 'ohlcv-feed', 80, 0),
        n('p2', 'ta-indicators', 80, 1),
        n('p3', 'technical-agent', 80, 2),
        n('p4', 'confidence-gate', 80, 6),
        n('p5', 'risk-gate', 80, 7),
        n('p6', 'paper-executor', 80, 8),
      ],
      edges: [e('p1', 'p2'), e('p2', 'p3'), e('p3', 'p4'), e('p4', 'p5'), e('p5', 'p6')],
      notes: trendStarterNotes,
      frames: trendStarterFrames,
      schemaVersion: CURRENT_GRAPH_SCHEMA_VERSION,
    },
    reviews: [
      {
        id: 'r1',
        author: 'Kabir Shah',
        initials: 'KS',
        rating: 5,
        createdAt: '2026-08-02T11:00:00.000Z',
        body: 'Exactly what I needed as a first graph. The comments on each node explain why it is there, which is rarer than it should be.',
      },
      {
        id: 'r2',
        author: 'Meera Nair',
        initials: 'MN',
        rating: 4,
        createdAt: '2026-07-19T09:30:00.000Z',
        body: 'Solid baseline. I added a drawdown brake almost immediately, but that is arguably the point of a starter.',
      },
      {
        id: 'r3',
        author: 'Dev Patel',
        initials: 'DP',
        rating: 5,
        createdAt: '2026-06-28T16:12:00.000Z',
        body: 'Ran it on paper for six weeks before changing anything. Boring in the good way.',
      },
    ],
    sampleRunId: 'run-1041',
    trending: true,
  },
  {
    id: 'preset-debate-engine',
    name: 'Debate Engine',
    tagline: 'Four analysts argue, a moderator decides.',
    description:
      'A full debate stack: technical, sentiment, macro and flow agents feed bull/bear rounds, a moderator scores the argument, and a devil\'s advocate gets the last word before risk sees anything.',
    authorNotes:
      'The transcripts are the real product here. Reading why a trade was rejected taught me more than any metric.',
    author: { name: 'Rohan Iyer', initials: 'RI', handle: '@riyer' },
    price: 499,
    forks: 1310,
    rating: 4.6,
    reviewCount: 88,
    layers: ['data', 'features', 'agents', 'debate', 'confidence', 'risk', 'execution'],
    nodeCount: 14,
    tier: 'starter',
    headline: { label: 'Sharpe, 1y backtest', value: '1.64', positive: true },
    createdAt: '2026-05-02T14:00:00.000Z',
    category: 'Research',
    tags: ['debate', 'agents', 'paid'],
    graph: {
      nodes: sentimentNodes.slice(0, 14),
      edges: sentimentEdges.slice(0, 12),
      notes: [],
      frames: [],
      schemaVersion: CURRENT_GRAPH_SCHEMA_VERSION,
    },
    reviews: [
      {
        id: 'r4',
        author: 'Anita Desai',
        initials: 'AD',
        rating: 5,
        createdAt: '2026-08-11T10:00:00.000Z',
        body: 'Slow to run but the reasoning traces are genuinely useful for post-mortems. Worth the credits.',
      },
      {
        id: 'r5',
        author: 'Sanjay Kumar',
        initials: 'SK',
        rating: 4,
        createdAt: '2026-07-25T13:45:00.000Z',
        body: 'Needed to cut the rounds from 3 to 2 to keep latency sane on intraday. Fine at swing horizons.',
      },
    ],
    sampleRunId: 'run-1038',
    trending: true,
  },
  {
    id: 'preset-risk-first',
    name: 'Risk First',
    tagline: 'Every risk node, wired correctly.',
    description:
      'Not a strategy  a risk chassis. Position caps, drawdown brake, correlation guard, daily loss limit, event blackout and a VaR monitor, all feeding one gate. Drop your own signal in the top.',
    authorNotes:
      'Fork this, then paste your own alpha above the gate. The boring layer is the one that decides whether you are still here next year.',
    author: { name: 'Farah Khan', initials: 'FK', handle: '@fkhan' },
    price: 299,
    forks: 2640,
    rating: 4.9,
    reviewCount: 156,
    layers: ['risk', 'monitoring', 'execution'],
    nodeCount: 9,
    tier: 'starter',
    headline: { label: 'Max drawdown cut', value: '-42%', positive: true },
    createdAt: '2026-04-08T09:00:00.000Z',
    category: 'Risk',
    tags: ['risk', 'template', 'paid'],
    graph: {
      nodes: [
        n('rf1', 'position-cap', 80, 7),
        n('rf2', 'drawdown-brake', 420, 7),
        n('rf3', 'correlation-guard', 760, 7),
        n('rf4', 'daily-loss-limit', 1100, 7),
        n('rf5', 'event-blackout', 80, 7),
        n('rf6', 'risk-gate', 420, 7),
        n('rf7', 'paper-executor', 80, 8),
        n('rf8', 'pnl-tracker', 80, 9),
        n('rf9', 'decision-log', 420, 9),
      ],
      edges: [
        e('rf1', 'rf6'),
        e('rf2', 'rf6'),
        e('rf3', 'rf6'),
        e('rf4', 'rf6'),
        e('rf5', 'rf6'),
        e('rf6', 'rf7'),
        e('rf7', 'rf8'),
        e('rf7', 'rf9'),
      ],
      notes: [],
      frames: [],
      schemaVersion: CURRENT_GRAPH_SCHEMA_VERSION,
    },
    reviews: [
      {
        id: 'r6',
        author: 'Vikram Rao',
        initials: 'VR',
        rating: 5,
        createdAt: '2026-08-18T08:00:00.000Z',
        body: 'This should honestly be the default template for new bots. Cut my worst month in half.',
      },
      {
        id: 'r7',
        author: 'Leela Menon',
        initials: 'LM',
        rating: 5,
        createdAt: '2026-08-01T12:30:00.000Z',
        body: 'The correlation guard alone caught a mistake I had been making for months.',
      },
    ],
    sampleRunId: 'run-1035',
    trending: true,
  },
  {
    id: 'preset-selflearn-loop',
    name: 'Self-Learning Loop',
    tagline: 'Post-mortems that turn into rules.',
    description:
      'A monitoring and learning tail you can bolt onto any working bot: decision logs, per-trade post-mortems, a rule miner and a scheduled retrainer with champion/challenger comparison.',
    authorNotes: 'Auto-promote is off by default and you should leave it off until you have read a hundred mined rules yourself.',
    author: { name: 'Ishaan Gupta', initials: 'IG', handle: '@igupta' },
    price: 799,
    forks: 640,
    rating: 4.4,
    reviewCount: 41,
    layers: ['monitoring', 'learning', 'memory'],
    nodeCount: 8,
    tier: 'pro',
    headline: { label: 'Rules derived, 90d', value: '23', positive: true },
    createdAt: '2026-06-20T11:00:00.000Z',
    category: 'Learning',
    tags: ['self-learning', 'pro', 'paid'],
    graph: {
      nodes: [
        n('sl1', 'pnl-tracker', 80, 9),
        n('sl2', 'decision-log', 420, 9),
        n('sl3', 'attribution', 760, 9),
        n('sl4', 'post-mortem', 80, 10),
        n('sl5', 'rule-miner', 420, 10),
        n('sl6', 'retrainer', 760, 10),
        n('sl7', 'outcome-store', 80, 11),
        n('sl8', 'lesson-bank', 420, 11),
      ],
      edges: [
        e('sl1', 'sl4'),
        e('sl2', 'sl4'),
        e('sl3', 'sl5'),
        e('sl4', 'sl5'),
        e('sl5', 'sl6'),
        e('sl4', 'sl7'),
        e('sl7', 'sl8'),
      ],
      notes: [],
      frames: [],
      schemaVersion: CURRENT_GRAPH_SCHEMA_VERSION,
    },
    reviews: [
      {
        id: 'r8',
        author: 'Tara Bose',
        initials: 'TB',
        rating: 4,
        createdAt: '2026-08-09T15:00:00.000Z',
        body: 'Genuinely useful, but you need a few hundred closed trades before the rule miner says anything interesting.',
      },
    ],
    sampleRunId: 'run-1032',
    trending: false,
  },
  {
    id: 'preset-expiry-vol',
    name: 'Expiry Volatility',
    tagline: 'Harvest expiry-week premium, carefully.',
    description:
      'Options chain and microstructure feeds into a flow analyst and volatility forecast, gated by uncertainty bands and a VaR monitor. Requires Pro-tier data nodes.',
    authorNotes: 'This one can lose money fast if you remove the VaR monitor. Please do not remove the VaR monitor.',
    author: { name: 'Neha Joshi', initials: 'NJ', handle: '@njoshi' },
    price: 999,
    forks: 410,
    rating: 4.2,
    reviewCount: 29,
    layers: ['data', 'features', 'agents', 'ml', 'confidence', 'risk', 'execution'],
    nodeCount: 14,
    tier: 'pro',
    headline: { label: 'Return, 1y backtest', value: '+22.9%', positive: true },
    createdAt: '2026-07-01T10:00:00.000Z',
    category: 'Options',
    tags: ['options', 'volatility', 'pro'],
    graph: {
      nodes: optionsNodes,
      edges: optionsEdges,
      notes: [],
      frames: [],
      schemaVersion: CURRENT_GRAPH_SCHEMA_VERSION,
    },
    reviews: [
      {
        id: 'r9',
        author: 'Aditya Verma',
        initials: 'AV',
        rating: 4,
        createdAt: '2026-08-15T09:00:00.000Z',
        body: 'Strong returns in backtest but the drawdowns are real. Size it small until you understand it.',
      },
      {
        id: 'r10',
        author: 'Ritika Sen',
        initials: 'RS',
        rating: 3,
        createdAt: '2026-07-30T14:20:00.000Z',
        body: 'Needs Pro data nodes to run at all, which is a big asterisk on the price.',
      },
    ],
    sampleRunId: 'run-1035',
    trending: false,
  },
  {
    id: 'preset-news-fade',
    name: 'News Fade',
    tagline: 'Trade against the headline, when the tape disagrees.',
    description:
      'Sentiment and technical agents must disagree for an entry to fire. Blackout windows keep it away from scheduled events.',
    authorNotes: 'Works best on liquid large caps. On small caps the slippage eats the edge entirely.',
    author: { name: 'Priya Raman', initials: 'PR', handle: '@praman' },
    price: 0,
    forks: 1980,
    rating: 4.3,
    reviewCount: 97,
    layers: ['data', 'features', 'agents', 'confidence', 'risk', 'execution'],
    nodeCount: 11,
    tier: 'free',
    headline: { label: 'Win rate, 1y', value: '57.4%', positive: true },
    createdAt: '2026-02-28T13:00:00.000Z',
    category: 'Events',
    tags: ['news', 'mean-reversion', 'free'],
    graph: {
      nodes: sentimentNodes.slice(0, 11),
      edges: sentimentEdges.slice(0, 9),
      notes: [],
      frames: [],
      schemaVersion: CURRENT_GRAPH_SCHEMA_VERSION,
    },
    reviews: [
      {
        id: 'r11',
        author: 'Nikhil Menon',
        initials: 'NM',
        rating: 4,
        createdAt: '2026-08-05T10:30:00.000Z',
        body: 'Good free option. The disagreement requirement cuts trade count a lot, which I think is correct.',
      },
    ],
    sampleRunId: 'run-1021',
    trending: true,
  },
  {
    id: 'preset-regime-switch',
    name: 'Regime Switcher',
    tagline: 'Two strategies, one regime detector.',
    description:
      'Runs a trend playbook in trending regimes and a mean-reversion playbook in chop, switching on a regime tagger with hysteresis so it does not flip constantly.',
    authorNotes: 'The hysteresis setting matters more than either strategy. Tune it first.',
    author: { name: 'Farah Khan', initials: 'FK', handle: '@fkhan' },
    price: 599,
    forks: 870,
    rating: 4.7,
    reviewCount: 63,
    layers: ['data', 'features', 'agents', 'ml', 'confidence', 'risk', 'execution', 'learning'],
    nodeCount: 12,
    tier: 'starter',
    headline: { label: 'Sharpe, 1y backtest', value: '1.38', positive: true },
    createdAt: '2026-05-25T09:00:00.000Z',
    category: 'Adaptive',
    tags: ['regime', 'adaptive', 'paid'],
    graph: {
      nodes: meanRevNodes,
      edges: meanRevEdges,
      notes: [],
      frames: [],
      schemaVersion: CURRENT_GRAPH_SCHEMA_VERSION,
    },
    reviews: [
      {
        id: 'r12',
        author: 'Zoya Ahmed',
        initials: 'ZA',
        rating: 5,
        createdAt: '2026-08-12T11:15:00.000Z',
        body: 'Finally a bot that does not blow up the moment the market changes character.',
      },
    ],
    sampleRunId: 'run-1029',
    trending: false,
  },
  {
    id: 'preset-memory-recall',
    name: 'Memory Recall',
    tagline: 'Ask history what usually happens next.',
    description:
      'A memory stack that surfaces the ten most similar historical setups and their outcomes, feeding base rates into the debate layer instead of leaving agents to guess.',
    authorNotes: 'Pairs beautifully with Debate Engine. On its own it is just a lookup table.',
    author: { name: 'Rohan Iyer', initials: 'RI', handle: '@riyer' },
    price: 449,
    forks: 520,
    rating: 4.5,
    reviewCount: 34,
    layers: ['features', 'memory', 'debate'],
    nodeCount: 7,
    tier: 'starter',
    headline: { label: 'Signal precision lift', value: '+8.1%', positive: true },
    createdAt: '2026-07-18T16:00:00.000Z',
    category: 'Research',
    tags: ['memory', 'research', 'paid'],
    graph: {
      nodes: [
        n('mr1', 'ohlcv-feed', 80, 0),
        n('mr2', 'ta-indicators', 80, 1),
        n('mr3', 'embedding-index', 80, 11),
        n('mr4', 'setup-recall', 420, 11),
        n('mr5', 'working-memory', 760, 11),
        n('mr6', 'bull-bear', 80, 5),
        n('mr7', 'moderator', 420, 5),
      ],
      edges: [e('mr1', 'mr2'), e('mr2', 'mr3'), e('mr3', 'mr4'), e('mr4', 'mr6'), e('mr5', 'mr6'), e('mr6', 'mr7')],
      notes: [],
      frames: [],
      schemaVersion: CURRENT_GRAPH_SCHEMA_VERSION,
    },
    reviews: [],
    sampleRunId: 'run-1019',
    trending: false,
  },
]

/* ------------------------------------------------------------------ */
/* My presets (saved by the current user)                              */
/* ------------------------------------------------------------------ */

export interface MyPreset {
  id: string
  name: string
  description: string
  createdAt: string
  visibility: 'private' | 'unlisted' | 'public'
  nodeCount: number
  layers: LayerId[]
  publishedId?: string
  graph: BotGraph
  versions: { id: string; label: string; createdAt: string; note: string }[]
}

export const MY_PRESETS: MyPreset[] = [
  {
    id: 'mp-momentum-core',
    name: 'Momentum Core',
    description: 'The data → features → model → risk spine I reuse in every trend bot.',
    createdAt: '2026-06-02T10:00:00.000Z',
    visibility: 'public',
    nodeCount: 9,
    layers: ['data', 'features', 'ml', 'confidence', 'risk'],
    publishedId: 'preset-trend-starter',
    graph: {
      nodes: [
        n('p1', 'ohlcv-feed', 80, 0),
        n('p2', 'ta-indicators', 80, 1),
        n('p3', 'technical-agent', 80, 2),
        n('p4', 'confidence-gate', 80, 6),
        n('p5', 'risk-gate', 80, 7),
        n('p6', 'paper-executor', 80, 8),
      ],
      edges: [e('p1', 'p2'), e('p2', 'p3'), e('p3', 'p4'), e('p4', 'p5'), e('p5', 'p6')],
      notes: trendStarterNotes,
      frames: trendStarterFrames,
      schemaVersion: CURRENT_GRAPH_SCHEMA_VERSION,
    },
    versions: [
      { id: 'mpv-3', label: 'v3', createdAt: '2026-08-10T09:00:00.000Z', note: 'Added calibrator' },
      { id: 'mpv-2', label: 'v2', createdAt: '2026-07-04T14:00:00.000Z', note: 'Swapped normaliser method' },
      { id: 'mpv-1', label: 'v1', createdAt: '2026-06-02T10:00:00.000Z', note: 'Initial save' },
    ],
  },
  {
    id: 'mp-risk-chassis',
    name: 'My Risk Chassis',
    description: 'Every risk node I trust, pre-wired to a single gate. Drop any signal in above it.',
    createdAt: '2026-05-14T11:30:00.000Z',
    visibility: 'unlisted',
    nodeCount: 7,
    layers: ['risk', 'monitoring'],
    graph: {
      nodes: [
        n('rf1', 'position-cap', 80, 7),
        n('rf2', 'drawdown-brake', 420, 7),
        n('rf3', 'correlation-guard', 760, 7),
        n('rf4', 'daily-loss-limit', 1100, 7),
        n('rf5', 'event-blackout', 80, 7),
        n('rf6', 'risk-gate', 420, 7),
        n('rf7', 'paper-executor', 80, 8),
      ],
      edges: [
        e('rf1', 'rf6'),
        e('rf2', 'rf6'),
        e('rf3', 'rf6'),
        e('rf4', 'rf6'),
        e('rf5', 'rf6'),
        e('rf6', 'rf7'),
      ],
      notes: [],
      frames: [],
      schemaVersion: CURRENT_GRAPH_SCHEMA_VERSION,
    },
    versions: [
      { id: 'mpv-5', label: 'v2', createdAt: '2026-08-16T10:00:00.000Z', note: 'Tighter daily loss limit' },
      { id: 'mpv-4', label: 'v1', createdAt: '2026-05-14T11:30:00.000Z', note: 'Initial save' },
    ],
  },
  {
    id: 'mp-news-block',
    name: 'News Ingest Block',
    description: 'News stream + embedder + sentiment agent as one draggable unit.',
    createdAt: '2026-04-21T08:45:00.000Z',
    visibility: 'private',
    nodeCount: 3,
    layers: ['data', 'features', 'agents'],
    graph: {
      nodes: [
        n('s1', 'news-stream', 80, 0),
        n('s4', 'nlp-embedder', 80, 1),
        n('s6', 'sentiment-agent', 80, 2),
      ],
      edges: [e('s1', 's4'), e('s4', 's6')],
      notes: [],
      frames: [],
      schemaVersion: CURRENT_GRAPH_SCHEMA_VERSION,
    },
    versions: [{ id: 'mpv-6', label: 'v1', createdAt: '2026-04-21T08:45:00.000Z', note: 'Initial save' }],
  },
  {
    id: 'mp-learning-tail',
    name: 'Learning Tail',
    description: 'Post-mortem, rule miner and outcome store  bolt onto anything that trades.',
    createdAt: '2026-07-09T16:20:00.000Z',
    visibility: 'private',
    nodeCount: 5,
    layers: ['monitoring', 'learning', 'memory'],
    graph: {
      nodes: [
        n('sl4', 'post-mortem', 80, 10),
        n('sl5', 'rule-miner', 420, 10),
        n('sl6', 'retrainer', 760, 10),
        n('sl7', 'outcome-store', 80, 11),
        n('sl8', 'lesson-bank', 420, 11),
      ],
      edges: [
        e('sl4', 'sl5'),
        e('sl5', 'sl6'),
        e('sl4', 'sl7'),
        e('sl7', 'sl8'),
      ],
      notes: [],
      frames: [],
      schemaVersion: CURRENT_GRAPH_SCHEMA_VERSION,
    },
    versions: [{ id: 'mpv-7', label: 'v1', createdAt: '2026-07-09T16:20:00.000Z', note: 'Initial save' }],
  },
]

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

export type NotificationKind =
  | 'backtest'
  | 'error'
  | 'trade'
  | 'risk'
  | 'fork'
  | 'review'
  | 'payment'
  | 'system'

export interface Notification {
  id: string
  kind: NotificationKind
  title: string
  body: string
  createdAt: string
  read: boolean
  href: string
}

export const NOTIFICATIONS: Notification[] = [
  {
    id: 'nt-1',
    kind: 'backtest',
    title: 'Backtest complete  Nifty Momentum v4',
    body: '+18.4% return, 1.62 Sharpe, -9.2% max drawdown across 112 trades.',
    createdAt: '2026-08-23T14:41:00.000Z',
    read: false,
    href: '/app/bots/bot-nifty-momentum/backtest/run-1041',
  },
  {
    id: 'nt-2',
    kind: 'risk',
    title: 'Risk limit approached  Nifty Momentum v4',
    body: 'Daily loss reached ₹3,850 of your ₹5,000 limit. New entries will stop at the limit.',
    createdAt: '2026-08-23T11:18:00.000Z',
    read: false,
    href: '/app/bots/bot-nifty-momentum/live',
  },
  {
    id: 'nt-3',
    kind: 'trade',
    title: 'Trade executed  RELIANCE',
    body: 'Long 42 shares at ₹2,914.20. Paper trading, no real funds used.',
    createdAt: '2026-08-23T10:02:00.000Z',
    read: false,
    href: '/app/bots/bot-nifty-momentum/live',
  },
  {
    id: 'nt-4',
    kind: 'fork',
    title: 'Your preset was forked 14 times this week',
    body: 'Momentum Core is trending in the Starter category.',
    createdAt: '2026-08-22T18:30:00.000Z',
    read: true,
    href: '/app/creator/dashboard',
  },
  {
    id: 'nt-5',
    kind: 'review',
    title: 'New review on Momentum Core',
    body: 'Kabir Shah left 5 stars: "Exactly what I needed as a first graph."',
    createdAt: '2026-08-22T11:00:00.000Z',
    read: true,
    href: '/app/marketplace/preset-trend-starter',
  },
  {
    id: 'nt-6',
    kind: 'error',
    title: 'Bot error  Small Cap Scanner',
    body: 'Execution node has no risk decision input. Validate the graph to see all 3 problems.',
    createdAt: '2026-08-21T19:25:00.000Z',
    read: true,
    href: '/app/builder/bot-smallcap-scan',
  },
  {
    id: 'nt-7',
    kind: 'payment',
    title: 'Payment receipt  ₹1,999',
    body: 'Pro plan, monthly. Invoice INV-2026-0814 is available to download.',
    createdAt: '2026-08-14T06:00:00.000Z',
    read: true,
    href: '/app/billing/history',
  },
  {
    id: 'nt-8',
    kind: 'backtest',
    title: 'Backtest complete  Headline Reversal',
    body: 'Walk-forward run finished. Sharpe 1.42 across 6 folds.',
    createdAt: '2026-08-21T08:20:00.000Z',
    read: true,
    href: '/app/bots/bot-news-reversal/backtest/run-1038',
  },
  {
    id: 'nt-9',
    kind: 'system',
    title: 'Two new components in the Memory layer',
    body: 'Shared Lesson Bank and Embedding Index are now available.',
    createdAt: '2026-08-18T09:00:00.000Z',
    read: true,
    href: '/app/library',
  },
  {
    id: 'nt-10',
    kind: 'trade',
    title: 'Position closed  HDFCBANK',
    body: 'Short closed at ₹1,642.80 for +₹4,120. Paper trading.',
    createdAt: '2026-08-20T15:22:00.000Z',
    read: true,
    href: '/app/bots/bot-nifty-momentum/live',
  },
]

/* ------------------------------------------------------------------ */
/* Activity feed                                                       */
/* ------------------------------------------------------------------ */

export interface Activity {
  id: string
  kind: 'backtest' | 'edit' | 'unlock' | 'publish' | 'live' | 'payment'
  title: string
  detail: string
  createdAt: string
  href: string
}

export const ACTIVITY: Activity[] = [
  {
    id: 'ac-1',
    kind: 'backtest',
    title: 'Ran a backtest on Nifty Momentum v4',
    detail: '+18.4% return · 1.62 Sharpe · 112 trades',
    createdAt: '2026-08-23T14:40:00.000Z',
    href: '/app/bots/bot-nifty-momentum/backtest/run-1041',
  },
  {
    id: 'ac-2',
    kind: 'edit',
    title: 'Edited Nifty Momentum v4',
    detail: 'Tightened the drawdown brake from 20% to 15%',
    createdAt: '2026-08-23T14:32:00.000Z',
    href: '/app/builder/bot-nifty-momentum',
  },
  {
    id: 'ac-3',
    kind: 'live',
    title: 'Started paper trading Nifty Momentum v4',
    detail: 'Running since 09:15 · 6 trades today',
    createdAt: '2026-08-23T09:15:00.000Z',
    href: '/app/bots/bot-nifty-momentum/live',
  },
  {
    id: 'ac-4',
    kind: 'edit',
    title: 'Edited Headline Reversal',
    detail: 'Disabled the Social Firehose node  too noisy',
    createdAt: '2026-08-21T08:05:00.000Z',
    href: '/app/builder/bot-news-reversal',
  },
  {
    id: 'ac-5',
    kind: 'unlock',
    title: 'Unlocked Regime Tagger',
    detail: '₹179 · Feature Engineering layer',
    createdAt: '2026-08-20T13:50:00.000Z',
    href: '/app/library/regime-tagger',
  },
  {
    id: 'ac-6',
    kind: 'backtest',
    title: 'Ran a backtest on Bank Nifty Mean Reversion',
    detail: '-2.1% return · 0.41 Sharpe · 68 trades',
    createdAt: '2026-08-19T17:50:00.000Z',
    href: '/app/bots/bot-bank-meanrev/backtest/run-1029',
  },
  {
    id: 'ac-7',
    kind: 'publish',
    title: 'Published Momentum Core to the marketplace',
    detail: 'Public · free · 4,820 forks since',
    createdAt: '2026-08-16T10:20:00.000Z',
    href: '/app/marketplace/preset-trend-starter',
  },
  {
    id: 'ac-8',
    kind: 'payment',
    title: 'Topped up 500 credits',
    detail: '₹499 · via UPI',
    createdAt: '2026-08-15T08:00:00.000Z',
    href: '/app/billing/history',
  },
]

/* ------------------------------------------------------------------ */
/* Billing                                                             */
/* ------------------------------------------------------------------ */

export interface Plan {
  id: PlanTier | 'payg'
  name: string
  blurb: string
  monthly: number
  annual: number
  highlight?: boolean
  cta: string
  features: string[]
}

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    blurb: 'Learn the system on paper, with no card and no clock.',
    monthly: 0,
    annual: 0,
    cta: 'Get started',
    features: [
      '2 bots',
      '10 backtests a month',
      'All free-tier components',
      'Paper trading only',
      'Community marketplace access',
    ],
  },
  {
    id: 'starter',
    name: 'Starter',
    blurb: 'For when one bot is working and you want three more.',
    monthly: 799,
    annual: 7990,
    cta: 'Start free trial',
    features: [
      '10 bots',
      '150 backtests a month',
      'Starter-tier components included',
      'Paper trading + 1 live bot',
      'Walk-forward and Monte Carlo tests',
      'Publish free presets',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    blurb: 'Every layer, every test type, and the self-learning stack.',
    monthly: 1999,
    annual: 19990,
    highlight: true,
    cta: 'Subscribe',
    features: [
      'Unlimited bots',
      'Unlimited backtests',
      'All components, all 12 layers',
      'Up to 5 live bots',
      'Self-learning and memory layers',
      'Sell paid presets, 80% revenue share',
      'API keys and webhooks',
      'Priority support',
    ],
  },
  {
    id: 'payg',
    name: 'Pay-as-you-go',
    blurb: 'No subscription. Buy credits, unlock what you actually use.',
    monthly: 0,
    annual: 0,
    cta: 'Buy credits',
    features: [
      'Credits never expire',
      'Unlock individual components forever',
      '1 credit ≈ ₹1 of component value',
      'Backtests cost 2–8 credits each',
      'Stack on top of any plan',
    ],
  },
]

export interface ComparisonRow {
  label: string
  free: string | boolean
  starter: string | boolean
  pro: string | boolean
  payg: string | boolean
}

export const PLAN_COMPARISON: { group: string; rows: ComparisonRow[] }[] = [
  {
    group: 'Building',
    rows: [
      { label: 'Bots', free: '2', starter: '10', pro: 'Unlimited', payg: '3' },
      { label: 'Nodes per bot', free: '12', starter: '40', pro: 'Unlimited', payg: '20' },
      { label: 'Saved presets', free: '3', starter: '25', pro: 'Unlimited', payg: '10' },
      { label: 'Version history', free: '5 versions', starter: '50 versions', pro: 'Unlimited', payg: '20 versions' },
      { label: 'Mini-presets (saved blocks)', free: false, starter: true, pro: true, payg: true },
    ],
  },
  {
    group: 'Layers',
    rows: [
      { label: 'Data Collection', free: 'Free nodes', starter: 'All', pro: 'All', payg: 'Per unlock' },
      { label: 'Feature Engineering', free: 'Free nodes', starter: 'All', pro: 'All', payg: 'Per unlock' },
      { label: 'Intelligence Agents', free: '2 agents', starter: 'All', pro: 'All', payg: 'Per unlock' },
      { label: 'ML Prediction', free: 'Free nodes', starter: 'All', pro: 'All', payg: 'Per unlock' },
      { label: 'Reinforcement Learning', free: false, starter: false, pro: true, payg: 'Per unlock' },
      { label: 'Debate Layer', free: false, starter: 'All', pro: 'All', payg: 'Per unlock' },
      { label: 'Confidence Engine', free: 'Free nodes', starter: 'All', pro: 'All', payg: 'Per unlock' },
      { label: 'Risk Management', free: 'Free nodes', starter: 'All', pro: 'All', payg: 'Per unlock' },
      { label: 'Execution', free: 'Paper only', starter: 'All', pro: 'All', payg: 'Per unlock' },
      { label: 'Trade Monitoring', free: 'Free nodes', starter: 'All', pro: 'All', payg: 'Per unlock' },
      { label: 'Self-Learning', free: false, starter: 'Partial', pro: 'All', payg: 'Per unlock' },
      { label: 'Memory', free: 'Free nodes', starter: 'All', pro: 'All', payg: 'Per unlock' },
    ],
  },
  {
    group: 'Testing',
    rows: [
      { label: 'Backtests per month', free: '10', starter: '150', pro: 'Unlimited', payg: '2–8 credits each' },
      { label: 'Historical', free: true, starter: true, pro: true, payg: true },
      { label: 'Walk-forward', free: false, starter: true, pro: true, payg: true },
      { label: 'Monte Carlo', free: false, starter: true, pro: true, payg: true },
      { label: 'A/B compare', free: false, starter: true, pro: true, payg: true },
      { label: 'Max history depth', free: '1 year', starter: '5 years', pro: '15 years', payg: '5 years' },
    ],
  },
  {
    group: 'Running',
    rows: [
      { label: 'Paper trading', free: true, starter: true, pro: true, payg: true },
      { label: 'Live bots', free: false, starter: '1', pro: '5', payg: false },
      { label: 'Real-fund execution', free: false, starter: 'Verification required', pro: 'Verification required', payg: false },
      { label: 'Alerts (email + in-app)', free: 'In-app', starter: true, pro: true, payg: 'In-app' },
      { label: 'Webhooks', free: false, starter: false, pro: true, payg: false },
    ],
  },
  {
    group: 'Marketplace',
    rows: [
      { label: 'Clone public presets', free: true, starter: true, pro: true, payg: true },
      { label: 'Publish free presets', free: false, starter: true, pro: true, payg: false },
      { label: 'Sell paid presets', free: false, starter: false, pro: true, payg: false },
      { label: 'Revenue share', free: '', starter: '', pro: '80%', payg: '' },
    ],
  },
]

export interface Invoice {
  id: string
  date: string
  description: string
  amount: number
  status: 'paid' | 'pending' | 'failed' | 'refunded'
}

export const INVOICES: Invoice[] = [
  { id: 'INV-2026-0814', date: '2026-08-14T06:00:00.000Z', description: 'Pro plan  monthly', amount: 1999, status: 'paid' },
  { id: 'INV-2026-0815', date: '2026-08-15T08:00:00.000Z', description: '500 credits top-up', amount: 499, status: 'paid' },
  { id: 'INV-2026-0820', date: '2026-08-20T13:50:00.000Z', description: 'Component unlock  Regime Tagger', amount: 179, status: 'paid' },
  { id: 'INV-2026-0714', date: '2026-07-14T06:00:00.000Z', description: 'Pro plan  monthly', amount: 1999, status: 'paid' },
  { id: 'INV-2026-0702', date: '2026-07-02T09:30:00.000Z', description: 'Marketplace purchase  Risk First', amount: 299, status: 'paid' },
  { id: 'INV-2026-0614', date: '2026-06-14T06:00:00.000Z', description: 'Pro plan  monthly', amount: 1999, status: 'paid' },
  { id: 'INV-2026-0605', date: '2026-06-05T11:00:00.000Z', description: '1000 credits top-up', amount: 999, status: 'paid' },
  { id: 'INV-2026-0514', date: '2026-05-14T06:00:00.000Z', description: 'Starter plan  monthly', amount: 799, status: 'paid' },
  { id: 'INV-2026-0508', date: '2026-05-08T14:00:00.000Z', description: 'Component unlock  Order Book Depth', amount: 149, status: 'refunded' },
  { id: 'INV-2026-0414', date: '2026-04-14T06:00:00.000Z', description: 'Starter plan  monthly', amount: 799, status: 'paid' },
  { id: 'INV-2026-0322', date: '2026-03-22T10:15:00.000Z', description: '100 credits top-up', amount: 99, status: 'failed' },
  { id: 'INV-2026-0314', date: '2026-03-14T06:00:00.000Z', description: 'Starter plan  monthly', amount: 799, status: 'paid' },
]

export interface PaymentMethod {
  id: string
  kind: 'card' | 'upi'
  label: string
  detail: string
  isDefault: boolean
}

export const PAYMENT_METHODS: PaymentMethod[] = [
  { id: 'pm-1', kind: 'card', label: 'HDFC Bank ·· 4291', detail: 'Visa, expires 09/2029', isDefault: true },
  { id: 'pm-2', kind: 'upi', label: 'arjun@okhdfcbank', detail: 'UPI autopay mandate, active', isDefault: false },
  { id: 'pm-3', kind: 'card', label: 'ICICI Bank ·· 8830', detail: 'Mastercard, expires 03/2028', isDefault: false },
]

export const CREDIT_BUNDLES = [
  { credits: 100, price: 99, blurb: 'A couple of component unlocks.' },
  { credits: 500, price: 499, blurb: 'Most popular. Unlocks a full layer.', popular: true },
  { credits: 1000, price: 999, blurb: 'Best value  11% more credits per rupee.' },
]

/* ------------------------------------------------------------------ */
/* Creator dashboard                                                   */
/* ------------------------------------------------------------------ */

/**
 * Published strategy preset on the creator dashboard.
 * Note: Once a unified backend exists, PublishedPreset and Preset can collapse
 * into a single unified StrategyPreset entity.
 */
export interface PublishedPreset {
  id: string
  name: string
  clones: number
  revenue: number
  rating: number
  reviews: number
  publishedAt: string
  price: number
  graph: BotGraph
}

export const PUBLISHED_PRESETS: PublishedPreset[] = [
  {
    id: 'preset-trend-starter',
    name: 'Trend Starter',
    clones: 4820,
    revenue: 0,
    rating: 4.8,
    reviews: 214,
    publishedAt: '2026-03-14T10:00:00.000Z',
    price: 0,
    graph: {
      nodes: [
        n('p1', 'ohlcv-feed', 80, 0),
        n('p2', 'ta-indicators', 80, 1),
        n('p3', 'technical-agent', 80, 2),
        n('p4', 'confidence-gate', 80, 6),
        n('p5', 'risk-gate', 80, 7),
        n('p6', 'paper-executor', 80, 8),
      ],
      edges: [e('p1', 'p2'), e('p2', 'p3'), e('p3', 'p4'), e('p4', 'p5'), e('p5', 'p6')],
      notes: trendStarterNotes,
      frames: trendStarterFrames,
      schemaVersion: CURRENT_GRAPH_SCHEMA_VERSION,
    },
  },
  {
    id: 'preset-news-fade',
    name: 'News Fade',
    clones: 1980,
    revenue: 0,
    rating: 4.3,
    reviews: 97,
    publishedAt: '2026-02-28T13:00:00.000Z',
    price: 0,
    graph: {
      nodes: sentimentNodes.slice(0, 11),
      edges: sentimentEdges.slice(0, 9),
      notes: [],
      frames: [],
      schemaVersion: CURRENT_GRAPH_SCHEMA_VERSION,
    },
  },
  {
    id: 'preset-risk-chassis-pub',
    name: 'My Risk Chassis',
    clones: 742,
    revenue: 177_608,
    rating: 4.9,
    reviews: 61,
    publishedAt: '2026-05-20T09:00:00.000Z',
    price: 299,
    graph: {
      nodes: [
        n('rf1', 'position-cap', 80, 7),
        n('rf2', 'drawdown-brake', 420, 7),
        n('rf3', 'correlation-guard', 760, 7),
        n('rf4', 'daily-loss-limit', 1100, 7),
        n('rf5', 'event-blackout', 80, 7),
        n('rf6', 'risk-gate', 420, 7),
        n('rf7', 'paper-executor', 80, 8),
        n('rf8', 'pnl-tracker', 80, 9),
        n('rf9', 'decision-log', 420, 9),
      ],
      edges: [
        e('rf1', 'rf6'),
        e('rf2', 'rf6'),
        e('rf3', 'rf6'),
        e('rf4', 'rf6'),
        e('rf5', 'rf6'),
        e('rf6', 'rf7'),
        e('rf7', 'rf8'),
        e('rf7', 'rf9'),
      ],
      notes: [],
      frames: [],
      schemaVersion: CURRENT_GRAPH_SCHEMA_VERSION,
    },
  },
  {
    id: 'preset-learning-tail-pub',
    name: 'Learning Tail',
    clones: 188,
    revenue: 120_112,
    rating: 4.4,
    reviews: 22,
    publishedAt: '2026-07-12T11:00:00.000Z',
    price: 799,
    graph: {
      nodes: [
        n('sl1', 'pnl-tracker', 80, 9),
        n('sl2', 'decision-log', 420, 9),
        n('sl3', 'attribution', 760, 9),
        n('sl4', 'post-mortem', 80, 10),
        n('sl5', 'rule-miner', 420, 10),
        n('sl6', 'retrainer', 760, 10),
        n('sl7', 'outcome-store', 80, 11),
        n('sl8', 'lesson-bank', 420, 11),
      ],
      edges: [
        e('sl1', 'sl4'),
        e('sl2', 'sl4'),
        e('sl3', 'sl5'),
        e('sl4', 'sl5'),
        e('sl5', 'sl6'),
        e('sl4', 'sl7'),
        e('sl7', 'sl8'),
      ],
      notes: [],
      frames: [],
      schemaVersion: CURRENT_GRAPH_SCHEMA_VERSION,
    },
  },
]

export const CREATOR_EARNINGS = {
  total: 297_720,
  thisMonth: 41_360,
  pendingPayout: 41_360,
  lastPayout: { amount: 68_400, date: '2026-08-01T00:00:00.000Z', status: 'paid' as const },
  nextPayoutDate: '2026-09-01T00:00:00.000Z',
}

/* ------------------------------------------------------------------ */
/* Live monitor                                                        */
/* ------------------------------------------------------------------ */

export interface Position {
  id: string
  symbol: string
  side: 'long' | 'short'
  qty: number
  entry: number
  ltp: number
  pnl: number
  pnlPct: number
  openedAt: string
}

export const OPEN_POSITIONS: Position[] = [
  { id: 'p-1', symbol: 'RELIANCE', side: 'long', qty: 42, entry: 2914.2, ltp: 2948.65, pnl: 1446.9, pnlPct: 1.18, openedAt: '2026-08-23T10:02:00.000Z' },
  { id: 'p-2', symbol: 'HDFCBANK', side: 'short', qty: 60, entry: 1662.5, ltp: 1642.8, pnl: 1182.0, pnlPct: 1.19, openedAt: '2026-08-23T09:48:00.000Z' },
  { id: 'p-3', symbol: 'INFY', side: 'long', qty: 85, entry: 1489.3, ltp: 1478.15, pnl: -947.75, pnlPct: -0.75, openedAt: '2026-08-23T11:20:00.000Z' },
  { id: 'p-4', symbol: 'NIFTY 24AUG 25500 CE', side: 'long', qty: 2, entry: 142.6, ltp: 156.85, pnl: 1425.0, pnlPct: 9.99, openedAt: '2026-08-23T09:22:00.000Z' },
]

export const LIVE_LOG_TEMPLATES = [
  'Technical Analyst: momentum score 0.68, trend regime confirmed',
  'Gradient Boosting Forecast: P(up | 5 bars) = 0.64',
  'Confidence Gate: 0.64 above threshold 0.60  passing',
  'Risk Gate: position cap check passed (8.2% of 10% max)',
  'Risk Gate: correlation with open book 0.41, below 0.70 limit',
  'Paper Executor: submitted BUY 42 RELIANCE @ market',
  'Paper Executor: filled 42 @ 2914.20, slippage 6 bps',
  'P&L Tracker: unrealised +₹1,446 across 4 positions',
  'Drawdown Brake: session drawdown 1.2%, no action',
  'Sentiment Analyst: no material headlines in last 15 min',
  'Confidence Gate: 0.54 below threshold 0.60  signal dropped',
  'Risk Gate: BLOCKED short INFY  daily loss limit at 77%',
  'Volatility Forecast: EWMA vol 0.94%, sizing scaled to 0.8x',
  'Decision Audit Log: 218 decisions recorded this session',
  'Event Blackout: no scheduled events in the next 60 min',
  'Macro Calendar: RBI policy in 2 days  flagged for review',
]

export const RISK_LIMITS = {
  maxDailyLoss: 5000,
  currentDailyPnl: -3850,
  maxPositionPct: 10,
  currentMaxPositionPct: 8.2,
  maxOpenPositions: 6,
  currentOpenPositions: 4,
  maxLeverage: 2,
  currentLeverage: 1.3,
}

/* ------------------------------------------------------------------ */
/* Docs & blog                                                         */
/* ------------------------------------------------------------------ */

export interface DocSection {
  slug: string
  title: string
  category: string
  summary: string
  readingTime: string
  blocks: { type: 'p' | 'h2' | 'h3' | 'code' | 'list' | 'note'; text?: string; items?: string[] }[]
}

export const DOC_SECTIONS: DocSection[] = [
  {
    slug: 'quickstart',
    title: 'Quickstart',
    category: 'Getting Started',
    summary: 'Build and backtest your first agent in about five minutes.',
    readingTime: '4 min',
    blocks: [
      { type: 'p', text: 'This walkthrough builds the smallest useful trading agent: one data feed, one indicator set, one analyst, a risk gate and paper execution. Every node used here is on the free tier.' },
      { type: 'h2', text: 'Create a bot' },
      { type: 'p', text: 'From the dashboard, choose New bot. You land on an empty canvas with the component library on the left, organised by layer.' },
      { type: 'h2', text: 'Wire the spine' },
      { type: 'list', items: ['Drag OHLCV Price Feed from Data Collection.', 'Drag Technical Indicators from Feature Engineering and connect the feed into it.', 'Drag Technical Analyst from Intelligence Agents.', 'Drag Risk Gate from Risk Management.', 'Drag Paper Trading Executor from Execution.'] },
      { type: 'note', text: 'Execution nodes only accept a RiskDecision input. This is deliberate  it makes it structurally impossible to ship a bot with no risk layer.' },
      { type: 'h2', text: 'Backtest it' },
      { type: 'p', text: 'Hit Run Backtest, pick a date range and starting capital, then run. You get an equity curve, trade log and a per-layer contribution breakdown.' },
      { type: 'p', text: 'Backtest results describe the past. They are not a forecast, and they never guarantee future results.' },
    ],
  },
  {
    slug: 'core-concepts',
    title: 'Core concepts',
    category: 'Getting Started',
    summary: 'Layers, nodes, ports and the rules that connect them.',
    readingTime: '6 min',
    blocks: [
      { type: 'p', text: 'An Aether agent is a directed graph. Nodes are components, edges carry typed data, and layers group nodes by their role in the decision pipeline.' },
      { type: 'h2', text: 'Layers' },
      { type: 'p', text: 'There are twelve layers, ordered from raw data through to memory. Nodes snap into their layer band automatically  you cannot put a risk node in the data layer, because the ordering encodes the decision flow.' },
      { type: 'h2', text: 'Port types' },
      { type: 'list', items: ['MarketData  prices, books, fundamentals', 'NewsFeed  text and scheduled events', 'FeatureVector  numeric features ready for a model', 'Signal  a directional view with confidence', 'RiskDecision  an explicit allow or block', 'ExecutionOrder  an order sent to a venue', 'TradeOutcome  what actually happened'] },
      { type: 'p', text: 'Ports only connect to compatible types. The canvas highlights valid targets while you drag and refuses incompatible drops with an explanation.' },
      { type: 'h2', text: 'Enabled, disabled and locked' },
      { type: 'p', text: 'Every node has an on/off switch, so you can ablate a layer and re-run a backtest to see what it was actually contributing. Locked nodes are components your plan does not include yet.' },
    ],
  },
  {
    slug: 'layer-reference',
    title: 'Layer reference',
    category: 'Layer Reference',
    summary: 'What each of the twelve layers is for, and when to skip it.',
    readingTime: '12 min',
    blocks: [
      { type: 'p', text: 'You do not need all twelve layers. Most profitable graphs use five or six. This reference covers what each layer does and the failure mode it protects against.' },
      { type: 'h2', text: 'The mandatory spine' },
      { type: 'p', text: 'Data → Features → some opinion-forming layer → Risk → Execution → Monitoring. Everything else is optional refinement.' },
      { type: 'h2', text: 'When to add the debate layer' },
      { type: 'p', text: 'Add it when you have three or more opinion sources and you cannot decide how to weight them. Skip it on latency-sensitive intraday graphs  the rounds cost time.' },
      { type: 'h2', text: 'When to add self-learning' },
      { type: 'p', text: 'After a few hundred closed trades. Before that, the rule miner has nothing statistically meaningful to find and will happily overfit noise.' },
      { type: 'note', text: 'The risk layer is the only layer we consider non-optional. A graph without it cannot pass validation.' },
    ],
  },
  {
    slug: 'backtesting',
    title: 'Backtesting',
    category: 'Layer Reference',
    summary: 'Test types, common biases, and how to read a result honestly.',
    readingTime: '9 min',
    blocks: [
      { type: 'p', text: 'A backtest is a simulation. Its value depends entirely on how carefully you avoid lying to yourself.' },
      { type: 'h2', text: 'Test types' },
      { type: 'list', items: ['Historical  one pass over a fixed window. Fast, and the easiest to overfit.', 'Walk-forward  repeated train/test splits rolling forward. Slower, far more honest.', 'Monte Carlo  resampled paths to see the distribution of outcomes, not one lucky line.', 'Paper trading  forward testing on live data with no money at risk.', 'A/B compare  two graph variants on identical data and seeds.'] },
      { type: 'h2', text: 'Biases to watch' },
      { type: 'list', items: ['Lookahead  using data that was not available at decision time. Point-in-time feeds help.', 'Survivorship  testing only on names that still exist.', 'Overfitting  tuning until the curve looks nice. Walk-forward is the antidote.', 'Cost blindness  omitting realistic fees and slippage.'] },
      { type: 'note', text: 'Past performance never guarantees future results. A good backtest raises your confidence slightly; it does not prove anything.' },
    ],
  },
  {
    slug: 'risk-management',
    title: 'Risk management',
    category: 'Layer Reference',
    summary: 'Caps, brakes, guards and the gate that ties them together.',
    readingTime: '8 min',
    blocks: [
      { type: 'p', text: 'The risk layer is the only part of your graph whose job is to make you less money in the short term so you are still trading in the long term.' },
      { type: 'h2', text: 'The gate pattern' },
      { type: 'p', text: 'Wire every risk node into a single Risk Gate, and route execution only from the gate. The gate emits an explicit allow or block with a reason, which the decision log records.' },
      { type: 'h2', text: 'Cost weighting' },
      { type: 'p', text: 'The gate exposes false-positive and false-negative cost weights. Set the false-negative weight higher than the false-positive weight  the cost of allowing a bad trade is usually larger than the cost of missing a good one.' },
      { type: 'h2', text: 'Kill switches' },
      { type: 'p', text: 'A daily loss limit and a drawdown brake cover different failure modes: one bad day versus a slow bleed. Run both.' },
    ],
  },
  {
    slug: 'api-reference',
    title: 'API reference',
    category: 'API Reference',
    summary: 'Programmatic access to bots, runs and results.',
    readingTime: '7 min',
    blocks: [
      { type: 'p', text: 'The API is available on Pro plans. Generate a key under Account → API keys. Keys are shown once at creation.' },
      { type: 'h2', text: 'Authentication' },
      { type: 'code', text: 'curl https://api.aether.dev/v1/bots \\\n  -H "Authorization: Bearer ae_live_..."' },
      { type: 'h2', text: 'Trigger a backtest' },
      { type: 'code', text: 'POST /v1/bots/{botId}/backtests\n{\n  "from": "2026-01-01",\n  "to": "2026-08-01",\n  "capital": 500000,\n  "type": "walk-forward",\n  "seed": 42\n}' },
      { type: 'h2', text: 'Rate limits' },
      { type: 'list', items: ['60 requests per minute per key', '10 concurrent backtests per account', 'Webhook retries: 5 attempts with exponential backoff'] },
    ],
  },
  {
    slug: 'webhooks',
    title: 'Webhooks',
    category: 'API Reference',
    summary: 'Receive backtest, trade and risk events at your own endpoint.',
    readingTime: '5 min',
    blocks: [
      { type: 'p', text: 'Webhooks push events to an HTTPS endpoint you control. Configure them per event type under Account → Notifications.' },
      { type: 'h2', text: 'Event types' },
      { type: 'list', items: ['backtest.completed', 'bot.error', 'trade.executed', 'risk.limit_breached', 'preset.forked', 'review.received'] },
      { type: 'h2', text: 'Verifying signatures' },
      { type: 'code', text: 'const expected = hmacSha256(secret, rawBody)\nif (!timingSafeEqual(expected, header)) reject()' },
    ],
  },
  {
    slug: 'glossary',
    title: 'Glossary',
    category: 'Getting Started',
    summary: 'Terms used across the builder and results pages.',
    readingTime: '5 min',
    blocks: [
      { type: 'p', text: 'Plain definitions for the terms that appear in metric cards and node config.' },
      { type: 'list', items: ['Sharpe ratio  return per unit of volatility. Above 1 is decent, above 2 is suspicious until proven.', 'Max drawdown  the worst peak-to-trough fall in equity. The number that decides whether you can actually hold the position.', 'R-multiple  profit divided by the risk you took. Avg R above 1 means winners outsize losers.', 'Profit factor  gross profit over gross loss. Below 1 means the strategy loses money.', 'Slippage  the gap between the price you wanted and the price you got, in basis points.', 'Calibration  whether a stated 70% confidence is right about 70% of the time.'] },
    ],
  },
]

export interface BlogPost {
  slug: string
  title: string
  excerpt: string
  date: string
  author: string
  readingTime: string
  category: string
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'why-risk-first',
    title: 'Why we made the risk layer impossible to skip',
    excerpt: 'Execution nodes only accept a risk decision as input. That was a deliberate constraint, and it is the single most argued-about decision in the product.',
    date: '2026-08-18T09:00:00.000Z',
    author: 'Farah Khan',
    readingTime: '6 min',
    category: 'Product',
  },
  {
    slug: 'debate-layer-postmortem',
    title: 'What 40,000 agent debates taught us about overconfidence',
    excerpt: 'Agents that argue reach fewer conclusions and better ones. We looked at the transcripts to find out why.',
    date: '2026-08-04T10:30:00.000Z',
    author: 'Rohan Iyer',
    readingTime: '11 min',
    category: 'Research',
  },
  {
    slug: 'walk-forward-or-nothing',
    title: 'Walk-forward or nothing',
    excerpt: 'A single historical backtest tells you how well you tuned your parameters. It tells you almost nothing about tomorrow.',
    date: '2026-07-22T08:00:00.000Z',
    author: 'Priya Raman',
    readingTime: '8 min',
    category: 'Research',
  },
  {
    slug: 'paper-trading-default',
    title: 'Paper trading is the default, and it should stay that way',
    excerpt: 'Every new bot starts with no money at risk. Getting to real capital requires separate verification, on purpose.',
    date: '2026-07-08T11:15:00.000Z',
    author: 'Neeraj Sharma',
    readingTime: '5 min',
    category: 'Product',
  },
  {
    slug: 'twelve-layers',
    title: 'The twelve layers, and why most bots only need six',
    excerpt: 'A tour of the layer system with honest guidance on what to skip when you are starting out.',
    date: '2026-06-26T09:45:00.000Z',
    author: 'Priya Raman',
    readingTime: '10 min',
    category: 'Guides',
  },
  {
    slug: 'slippage-eats-alpha',
    title: 'Slippage eats more alpha than you think',
    excerpt: 'We re-ran 12,000 community backtests with realistic execution costs. A third of them stopped being profitable.',
    date: '2026-06-11T14:00:00.000Z',
    author: 'Neha Joshi',
    readingTime: '7 min',
    category: 'Research',
  },
  {
    slug: 'building-the-loom',
    title: 'Building The Loom: notes on a node canvas',
    excerpt: 'Layer bands, port typing and the small interaction decisions that make a graph editor feel calm instead of chaotic.',
    date: '2026-05-29T10:00:00.000Z',
    author: 'Ishaan Gupta',
    readingTime: '9 min',
    category: 'Engineering',
  },
  {
    slug: 'self-learning-honest',
    title: 'An honest look at self-learning bots',
    excerpt: 'Automated rule mining finds real patterns and imaginary ones with equal enthusiasm. Here is how we try to tell them apart.',
    date: '2026-05-15T13:30:00.000Z',
    author: 'Rohan Iyer',
    readingTime: '12 min',
    category: 'Research',
  },
]

/* ------------------------------------------------------------------ */
/* Help / FAQ                                                          */
/* ------------------------------------------------------------------ */

export const FAQS = [
  {
    q: 'Is this financial advice?',
    a: 'No. Aether is a tool for building and testing your own strategies. Nothing here is a recommendation to buy or sell anything, and we do not manage money or offer advice.',
  },
  {
    q: 'Does this trade with real money?',
    a: 'Not by default. Every bot runs in paper trading mode with simulated fills and no real funds. Connecting a real brokerage account is a separate, explicitly opt-in tier that requires additional verification.',
  },
  {
    q: 'What data sources are supported?',
    a: 'Price and volume candles, level 2 order books, fundamentals, options chains, news wires, exchange filings, macro calendars, social feeds and on-chain metrics. Availability depends on your plan and which data nodes you have unlocked.',
  },
  {
    q: 'How does pricing work?',
    a: 'Two ways, and they stack. Subscriptions (Free, Starter, Pro) unlock tiers of components and raise your monthly backtest and live-bot limits. Credits are a pay-as-you-go alternative  buy them once, unlock individual components permanently, and spend them per backtest.',
  },
  {
    q: 'Can I sell the bots I build?',
    a: 'You can publish presets to the marketplace. Free presets are open to all plans; selling paid presets requires Pro and pays an 80% revenue share.',
  },
  {
    q: 'What happens to my bots if I downgrade?',
    a: 'Nothing is deleted. Bots that exceed your new plan limits become read-only until you either upgrade again or archive enough bots to fit under the limit.',
  },
  {
    q: 'Do credits expire?',
    a: 'No. Credits stay on your account indefinitely, and component unlocks you buy with them are permanent.',
  },
  {
    q: 'How do I get my data out?',
    a: 'Account → Danger zone → Export all data gives you a JSON archive of every bot, preset, backtest run and setting. Backtest reports also export individually as PDF or CSV.',
  },
]

/* ------------------------------------------------------------------ */
/* Testimonials                                                        */
/* ------------------------------------------------------------------ */

export const TESTIMONIALS = [
  {
    quote:
      'I had a strategy in a spreadsheet for two years. It took an afternoon to rebuild it here, and the risk layer immediately showed me why it kept blowing up.',
    author: 'Priya Raman',
    role: 'Independent trader',
    initials: 'PR',
  },
  {
    quote:
      'The per-layer attribution is the feature I did not know I wanted. Turns out two of my expensive nodes were contributing nothing.',
    author: 'Vikram Rao',
    role: 'Quant researcher',
    initials: 'VR',
  },
  {
    quote:
      'Being able to switch a node off and re-run the same seed is how I finally understood what my own bot was doing.',
    author: 'Leela Menon',
    role: 'Systematic trader',
    initials: 'LM',
  },
  {
    quote:
      'Paper trading by default, and real money behind a separate wall. That is the right default and it is why I trusted it enough to try.',
    author: 'Sanjay Kumar',
    role: 'Former desk trader',
    initials: 'SK',
  },
]

export const LANDING_STATS = [
  { label: 'Bots built', value: 128_400, suffix: '' },
  { label: 'Backtests run', value: 2_940_000, suffix: '' },
  { label: 'Community presets', value: 6_120, suffix: '' },
]

/* ------------------------------------------------------------------ */
/* Sessions & API keys                                                 */
/* ------------------------------------------------------------------ */

export const SESSIONS = [
  { id: 'se-1', device: 'MacBook Pro · Chrome', location: 'Mumbai, IN', lastActive: '2026-08-24T08:40:00.000Z', current: true },
  { id: 'se-2', device: 'iPhone 16 · Safari', location: 'Mumbai, IN', lastActive: '2026-08-23T21:10:00.000Z', current: false },
  { id: 'se-3', device: 'Windows PC · Edge', location: 'Pune, IN', lastActive: '2026-08-19T14:22:00.000Z', current: false },
]

export const API_KEYS = [
  { id: 'ak-1', name: 'Local research scripts', scope: 'read', prefix: 'ae_live_7f2a', createdAt: '2026-07-02T10:00:00.000Z', lastUsed: '2026-08-23T09:14:00.000Z' },
  { id: 'ak-2', name: 'Backtest CI runner', scope: 'read+write', prefix: 'ae_live_c41d', createdAt: '2026-06-14T15:30:00.000Z', lastUsed: '2026-08-22T02:00:00.000Z' },
]

export const NOTIFICATION_EVENTS = [
  { id: 'backtest_complete', label: 'Backtest complete', detail: 'When a run finishes, with headline metrics.' },
  { id: 'bot_error', label: 'Bot error', detail: 'Validation failures and runtime errors during a run.' },
  { id: 'trade_executed', label: 'Live trade executed', detail: 'Every fill on a running bot.' },
  { id: 'risk_breach', label: 'Risk limit breached', detail: 'Daily loss limits, drawdown brakes and position caps.' },
  { id: 'preset_forked', label: 'Preset forked', detail: 'When someone clones a preset you published.' },
  { id: 'review_received', label: 'Review received', detail: 'New ratings and comments on your presets.' },
  { id: 'payment_receipt', label: 'Payment receipt', detail: 'Subscription renewals, top-ups and unlocks.' },
]

export type ActivityItem = Activity

export interface MockDataset {
  id: string
  name: string
  rowCount: number
  dateRange: string
  size: string
  format: string
}

export const MOCK_DATASETS: MockDataset[] = [
  { id: 'ds-nifty50-1m', name: 'NSE Nifty 50 (1-Minute Ticks)', rowCount: 1840000, dateRange: '2023-01 to 2026-08', size: '142 MB', format: 'Parquet' },
  { id: 'ds-banknifty-options', name: 'BankNifty Weekly Options Chain', rowCount: 4200000, dateRange: '2024-01 to 2026-08', size: '380 MB', format: 'HDF5' },
  { id: 'ds-us-equities-daily', name: 'S&P 500 Daily OHLCV (Adjusted)', rowCount: 950000, dateRange: '2015-01 to 2026-08', size: '64 MB', format: 'CSV' },
  { id: 'ds-crypto-orderbook', name: 'BTC/ETH L2 Depth Snapshots (100ms)', rowCount: 6500000, dateRange: '2025-06 to 2026-08', size: '512 MB', format: 'Parquet' },
  { id: 'ds-reuters-sentiment', name: 'Financial News Sentiment Corpus', rowCount: 320000, dateRange: '2022-01 to 2026-08', size: '28 MB', format: 'JSONL' },
]


