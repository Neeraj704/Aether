'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
} from 'recharts'
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  LineChart,
  CandlestickChart,
  ChevronDown,
} from 'lucide-react'
import {
  Menu,
  MenuTrigger,
  MenuContent,
  MenuItem,
  MenuLabel,
} from '@/components/ui/menu'

export interface KlinePoint {
  time: number
  dateStr: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

const TIMEFRAMES = [
  { id: '1m', label: '1m' },
  { id: '3m', label: '3m' },
  { id: '5m', label: '5m' },
  { id: '15m', label: '15m' },
  { id: '30m', label: '30m' },
  { id: '1h', label: '1h' },
  { id: '4h', label: '4h' },
  { id: '1d', label: '1D' },
]

interface LivePriceChartProps {
  symbol?: string
  availableSymbols?: string[]
  defaultTimeframe?: string
  currentCandle?: {
    symbol?: string
    open?: number
    high?: number
    low?: number
    close?: number
    volume?: number
    openTime?: string
  } | null
  className?: string
  onSymbolChange?: (symbol: string) => void
}

function CustomChartTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null

  const d: KlinePoint = payload[0]?.payload
  if (!d) return null

  const isUp = d.close >= d.open
  const change = d.close - d.open
  const changePct = d.open > 0 ? (change / d.open) * 100 : 0

  const date = new Date(d.time)
  const fullDateIST = date.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  const fullTimeIST = date.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })

  return (
    <div className="glass rounded-xl p-3 border border-border/80 text-xs shadow-2xl flex flex-col gap-2 min-w-52 backdrop-blur-xl bg-card/95">
      <div className="flex items-center justify-between border-b border-border/50 pb-1.5">
        <div className="flex flex-col">
          <span className="font-semibold text-foreground/90 font-mono text-[11px]">{fullTimeIST} IST</span>
          <span className="text-[10px] text-muted-foreground">{fullDateIST}</span>
        </div>
        <span
          className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${
            isUp ? 'bg-profit/15 text-profit' : 'bg-loss/15 text-loss'
          }`}
        >
          {isUp ? '+' : ''}
          {changePct.toFixed(2)}%
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] font-mono">
        <div className="flex items-center justify-between text-muted-foreground">
          <span>Open:</span>
          <span className="text-foreground">${d.open.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="flex items-center justify-between text-muted-foreground">
          <span>Close:</span>
          <span className="font-bold text-foreground">${d.close.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="flex items-center justify-between text-muted-foreground">
          <span>High:</span>
          <span className="text-profit">${d.high.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
        <div className="flex items-center justify-between text-muted-foreground">
          <span>Low:</span>
          <span className="text-loss">${d.low.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[10px] font-mono text-muted-foreground">
        <span>Volume:</span>
        <span className="text-foreground font-semibold">
          {d.volume.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </span>
      </div>
    </div>
  )
}

function CandlestickShape(props: any) {
  const { x, y, width, height, payload, yMin, yMax } = props
  if (!payload || yMin === undefined || yMax === undefined) return null

  const { open, close, high, low } = payload
  const isUp = close >= open
  const color = isUp ? 'var(--profit)' : 'var(--loss)'

  const chartBottom = y + height
  const scale = height > 0 && payload.close > yMin
    ? height / (payload.close - yMin)
    : 240 / Math.max(1, yMax - yMin)

  const yHigh = chartBottom - (high - yMin) * scale
  const yLow = chartBottom - (low - yMin) * scale
  const yOpen = chartBottom - (open - yMin) * scale
  const yClose = chartBottom - (close - yMin) * scale

  const bodyTop = Math.min(yOpen, yClose)
  const bodyHeight = Math.max(2, Math.abs(yOpen - yClose))
  const candleWidth = Math.max(2, Math.min(14, width * 0.75))
  const candleX = x + (width - candleWidth) / 2
  const centerX = x + width / 2

  return (
    <g className="candlestick">
      {/* High/Low Wick */}
      <line
        x1={centerX}
        y1={yHigh}
        x2={centerX}
        y2={yLow}
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      {/* Open/Close Body */}
      <rect
        x={candleX}
        y={bodyTop}
        width={candleWidth}
        height={bodyHeight}
        fill={color}
        stroke={color}
        strokeWidth={0.5}
        rx={1}
      />
    </g>
  )
}

export function LivePriceChart({
  symbol: initialSymbol = 'BTCUSDT',
  availableSymbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT'],
  defaultTimeframe = '1m',
  currentCandle,
  className = '',
  onSymbolChange,
}: LivePriceChartProps) {
  const [currentSymbol, setCurrentSymbol] = useState(initialSymbol)
  const [timeframe, setTimeframe] = useState(defaultTimeframe)
  const [chartType, setChartType] = useState<'line' | 'candle'>('candle')
  const [data, setData] = useState<KlinePoint[]>([])
  const [liveTickerPrice, setLiveTickerPrice] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Sync if initialSymbol changes externally
  useEffect(() => {
    if (initialSymbol && initialSymbol !== currentSymbol) {
      setCurrentSymbol(initialSymbol)
    }
  }, [initialSymbol])

  // Real-time live ticker price polling with in-flight lock and abort timeout
  useEffect(() => {
    let isMounted = true
    let inFlight = false

    const fetchLivePrice = async () => {
      if (inFlight) return
      inFlight = true
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 3500)

      try {
        let price: number | null = null
        try {
          const res = await fetch(
            `https://api.binance.com/api/v3/ticker/price?symbol=${encodeURIComponent(currentSymbol)}`,
            { signal: controller.signal },
          )
          if (res.ok) {
            const json = await res.json()
            price = parseFloat(json.price)
          }
        } catch {
          // Fallback via proxy
          const res = await fetch(
            `/api/market/klines?symbol=${encodeURIComponent(currentSymbol)}&interval=1m&limit=1`,
            { signal: controller.signal },
          )
          if (res.ok) {
            const json = await res.json()
            if (Array.isArray(json) && json.length) price = parseFloat(json[0][4])
          }
        }

        if (isMounted && price !== null && !isNaN(price)) {
          setLiveTickerPrice(price)
        }
      } catch (err) {
        // network blip
      } finally {
        clearTimeout(timeoutId)
        inFlight = false
      }
    }

    fetchLivePrice()
    const timer = setInterval(fetchLivePrice, 3500)
    return () => {
      isMounted = false
      clearInterval(timer)
    }
  }, [currentSymbol])

  // Fetch candles helper with abort timeout and in-flight guard
  const fetchKlines = useCallback(
    async (sym: string, tf: string, isManual = false) => {
      if (isManual) setIsRefreshing(true)
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 4500)
      try {
        let res: Response
        try {
          // Direct public endpoint for optimal speed
          res = await fetch(
            `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(sym)}&interval=${encodeURIComponent(tf)}&limit=60`,
            { signal: controller.signal },
          )
        } catch {
          // Fallback to internal API route proxy
          res = await fetch(
            `/api/market/klines?symbol=${encodeURIComponent(sym)}&interval=${encodeURIComponent(tf)}&limit=60`,
            { signal: controller.signal },
          )
        }

        if (res.ok) {
          const raw: any[] = await res.json()
          const parsed: KlinePoint[] = raw.map((k) => {
            const timeMs = Number(k[0])
            const date = new Date(timeMs)
            const dateStr =
              tf === '1d'
                ? date.toLocaleDateString('en-IN', {
                    timeZone: 'Asia/Kolkata',
                    month: 'short',
                    day: 'numeric',
                  })
                : date.toLocaleTimeString('en-IN', {
                    timeZone: 'Asia/Kolkata',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                  })

            return {
              time: timeMs,
              dateStr,
              open: parseFloat(k[1]),
              high: parseFloat(k[2]),
              low: parseFloat(k[3]),
              close: parseFloat(k[4]),
              volume: parseFloat(k[5]),
            }
          })
          setData(parsed)

          // Also initialize liveTickerPrice from the latest candle close
          if (parsed.length > 0) {
            setLiveTickerPrice((prev) => prev || parsed[parsed.length - 1].close)
          }
        }
      } catch (err) {
        console.warn('[LivePriceChart] Failed to fetch klines:', err)
      } finally {
        clearTimeout(timeoutId)
        setLoading(false)
        if (isManual) setIsRefreshing(false)
      }
    },
    [],
  )

  // Initial load and on timeframe or symbol change
  useEffect(() => {
    setLoading(true)
    fetchKlines(currentSymbol, timeframe)
  }, [currentSymbol, timeframe, fetchKlines])

  // Periodic polling for full candle array refresh every 6s
  useEffect(() => {
    const timer = setInterval(() => {
      fetchKlines(currentSymbol, timeframe)
    }, 6000)
    return () => clearInterval(timer)
  }, [currentSymbol, timeframe, fetchKlines])

  // Real-time live chart data with live tick integrated into the active candle
  const chartData = useMemo(() => {
    if (!data.length) return data
    if (!liveTickerPrice) return data

    const updated = [...data]
    const lastIdx = updated.length - 1
    const last = updated[lastIdx]
    if (last) {
      updated[lastIdx] = {
        ...last,
        close: liveTickerPrice,
        high: Math.max(last.high, liveTickerPrice),
        low: Math.min(last.low, liveTickerPrice),
      }
    }
    return updated
  }, [data, liveTickerPrice])

  // Calculate metrics over visible period
  const firstPoint = chartData[0]
  const latestPoint = chartData[chartData.length - 1]
  const currentPrice = liveTickerPrice || (latestPoint ? latestPoint.close : 0)
  const openPrice = firstPoint ? firstPoint.open : currentPrice

  const priceDiff = currentPrice - openPrice
  const pctDiff = openPrice > 0 ? (priceDiff / openPrice) * 100 : 0
  const isUp = priceDiff >= 0

  const highPrice = chartData.reduce((max, p) => Math.max(max, p.high), currentPrice || 0)
  const lowPrice = chartData.reduce(
    (min, p) => Math.min(min, p.low),
    currentPrice || Number.MAX_VALUE,
  )
  const totalVolume = chartData.reduce((acc, p) => acc + p.volume, 0)

  // Dynamic Y domain
  const yMin = useMemo(() => {
    if (!chartData.length) return 0
    const min = Math.min(...chartData.map((d) => d.low))
    return min * 0.9992
  }, [chartData])

  const yMax = useMemo(() => {
    if (!chartData.length) return 100
    const max = Math.max(...chartData.map((d) => d.high))
    return max * 1.0008
  }, [chartData])

  const strokeColor = isUp ? 'var(--profit)' : 'var(--loss)'
  const gradientId = `priceGradient-${currentSymbol}-${timeframe}`

  const handleSelectSymbol = (sym: string) => {
    setCurrentSymbol(sym)
    setLiveTickerPrice(null)
    onSymbolChange?.(sym)
  }

  // Ensure currentSymbol is in available list
  const tickerList = useMemo(() => {
    const list = [...availableSymbols]
    if (!list.includes(currentSymbol)) list.unshift(currentSymbol)
    return list
  }, [availableSymbols, currentSymbol])

  return (
    <div
      className={`rounded-xl border border-border bg-card/60 p-4 sm:p-5 flex flex-col gap-4 shadow-sm backdrop-blur-sm ${className}`}
    >
      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3.5">
        <div className="flex flex-wrap items-center gap-3">
          {/* Interactive Ticker Dropdown Selector */}
          {tickerList.length > 1 ? (
            <Menu>
              <MenuTrigger
                render={
                  <button
                    type="button"
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border bg-secondary/50 hover:bg-secondary text-foreground font-bold text-base tracking-tight transition-colors cursor-pointer group"
                    title="Change trading ticker"
                  >
                    <span className="relative flex size-2">
                      <span className="absolute inset-0 animate-ping rounded-full bg-profit opacity-75" />
                      <span className="relative size-2 rounded-full bg-profit" />
                    </span>
                    <span>{currentSymbol}</span>
                    <ChevronDown className="size-3.5 text-muted-foreground group-hover:text-foreground transition-transform" />
                  </button>
                }
              />
              <MenuContent align="start" className="w-48">
                <MenuLabel>Select Market Ticker</MenuLabel>
                {tickerList.map((sym) => (
                  <MenuItem
                    key={sym}
                    onClick={() => handleSelectSymbol(sym)}
                    className={currentSymbol === sym ? 'text-brand font-semibold' : ''}
                  >
                    <span
                      className={`size-1.5 rounded-full mr-1.5 ${
                        currentSymbol === sym ? 'bg-brand' : 'bg-muted-foreground/40'
                      }`}
                    />
                    {sym}
                  </MenuItem>
                ))}
              </MenuContent>
            </Menu>
          ) : (
            <div className="flex items-center gap-2">
              <span className="relative flex size-2.5">
                <span className="absolute inset-0 animate-ping rounded-full bg-profit opacity-75" />
                <span className="relative size-2.5 rounded-full bg-profit" />
              </span>
              <span className="font-bold text-base tracking-tight text-foreground">{currentSymbol}</span>
            </div>
          )}

          {/* Real-time Crypto Price Display */}
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold font-mono text-foreground tracking-tight">
              ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span
              className={`inline-flex items-center gap-1 font-mono text-xs font-semibold px-2 py-0.5 rounded-full ${
                isUp
                  ? 'bg-profit/15 text-profit border border-profit/30'
                  : 'bg-loss/15 text-loss border border-loss/30'
              }`}
            >
              {isUp ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
              {isUp ? '+' : ''}
              {pctDiff.toFixed(2)}% ({isUp ? '+' : ''}
              ${Math.abs(priceDiff).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
            </span>
          </div>
        </div>

        {/* Right Tools: Line vs Candle Toggle & Timeframe Selector */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {/* Chart Type Toggle: Line vs Candle */}
          <div className="flex items-center gap-0.5 bg-secondary/60 p-1 rounded-lg border border-border shrink-0">
            <button
              type="button"
              onClick={() => setChartType('line')}
              title="Line Chart"
              className={`size-6 flex items-center justify-center rounded-md transition-all cursor-pointer ${
                chartType === 'line'
                  ? 'bg-brand text-brand-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-card'
              }`}
            >
              <LineChart className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setChartType('candle')}
              title="Candlestick Chart"
              className={`size-6 flex items-center justify-center rounded-md transition-all cursor-pointer ${
                chartType === 'candle'
                  ? 'bg-brand text-brand-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-card'
              }`}
            >
              <CandlestickChart className="size-3.5" />
            </button>
          </div>

          {/* Timeframe Selector */}
          <div className="flex items-center gap-1 bg-secondary/60 p-1 rounded-lg border border-border">
            {TIMEFRAMES.map((tf) => {
              const active = tf.id === timeframe
              return (
                <button
                  key={tf.id}
                  onClick={() => setTimeframe(tf.id)}
                  className={`h-6 px-2 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    active
                      ? 'bg-brand text-brand-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-card'
                  }`}
                >
                  {tf.label}
                </button>
              )
            })}
          </div>

          <button
            onClick={() => fetchKlines(currentSymbol, timeframe, true)}
            title="Refresh chart"
            className="size-8 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer shrink-0 ml-0.5"
          >
            <RefreshCw className={`size-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="w-full h-64 sm:h-72 relative">
        {loading && chartData.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <RefreshCw className="size-5 animate-spin text-brand" />
            <span className="text-xs">Connecting live crypto market feed...</span>
          </div>
        ) : chartType === 'line' ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={strokeColor} stopOpacity={0.28} />
                  <stop offset="95%" stopColor={strokeColor} stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid stroke="rgba(255, 255, 255, 0.05)" strokeDasharray="3 3" vertical={false} />

              <XAxis
                dataKey="dateStr"
                stroke="rgba(255, 255, 255, 0.25)"
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
                dy={6}
                minTickGap={25}
              />

              <YAxis
                orientation="right"
                stroke="rgba(255, 255, 255, 0.25)"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                domain={[yMin, yMax]}
                tickFormatter={(val: number) =>
                  `$${val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val.toFixed(1)}`
                }
              />

              {/* Seamless transparent cursor (no bright white box) */}
              <RechartsTooltip
                cursor={{ stroke: 'rgba(255, 255, 255, 0.15)', strokeDasharray: '3 3' }}
                content={<CustomChartTooltip />}
              />

              <Area
                type="monotone"
                dataKey="close"
                stroke={strokeColor}
                strokeWidth={2}
                fillOpacity={1}
                fill={`url(#${gradientId})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255, 255, 255, 0.05)" strokeDasharray="3 3" vertical={false} />

              <XAxis
                dataKey="dateStr"
                stroke="rgba(255, 255, 255, 0.25)"
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
                dy={6}
                minTickGap={25}
              />

              <YAxis
                orientation="right"
                stroke="rgba(255, 255, 255, 0.25)"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                domain={[yMin, yMax]}
                tickFormatter={(val: number) =>
                  `$${val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val.toFixed(1)}`
                }
              />

              {/* Seamless transparent cursor (no bright white box on hover) */}
              <RechartsTooltip
                cursor={{ fill: 'transparent', stroke: 'rgba(255, 255, 255, 0.12)', strokeDasharray: '3 3' }}
                content={<CustomChartTooltip />}
              />

              <Bar
                dataKey="close"
                shape={<CandlestickShape yMin={yMin} yMax={yMax} />}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* OHLCV Summary Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-2 border-t border-border/50 text-xs font-mono">
        <div className="flex flex-col bg-secondary/40 px-3 py-2 rounded-lg border border-border/40">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Period Open</span>
          <span className="font-bold text-foreground">
            ${openPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex flex-col bg-secondary/40 px-3 py-2 rounded-lg border border-border/40">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Period High</span>
          <span className="font-bold text-profit">
            ${highPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex flex-col bg-secondary/40 px-3 py-2 rounded-lg border border-border/40">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Period Low</span>
          <span className="font-bold text-loss">
            ${lowPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex flex-col bg-secondary/40 px-3 py-2 rounded-lg border border-border/40">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Live Close (LTP)</span>
          <span className="font-bold text-brand">
            ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex flex-col bg-secondary/40 px-3 py-2 rounded-lg border border-border/40">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Window Vol</span>
          <span className="font-bold text-foreground">
            {totalVolume.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    </div>
  )
}
