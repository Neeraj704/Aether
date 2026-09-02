import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const symbol = searchParams.get('symbol') || 'BTCUSDT'
  const interval = searchParams.get('interval') || '1m'
  const limit = searchParams.get('limit') || '60'

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 4000)

    const res = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=${encodeURIComponent(limit)}`,
      {
        headers: {
          'User-Agent': 'Aether-Trading-Bot/1.0',
        },
        signal: controller.signal,
        next: { revalidate: 2 },
      },
    )
    clearTimeout(timeoutId)

    if (!res.ok) {
      return NextResponse.json(
        { error: `Binance API error: ${res.status}` },
        { status: res.status },
      )
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Market data timeout' },
      { status: 504 },
    )
  }
}
