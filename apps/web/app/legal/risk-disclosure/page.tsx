import type { Metadata } from 'next'
import { LegalPageLayout } from '@/components/legal/legal-page-layout'
import { AlertTriangle } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Risk Disclosure',
  description: 'Comprehensive risk disclosure and simulation disclaimers for Aether users.',
}

export default function RiskDisclosurePage() {
  return (
    <LegalPageLayout title="Risk Disclosure" lastUpdated="24 August 2026">
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-5 text-foreground">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-bold text-foreground">Crucial Notice Regarding Financial Risk</h3>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Trading securities, equities, futures, options, commodities, foreign exchange, and digital
              assets carries a <strong>substantial risk of loss</strong> and is not suitable for every
              individual. You may lose some, all, or more than your initial invested capital. Never trade with
              money you cannot afford to lose.
            </p>
          </div>
        </div>
      </div>

      <h2>1. Zero Investment Advice &amp; No Fiduciary Duty</h2>
      <p>
        Aether is an interactive research, graphical modeling, and backtest simulation platform. <strong>Nothing within the Platform constitutes investment, financial, legal, tax, or regulatory advice.</strong>
      </p>
      <p>
        Aether Systems Pvt. Ltd. is not a registered investment advisor (RIA), broker-dealer, commodity
        trading advisor (CTA), portfolio manager, or financial planner with SEBI, the SEC, or any other
        regulatory body. We do not manage client assets, solicit capital, execute trades on behalf of
        users, or endorse specific assets or strategies.
      </p>
      <p>
        All bots, graphs, node configurations, indicators, and debate mechanisms created or cloned on the
        Platform are designed and evaluated at your sole discretion and risk. You bear sole responsibility
        for assessing the suitability of any trade, strategy, or automated system.
      </p>

      <h2>2. Past Performance &amp; The Reality of Backtest Simulations</h2>
      <p>
        <strong>Backtest results describe the past. They are not a forecast, and they never guarantee future results.</strong>
      </p>
      <p>
        A backtest is a mathematical simulation over a historical data slice. A favorable historical equity
        curve, high Sharpe ratio, or low simulated drawdown does not prove or guarantee that a bot will
        remain profitable in live forward trading. When evaluating backtests, you must account for the
        critical biases inherent to historical simulation:
      </p>
      <ul>
        <li>
          <strong>Lookahead Bias:</strong> The accidental incorporation of pricing, volume, or corporate
          action data that was not yet available in the real market at the simulated moment of decision.
          While Aether utilizes point-in-time candle feeds, custom indicators or delayed reporting can
          inadvertently introduce lookahead distortion.
        </li>
        <li>
          <strong>Survivorship Bias:</strong> Simulating exclusively across present-day index constituents or
          active tickers while omitting companies that were delisted, liquidated, acquired, or went bankrupt
          during the historical test window.
        </li>
        <li>
          <strong>Overfitting &amp; Curve-Fitting:</strong> Over-tuning indicator thresholds, stop distances,
          or agent weights until the historical equity curve looks immaculate on historical noise. The more
          parameters you tune to a static dataset, the more likely the strategy will fail when deployed into
          new market regimes. Walk-forward and Monte Carlo testing help highlight this vulnerability.
        </li>
        <li>
          <strong>Cost Blindness &amp; Execution Friction:</strong> Backtests that omit realistic transaction
          fees, exchange turnover charges, stamp duties, STT taxes, and realistic market slippage often show
          phantom alpha that completely evaporates in live execution.
        </li>
      </ul>

      <h2>3. Paper Trading vs. Live Market Realities</h2>
      <p>
        By default, all bots built on Aether run in <strong>paper trading mode</strong> with simulated fills
        and zero real money at risk. While paper trading forward-tests your strategy on live tick streams, it
        remains a simulation with several structural divergences from live trading:
      </p>
      <ul>
        <li>
          <strong>Fill Assumptions:</strong> Simulated paper orders assume immediate fill at current bid/ask
          or candle close prices without accounting for queue priority, partial fills, or order book depth.
        </li>
        <li>
          <strong>Slippage Under Market Stress:</strong> During rapid market breaks, high-volatility news
          announcements, or macro regime shifts, bid-ask spreads widen significantly, and market liquidity
          can instantly dry up. Real-world slippage during stress events routinely exceeds backtest estimates.
        </li>
        <li>
          <strong>Psychological Differences:</strong> Paper trading involves no financial fear or greed.
          Executing strategies with real capital introduces psychological pressures that frequently cause
          traders to override, alter, or abandon automated systems during drawdowns.
        </li>
      </ul>

      <h2>4. Algorithmic System &amp; Infrastructure Failure Modes</h2>
      <p>
        Automated algorithmic bots are vulnerable to unique operational and systemic risks, including:
      </p>
      <ul>
        <li>
          <strong>Market Regime Changes:</strong> Quantitative edges discovered during trending or
          low-volatility periods can abruptly fail during choppy sideways regimes, sudden flash crashes, or
          liquidity freezes.
        </li>
        <li>
          <strong>Data Feed Latencies &amp; Outages:</strong> Delayed candle delivery, exchange socket
          disconnects, corrupted tick feeds, or upstream API downtime can cause agents to misfire or delay
          critical exit signals.
        </li>
        <li>
          <strong>Logic &amp; Configuration Errors:</strong> Misconfigured risk gates, inverted condition
          logic, or missing drawdown brakes can lead to rapid capital drawdowns if an unexpected sequence of
          trades occurs.
        </li>
      </ul>

      <h2>5. Live Money Execution &amp; Mandatory Risk Controls</h2>
      <p>
        Connecting a live brokerage account to execute real-money orders is a separate, explicitly opt-in
        tier requiring additional verification and brokerage API authentication.
      </p>
      <p>
        To mitigate catastrophic automated errors, Aether requires a non-optional <strong>Risk Management Layer</strong> (such as Risk Gates, Daily Loss Caps, and Drawdown Brakes) in all valid bot graphs. However, software risk gates cannot guarantee the prevention of financial loss under extreme market conditions, broker API disconnection, or exchange circuit breaker events.
      </p>

      <h2>6. Final Acknowledgment</h2>
      <p>
        By using the Aether platform to design, backtest, or deploy trading agents, you explicitly acknowledge
        that you have reviewed this Risk Disclosure, understand the substantial hazards of algorithmic trading,
        and assume full and unreserved responsibility for any and all financial outcomes.
      </p>
    </LegalPageLayout>
  )
}
