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
