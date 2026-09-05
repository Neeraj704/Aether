import { createClient } from '@/lib/supabase/client'
import type { BacktestConfigValues } from '@/components/backtest/config-panel'
import type { BacktestRun } from '@/mock/data'

export interface BacktestResultResponse {
  id: string
  status: 'queued' | 'running' | 'complete' | 'error'
  metrics?: BacktestRun['metrics']
  trades?: BacktestRun['trades']
  equity?: BacktestRun['equity']
  config?: any
  errorMessage?: string
  error_message?: string
}

export async function startBacktest(botId: string, config: BacktestConfigValues) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  const engineUrl = process.env.NEXT_PUBLIC_ENGINE_URL || 'http://localhost:8000'
  const res = await fetch(`${engineUrl}/backtest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify({
      botId,
      config: {
        from: config.from,
        to: config.to,
        symbols: config.symbols,
        capital: config.capital,
        fees: config.fees,
        slippage: config.slippage,
        seed: config.seed,
        type: config.type,
      },
    }),
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(errorText || `Engine returned status ${res.status}`)
  }

  return res.json() as Promise<{ runId: string; status: string }>
}

export async function getBacktest(runId: string): Promise<BacktestResultResponse> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  const engineUrl = process.env.NEXT_PUBLIC_ENGINE_URL || 'http://localhost:8000'
  const res = await fetch(`${engineUrl}/backtest/${runId}`, {
    headers: {
      Authorization: `Bearer ${session?.access_token}`,
    },
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(errorText || `Engine returned status ${res.status}`)
  }

  return res.json()
}

export async function listBacktestRuns(botId: string): Promise<BacktestRun[]> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  const engineUrl = process.env.NEXT_PUBLIC_ENGINE_URL || 'http://localhost:8000'
  try {
    const res = await fetch(`${engineUrl}/bots/${botId}/backtests`, {
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
      },
    })

    if (!res.ok) {
      return []
    }

    const data = await res.json()
    return (data || []).map((r: any) => ({
      id: r.id,
      botId: r.botId,
      status: r.status,
      createdAt: r.createdAt,
      config: r.config,
      metrics: r.metrics || {
        totalReturn: 0,
        sharpe: 0,
        maxDrawdown: 0,
        winRate: 0,
        trades: 0,
        profitFactor: 0,
      },
      trades: [],
      equity: [],
      logs: [],
      errorMessage: r.errorMessage,
    }))
  } catch (e) {
    console.error('Failed to fetch backtests from engine:', e)
    return []
  }
}

export async function deleteBacktestRun(runId: string): Promise<void> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  const engineUrl = process.env.NEXT_PUBLIC_ENGINE_URL || 'http://localhost:8000'
  const res = await fetch(`${engineUrl}/backtest/${runId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${session?.access_token}`,
    },
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(errorText || `Engine returned status ${res.status}`)
  }
}

/* ------------------------------------------------------------------ */
/* Live Session Types & API                                           */
/* ------------------------------------------------------------------ */

export interface LiveSessionPosition {
  side: 'long' | 'short'
  size: number
  entry_price: number
  entry_time: string
  stop_price?: number | null
  confidence?: number
  entry_candle?: any
  entry_features?: any
  entry_signal?: any
  entry_risk?: any
  execution_flow?: any
  [key: string]: any
}

export type LiveTrade = BacktestRun['trades'][number] & {
  executionFlow?: any
  entryPrice?: number
  exitPrice?: number
  stopPrice?: number | null
  sessionId?: string
  confidence?: number
}

export interface LiveSessionSummary {
  id: string
  botId: string
  status: 'running' | 'stopped' | 'error'
  symbol: string
  capital: number
  cash: number
  equity: number
  peakEquity: number
  maxDrawdown: number
  startedAt: string
  stoppedAt?: string | null
  lastBarTime?: string | null
  errorMessage?: string | null
}

export interface LiveNodeStep {
  nodeId: string
  componentId: string
  nodeName: string
  layer: string
  summary: string
  metricLabel: string
  metricValue: string
  output: any
  executionTimeMs?: number
}

export interface LiveEvaluationSnapshot {
  timestamp: string
  symbol: string
  resolution: string
  candle: {
    symbol: string
    open: number
    high: number
    low: number
    close: number
    volume: number
    openTime: string
  }
  steps: LiveNodeStep[]
}

export interface LiveLogEntry {
  id: string
  time: string
  type: 'data' | 'features' | 'signal' | 'risk' | 'fill' | 'warn' | 'system'
  node: string
  text: string
}

export interface LiveStateResponse {
  status: 'running' | 'stopped' | 'error' | 'not_running'
  botId: string
  botName?: string
  resolution?: string
  interval?: number
  session?: LiveSessionSummary | null
  position?: LiveSessionPosition | null
  equity: Array<{ date: string; equity: number; drawdown: number }>
  trades: LiveTrade[]
  evaluation?: LiveEvaluationSnapshot | null
  logs?: LiveLogEntry[]
}

export interface ActiveLiveSession {
  id: string
  botId: string
  botName: string
  status: 'running' | 'stopped' | 'error'
  symbol: string
  resolution?: string
  interval?: number
  capital: number
  cash: number
  equity: number
  peakEquity: number
  maxDrawdown: number
  position?: LiveSessionPosition | null
  startedAt: string
  lastBarTime?: string | null
}

export async function startLiveSession(
  botId: string,
  symbol: string = 'BTCUSDT',
  capital: number = 100000,
): Promise<{ sessionId: string }> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  const engineUrl = process.env.NEXT_PUBLIC_ENGINE_URL || 'http://localhost:8000'
  const res = await fetch(`${engineUrl}/bots/${botId}/live/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify({
      symbol,
      capital,
    }),
  })

  if (!res.ok) {
    let errorMsg = `Engine returned status ${res.status}`
    try {
      const errJson = await res.json()
      if (errJson.detail) {
        errorMsg = errJson.detail
      }
    } catch {
      const errorText = await res.text()
      if (errorText) errorMsg = errorText
    }
    throw new Error(errorMsg)
  }

  return res.json()
}

export async function stopLiveSession(botId: string): Promise<void> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  const engineUrl = process.env.NEXT_PUBLIC_ENGINE_URL || 'http://localhost:8000'
  try {
    const res = await fetch(`${engineUrl}/bots/${botId}/live/stop`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
      },
    })

    if (!res.ok) {
      console.warn(`[Engine] Stop bot endpoint returned ${res.status} for bot ${botId}`)
    }
  } catch (err) {
    console.warn(`[Engine] Network error while requesting stop for bot ${botId}:`, err)
  }
}

export async function getLiveState(botId: string): Promise<LiveStateResponse> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  const engineUrl = process.env.NEXT_PUBLIC_ENGINE_URL || 'http://localhost:8000'
  const res = await fetch(`${engineUrl}/bots/${botId}/live/state`, {
    headers: {
      Authorization: `Bearer ${session?.access_token}`,
    },
  })

  if (!res.ok) {
    let errorMsg = `Engine returned status ${res.status}`
    try {
      const errJson = await res.json()
      if (errJson.detail) errorMsg = errJson.detail
    } catch {
      const errorText = await res.text()
      if (errorText) errorMsg = errorText
    }
    throw new Error(errorMsg)
  }

  return res.json()
}

export async function listActiveLiveSessions(): Promise<ActiveLiveSession[]> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  const engineUrl = process.env.NEXT_PUBLIC_ENGINE_URL || 'http://localhost:8000'
  try {
    const res = await fetch(`${engineUrl}/live/active`, {
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
      },
    })

    if (!res.ok) {
      return []
    }

    return res.json()
  } catch (e) {
    console.error('Failed to fetch active live sessions:', e)
    return []
  }
}

export async function clearLiveLogs(botId: string): Promise<void> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  const engineUrl = process.env.NEXT_PUBLIC_ENGINE_URL || 'http://localhost:8000'
  try {
    await fetch(`${engineUrl}/bots/${botId}/live/logs/clear`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
      },
    })
  } catch (e) {
    console.warn('Notice on clearing live logs:', e)
  }
}

export interface GlobalLiveTradeItem extends LiveTrade {
  botId: string
  botName: string
  sessionId: string
}

export async function listAllLiveTrades(limit = 100): Promise<GlobalLiveTradeItem[]> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  const engineUrl = process.env.NEXT_PUBLIC_ENGINE_URL || 'http://localhost:8000'
  try {
    const res = await fetch(`${engineUrl}/live/trades?limit=${limit}`, {
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
      },
    })

    if (!res.ok) {
      return []
    }

    return res.json()
  } catch (e) {
    console.error('Failed to fetch all live trades:', e)
    return []
  }
}


