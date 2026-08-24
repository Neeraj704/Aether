# ⚡ QUANTUM EDGE
## Master Blueprint — Agentic Crypto Trading System (Full Plan, In Depth)

> *"Prove it on historical data, prove it on paper, then — and only then — let it touch real money."*

---

## 1. VISION & PHILOSOPHY

**QUANTUM EDGE** is a multi-agent, self-improving crypto trading system. It trades **BTC first**, with other currencies added one at a time later. It does **not** scalp — target hold times are **10–15 minutes, 1 hour, 4 hours, and sometimes longer**, with decisions made on 15m/1h/4h candle cycles. This holding-period choice matters architecturally: it's what makes it workable to have multiple LLM reasoning steps (debate, chart-pattern reading, final decision) inside the decision loop — a true sub-minute scalper couldn't tolerate that latency, but a 15-minute-to-4-hour hold comfortably can.

Every decision starts from hard numbers (price, indicators, order book, ML model outputs) computed deterministically. Only after that numeric picture is locked in do any LLM-based agents — debate, chart-pattern reading, macro/sentiment interpretation, final decision-making — get to reason over it. Nothing an LLM says can override or contradict the actual computed data.

Every part of the system is individually switchable through one configuration file — every data source, every analysis agent, every ML model, every LLM-based layer. Nothing requires touching code to turn off. This is essential for controlling API costs, for testing what happens with a source removed, and for isolating exactly which signals are actually earning their keep.

Nothing gets to influence real trades until it has *earned* that right with evidence: first tested against years of historical data, then run live on paper for a real stretch of time across multiple market conditions, then formally reviewed against a fixed bar — and only after clearing all of that does it get turned on for real money, starting small.

### Core Principles

- **Determinism before LLMs.** All numerical data (indicators, prices, ML predictions, order book state) is computed first, without any LLM involvement, and locked into a snapshot. LLM-based agents reason on top of that snapshot; they cannot invent or override numbers.
- **Nothing trades real money until it's proven.** Historical backtest → paper trading → formal evidence review → live, in that order, every time.
- **New or unproven components run in observation mode first.** They generate a real opinion every cycle, get logged, and get scored against what actually happened — but they don't get to change the trade until they've demonstrably added value over a baseline that ignores them. This applies to the internal debate system and the visual chart-pattern reader described below.
- **Every agent is a switch.** Every data source and every analytical agent can be turned off from one config file, with a clearly defined, safe fallback for everything downstream of it.
- **One coin first.** Full validation on BTC before touching a second currency, so there's only ever one thing that can be wrong at a time while you're debugging.
- **Risk management is not optional and not a toy to ablation-test.** Portfolio risk limits, position sizing, and pre-trade guard checks stay on; everything else is a genuine switch.
- **Learning happens deliberately, not by accident.** Rule synthesis and model retraining run in controlled batches you can review, not as silent continuous updates against open positions.

---

## 2. WHERE THE DESIGN COMES FROM

Two reference repos shaped this plan, plus a set of components built new for this project.

### QRAK — a paper-trading, single-asset, LLM-driven bot with no traditional ML

What it does well, and what QUANTUM EDGE borrows from it: a ChromaDB vector-memory "brain" that stores every trade as an embedding with rich metadata; a reflection engine that synthesizes natural-language rules out of clusters of similar past trades; post-mortem autopsies written by an LLM after every closed trade; a "surprise ratio" that flags lucky wins so they don't get reinforced as if they were skill; classification of AI mistakes into types (overconfidence, wrong-regime, premise failure); a sequential guard pipeline that rejects bad trades fast, with every rejection logged and fed back into future prompts; a Numba JIT-compiled indicator library with no external dependency; order-book microstructure tracking; a hard rule that stop-losses can't be tightened without real price progress; and — most relevant to a new piece of this plan — sending a rendered OHLCV chart image to a multimodal LLM for visual confirmation alongside the numeric signals.

Where it falls short: no live execution, single asset only, no traditional ML models, no backtesting at all, and its retrieval is keyword-based rather than semantic.

### TAURI (TradingAgents) — a LangGraph-based multi-agent debate framework, research-only

What it does well, and what QUANTUM EDGE borrows from it: the entire pipeline modeled as a LangGraph state graph with conditional routing; a genuinely adversarial two-tier debate (bullish vs bearish case, then a separate risk debate); structured Pydantic outputs instead of free text; a "verified market snapshot" step that locks in ground-truth numbers before any LLM reasoning starts, so agents can't contradict real data; a vendor-routing layer with fallback chains; a multi-provider LLM factory (OpenAI, Anthropic, Google, Groq, Ollama, etc.) behind one interface; deferred reflection (the LLM looks back on a decision only once the real outcome is known); and SQLite-based checkpointing for crash recovery.

Where it falls short: no live execution, daily-only data (nothing intraday), no traditional ML, no backtesting, no crypto-specific data like funding rate or on-chain flows, no real-time streaming.

### Built new for this project (neither repo had these)

Live exchange execution via CCXT; a seven-model traditional ML ensemble (LSTM, XGBoost, CatBoost, LightGBM, Random Forest, GNN, GRU); a reinforcement-learning position-sizing/action agent; on-chain data ingestion; funding-rate/open-interest/liquidation data; a Bayesian confidence-fusion engine; fractional-Kelly position sizing; semantic (not keyword) news search via FAISS; cross-asset portfolio risk management; a **visual, multi-timeframe chart-pattern reading agent** built by formalizing the exact manual process of rendering a chart and asking a vision-capable LLM to read it (detailed in Section 7); a **complete historical → paper → live validation pipeline**, which neither reference repo had at all; and a **single master configuration file that turns every component on or off** without touching code.

---

## 3. THE VALIDATION PIPELINE — Nothing Trades Real Money Until It Clears This

This is the backbone the rest of the system sits inside. Every component — the ML ensemble, the debate system, the visual chart-pattern reader — moves through the same four stages before it's trusted with real capital.

### Stage 1 — Historical Walk-Forward Backtest *(the deterministic + ML core only)*

What gets tested here: the indicator engine, order-book features, the ML ensemble, position-sizing logic, and risk-gate logic. What does **not** get tested here: the debate system or the visual chart-pattern reader — because both depend on live news, sentiment, and rendered chart context tied to a specific moment in time, which can't be faithfully or cheaply reconstructed for years of history, and re-running years of candles through multi-round LLM calls would be expensive and non-deterministic (ask twice, get two different debates). So the debate and chart-pattern layers are validated **forward-only**, starting in Stage 2 — plan your timeline knowing that piece takes longer than the ML backtest.

Requirements to pass:
- At least 2–3 years of BTC price history, split into segments that clearly cover an uptrend, a downtrend, and a ranging/choppy period.
- True walk-forward validation — train on one window, test on the next, roll forward — never a single in-sample fit.
- Tested net of realistic fees, slippage, and spread.
- Benchmarked against buy-and-hold and a simple moving-average-crossover strategy over the same periods.
- **To pass:** the system has to beat both baselines, net of costs, in *every* regime segment individually — not just on average. A system that only wins because one segment happened to be a runaway bull run hasn't actually proven anything about how it handles a downtrend or chop.

If this stage fails, don't move forward — revisit the features or models first.

### Stage 2 — Live Paper Trading (Real-Time, No Real Money)

Once Stage 1 passes, the full system runs live, on paper, for a real stretch of time — long enough to see genuine performance across an uptrend, a downtrend, and a ranging period, not just a fixed number of calendar days. If your paper-trading window happens to land entirely inside one regime, extend it; a good run during a single trending month proves nothing about how the system handles the next chop.

During this stage:

- The **deterministic core, ML ensemble, and confidence/decision/risk/execution layers** are authoritative — they drive the actual paper trade taken.
- The **debate system and the visual chart-pattern reader run in observation mode**: they produce a real, logged opinion every single cycle, but that opinion does not change what STRATEGIST decides to trade. Their calls are compared afterward against what actually happened.
- Every single decision is logged together with a full snapshot of exactly which agents and data sources were switched on at that moment (Section 8) — this is what makes it possible, later, to tell whether a good or bad outcome was caused by a real signal or just by whatever happened to be toggled on that day.

### Stage 3 — Formal Evidence Review (a Fixed, Pre-Agreed Bar — Decided Before You Look at Results)

At the end of Stage 2, decide whether the debate system and the visual chart-pattern reader get promoted to actually influence trades. The exact scoring mechanics are in Section 9. In short: there needs to be enough scored trades, spanning all three market regimes, before any number is trusted; the comparison is between "what STRATEGIST actually did without this component" and "what it would have done with this component included," weighted by trade outcome size (not just win/loss); and the bar for promotion is written down *before* you look at the results, so you're not tempted to lower it after seeing a promising-but-not-quite-there number.

If a component doesn't clear the bar, it stays in observation mode (or gets switched off entirely) — it never gets forced into real decisions "because it should theoretically help."

### Stage 4 — Live Trading, Small and Staged

Only after Stages 1–3 are cleared for BTC does real capital get involved, starting small and scaling up gradually. A second currency does not start its own Stage 1 until BTC has run in Stage 4 for a meaningful stretch without a structural failure — a blown risk limit, a broken data feed causing bad decisions, and so on.

### The Pipeline, Visually

```
   Historical BTC price data (2-3+ years, multi-regime)
                    │
                    ▼
   ┌───────────────────────────────────────┐
   │  STAGE 1 — HISTORICAL BACKTEST        │   ML + indicators only.
   │  walk-forward, vs buy&hold + MA-cross │   Must win in EVERY regime segment.
   └───────────────────┬───────────────────┘
                       │ passes
                       ▼
   ┌───────────────────────────────────────┐
   │  STAGE 2 — LIVE PAPER TRADING         │   Full system live, real-time, no real $.
   │  (until multiple regimes observed)    │   Debate + chart-reader: logged, not authoritative.
   └───────────────────┬───────────────────┘
                       │ enough scored trades, all regimes covered
                       ▼
   ┌───────────────────────────────────────┐
   │  STAGE 3 — FORMAL EVIDENCE REVIEW     │   Pre-agreed bar, decided before results exist.
   │  (manual, against fixed criteria)     │   Debate/chart-reader promoted or not.
   └───────────────────┬───────────────────┘
                       │ passes
                       ▼
   ┌────────────────────────────────────────┐
   │  STAGE 4 — LIVE TRADING (small, staged)│   New currencies repeat Stage 1
   │                                        │   only after this one is stable.
   └────────────────────────────────────────┘
```

---

## 4. CURRENCY ROLLOUT — BTC First, Others Added One at a Time

```
BTC ── Stage 1 → Stage 2 → Stage 3 → Stage 4 (live, small, stable) ─────┐
                                                                        │
                                                                        ▼
                                                    ETH ── Stage 1 → Stage 2 → Stage 3 → Stage 4 ──────┐
                                                                                                       │
                                                                                                       ▼
                                                                                SOL ── (same pipeline) ...
                                                                                   then BNB, XRP, MATIC
```

Why sequential rather than all six from day one:

1. **Debuggability.** One pipeline, one set of logs, one thing that can go wrong at a time.
2. **Cost control.** One currency's worth of LLM calls and data-vendor calls, not six.
3. **Honest validation.** Each currency needs its own full pipeline run — BTC clearing Stage 1–3 tells you nothing certain about how ETH behaves.

What's shared across all currencies from day one (built once, currency-agnostic): the news feed, sentiment scraping, macro/Fear&Greed data, on-chain data, cross-market data (BTC dominance, global market cap), the memory system, the portfolio-level risk manager, the execution gateway, and the dashboard.

What's per-currency (BTC first, then re-instantiated for each new coin): the market data fetcher, the indicator engine, the microstructure agent, all six per-coin intelligence agents, the visual chart-pattern reader, the ML ensemble, the RL agent, the four debate agents, the confidence-fusion agent, and the final decision agent. These are written generically from the start (parameterized by coin symbol), so adding ETH later is a config change plus a fresh Stage 1 run, not a rewrite.

---

## 5. FULL AGENT ECOSYSTEM — Every Named Agent, BTC Instance

Every agent below has a kill switch in the master config (Section 8). Portfolio risk, position sizing, and the pre-trade guard pipeline are the one category where flipping the switch off also blocks live trading — everything else is a genuine, safe-to-flip switch.

### LAYER 0 — ORCHESTRATION

| Agent | Role |
|---|---|
| **NEXUS** | Master supervisor. Spawns and monitors the per-currency pipeline(s), tracks which validation stage each currency is in, enforces global limits. |
| **HERMES** | Execution commander. The single gateway to the exchange via CCXT — receives approved trades, picks an order strategy, submits, confirms fills. |

### LAYER I — DATA COLLECTION

| Agent | Role | Kill switch behavior when off |
|---|---|---|
| **PRISM-BTC** | Fetches live OHLCV across all timeframes plus ticker and raw order book via exchange WebSocket. | Core feed — not meant to be switched off. |
| **HYDRA** | BTC dominance, global market cap, DeFi TVL, altcoin season index. Shared across currencies. | Off → cross-market context simply excluded from fusion, weight redistributed. |
| **POSEIDON-BTC** | Funding rate, open interest, long/short ratio, liquidation map from perpetuals + Coinglass. | Off → derivatives context excluded, weight redistributed. |
| **TITAN** | On-chain data: exchange net flows, whale movements, active addresses, SOPR, MVRV. Shared. | Off → on-chain signal excluded, weight redistributed. |

### LAYER II — FEATURE ENGINEERING

| Agent | Role |
|---|---|
| **ARCHIMEDES-BTC** | Numba JIT-compiled indicator engine — 50+ indicators (RSI, MACD, ATR, ADX, VWAP, Bollinger, Ichimoku, Supertrend, OBV, MFI, Hurst Exponent, liquidity-sweep detection) across every timeframe, in milliseconds. |
| **MERCURY-BTC** | Order-book microstructure: bid/ask depth, cross-candle delta, spread, imbalance ratio, absorption zones. |

### LAYER III — INTELLIGENCE LAYER

| Agent | Role |
|---|---|
| **REGIME-BTC** | Classifies current market state: strong trend, weak trend, ranging, volatile breakout, or distribution. |
| **FLOW-BTC** | Identifies liquidity pools, stop-hunt zones, order blocks, fair-value gaps. |
| **MOMENTUM-BTC** | Multi-timeframe trend alignment and momentum confirmation (EMA stacks, MACD trajectory, RSI divergence). |
| **VOLUME-BTC** | VWAP anchoring, volume profile, accumulation/distribution, OBV divergence. |
| **PATTERN-BTC** | Detects chart patterns **mathematically**, from price-series geometry — H&S, double top/bottom, flags, wedges, engulfing candles, etc. — with a computed completion probability. This is the "numbers-only" pattern detector, distinct from the visual reader below. |
| **STRUCTURE-BTC** | Maps support/resistance via swing points, Fibonacci retracements, pivot points, round numbers. |
| **OCULUS-BTC** | The **visual** chart-pattern reader — described in full in Section 7. Runs in observation mode until it clears Stage 3. |
| **HERALD** | Fetches, dedupes, and semantically summarizes crypto news; FAISS-based retrieval. Shared. |
| **ECHO** | Social sentiment from Twitter/X, Reddit, Telegram; FinBERT + VADER scoring. Shared. |
| **PULSE** | Fear & Greed Index, DXY, US10Y yield, CPI/Fed dates, Polymarket, FRED macro series. Shared. |
| **SPECTRA** | Google Trends, Polymarket, futures basis, Grayscale premiums — non-obvious alternative data. Shared. |

### LAYER IV — PREDICTION LAYER

| Agent | Role |
|---|---|
| **PROPHET-BTC** | ML ensemble orchestrator. Runs the following seven models in parallel and aggregates their directional predictions with confidence weights — each model has its own individual kill switch: **LSTM** (short-term sequences), **XGBoost** (feature-based), **CatBoost** (categorical-aware), **LightGBM** (fast scoring), **Random Forest** (medium-term), **GNN** (inter-asset correlation graph), **GRU** (ultra-short sequences). |

### LAYER V — REINFORCEMENT LEARNING

| Agent | Role |
|---|---|
| **DARWINEX-BTC** | A PPO/SAC reinforcement-learning agent that observes market state, decides position actions (enter/exit/hold/size), and learns from reward signal. Off by default via its kill switch until the rest of the system has a proven track record. When it is turned on, it retrains in scheduled offline batches on accumulated trade history — it never updates its policy continuously against open positions. |

### LAYER VI — DEBATE LAYER

| Agent | Role |
|---|---|
| **BULL-BTC** | Builds the strongest long case: entry catalysts, support structure, upside targets. |
| **BEAR-BTC** | Builds the strongest short case: resistance zones, distribution, macro headwinds, downside risk. |
| **SOCRATES-BTC** | Adversarially challenges both, flags contradictions, forces sharper argument. |
| **MAGISTRA-BTC** | Reads the full exchange and synthesizes a structured investment thesis: direction, conviction, key risks, primary driver. |

A separate risk sub-debate runs after MAGISTRA:

| Agent | Role |
|---|---|
| **WARDEN-AGGRESSIVE** | Argues for maximizing returns. |
| **WARDEN-CONSERVATIVE** | Argues for protecting capital. |
| **WARDEN-NEUTRAL** | Mediates between the two. |

The whole debate layer runs every cycle and gets scored, but starts in observation mode — its opinion doesn't move the trade until it clears Stage 3 (Section 3, Section 9). The risk sub-debate is scored and promoted independently of the directional debate, since it only affects position sizing, not direction.

### LAYER VII — CONFIDENCE ENGINE

| Agent | Role |
|---|---|
| **ORACLE-BTC** | Fuses ML ensemble output, RL signal (if on), debate thesis (if promoted), visual pattern read (if promoted), sentiment, macro, and on-chain into one Bayesian confidence score. Automatically re-weights around whatever's switched off or not yet promoted — it never fakes a neutral value for something that's simply missing. |

### LAYER VIII — DECISION LAYER

| Agent | Role |
|---|---|
| **STRATEGIST-BTC** | Reads ORACLE's confidence report plus memory-injected brain context and dynamic thresholds, and outputs one final decision: BUY / SELL / SHORT / EXIT / WAIT / NO_TRADE, with full reasoning and execution parameters. |

### LAYER IX — RISK LAYER

| Agent | Role |
|---|---|
| **SENTINEL** | Global portfolio risk manager: max daily loss, max drawdown, per-currency exposure cap, cross-asset correlation limits, total portfolio heat. |
| **WARDEN** | Position sizing via fractional Kelly Criterion, scaled by volatility and confidence tier. |
| **GUARDIAN** | Sequential pre-trade guard pipeline: cooldown window, symbol whitelist, max position size, daily loss stop, margin sufficiency, minimum risk/reward threshold. Fail-fast; every rejection logged. |

### LAYER X — EXECUTION LAYER

| Agent | Role |
|---|---|
| **HERMES** | Picks the order strategy (TWAP/VWAP/Limit/Market/Iceberg) based on size, liquidity, and urgency. |
| **BROKER** | CCXT exchange-abstraction layer (Binance/Bybit/OKX/Kraken) — handles auth, rate limits, WebSocket subscriptions, fills. Runs in paper mode until Stage 4. |

### LAYER XI — MONITORING LAYER

| Agent | Role |
|---|---|
| **ARGUS** | Checks every open position's P&L, distance to stop/target, trailing-stop conditions, and time-based exit rules every 30 seconds. |
| **VELOX** | Hard rule enforcement: a stop-loss cannot be tightened unless price has genuinely progressed toward the target by a learned threshold — this can't be overridden by an LLM alone. |

### LAYER XII — SELF-LEARNING LAYER

| Agent | Role |
|---|---|
| **NEMESIS** | Writes a structured post-mortem after every closed trade: verdict, expected-vs-actual, and a lesson, stored for retrieval. |
| **KRONOS** | Periodically clusters closed trades and synthesizes plain-language rules (best-practice, anti-pattern, corrective, AI-mistake) that get injected into future prompts. |
| **CASSANDRA** | Tracks each ML model's rolling accuracy and reweights the ensemble accordingly, flags weak models for retraining — and separately, runs the scorecards that track the debate layer's and the visual pattern reader's performance against real outcomes (Section 9). |

### LAYER XIII — MEMORY

| Agent | Role |
|---|---|
| **ATLAS** | Coordinates four memory systems: a vector store of trade experiences, a relational audit trail and trade history, a fast in-memory cache for live data, and a semantic index for news retrieval. |

### DASHBOARD

| Agent | Role |
|---|---|
| **AETHER** | Live web dashboard — signals for the active currency/currencies, open positions, P&L, brain-rule growth, agent activity log, the full config toggle panel, and the debate/pattern-reader scorecards. |

---

## 6. LAYER MAP (Condensed)

| Layer | Focus | Agents |
|---|---|---|
| 0 | Orchestration | NEXUS, HERMES |
| I | Data Collection | PRISM, HYDRA, POSEIDON, TITAN |
| II | Feature Engineering | ARCHIMEDES, MERCURY |
| III | Intelligence | REGIME, FLOW, MOMENTUM, VOLUME, PATTERN, STRUCTURE, OCULUS, HERALD, ECHO, PULSE, SPECTRA |
| IV | Prediction | PROPHET (7 sub-models) |
| V | Reinforcement Learning | DARWINEX |
| VI | Debate | BULL, BEAR, SOCRATES, MAGISTRA + WARDEN-variants (risk sub-debate) |
| VII | Confidence Engine | ORACLE |
| VIII | Decision | STRATEGIST |
| IX | Risk | SENTINEL, WARDEN, GUARDIAN |
| X | Execution | HERMES, BROKER |
| XI | Monitoring | ARGUS, VELOX |
| XII | Self-Learning | NEMESIS, KRONOS, CASSANDRA |
| XIII | Memory | ATLAS |
| — | Dashboard | AETHER |

---

## 7. OCULUS — THE VISUAL CHART-PATTERN READER, IN DEPTH

### The Idea, Stated Plainly

This formalizes exactly the manual workflow you described: take the price data, render it into an actual chart image for a given timeframe, and hand that image to a vision-capable LLM in a conversation, asking it to look at the chart the way a human technical analyst would and tell you what pattern it sees. OCULUS-BTC is that process, automated and run on a schedule, across every timeframe you care about, with the results logged and scored like every other agent in the system.

### The Mechanism, Step by Step

1. **Render.** For each active timeframe, generate an actual candlestick chart image from the OHLCV data — deterministically, from a charting library, not a screenshot of some live dashboard UI (this keeps every render reproducible: the same data always produces the same image).
2. **Send.** Each chart image goes to a vision-capable LLM (e.g. Claude or Gemini with image support) in a structured prompt/conversation, exactly like sending a screenshot in a chat and asking "what pattern do you see here?" — asking it to identify classical chart patterns: head & shoulders (and inverse), double/triple tops and bottoms, ascending/descending/symmetrical triangles, flags, pennants, wedges, cup & handle, rounding bottoms, channels, and candlestick formations (engulfing, doji, hammer, shooting star, morning/evening star).
3. **Structure the answer.** The LLM's reply is parsed into a structured record per timeframe: which pattern (if any), whether it's still forming or already confirmed, the implied direction, an implied price target, a confidence score, and a short plain-language rationale.
4. **Synthesize across timeframes.** A final summary reconciles what the different timeframes are saying — e.g. "the 4-hour chart shows a bullish flag mid-formation, sitting inside the broader ascending channel visible on the daily."

### Timeframes Covered

**1m, 5m, 15m, 30m, 1h, 4h, 1d, 5d, 30d** — one chart image rendered and analyzed per timeframe, each with its own individual on/off switch, so you can, for example, turn off 1m/5m if they're not relevant to a 4-hour hold, or turn off 30d if it rarely adds anything.

### Structured Output

```python
class TimeframePatternRead(BaseModel):
    timeframe: str                     # "1m","5m","15m","30m","1h","4h","1d","5d","30d"
    pattern_detected: Optional[str]     # e.g. "inverse_head_and_shoulders"
    stage: Literal["forming", "confirmed", "invalidated", "none"]
    implied_direction: Literal["LONG", "SHORT", "NEUTRAL"]
    implied_target: Optional[float]
    confidence: float                   # 0-100, self-reported by the vision LLM
    notes: str                          # brief plain-language rationale

class OculusReport(BaseModel):
    coin: str
    timeframe_reads: List[TimeframePatternRead]
    multi_timeframe_synthesis: str
    overall_direction: Literal["LONG", "SHORT", "NEUTRAL", "CONFLICTING"]
    overall_confidence: float
    timestamp: datetime
```

### Why This Is Kept Separate From PATTERN-BTC

PATTERN-BTC finds patterns by running geometry rules against the actual numbers — precise and cheap, but limited to exactly what it was coded to look for. OCULUS is a genuinely different kind of signal — a holistic visual read, the same way a discretionary chart trader eyeballs a chart, which can pick up on shapes that don't cleanly match a hard-coded rule, but is not (yet) proven to be reliable. Keeping them as two separately-logged, separately-scored inputs — rather than merging them into one "pattern signal" — is deliberate: it lets you find out empirically whether the visual read is actually adding anything beyond what the math-based detector already catches.

### Cost and Scheduling Controls

Vision-LLM calls are the most expensive single cost in the whole system, so:
- Every one of the 9 timeframes has its own switch.
- Short timeframes (5m/15m/30m) can be set to re-render and re-analyze every cycle; long timeframes (1h/4h/1d/5d/30d) can be set to refresh less often (e.g. only once an hour) since they don't change meaningfully within a 15-minute window.
- Rendered images are cached with a time-to-live matched to their timeframe, so a 30-day chart isn't needlessly regenerated every 15 minutes.

### Where It Sits in the Pipeline

OCULUS runs alongside the other Layer III intelligence agents, every decision cycle. Its output is logged and scored (Section 9) but is **not** authoritative in ORACLE's fusion until it clears the formal evidence review in Section 3 — exactly the same treatment as the debate layer, and independently scored from it, since it's entirely possible for one to prove useful and the other not.

---

## 8. THE MASTER CONFIG / KILL-SWITCH SYSTEM

### The Goal

Turn any data source, agent, or subsystem on or off — to save API costs, or to deliberately test what happens with something removed — by editing one file, never by touching code. Every agent reads its own on/off state from this file at the start of every cycle.

### `config/system_config.yaml`

```yaml
# ============================================================
# QUANTUM EDGE — Master Kill-Switch Config
# Edit this file to enable/disable any component.
# No code changes required.
# ============================================================

system:
  active_currency: "BTC"
  validation_stage: 1              # 1 | 2 | 3 | 4 — current stage, gates live-trading behavior

data_sources:
  prism:            { enabled: true  }   # OHLCV — core feed, always on
  hydra:            { enabled: true  }   # BTC dominance / global market data
  poseidon:         { enabled: true  }   # funding rate / OI / liquidations
  titan:            { enabled: false }   # on-chain data — off, saving API cost
  herald_news:      { enabled: true  }
  echo_sentiment:
    enabled: true
    sources:
      twitter:      { enabled: false }   # off this month — no API credits
      reddit:       { enabled: true  }
      telegram:     { enabled: false }
  pulse_macro:      { enabled: true  }
  spectra_altdata:  { enabled: false }

intelligence_agents:
  regime:           { enabled: true }
  flow:             { enabled: true }
  momentum:         { enabled: true }
  volume:           { enabled: true }
  pattern_algo:     { enabled: true }    # PATTERN-BTC, math-based
  structure:        { enabled: true }
  oculus:                                # visual chart-pattern reader
    enabled: true
    influences_decision: false           # observation mode until it clears Stage 3
    timeframes:
      1m:  { enabled: false }
      5m:  { enabled: true  }
      15m: { enabled: true  }
      30m: { enabled: true  }
      1h:  { enabled: true  }
      4h:  { enabled: true  }
      1d:  { enabled: true  }
      5d:  { enabled: false }
      30d: { enabled: false }
    refresh_policy:
      short_tf_every_cycle: true
      long_tf_hourly_only: true

ml_ensemble:
  prophet:
    enabled: true
    models:
      lstm:          { enabled: true  }
      xgboost:       { enabled: true  }
      catboost:      { enabled: false }   # excluded — underperforming per CASSANDRA's tracking
      lightgbm:      { enabled: true  }
      random_forest: { enabled: true  }
      gnn:           { enabled: false }   # not built yet
      gru:           { enabled: true  }

reinforcement_learning:
  darwinex:
    enabled: false                        # off until the non-RL system has a proven track record
    mode: "offline_batch_only"            # once turned on: never continuous online updates

debate_layer:
  enabled: true
  influences_decision: false              # observation mode until it clears Stage 3
  agents:
    bull:     { enabled: true }
    bear:     { enabled: true }
    socrates: { enabled: true }
    magistra: { enabled: true }
  risk_subdebate:
    enabled: true
    influences_decision: true              # scored/promoted independently of the directional debate
  verbosity: "concise"                     # concise | normal — concise = short, high-signal output only

risk_layer:
  sentinel:  { enabled: true }
  warden:    { enabled: true }
  guardian:  { enabled: true }

self_learning:
  nemesis:   { enabled: true }
  kronos:    { enabled: true }
  cassandra: { enabled: true }             # also runs the debate/oculus scorecards
```

### Graceful Degradation — What Happens Downstream When Something's Off

The rule that makes turning things off safe: **a disabled input is never silently treated as neutral.** Every place that fuses multiple signals renormalizes its weights around what's actually available, and flags that its evidence is reduced — it doesn't quietly pretend nothing changed.

| Switched off | What happens immediately | What happens downstream (in ORACLE's fusion) |
|---|---|---|
| `echo_sentiment` (all sources) | Sentiment score comes back empty instead of a number | ORACLE drops the sentiment weight and redistributes it across the remaining active inputs; the confidence report is flagged as running on reduced evidence |
| `titan` (on-chain) | On-chain signal comes back empty | Same — weight redistributed, evidence-quality flag set |
| One ML model (e.g. `catboost`) | Excluded from the ensemble vote | Model-agreement percentage is computed only across the remaining active models, not silently diluted by a phantom "vote" |
| `oculus` entirely | No visual pattern read that cycle | Decision proceeds without it; the scorecard simply notes "no read this cycle" rather than counting it as a miss |
| `debate_layer` entirely | No debate runs that cycle | STRATEGIST proceeds on the ML ensemble, technicals, sentiment, and macro alone |
| `spectra_altdata` | No alt-data signal | Simply excluded from supporting/conflicting evidence lists, never invented |
| `sentinel` / `warden` / `guardian` | Live trading is blocked entirely regardless of anything else | These are the one place the system won't proceed no matter what the rest of the config says |

### Logging Exactly What Was On, Every Single Decision

Every trade decision — paper or live — is stored together with a complete record of the config state that produced it:

```python
class DecisionContext(BaseModel):
    trade_id: str
    timestamp: datetime
    active_data_sources: Dict[str, bool]
    active_intelligence_agents: Dict[str, bool]
    active_ml_models: List[str]
    oculus_active_timeframes: List[str]
    debate_ran: bool
    debate_influenced_decision: bool
    oculus_influenced_decision: bool
    rl_active: bool
```

Without this, there's no way to later answer "did this trade lose because the strategy is bad, or because sentiment happened to be switched off that week?" This log is what makes every backtest, every paper-trading result, and the Stage 3 evidence review honest rather than guesswork.

### Practical Scenarios This Enables

- Run out of API credit for Twitter/on-chain this week → flip `echo_sentiment.sources.twitter.enabled` and `titan.enabled` to `false`. Nothing breaks; ORACLE reweights automatically.
- Want to know if the debate layer is worth its cost → compare periods with `debate_ran: true` against periods with `debate_layer.enabled: false`, using the Section 9 scorecard.
- Want to test OCULUS on only the timeframes closest to your hold time → turn off the other timeframes, no code touched.
- CASSANDRA flags an underperforming ML model → flip it off in config; PROPHET and ORACLE both adjust automatically.

---

## 9. SIGNAL FLOW — ONE FULL DECISION CYCLE, END TO END

```
[Candle Closes — 15m / 1h / 4h per config]
      │
      ▼
PRISM-BTC fetches OHLCV                     POSEIDON-BTC fetches funding/OI/liquidations (if on)
      │
      ▼  concurrent, only switched-on agents run
ARCHIMEDES-BTC computes indicators          MERCURY-BTC computes order-book deltas (if on)
      │
      ▼  DETERMINISTIC SNAPSHOT LOCKED — no LLM, including OCULUS or the debate layer,
      │  can contradict these numbers from here on
      │
      ├────────────────────────────────────────────────────────┐
      ▼ concurrent (switched-on subset)                        ▼
REGIME / FLOW / MOMENTUM / VOLUME / PATTERN / STRUCTURE     OCULUS-BTC renders + reads charts
      │                                                          across active timeframes
      ▼                                                          (logged — authoritative only
Shared agents (cached, switched-on subset):                       once it clears Stage 3)
HERALD (news) · ECHO (sentiment) · PULSE (macro)
HYDRA (dominance) · TITAN (on-chain)
      │
      ▼
PROPHET-BTC runs the active ML sub-models in parallel
      │
      ▼
DEBATE — BULL → BEAR → SOCRATES → (further rounds) → MAGISTRA → investment thesis
      (logged and scored — authoritative only once it clears Stage 3)
      │
      ▼
ORACLE-BTC fuses every active + promoted input → confidence report (auto-reweighted)
      │
      ▼
ATLAS injects: brain-learned rules · post-mortem lessons · dynamic thresholds · rejected-trade feedback
      │
      ▼
STRATEGIST-BTC → final trade decision + a full config snapshot of what was active
      │
      ▼
GUARDIAN checks the guard pipeline → APPROVE / REJECT ──(reject)──→ logged, explained back to STRATEGIST
      │ approve
      ▼
WARDEN sizes the position (Kelly + volatility)  →  SENTINEL checks portfolio risk → APPROVE / VETO
      │ approve
      ▼
HERMES plans the order → BROKER submits (paper until Stage 4)
      │
      ▼
ARGUS monitors the open position every 30s · VELOX governs stop-loss tightening
      │
      ▼  [Position Closes]
NEMESIS writes the post-mortem       CASSANDRA scores: ML accuracy + debate scorecard + OCULUS scorecard
      │                                    │
      ▼                                    ▼
ATLAS stores everything              Evidence-review stats updated — reviewed at Stage 3
      │
      ▼
[Next cycle]
```

---

## 10. EVALUATION & SCORING — How the Debate Layer and OCULUS Earn Real Influence

This is CASSANDRA's job alongside ML model calibration.

### Rules, Fixed Before Any Results Exist

1. **Minimum sample size and regime coverage.** A component's scored trades need to span at least one uptrend, one downtrend, and one ranging/chop period before its numbers mean anything — a great score during a single trending stretch tells you nothing.
2. **How the comparison works.** For every closed trade, reconstruct two hypothetical decisions from the logged config snapshot: what STRATEGIST actually decided without this component, and what it would have decided with the component's signal included. Where the two agree, the component added nothing that trade. Where they diverge, track how often the divergence pointed toward the actual winning outcome.
3. **Weight by outcome size, not just win/loss.** Score using realized profit/loss relative to risk taken (R-multiple), not a flat point per trade. A component that's right less than half the time but right *big* when it matters can still be net positive — plain win-rate scoring would wrongly throw it out.
4. **The promotion bar.** A component only gets `influences_decision: true` if it beats the "without it" baseline by an agreed margin, on the divergent-trade subset, across all three regime types, over the full minimum sample. If it doesn't clear that, it stays in observation mode — not "we'll check again next week," but genuinely parked until there's more evidence.
5. **Demotion is automatic, forever.** A promoted component keeps being scored on a rolling basis. If its performance later drops below the same bar, it's flagged and reverts to observation mode pending review — nothing coasts on an old promotion indefinitely.
6. **Check it's not just riding the trend.** Before crediting any component with real skill, check whether its hit rate simply tracked the market's overall direction during the test window (e.g. the bull case looking great purely because BTC trended up the whole time). Credit is only given for calls that were right *net of* the prevailing directional bias of that period.

### Scorecard, Tracked Continuously

```python
class ComponentScorecard(BaseModel):
    component: str                 # "debate_layer" | "oculus" | specific sub-agent
    trades_scored: int
    regimes_covered: List[str]     # must include uptrend, downtrend, chop before promotion review
    divergence_trades: int
    divergence_win_rate: float
    divergence_avg_r_multiple: float
    trend_adjusted_edge: float     # edge after removing prevailing-trend bias
    current_status: Literal["observation", "promoted", "demoted"]
    last_reviewed: datetime
```

The debate layer and OCULUS are scored — and promoted or not — **independently of each other.** It's entirely possible for one to clear the bar and the other not. The risk sub-debate (WARDEN-AGGRESSIVE/CONSERVATIVE/NEUTRAL) is scored the same way but against sizing outcomes rather than direction, and can be promoted on its own timeline.

---

## 11. RISK LAYER

| Agent | Function |
|---|---|
| **SENTINEL** | Global portfolio risk: max daily loss, max drawdown, per-currency exposure cap, correlation limits, total portfolio heat. Runs identically in paper and live mode so Stage 2 genuinely rehearses Stage 4. |
| **WARDEN** | Position sizing: `kelly_fraction = (win_rate × avg_win) / avg_loss − (1 − win_rate)`, then `fractional_kelly = kelly_fraction × 0.25` (a conservative quarter-Kelly), scaled further by volatility and confidence tier. |
| **GUARDIAN** | Sequential, fail-fast guard pipeline: cooldown window → symbol whitelist → max position size → daily loss stop → margin sufficiency → minimum risk/reward threshold. Every rejection logged. |

**Example starting limits (tune during Stage 2):**
- Max daily loss: 2% of capital
- Max single-trade loss: 0.5% of capital
- Max concurrent open positions: 4
- Max exposure per currency: 25% of capital
- Max total portfolio heat: 5%

These three agents are the one place the system enforces a hard rule regardless of config: it will not move into Stage 4 (live trading) while any of them is switched off.

---

## 12. TECH STACK

**Core framework:** Python 3.11+, asyncio for concurrency, LangGraph for the state-graph decision pipeline, LangChain for LLM tool binding, Pydantic v2 for every schema, PyYAML for the master config.

**Data & market connectivity:** ccxt (Binance/Bybit/OKX/Kraken, paper and live), websockets for streaming, aiohttp/requests for HTTP, pycoingecko for market metadata.

**Feature engineering & charting:** numba for the JIT indicator library, numpy/pandas for data handling, mplfinance/plotly for the deterministic candlestick renders OCULUS analyzes.

**ML models:** scikit-learn, xgboost, catboost, lightgbm for the tree-based models; torch and torch-geometric for LSTM/GRU/GNN; stable-baselines3 and gymnasium for the RL agent.

**Vision:** an Anthropic or Google multimodal API for OCULUS's chart reading, Pillow for image handling before those calls.

**Memory & storage:** chromadb for the vector experience store, sentence-transformers for trade-context embeddings, faiss-cpu for semantic news search, redis for the hot cache, sqlite for the audit trail, post-mortems, and every scorecard/config-snapshot log.

**NLP & sentiment:** transformers (FinBERT) for financial sentiment, vaderSentiment for short-text scoring.

**Backtesting:** vectorbt or backtrader for the Stage 1 walk-forward engine, quantstats for performance reporting against buy-and-hold and moving-average benchmarks.

**LLM providers:** a multi-provider factory (Anthropic, OpenAI, Google, Groq, Ollama) with fallback chains, so no single provider outage stops the system.

**Infrastructure:** FastAPI + uvicorn for the dashboard API (including the config toggle panel), rich/typer for the CLI, python-dotenv/pydantic-settings for config management, apscheduler for cron-like scheduling, discord.py for trade notifications.

---

## 13. IMPLEMENTATION ROADMAP

Timeframes are planning estimates — the validation stages in Section 3 are what actually decide when you move on, not the calendar.

**Foundation.** Project structure and the config/kill-switch infrastructure first — every agent built afterward reads its on/off state from this from day one, rather than switches being bolted on later. CCXT bridge in paper mode. Live BTC data flowing through PRISM-BTC. Memory system skeleton.

**Deterministic core + backtesting engine.** Port the JIT indicator library, order-book microstructure, and the anti-hallucination snapshot. Build the Stage 1 walk-forward backtesting harness before there's anything sophisticated to test it against. Acquire and segment 2-3+ years of BTC history into uptrend/downtrend/chop windows.

**ML ensemble + Stage 1 validation.** Build PROPHET starting with XGBoost and LSTM, add the rest per their individual switches as they're built. Run the full Stage 1 backtest against buy-and-hold and moving-average-crossover. Do not proceed until it passes in every regime segment.

**Intelligence layer + OCULUS.** Build the six per-coin analysts, the shared news/sentiment/macro/on-chain agents, and OCULUS — the chart-rendering pipeline, the vision-LLM call, the structured output, the per-timeframe switches, and the caching policy.

**Debate layer + confidence fusion.** Build BULL/BEAR/SOCRATES/MAGISTRA running in observation mode from the first line of code — `influences_decision: false` is the default, not something added later. Build ORACLE's Bayesian fusion with auto-reweighting, and STRATEGIST's final decision logic with brain-context injection.

**Risk + paper execution.** Build GUARDIAN, WARDEN, SENTINEL, and the full order lifecycle. This is where Stage 2 (live paper trading) actually begins — the clock on "long enough to see multiple regimes" starts here.

**Monitoring + self-learning + the scorecard.** Build ARGUS, VELOX, NEMESIS, KRONOS, and — critically — CASSANDRA's scorecard system, built alongside paper trading from its first trade, not bolted on afterward. Build the AETHER dashboard, including the toggle panel and live scorecards.

**Formal evidence review.** Once there's enough sample size and all three regimes are covered: run the pre-agreed promotion test on the debate layer and OCULUS independently. Manually review and flip their `influences_decision` flags accordingly, or leave them in observation mode / switch them off.

**Live trading, BTC only.** Small capital, staged increase. RL stays off unless deliberately revisited later, and even then, offline-batch only. Weekly review of risk limits and scorecards.

**Second currency.** Repeat the whole pipeline for ETH, reusing the shared services built once at the start. Update SENTINEL for cross-asset correlation once two currencies are live. Then repeat for SOL, BNB, XRP, MATIC, one at a time.

---

## 14. TOP-LEVEL FLOWCHARTS

### 14a. Full System — Agent Interaction Map (Everything Built, Fully Switched On)

```
                              ┌────────────────────────────────────┐
                              │        NEXUS (Supervisor)          │
                              │  tracks validation stage per coin  │
                              └───────────────────┬────────────────┘
                                                  │
                    ┌─────────────────────────────┼─────────────────────────────┐
                    │                             │                             │
         ┌──────────▼───────────┐       ┌─────────▼────────────┐       ┌────────▼─────────────┐
         │   BTC Pipeline       │       │   ETH Pipeline       │       │   SOL Pipeline       │ 
         │                      │       │                      │       │                      │
         │  PRISM, POSEIDON     │       │  (same structure,    │       │  (same structure,    │
         │  ARCHIMEDES, MERCURY │       │   own instance)      │       │   own instance)      │
         │  REGIME/FLOW/MOMEN-  │       │                      │       │                      │
         │  TUM/VOLUME/PATTERN/ │       │                      │       │                      │
         │  STRUCTURE, OCULUS   │       │                      │       │                      │
         │  PROPHET (7 models)  │       │                      │       │                      │
         │  DARWINEX (RL)       │       │                      │       │                      │
         │  BULL/BEAR/SOCRATES/ │       │                      │       │                      │
         │  MAGISTRA + risk     │       │                      │       │                      │
         │  sub-debate          │       │                      │       │                      │
         │  ORACLE, STRATEGIST  │       │                      │       │                      │
         └──────────┬───────────┘       └─────────┬────────────┘       └────────┬─────────────┘
                    │                             │                             │
                    └─────────────────────────────┼─────────────────────────────┘
                                                  │  all pipelines share:
                                     ┌────────────▼───────────────┐
                                     │      SHARED SERVICES       │
                                     │  HYDRA · HERALD · ECHO     │
                                     │  PULSE · SPECTRA · TITAN   │
                                     │  ATLAS (memory)            │
                                     └─────────────┬──────────────┘
                                                   │
                                     ┌─────────────▼──────────────┐
                                     │   SENTINEL (portfolio risk)│
                                     │   WARDEN (sizing)          │
                                     │   GUARDIAN (guard gates)   │
                                     └─────────────┬──────────────┘
                                                   │
                                     ┌─────────────▼──────────────┐
                                     │   HERMES + BROKER          │
                                     │   (execution)              │
                                     └─────────────┬──────────────┘
                                                   │
                                     ┌─────────────▼───────────────┐
                                     │   ARGUS + VELOX             │
                                     │   (position monitoring)     │
                                     └─────────────┬───────────────┘
                                                   │
                                     ┌─────────────▼───────────────┐
                                     │  NEMESIS + KRONOS +         │
                                     │  CASSANDRA + DARWINEX       │
                                     │  (self-learning loop)       │
                                     └─────────────────────────────┘
```

### 14b. Full Decision-Authority Map (Everything Fully Promoted / Fully On)

This is what the system looks like once *everything* — the debate layer, OCULUS, RL — has been built, tested, and has actually earned real influence:

```
DETERMINISTIC SNAPSHOT (price, indicators, order book)
            │
            ├──────────────► PROPHET ML Ensemble ──────────────┐
            │                                                  │
            ├──────────────► DARWINEX (RL signal) ─────────────┤
            │                                                  │
            ├──────────────► BULL/BEAR/SOCRATES/MAGISTRA debate┤──► ORACLE
            │                                                  │    (Bayesian
            ├──────────────► OCULUS visual pattern read ───────┤     fusion)
            │                                                  │
            ├──────────────► ECHO sentiment ───────────────────┤
            │                                                  │
            └──────────────► PULSE macro / TITAN on-chain ─────┘
                                                                 │
                                                                 ▼
                                                          STRATEGIST
                                                       (final decision)
                                                                 │
                                                                 ▼
                                              GUARDIAN → WARDEN → SENTINEL
                                                                 │
                                                                 ▼
                                                     HERMES/BROKER (live)
```

### 14c. Full Vision vs. Where Things Actually Start — Side by Side

The full system above is the destination. Here's what's actually running at the very beginning, before anything has earned its way up through the validation pipeline:

```
┌─────────────────────────────────────────┐        ┌─────────────────────────────────────────┐
│         FULL VISION (destination)       │        │      STARTING POINT (day one)           │
├─────────────────────────────────────────┤        ├─────────────────────────────────────────┤
│ Currencies: BTC, ETH, SOL, BNB,         │        │ Currencies: BTC only                    │
│   XRP, MATIC — all live                 │        │                                         │
│                                         │        │                                         │
│ Debate layer: PROMOTED,                 │        │ Debate layer: runs every cycle,         │
│   authoritative in STRATEGIST's         │        │   fully logged and scored,              │
│   decision                              │        │   but NOT authoritative yet             │
│                                         │        │                                         │
│ OCULUS: PROMOTED,                       │        │ OCULUS: runs every cycle on active      │
│   authoritative, all 9 timeframes       │        │   timeframes, fully logged and scored,  │
│   active                                │        │   but NOT authoritative yet             │
│                                         │        │                                         │
│ DARWINEX (RL): active, retraining       │        │ DARWINEX (RL): built, switched off,     │
│   on a scheduled offline batch          │        │   not observing or acting at all        │
│                                         │        │                                         │
│ ML ensemble: all 7 models active,       │        │ ML ensemble: starts with 2 models       │
│   reweighted by live accuracy           │        │   (XGBoost + LSTM), others added        │
│                                         │        │   and switched on as they're built      │
│                                         │        │   and validated                         │
│                                         │        │                                         │
│ Data sources: all active                │        │ Data sources: core feed + whichever     │
│   (news, sentiment incl. Twitter,       │        │   are affordable right now — e.g.       │
│   on-chain, macro, alt-data)            │        │   Twitter/on-chain/alt-data can start   │
│                                         │        │   OFF to save API cost                  │
│                                         │        │                                         │
│ Trading mode: LIVE, real capital        │        │ Trading mode: PAPER only, no real money │
│                                         │        │                                         │
│ Risk agents (SENTINEL/WARDEN/           │        │ Risk agents: ALWAYS ON — this is the    │
│   GUARDIAN): tuned from months          │        │   same in both columns, on day one and  │
│   of live data                          │        │   at the destination, never a "later"   │
│                                         │        │   feature                               │
└─────────────────────────────────────────┘        └─────────────────────────────────────────┘

   The only path from the right column to the left column is through the
   validation pipeline in Section 3, one component and one currency at a time —
   never all at once, and never skipped because something "should" work.
```

---

## APPENDIX A: Agent Quick Reference (BTC Instance)

| Agent | Layer | LLM? | Starting Mode |
|---|---|---|---|
| NEXUS | 0 | Quick LLM | Active |
| HERMES | 0, X | No | Active (paper) |
| BROKER | X | No | Active (paper) |
| PRISM-BTC | I | No | Active — core feed |
| HYDRA | I | No | Active |
| POSEIDON-BTC | I | No | Active |
| TITAN | I | No | Off (cost) |
| ARCHIMEDES-BTC | II | No | Active — core |
| MERCURY-BTC | II | No | Active |
| REGIME-BTC | III | Quick LLM | Active |
| FLOW-BTC | III | Quick LLM | Active |
| MOMENTUM-BTC | III | Quick LLM | Active |
| VOLUME-BTC | III | Quick LLM | Active |
| PATTERN-BTC | III | Quick LLM | Active |
| STRUCTURE-BTC | III | Quick LLM | Active |
| OCULUS-BTC | III | Vision LLM | Observation mode |
| HERALD | III | Quick LLM | Active |
| ECHO | III | FinBERT/VADER | Active (per-source switch) |
| PULSE | III | Quick LLM | Active |
| SPECTRA | III | Quick LLM | Off by default |
| PROPHET-BTC | IV | No | Active (per-model switch) |
| DARWINEX-BTC | V | No | Off |
| BULL/BEAR/SOCRATES-BTC | VI | Quick LLM | Observation mode |
| MAGISTRA-BTC | VI | Deep LLM | Observation mode |
| ORACLE-BTC | VII | Deep LLM | Active — core, auto-reweights |
| STRATEGIST-BTC | VIII | Deep LLM | Active — core |
| SENTINEL | IX | Deep LLM | Active — always on |
| WARDEN | IX | No | Active — always on |
| GUARDIAN | IX | No | Active — always on |
| ARGUS | XI | No | Active — core |
| VELOX | XI | No | Active — core safety |
| NEMESIS | XII | Quick LLM | Active |
| KRONOS | XII | Deep LLM | Active |
| CASSANDRA | XII | No | Active — core, runs scorecards |
| ATLAS | XIII | No | Active — core |
| AETHER | – | No | Active — core |

---

## APPENDIX B: Inspiration Source Map

| Feature | Source |
|---|---|
| Vector-memory brain + reflection rules | QRAK |
| JIT indicator library | QRAK |
| Dynamic threshold injection | QRAK |
| AI-mistake classification | QRAK |
| Post-mortem autopsies | QRAK |
| Surprise-ratio tracking | QRAK |
| Guard pipeline + audit trail | QRAK |
| Order-book microstructure deltas | QRAK |
| Multimodal chart analysis | QRAK — direct precedent for OCULUS |
| Stop-loss tightening hard gate | QRAK |
| Rejected-trade feedback loop | QRAK |
| Composition-root project structure | QRAK |
| LangGraph state-graph pipeline | TAURI |
| Two-tier adversarial debate | TAURI |
| Structured typed outputs | TAURI |
| Anti-hallucination deterministic snapshot | TAURI |
| Multi-provider LLM factory | TAURI |
| Deferred reflection | TAURI |
| Checkpoint/resume | TAURI |
| Sequential (not parallel) multi-currency rollout | Built for this project |
| Full backtest → paper → evidence-review → live pipeline | Built for this project |
| Observation-mode + promotion gate for debate layer | Built for this project |
| OCULUS visual multi-timeframe chart reader | Built for this project |
| Master kill-switch config + graceful degradation rules | Built for this project |
| Per-decision config snapshot logging | Built for this project |
| RL isolated with an off-by-default switch | Built for this project |
| ML prediction ensemble (7 models) | Built for this project |
| Bayesian confidence fusion | Built for this project |
| Fractional Kelly position sizing | Built for this project |
| On-chain data | Built for this project |
| Cross-asset portfolio risk | Built for this project |
| Semantic (FAISS) news search | Built for this project |

---

*Nothing in this document overrides the one rule everything else sits inside: nothing trades real money until it has cleared the historical backtest, the live paper-trading run, and the formal evidence review, in that order.*