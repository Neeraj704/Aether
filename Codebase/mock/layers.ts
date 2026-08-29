export type PortType =
  | 'MarketData'
  | 'NewsFeed'
  | 'FeatureVector'
  | 'Signal'
  | 'RiskDecision'
  | 'ExecutionOrder'
  | 'TradeOutcome'

export type PlanTier = 'free' | 'starter' | 'pro'

export type LayerId =
  | 'data'
  | 'features'
  | 'agents'
  | 'ml'
  | 'rl'
  | 'debate'
  | 'confidence'
  | 'risk'
  | 'execution'
  | 'monitoring'
  | 'learning'
  | 'memory'

export interface LayerDef {
  id: LayerId
  roman: string
  name: string
  short: string
  description: string
  hue: string
}

export const PORT_COLORS: Record<PortType, string> = {
  MarketData: '#2997ff',
  NewsFeed: '#7b61ff',
  FeatureVector: '#00b8c4',
  Signal: '#ff9f0a',
  RiskDecision: '#ff6ac1',
  ExecutionOrder: '#30d158',
  TradeOutcome: '#a1a1a6',
}

export const LAYERS: LayerDef[] = [
  {
    id: 'data',
    roman: 'I',
    name: 'Data Collection',
    short: 'Where your agent gets its raw view of the market.',
    description:
      'Price feeds, order books, news, filings and alternative data. Everything downstream is only as good as what you wire in here.',
    hue: '#2997ff',
  },
  {
    id: 'features',
    roman: 'II',
    name: 'Feature Engineering',
    short: 'Turn raw feeds into numbers a model can reason about.',
    description:
      'Moving averages, order-flow imbalance, regime indicators, text embeddings and rolling normalisations.',
    hue: '#00b8c4',
  },
  {
    id: 'agents',
    roman: 'III',
    name: 'Intelligence Agents',
    short: 'Specialised models that form opinions.',
    description:
      'Technical, sentiment, macro, flow, contrarian and event specialists, each with a narrow persona and its own reasoning prompt.',
    hue: '#ff9f0a',
  },
  {
    id: 'ml',
    roman: 'IV',
    name: 'ML Predictive Models',
    short: 'Classical and neural models for price and volatility.',
    description:
      'Gradient boosted trees, sequence models, volatility forecasters, ensemble stackers and meta-labelers.',
    hue: '#30d158',
  },
  {
    id: 'rl',
    roman: 'V',
    name: 'Reinforcement Learning',
    short: 'Policies that learn how to act through reward.',
    description:
      'Trained policies for position sizing, entry timing, trailing exits and execution schedules.',
    hue: '#34c759',
  },
  {
    id: 'debate',
    roman: 'VI',
    name: 'Debate & Consensus',
    short: 'Make the agents argue before risking capital.',
    description:
      'Bull vs bear rounds, moderator scoring, adversarial stress tests and structured debate logs.',
    hue: '#ffd60a',
  },
  {
    id: 'confidence',
    roman: 'VII',
    name: 'Confidence & Calibration',
    short: 'Know when the agents are sure and when they are guessing.',
    description:
      'Probability calibrators, agreement metrics, uncertainty bands and out-of-distribution drift monitors.',
    hue: '#bf5af2',
  },
  {
    id: 'risk',
    roman: 'VIII',
    name: 'Risk Management',
    short: 'The seatbelts: position caps, drawdown brakes and gates.',
    description:
      'Position ceilings, daily loss limits, drawdown brakes, sector caps, event blackouts and VaR bounds.',
    hue: '#ff375f',
  },
  {
    id: 'execution',
    roman: 'IX',
    name: 'Execution',
    short: 'Getting the order to the venue without bleeding.',
    description: 'Order types, slicing, slippage budgets, venue routing and retry behaviour.',
    hue: '#ff453a',
  },
  {
    id: 'monitoring',
    roman: 'X',
    name: 'Trade Monitoring',
    short: 'Watch every open position and every decision.',
    description: 'Live P&L tracking, anomaly detection, latency watch and decision audit logs.',
    hue: '#ff6ac1',
  },
  {
    id: 'learning',
    roman: 'XI',
    name: 'Self-Learning',
    short: 'Turn closed trades into better rules.',
    description:
      'Post-mortems on every trade, rule derivation, retraining schedules and regime-change detection.',
    hue: '#c95cff',
  },
  {
    id: 'memory',
    roman: 'XII',
    name: 'Memory',
    short: 'What the agent remembers between runs.',
    description:
      'Vector recall of similar setups, long-term outcome stores and shared lesson banks across your bots.',
    hue: '#7b61ff',
  },
]

export const LAYER_MAP: Record<LayerId, LayerDef> = LAYERS.reduce(
  (acc, l) => {
    acc[l.id] = l
    return acc
  },
  {} as Record<LayerId, LayerDef>,
)

export function layerIndex(id: LayerId) {
  return LAYERS.findIndex((l) => l.id === id)
}

export interface ModelSelection {
  providerId: string // 'openai' | 'anthropic' | 'google' | 'alibaba' | 'deepseek' | 'ollama'
  modelId: string // e.g. 'gpt-5-mini', or free-typed 'llama3.1:8b'
  endpoint?: string // for 'ollama' - default http://localhost:11434
  apiKey?: string // Optional custom user BYOK key
  temperature: number
  maxTokens: number
}

export type FieldDef =
  | { key: string; label: string; type: 'text'; placeholder?: string; help?: string; value?: string }
  | { key: string; label: string; type: 'password'; placeholder?: string; help?: string }
  | { key: string; label: string; type: 'select'; options: string[]; value?: string; help?: string }
  | { key: string; label: string; type: 'slider'; min: number; max: number; step: number; value: number; unit?: string; help?: string }
  | { key: string; label: string; type: 'switch'; value: boolean; help?: string }
  | { key: string; label: string; type: 'checklist'; options: string[]; value: string[]; help?: string }
  | { key: string; label: string; type: 'number'; value: number; min?: number; max?: number; unit?: string; help?: string }
  | { key: string; label: string; type: 'model-select'; value: ModelSelection; help?: string }
  | { key: string; label: string; type: 'prompt'; value: string; variables?: string[]; help?: string }
  | { key: string; label: string; type: 'code'; language?: 'json' | 'python' | 'javascript'; value: string; help?: string }
  | { key: string; label: string; type: 'json'; value: string; help?: string }
  | { key: string; label: string; type: 'key-value'; value: { key: string; value: string }[]; help?: string }
  | { key: string; label: string; type: 'weighted-list'; options: string[]; value: Record<string, number>; help?: string }
  | { key: string; label: string; type: 'credential'; provider?: string; value: string; help?: string }
  | { key: string; label: string; type: 'dataset-ref'; value: string | null; help?: string }

export interface ComponentDocs {
  whenToUse: string
  whenToSkip: string
  bestPractices: string[]
  commonMistakes: string[]
}

export interface ComponentDef {
  id: string
  name: string
  layer: LayerId
  tagline: string
  description: string
  inputs: PortType[]
  outputs: PortType[]
  tier: PlanTier
  price: number
  fields: FieldDef[]
  advancedFields?: FieldDef[]
  docs?: ComponentDocs
  useCase: string
}

function c(
  id: string,
  layer: LayerId,
  name: string,
  tagline: string,
  description: string,
  inputs: PortType[],
  outputs: PortType[],
  tier: PlanTier,
  price: number,
  fields: FieldDef[],
  useCase: string,
  advancedFields?: FieldDef[],
  docs?: ComponentDocs,
): ComponentDef {
  return { id, name, layer, tagline, description, inputs, outputs, tier, price, fields, useCase, advancedFields, docs }
}

const intervalField: FieldDef = {
  key: 'interval',
  label: 'Refresh interval',
  type: 'slider',
  min: 1,
  max: 300,
  step: 1,
  value: 15,
  unit: 's',
  help: 'How often this node pulls fresh data during a run.',
}

export const COMPONENTS: ComponentDef[] = [
  // ==========================================
  // ---------- I. Data Collection ------------
  // ==========================================
  c(
    'ohlcv-feed',
    'data',
    'OHLCV Price Feed',
    'Candles for any listed symbol.',
    'Open/high/low/close/volume candles across 1m to 1d resolutions, adjusted for splits and corporate actions.',
    [],
    ['MarketData'],
    'free',
    0,
    [
      { key: 'symbols', label: 'Symbols', type: 'text', value: 'NIFTY, RELIANCE, HDFCBANK', placeholder: 'Comma separated' },
      { key: 'resolution', label: 'Resolution', type: 'select', options: ['1m', '5m', '15m', '1h', '1d'], value: '15m' },
      intervalField,
    ],
    'The default starting point for almost every bot — most feature nodes expect a candle series.',
    [
      { key: 'exchangeHeaders', label: 'Custom HTTP Headers', type: 'key-value', value: [{ key: 'X-Exchange-Zone', value: 'IN-MUM-NSE' }] },
      { key: 'apiKey', label: 'Data Provider API Key', type: 'credential', provider: 'NSE MarketData Gateway', value: '', help: 'Authentication key for live tick websocket and historical backfill.' },
      { key: 'datasetRef', label: 'Historical Tick Dataset', type: 'dataset-ref', value: 'ds-nifty50-1m', help: 'Offline backtest replay dataset.' },
      { key: 'fillHoles', label: 'Interpolate missing ticks', type: 'switch', value: true },
      { key: 'timezone', label: 'Exchange Timezone', type: 'select', options: ['Asia/Kolkata', 'America/New_York', 'UTC', 'Europe/London'], value: 'Asia/Kolkata' },
    ],
    {
      whenToUse: 'Use when building any directional or volatility strategy requiring standard price bars.',
      whenToSkip: 'Skip if your strategy relies purely on macroeconomic calendars or Level 3 orderbook queuing.',
      bestPractices: ['Ensure resolution matches your holding period (1m for intraday scalps, 1h/1d for swing setups).', 'Enable missing tick interpolation to avoid NaN propagation through rolling indicators.'],
      commonMistakes: ['Requesting too many unadjusted symbols on low memory tiers.', 'Using unadjusted prices across dividend or split ex-dates.'],
    },
  ),
  c(
    'orderbook-depth',
    'data',
    'Order Book Depth',
    'Level 2 book snapshots.',
    'Bid/ask ladder snapshots with configurable depth, useful for microstructure and liquidity-aware execution.',
    [],
    ['MarketData'],
    'starter',
    149,
    [
      { key: 'levels', label: 'Depth levels', type: 'slider', min: 1, max: 50, step: 1, value: 10 },
      { key: 'venue', label: 'Venue', type: 'select', options: ['NSE', 'BSE', 'Aggregated'], value: 'NSE' },
      intervalField,
    ],
    'Pair with a liquidity-aware execution node to avoid crossing a thin book.',
    [
      { key: 'brokerApiKey', label: 'L2 Feed API Key', type: 'credential', provider: 'Direct Market Access', value: '' },
      { key: 'sampleHz', label: 'Sampling Frequency', type: 'slider', min: 10, max: 1000, step: 10, value: 100, unit: 'ms' },
      { key: 'datasetRef', label: 'Historical Depth Dataset', type: 'dataset-ref', value: 'ds-crypto-orderbook' },
      { key: 'aggregateLadders', label: 'Aggregate Top 5 Price Levels', type: 'switch', value: true },
    ],
    {
      whenToUse: 'Use for order flow imbalance (OFI) calculations, queue position modeling, or high-urgency execution.',
      whenToSkip: 'Skip for swing or multi-day strategies where instantaneous orderbook depth is irrelevant.',
      bestPractices: ['Keep depth levels below 20 unless running specialized market-making algorithms.'],
      commonMistakes: ['Sampling L2 snapshots at higher frequency than your graph can process, creating backlog lag.'],
    },
  ),
  c(
    'news-stream',
    'data',
    'News Stream',
    'Headlines as they print.',
    'Real-time headline stream from wire services, exchange announcements and curated finance media.',
    [],
    ['NewsFeed'],
    'free',
    0,
    [
      {
        key: 'channels',
        label: 'Channels',
        type: 'checklist',
        options: ['Wire services', 'Exchange filings', 'Finance media', 'Regulatory'],
        value: ['Wire services', 'Exchange filings'],
      },
      { key: 'apiKey', label: 'Provider API key', type: 'credential', provider: 'Reuters/Bloomberg Wire', value: '' },
      intervalField,
    ],
    'Feed a sentiment agent so your bot reacts to narrative, not just price.',
    [
      { key: 'dedupWindow', label: 'Deduplication window', type: 'slider', min: 5, max: 120, step: 5, value: 30, unit: 'min' },
      { key: 'languageFilter', label: 'Filter English only', type: 'switch', value: true },
      { key: 'datasetRef', label: 'Historical News Dataset', type: 'dataset-ref', value: 'ds-reuters-sentiment' },
      { key: 'sentimentScoring', label: 'Pre-calculate polarity score on ingest', type: 'switch', value: true },
    ],
    {
      whenToUse: 'Use whenever an LLM sentiment or event analyst is in your strategy graph.',
      whenToSkip: 'Skip for pure mathematical or statistical arbitrage bots that trade on tick patterns alone.',
      bestPractices: ['Filter by specific ticker tags to avoid processing noise from unrelated asset classes.'],
      commonMistakes: ['Treating opinion op-eds with equal weight to regulatory exchange disclosures.'],
    },
  ),
  c(
    'social-sentiment',
    'data',
    'Social Firehose',
    'Retail chatter, deduplicated.',
    'Aggregated social posts filtered for finance relevance, spam-scored and deduplicated per ticker.',
    [],
    ['NewsFeed'],
    'starter',
    199,
    [
      { key: 'platforms', label: 'Platforms', type: 'checklist', options: ['X', 'Reddit', 'StockTwits', 'Telegram'], value: ['X', 'Reddit'] },
      { key: 'minEngagement', label: 'Min engagement', type: 'number', value: 25, min: 0, max: 5000 },
    ],
    'Detect crowded retail positioning before a squeeze.',
    [
      { key: 'spamFilterThreshold', label: 'Spam score threshold', type: 'slider', min: 0.1, max: 0.9, step: 0.05, value: 0.65 },
      { key: 'botAccountFilter', label: 'Filter suspected bot accounts', type: 'switch', value: true },
      { key: 'customKeywords', label: 'Tracked cashtags/keywords', type: 'text', value: '$NIFTY, #fno, #banknifty' },
    ],
    {
      whenToUse: 'Use for momentum breakout confirmation or detecting extreme retail euphoric tops.',
      whenToSkip: 'Skip during illiquid overnight hours where bot spam dominates volume.',
      bestPractices: ['Always apply a high minimum engagement threshold to eliminate promotional noise.'],
      commonMistakes: ['Trading solely on raw post volume spikes without checking sentiment polarity.'],
    },
  ),
  c(
    'macro-calendar',
    'data',
    'Macro Calendar',
    'Scheduled events that move everything.',
    'Central bank decisions, CPI prints, earnings dates and expiry calendars as structured events.',
    [],
    ['NewsFeed'],
    'free',
    0,
    [
      { key: 'regions', label: 'Regions', type: 'checklist', options: ['India', 'US', 'EU', 'Global'], value: ['India', 'US'] },
      { key: 'blackout', label: 'Emit blackout windows', type: 'switch', value: true, help: 'Risk nodes can use these to stand down around events.' },
    ],
    'Stop trading 15 minutes either side of a rate decision.',
    [
      { key: 'bufferMinutes', label: 'Blackout buffer', type: 'slider', min: 5, max: 60, step: 5, value: 15, unit: 'm' },
      { key: 'impactThreshold', label: 'Min Event Impact', type: 'select', options: ['High Only', 'Medium & High', 'All Events'], value: 'High Only' },
      { key: 'autoBlackout', label: 'Auto-broadcast signal veto on high impact', type: 'switch', value: true },
    ],
    {
      whenToUse: 'Essential for volatility breakout strategies and automated risk gates before major announcements.',
      whenToSkip: 'Skip for long-term multi-month fundamental value portfolios.',
      bestPractices: ['Feed directly into an Event Blackout risk node.'],
      commonMistakes: ['Leaving automated limit orders resting during high-volatility rate announcements.'],
    },
  ),
  c(
    'fundamentals',
    'data',
    'Fundamentals Snapshot',
    'Balance sheet on tap.',
    'Quarterly and annual statements, ratios and analyst revisions, point-in-time to avoid lookahead bias.',
    [],
    ['MarketData'],
    'starter',
    149,
    [
      { key: 'metrics', label: 'Metrics', type: 'checklist', options: ['P/E', 'ROE', 'Debt/Equity', 'Revenue growth', 'FCF yield'], value: ['P/E', 'ROE'] },
      { key: 'pointInTime', label: 'Point-in-time only', type: 'switch', value: true },
    ],
    'Screen a universe down to quality names before technical entry logic runs.',
    [
      { key: 'filingType', label: 'Filing Source', type: 'select', options: ['Standalone', 'Consolidated', 'Both'], value: 'Consolidated' },
      { key: 'restatementLag', label: 'Restatement lag buffer', type: 'slider', min: 0, max: 90, step: 5, value: 15, unit: ' days' },
      { key: 'secHeaders', label: 'Exchange Gateway Headers', type: 'key-value', value: [{ key: 'X-Filing-Tier', value: 'Quarterly' }] },
    ],
    {
      whenToUse: 'Use for periodic universe rebalancing, stock screening, and factor quality scoring.',
      whenToSkip: 'Skip for short-horizon intraday trading strategies.',
      bestPractices: ['Always enable point-in-time mode to prevent backtest lookahead bias.'],
      commonMistakes: ['Using restated financial metrics before they were publicly disclosed.'],
    },
  ),
  c(
    'options-chain',
    'data',
    'Options Chain',
    'Greeks, IV and open interest.',
    'Full chain snapshots with implied vol surface, open interest deltas and put/call skew.',
    [],
    ['MarketData'],
    'pro',
    299,
    [
      { key: 'underlying', label: 'Underlying', type: 'text', value: 'NIFTY' },
      { key: 'expiries', label: 'Expiries tracked', type: 'slider', min: 1, max: 8, step: 1, value: 2 },
    ],
    'Read IV crush around expiry and size positions accordingly.',
    [
      { key: 'calcGreeks', label: 'Calculate live Greeks (Delta, Gamma, Vega, Theta)', type: 'switch', value: true },
      { key: 'impliedVolModel', label: 'IV Calculation Model', type: 'select', options: ['Black-Scholes-Merton', 'Bachelier', 'Binomial Tree', 'SABR Surface'], value: 'Black-Scholes-Merton' },
      { key: 'strikeSpread', label: 'Strikes above/below ATM', type: 'slider', min: 5, max: 50, step: 5, value: 20 },
    ],
    {
      whenToUse: 'Use for options volatility trading, Delta-neutral hedging, and max-pain level identification.',
      whenToSkip: 'Skip if trading pure cash equities without derivatives overlay.',
      bestPractices: ['Monitor IV skew to detect institutional downside tail hedging.'],
      commonMistakes: ['Neglecting interest rate and dividend assumptions in Greek calculations.'],
    },
  ),
  c(
    'onchain-feed',
    'data',
    'On-chain Feed',
    'Wallet flow and chain metrics.',
    'Exchange inflow/outflow, whale transfers, gas and staking metrics for major chains.',
    [],
    ['MarketData'],
    'pro',
    299,
    [
      { key: 'chains', label: 'Chains', type: 'checklist', options: ['Bitcoin', 'Ethereum', 'Solana'], value: ['Bitcoin', 'Ethereum'] },
    ],
    'Catch large exchange inflows that often precede spot selling.',
    [
      { key: 'minTransferUsd', label: 'Whale alert min notional ($)', type: 'slider', min: 50000, max: 5000000, step: 50000, value: 500000, unit: ' USD' },
      { key: 'watchContractAddresses', label: 'Watchlist contracts', type: 'text', value: '0x..., 0x...' },
      { key: 'apiKey', label: 'RPC / Node API Key', type: 'credential', provider: 'Infura / Alchemy Gateway', value: '' },
    ],
    {
      whenToUse: 'Use for crypto spot and perpetual futures to track large exchange deposit spikes.',
      whenToSkip: 'Skip for traditional equity or commodity markets.',
      bestPractices: ['Filter out internal exchange wallet rebalancing sweeps.'],
      commonMistakes: ['Acting on small retail token transfers.'],
    },
  ),

  // ==========================================
  // ---------- II. Feature Engineering -------
  // ==========================================
  c(
    'ta-indicators',
    'features',
    'Technical Indicators',
    'The classics, fully customizable.',
    'RSI, MACD, ATR, Bollinger, ADX, Stochastic, Supertrend, with individual toggles & parameter inputs.',
    ['MarketData'],
    ['FeatureVector'],
    'free',
    0,
    [
      { key: 'set', label: 'Active Indicator Bundle', type: 'checklist', options: ['RSI', 'MACD', 'ATR', 'Bollinger', 'ADX', 'Stochastic', 'Supertrend'], value: ['RSI', 'MACD', 'ATR'] },
      { key: 'lookback', label: 'Global Baseline Lookback', type: 'slider', min: 5, max: 200, step: 1, value: 14, unit: ' bars' },
    ],
    'The foundation for technical alpha generation.',
    [
      // RSI Customization
      { key: 'enableRSI', label: 'Enable RSI (Relative Strength Index)', type: 'switch', value: true },
      { key: 'rsiPeriod', label: 'RSI Period', type: 'slider', min: 2, max: 50, step: 1, value: 14, unit: ' bars' },
      { key: 'rsiOverbought', label: 'RSI Overbought Threshold', type: 'slider', min: 60, max: 95, step: 1, value: 70 },
      { key: 'rsiOversold', label: 'RSI Oversold Threshold', type: 'slider', min: 5, max: 40, step: 1, value: 30 },

      // MACD Customization
      { key: 'enableMACD', label: 'Enable MACD (Moving Avg Convergence Divergence)', type: 'switch', value: true },
      { key: 'macdFast', label: 'MACD Fast EMA', type: 'slider', min: 2, max: 50, step: 1, value: 12, unit: ' bars' },
      { key: 'macdSlow', label: 'MACD Slow EMA', type: 'slider', min: 10, max: 100, step: 1, value: 26, unit: ' bars' },
      { key: 'macdSignal', label: 'MACD Signal Smoothing', type: 'slider', min: 2, max: 30, step: 1, value: 9, unit: ' bars' },

      // Bollinger Bands Customization
      { key: 'enableBollinger', label: 'Enable Bollinger Bands', type: 'switch', value: true },
      { key: 'bollingerPeriod', label: 'Bollinger Period', type: 'slider', min: 5, max: 100, step: 1, value: 20, unit: ' bars' },
      { key: 'bollingerStdDev', label: 'Bollinger Std Deviations', type: 'slider', min: 1.0, max: 4.0, step: 0.1, value: 2.0, unit: 'σ' },

      // ATR Customization
      { key: 'enableATR', label: 'Enable ATR (Average True Range)', type: 'switch', value: true },
      { key: 'atrPeriod', label: 'ATR Period', type: 'slider', min: 2, max: 50, step: 1, value: 14, unit: ' bars' },

      // Supertrend Customization
      { key: 'enableSupertrend', label: 'Enable Supertrend', type: 'switch', value: false },
      { key: 'supertrendPeriod', label: 'Supertrend ATR Period', type: 'slider', min: 5, max: 50, step: 1, value: 10, unit: ' bars' },
      { key: 'supertrendMultiplier', label: 'Supertrend Multiplier', type: 'slider', min: 1.0, max: 6.0, step: 0.1, value: 3.0 },

      // Custom Python Script
      { key: 'customFormula', label: 'Custom Indicator Formula (Python)', type: 'code', language: 'python', value: '# def custom_alpha(df):\n#   return (df["close"] - df["open"]) / df["atr"]' },
    ],
    {
      whenToUse: 'Use to extract standardized momentum, volatility, and trend metrics from raw OHLCV bars.',
      whenToSkip: 'Skip if training pure end-to-end deep learning models on raw orderbook microstructure.',
      bestPractices: ['Combine an oscillator (RSI), a trend metric (MACD), and a volatility measure (ATR).', 'Adjust periods according to the bar resolution.'],
      commonMistakes: ['Using 5 different oscillators that are 98% correlated with each other.'],
    },
  ),
  c(
    'normalizer',
    'features',
    'Rolling Normaliser',
    'Keep features on a comparable scale.',
    'Z-score, min-max or rank normalisation over a rolling window so models do not drift with price level.',
    ['FeatureVector'],
    ['FeatureVector'],
    'free',
    0,
    [
      { key: 'method', label: 'Method', type: 'select', options: ['Z-score', 'Min-max', 'Rank', 'Quantile Transformer'], value: 'Z-score' },
      { key: 'window', label: 'Window', type: 'slider', min: 20, max: 500, step: 10, value: 120, unit: ' bars' },
    ],
    'Required if you are feeding a model that assumes stationary inputs.',
    [
      { key: 'clipOutliers', label: 'Clip extreme outliers', type: 'switch', value: true },
      { key: 'clipSigma', label: 'Outlier clip threshold (σ)', type: 'slider', min: 2.0, max: 5.0, step: 0.5, value: 3.0, unit: 'σ' },
      { key: 'decayFactor', label: 'Exponential decay factor (half-life)', type: 'slider', min: 0.8, max: 0.999, step: 0.005, value: 0.95 },
    ],
    {
      whenToUse: 'Essential prior to feeding ML models or neural networks sensitive to varying input magnitudes.',
      whenToSkip: 'Skip for tree-based models (GBDT) that are invariant to monotonic scale transformations.',
      bestPractices: ['Use rolling Z-scores with at least 60–120 bars of history.'],
      commonMistakes: ['Normalizing using the full dataset instead of rolling windows, causing lookahead bias.'],
    },
  ),
  c(
    'regime-tagger',
    'features',
    'Regime Tagger',
    'Label the market you are in.',
    'Classifies each bar into trend/chop/high-vol/low-vol regimes so downstream logic can behave differently.',
    ['MarketData', 'FeatureVector'],
    ['FeatureVector'],
    'starter',
    179,
    [
      { key: 'regimes', label: 'Regime set', type: 'select', options: ['Trend / Chop', 'Vol quartiles', 'HMM 4-state', 'Gaussian Mixture'], value: 'Trend / Chop' },
      { key: 'smoothing', label: 'Smoothing', type: 'slider', min: 0, max: 20, step: 1, value: 5, unit: ' bars' },
    ],
    'Turn off a mean-reversion bot the moment a trend regime is detected.',
    [
      { key: 'hiddenStates', label: 'Hidden Markov States', type: 'slider', min: 2, max: 8, step: 1, value: 4 },
      { key: 'minDuration', label: 'Min Regime Duration', type: 'slider', min: 1, max: 30, step: 1, value: 5, unit: ' bars' },
      { key: 'transitionMatrix', label: 'Custom Transition Matrix Prior', type: 'json', value: '{\n  "trend_to_chop": 0.2,\n  "chop_to_trend": 0.35\n}' },
    ],
    {
      whenToUse: 'Use to dynamically switch strategy parameter presets between trending and choppy regimes.',
      whenToSkip: 'Skip for universal market-neutral statistical arbitrage strategies.',
      bestPractices: ['Apply smoothing to prevent regime flip-flopping on borderline bars.'],
      commonMistakes: ['Over-fitting regime state transitions to historical market phases.'],
    },
  ),
  c(
    'nlp-embedder',
    'features',
    'Headline Embedder',
    'Text into vectors.',
    'Embeds headlines and filings into dense vectors, with per-ticker attribution and recency weighting.',
    ['NewsFeed'],
    ['FeatureVector'],
    'starter',
    199,
    [
      { key: 'model', label: 'Embedding model', type: 'select', options: ['Compact (fast - 384d)', 'Balanced (768d)', 'Large (slow - 1536d)'], value: 'Balanced (768d)' },
      { key: 'halfLife', label: 'Recency half-life', type: 'slider', min: 1, max: 72, step: 1, value: 6, unit: 'h' },
    ],
    'Give a sentiment agent something richer than a keyword count.',
    [
      { key: 'vectorDimensions', label: 'Output Projection Dims', type: 'select', options: ['128', '256', '512', '768'], value: '256' },
      { key: 'poolingStrategy', label: 'Pooling Strategy', type: 'select', options: ['Mean Pooling', 'CLS Token', 'Max Pooling'], value: 'Mean Pooling' },
      { key: 'truncateLength', label: 'Max Token Truncation', type: 'slider', min: 64, max: 1024, step: 64, value: 256, unit: ' tokens' },
    ],
    {
      whenToUse: 'Use to transform qualitative news and corporate disclosures into quantitative vector features.',
      whenToSkip: 'Skip if strategy has no news or sentiment feeds wired.',
      bestPractices: ['Use recency half-life decay so older news loses weight predictably.'],
      commonMistakes: ['Passing unstructured spam chatter into heavy 1536-dimensional embeddings.'],
    },
  ),
  c(
    'cross-asset',
    'features',
    'Cross-asset Correlation',
    'What else is moving with it.',
    'Rolling correlation and beta against indices, sectors, currencies and commodities.',
    ['MarketData'],
    ['FeatureVector'],
    'starter',
    179,
    [
      { key: 'benchmarks', label: 'Benchmarks', type: 'text', value: 'NIFTY, USDINR, CRUDE' },
      { key: 'window', label: 'Window', type: 'slider', min: 20, max: 250, step: 5, value: 60, unit: ' bars' },
    ],
    'Avoid stacking four positions that are secretly the same bet.',
    [
      { key: 'correlationMethod', label: 'Calculation Method', type: 'select', options: ['Pearson', 'Spearman Rank', 'Kendall Tau'], value: 'Pearson' },
      { key: 'leadLagShift', label: 'Lead/Lag Bar Shift', type: 'slider', min: -5, max: 5, step: 1, value: 0, unit: ' bars' },
      { key: 'weights', label: 'Benchmark Influence Weights', type: 'weighted-list', options: ['NIFTY Index', 'USDINR Currency', 'Crude Oil Proxy'], value: { 'NIFTY Index': 50, 'USDINR Currency': 30, 'Crude Oil Proxy': 20 } },
    ],
    {
      whenToUse: 'Use to detect macroeconomic divergences and avoid unintentional factor concentration.',
      whenToSkip: 'Skip if trading isolated micro-cap instruments with zero macro beta.',
      bestPractices: ['Include both currency and commodity proxies for emerging market equities.'],
      commonMistakes: ['Assuming rolling correlations remain constant during liquidity crises.'],
    },
  ),
  c(
    'microstructure',
    'features',
    'Microstructure Features',
    'Read the tape, not the chart.',
    'Order-flow imbalance, spread dynamics, trade-size distribution and queue depletion rates.',
    ['MarketData'],
    ['FeatureVector'],
    'pro',
    349,
    [
      { key: 'features', label: 'Features', type: 'checklist', options: ['OFI', 'Spread', 'Trade size', 'Queue depletion'], value: ['OFI', 'Spread'] },
    ],
    'Short-horizon entries where a few basis points of timing matters.',
    [
      { key: 'ofiWindow', label: 'OFI Rolling Accumulation', type: 'slider', min: 5, max: 100, step: 5, value: 20, unit: ' ticks' },
      { key: 'vpinBuckets', label: 'VPIN Volume Buckets', type: 'slider', min: 10, max: 100, step: 10, value: 50 },
      { key: 'cancelRatioThreshold', label: 'Cancel/Order Ratio Alert', type: 'slider', min: 0.5, max: 0.99, step: 0.01, value: 0.85 },
    ],
    {
      whenToUse: 'Essential for tick-level scalping, high-urgency order execution, and toxic flow detection.',
      whenToSkip: 'Skip for daily or swing trading holding periods.',
      bestPractices: ['Pair Order Flow Imbalance with Limit Order Depth feeds.'],
      commonMistakes: ['Computing heavy microstructure metrics on downsampled 1-hour candles.'],
    },
  ),
  c(
    'feature-selector',
    'features',
    'Feature Selector',
    'Drop what does not help.',
    'Mutual information and permutation-importance filtering to cut redundant features before training.',
    ['FeatureVector'],
    ['FeatureVector'],
    'pro',
    299,
    [
      { key: 'keep', label: 'Keep top N', type: 'slider', min: 3, max: 100, step: 1, value: 20 },
      { key: 'method', label: 'Method', type: 'select', options: ['Mutual information', 'Permutation importance', 'L1 path', 'Recursive Feature Elimination'], value: 'Mutual information' },
    ],
    'Fights overfitting when you have wired in more feeds than data.',
    [
      { key: 'varianceThreshold', label: 'Min Feature Variance Filter', type: 'slider', min: 0.0, max: 0.1, step: 0.01, value: 0.02 },
      { key: 'pValCutoff', label: 'Significance p-value Cutoff', type: 'slider', min: 0.01, max: 0.1, step: 0.01, value: 0.05 },
      { key: 'rankingWeights', label: 'Selection Criterion Weights', type: 'weighted-list', options: ['Predictive Alpha', 'Low Collinearity', 'Computational Speed'], value: { 'Predictive Alpha': 60, 'Low Collinearity': 30, 'Computational Speed': 10 } },
    ],
    {
      whenToUse: 'Use when combining multiple indicators and text embeddings to prune redundant inputs.',
      whenToSkip: 'Skip when using under 5 features.',
      bestPractices: ['Retrain feature selection weights on out-of-sample data.'],
      commonMistakes: ['Selecting features across the entire historical backtest window simultaneously.'],
    },
  ),

  // ==========================================
  // ---------- III. Intelligence Agents ------
  // ==========================================
  c(
    'technical-agent',
    'agents',
    'Technical Analyst',
    'Reads structure and momentum.',
    'Forms a directional view from price structure, momentum and volume with a written rationale.',
    ['FeatureVector'],
    ['Signal'],
    'free',
    0,
    [
      { key: 'style', label: 'Style', type: 'select', options: ['Trend following', 'Mean reversion', 'Breakout'], value: 'Trend following' },
      { key: 'horizon', label: 'Horizon', type: 'select', options: ['Intraday', 'Swing', 'Position'], value: 'Swing' },
    ],
    'A solid first opinion node for any price-driven bot.',
    [
      {
        key: 'model',
        label: 'Intelligence Model',
        type: 'model-select',
        value: { providerId: 'openai', modelId: 'gpt-5-mini', temperature: 0.4, maxTokens: 1024 },
      },
      {
        key: 'systemPrompt',
        label: 'Analyst Persona Prompt',
        type: 'prompt',
        value: 'You are a disciplined technical analyst. Given the feature vector for {{input}}, form a directional view based on price structure, momentum indicators, and volume trends. Output your view (BUY, SELL, or HOLD), confidence (0.0 to 1.0), and a concise one-sentence quantitative rationale.',
      },
      { key: 'confidenceThreshold', label: 'Min Output Confidence', type: 'slider', min: 0.5, max: 0.95, step: 0.05, value: 0.65 },
      { key: 'reasoningStyle', label: 'Reasoning Mode', type: 'select', options: ['Strict Quantitative', 'Price Action & Support/Resistance', 'Statistical Anomalies'], value: 'Strict Quantitative' },
    ],
    {
      whenToUse: 'Use when you want structural, trend, and indicator-based trade generation with full natural language auditability.',
      whenToSkip: 'Skip if building high-frequency tick algorithms where sub-millisecond execution is mandatory.',
      bestPractices: ['Feed both normalized indicators and raw OHLCV context.', 'Pair with a Moderator debate node.'],
      commonMistakes: ['Prompting the model without providing clear directional criteria or output constraints.'],
    },
  ),
  c(
    'sentiment-agent',
    'agents',
    'Sentiment Analyst',
    'Reads the mood.',
    'Scores narrative tone and shifts in coverage intensity, separating fresh news from recycled takes.',
    ['FeatureVector', 'NewsFeed'],
    ['Signal'],
    'free',
    0,
    [
      { key: 'sensitivity', label: 'Sensitivity', type: 'slider', min: 1, max: 10, step: 1, value: 6 },
      { key: 'ignoreRecycled', label: 'Ignore recycled coverage', type: 'switch', value: true },
    ],
    'Useful as a veto: do not buy a breakout into terrible news.',
    [
      {
        key: 'model',
        label: 'Intelligence Model',
        type: 'model-select',
        value: { providerId: 'anthropic', modelId: 'claude-sonnet', temperature: 0.3, maxTokens: 1024 },
      },
      {
        key: 'systemPrompt',
        label: 'Sentiment Persona Prompt',
        type: 'prompt',
        value: 'You are an institutional financial sentiment analyst. Evaluate headlines and narrative tone from {{input}}. Differentiate between short-term noise and structural business impact. Return a polarity score (-1.0 to +1.0) and a rationale.',
      },
      { key: 'confidenceThreshold', label: 'Min Output Confidence', type: 'slider', min: 0.5, max: 0.95, step: 0.05, value: 0.7 },
      { key: 'recycledDiscount', label: 'Recycled News Decay Penalty', type: 'slider', min: 0.1, max: 0.9, step: 0.05, value: 0.5 },
    ],
    {
      whenToUse: 'Use to filter out trades during negative headline drift or trade earnings sentiment surprises.',
      whenToSkip: 'Skip in market regimes with zero news catalyst where pure statistical mean reversion dominates.',
      bestPractices: ['Use a reasoning model like Claude Sonnet or DeepSeek R1 for nuanced earnings tone extraction.'],
      commonMistakes: ['Allowing one sensationalist headline to completely override 6 months of bullish market structure.'],
    },
  ),
  c(
    'macro-agent',
    'agents',
    'Macro Strategist',
    'Top-down context.',
    'Interprets rates, inflation, currency and liquidity conditions into a risk-on/risk-off posture.',
    ['FeatureVector', 'NewsFeed'],
    ['Signal'],
    'starter',
    229,
    [
      { key: 'regionFocus', label: 'Region focus', type: 'select', options: ['India', 'US', 'Global'], value: 'India' },
      { key: 'weight', label: 'Weight in debate', type: 'slider', min: 0, max: 100, step: 5, value: 40, unit: '%' },
    ],
    'Scale exposure down when global liquidity is tightening.',
    [
      {
        key: 'model',
        label: 'Intelligence Model',
        type: 'model-select',
        value: { providerId: 'google', modelId: 'gemini-pro', temperature: 0.4, maxTokens: 1536 },
      },
      {
        key: 'systemPrompt',
        label: 'Macro Persona Prompt',
        type: 'prompt',
        value: 'You are a global macro strategist. Synthesize central bank policy, yield curve movements, inflation data, and liquidity conditions from {{input}}. State current regime posture (RISK_ON, RISK_OFF, NEUTRAL) and specify risk multipliers.',
      },
      { key: 'confidenceThreshold', label: 'Min Output Confidence', type: 'slider', min: 0.5, max: 0.95, step: 0.05, value: 0.6 },
      { key: 'liquidityWeight', label: 'Global M2 Liquidity Weight', type: 'slider', min: 10, max: 100, step: 10, value: 60, unit: '%' },
    ],
    {
      whenToUse: 'Use on index futures and broad market baskets to establish macro regime bias.',
      whenToSkip: 'Skip for idiosyncratic single-stock breakout scalping.',
      bestPractices: ['Combine domestic central bank calendar with global USD liquidity metrics.'],
      commonMistakes: ['Over-weighting macro views for short 5-minute intraday scalping strategies.'],
    },
  ),
  c(
    'flow-agent',
    'agents',
    'Flow Analyst',
    'Follows the money.',
    'Interprets institutional flow, block trades, FII/DII activity and unusual options positioning.',
    ['FeatureVector'],
    ['Signal'],
    'starter',
    229,
    [
      { key: 'sources', label: 'Flow sources', type: 'checklist', options: ['Block trades', 'FII/DII', 'Options OI', 'Dark pool proxy'], value: ['FII/DII', 'Options OI'] },
    ],
    'Confirm a technical setup with real positioning data.',
    [
      {
        key: 'model',
        label: 'Intelligence Model',
        type: 'model-select',
        value: { providerId: 'deepseek', modelId: 'deepseek-v3', temperature: 0.3, maxTokens: 1024 },
      },
      {
        key: 'systemPrompt',
        label: 'Flow Persona Prompt',
        type: 'prompt',
        value: 'You are an institutional order-flow analyst. Analyze FII/DII cash turnover and options open interest changes in {{input}}. Determine whether smart money is accumulating, distributing, or hedging.',
      },
      { key: 'confidenceThreshold', label: 'Min Output Confidence', type: 'slider', min: 0.5, max: 0.95, step: 0.05, value: 0.65 },
      { key: 'derivativesBias', label: 'Options OI Weighting', type: 'slider', min: 10, max: 90, step: 10, value: 50, unit: '%' },
    ],
    {
      whenToUse: 'Use to validate breakouts by verifying whether institutional volume and derivatives OI confirm the move.',
      whenToSkip: 'Skip if trading instruments with no published exchange participant volume data.',
      bestPractices: ['Compare options strike open interest build-up against underlying spot resistance.'],
      commonMistakes: ['Confusing retail call buying spikes with institutional accumulation.'],
    },
  ),
  c(
    'contrarian-agent',
    'agents',
    'Contrarian',
    'Argues the other side, deliberately.',
    'Constructs the strongest case against the consensus view — designed to be wrong often but valuable when right.',
    ['FeatureVector', 'Signal'],
    ['Signal'],
    'pro',
    349,
    [
      { key: 'aggression', label: 'Aggression', type: 'slider', min: 1, max: 10, step: 1, value: 5 },
    ],
    'Feed the debate layer so your bull case gets stress-tested.',
    [
      {
        key: 'model',
        label: 'Intelligence Model',
        type: 'model-select',
        value: { providerId: 'deepseek', modelId: 'deepseek-r1', temperature: 0.7, maxTokens: 2048 },
      },
      {
        key: 'systemPrompt',
        label: 'Contrarian Persona Prompt',
        type: 'prompt',
        value: 'You are a ruthless contrarian trader. Examine the prevailing consensus signals in {{input}}. Actively construct the single strongest thesis explaining why this trade is a crowded trap. Highlight failure modes and hidden tail risks.',
      },
      { key: 'confidenceThreshold', label: 'Min Output Confidence', type: 'slider', min: 0.5, max: 0.95, step: 0.05, value: 0.6 },
      { key: 'skepticismMode', label: 'Skepticism Persona Mode', type: 'select', options: ['Trap Hunter', 'Liquidity Sweep Hunter', 'Regime Exhaustion'], value: 'Trap Hunter' },
    ],
    {
      whenToUse: 'Use in debate architectures to stress-test winning setups against blind spots and complacency.',
      whenToSkip: 'Do not use as a standalone execution generator; it is designed to be an adversary in a debate.',
      bestPractices: ['Wire into a Bull vs Bear debate node paired with a Technical Analyst.'],
      commonMistakes: ['Treating every contrarian objection as a signal to flip short.'],
    },
  ),
  c(
    'event-agent',
    'agents',
    'Event Specialist',
    'Earnings, splits, policy.',
    'Handles discrete scheduled events with their own playbooks rather than treating them as normal bars.',
    ['NewsFeed', 'FeatureVector'],
    ['Signal'],
    'starter',
    229,
    [
      { key: 'events', label: 'Event types', type: 'checklist', options: ['Earnings', 'Policy', 'Index rebalance', 'Expiry'], value: ['Earnings', 'Expiry'] },
      { key: 'preWindow', label: 'Pre-event window', type: 'slider', min: 0, max: 10, step: 1, value: 2, unit: ' days' },
    ],
    'Trade the drift into earnings without holding through the print.',
    [
      {
        key: 'model',
        label: 'Intelligence Model',
        type: 'model-select',
        value: { providerId: 'openai', modelId: 'gpt-5', temperature: 0.5, maxTokens: 1024 },
      },
      {
        key: 'systemPrompt',
        label: 'Event Specialist Persona Prompt',
        type: 'prompt',
        value: 'You are an event-driven quantitative specialist. Analyze scheduled catalyst calendar and historical pre-announcement drift from {{input}}. Recommend whether to position for drift, trade post-event volatility crush, or stand down.',
      },
      { key: 'confidenceThreshold', label: 'Min Output Confidence', type: 'slider', min: 0.5, max: 0.95, step: 0.05, value: 0.65 },
      { key: 'ivCrushFactor', label: 'Anticipated IV Crush Factor', type: 'slider', min: 0.1, max: 0.8, step: 0.05, value: 0.45 },
    ],
    {
      whenToUse: 'Use for quarterly earnings cycle playbooks, index rebalancing events, and monthly derivative expiries.',
      whenToSkip: 'Skip during calm non-event trading sessions.',
      bestPractices: ['Pre-calculate implied volatility skew 48 hours ahead of the scheduled announcement.'],
      commonMistakes: ['Gambling across binary earnings releases without strict implied volatility edge.'],
    },
  ),

  // ==========================================
  // ---------- IV. ML Prediction -------------
  // ==========================================
  c(
    'gbdt-forecast',
    'ml',
    'Gradient Boosting Forecast',
    'Strong tabular baseline with full hyperparameters.',
    'Boosted trees predicting forward returns or direction, with feature importance surfaced per prediction.',
    ['FeatureVector'],
    ['Signal'],
    'free',
    0,
    [
      { key: 'target', label: 'Target', type: 'select', options: ['Direction', 'Forward return', 'Volatility'], value: 'Direction' },
      { key: 'horizon', label: 'Prediction horizon', type: 'slider', min: 1, max: 60, step: 1, value: 5, unit: ' bars' },
      { key: 'depth', label: 'Max tree depth', type: 'slider', min: 2, max: 16, step: 1, value: 6 },
    ],
    'The model to beat before you try anything fancier.',
    [
      { key: 'learningRate', label: 'Learning Rate (η)', type: 'slider', min: 0.01, max: 0.5, step: 0.01, value: 0.05 },
      { key: 'nEstimators', label: 'Number of Trees (n_estimators)', type: 'slider', min: 50, max: 1000, step: 50, value: 300 },
      { key: 'subsample', label: 'Row Subsample Ratio', type: 'slider', min: 0.5, max: 1.0, step: 0.05, value: 0.8 },
      { key: 'lossFunction', label: 'Loss Objective', type: 'select', options: ['Log-Loss (Classification)', 'Squared-Error (MSE)', 'Huber (Robust)', 'Quantile (Pinball)'], value: 'Log-Loss (Classification)' },
      { key: 'earlyStopping', label: 'Early Stopping Patience', type: 'slider', min: 5, max: 50, step: 5, value: 15, unit: ' rounds' },
      { key: 'customParams', label: 'Advanced LightGBM JSON Params', type: 'json', value: '{\n  "colsample_bytree": 0.8,\n  "reg_alpha": 0.1,\n  "reg_lambda": 1.0\n}' },
    ],
    {
      whenToUse: 'Best baseline model for tabular market features, technical indicators, and momentum vectors.',
      whenToSkip: 'Skip when input features contain long raw sequence histories with temporal dependencies.',
      bestPractices: ['Use early stopping patience to avoid overfitting on noisy market regimes.'],
      commonMistakes: ['Setting max depth above 10 on financial data, which guarantees overfitting.'],
    },
  ),
  c(
    'sequence-model',
    'ml',
    'Sequence Model',
    'Temporal patterns over windows.',
    'Recurrent/transformer sequence model over feature windows for path-dependent predictions.',
    ['FeatureVector'],
    ['Signal'],
    'starter',
    299,
    [
      { key: 'window', label: 'Sequence length', type: 'slider', min: 8, max: 256, step: 8, value: 64, unit: ' bars' },
      { key: 'arch', label: 'Architecture', type: 'select', options: ['GRU', 'LSTM', 'Small transformer', 'Mamba SSM'], value: 'GRU' },
    ],
    'Useful when the order of events matters, not just the current snapshot.',
    [
      { key: 'hiddenUnits', label: 'Hidden Dimension Units', type: 'slider', min: 32, max: 512, step: 32, value: 128 },
      { key: 'numLayers', label: 'Layer Depth', type: 'slider', min: 1, max: 6, step: 1, value: 2 },
      { key: 'dropout', label: 'Dropout Rate', type: 'slider', min: 0.0, max: 0.5, step: 0.05, value: 0.2 },
      { key: 'learningRate', label: 'AdamW Learning Rate', type: 'slider', min: 0.0001, max: 0.01, step: 0.0005, value: 0.001 },
      { key: 'batchSize', label: 'Training Batch Size', type: 'select', options: ['16', '32', '64', '128', '256'], value: '64' },
      { key: 'attentionHeads', label: 'Attention Heads (Transformer only)', type: 'slider', min: 2, max: 16, step: 2, value: 4 },
    ],
    {
      whenToUse: 'Use for orderbook sequence dynamics, path-dependent volatility, and multi-bar momentum patterns.',
      whenToSkip: 'Skip if inputs are already aggregated rolling metrics where sequence order is redundant.',
      bestPractices: ['Keep hidden dimension under 256 to prevent parameter explosion.'],
      commonMistakes: ['Training deep transformers on short sample sets without dropout regularization.'],
    },
  ),
  c(
    'vol-forecast',
    'ml',
    'Volatility Forecast',
    'How much movement to expect.',
    'GARCH-family and ML hybrid volatility forecasts feeding position sizing and stop placement.',
    ['FeatureVector'],
    ['Signal'],
    'free',
    0,
    [
      { key: 'model', label: 'Model', type: 'select', options: ['GARCH(1,1)', 'EGARCH', 'GJR-GARCH', 'EWMA', 'ML hybrid'], value: 'GARCH(1,1)' },
      { key: 'horizon', label: 'Horizon', type: 'slider', min: 1, max: 30, step: 1, value: 5, unit: ' bars' },
    ],
    'Size positions by expected volatility instead of a fixed lot.',
    [
      { key: 'pLag', label: 'GARCH P-Lag (Autoregressive)', type: 'slider', min: 1, max: 5, step: 1, value: 1 },
      { key: 'qLag', label: 'GARCH Q-Lag (Moving Average)', type: 'slider', min: 1, max: 5, step: 1, value: 1 },
      { key: 'distType', label: 'Residual Distribution', type: 'select', options: ['Normal', "Student's t", 'Skewed t', 'GED (Generalized Error)'], value: "Student's t" },
      { key: 'confidenceAlpha', label: 'Significance Alpha (VaR Bounds)', type: 'slider', min: 0.01, max: 0.1, step: 0.01, value: 0.05 },
    ],
    {
      whenToUse: 'Essential for dynamically adjusting stop-loss distances and volatility-weighted position sizing.',
      whenToSkip: 'Skip if trading fixed-delta option spreads where volatility is pre-hedged.',
      bestPractices: ["Use Student's t distribution to account for fat tails in financial returns."],
      commonMistakes: ['Assuming volatility is Gaussian and constant across market regimes.'],
    },
  ),
  c(
    'ensemble-stacker',
    'ml',
    'Ensemble Stacker',
    'Blend several models properly.',
    'Learns weights across model outputs with out-of-fold stacking rather than naive averaging.',
    ['Signal'],
    ['Signal'],
    'pro',
    399,
    [
      { key: 'folds', label: 'CV folds', type: 'slider', min: 3, max: 10, step: 1, value: 5 },
      { key: 'meta', label: 'Meta-learner', type: 'select', options: ['Ridge', 'Logistic', 'Shallow GBDT', 'Linear Constrained'], value: 'Ridge' },
    ],
    'Squeeze a little more out of models you already trust.',
    [
      { key: 'useProbabilities', label: 'Stack Raw Probabilities (vs Discrete Signals)', type: 'switch', value: true },
      { key: 'modelWeights', label: 'Model Confidence Base Weights', type: 'weighted-list', options: ['Technical GBDT', 'Sequence Model', 'Sentiment Agent', 'Macro Classifier'], value: { 'Technical GBDT': 40, 'Sequence Model': 30, 'Sentiment Agent': 20, 'Macro Classifier': 10 } },
    ],
    {
      whenToUse: 'Use when combining multiple uncorrelated model predictions into a single superior consensus signal.',
      whenToSkip: 'Skip when stacking models that use identical features and architectures.',
      bestPractices: ['Ensure out-of-fold predictions are strictly purged to prevent information leakage.'],
      commonMistakes: ['Stacking 5 models that are 95% collinear.'],
    },
  ),
  c(
    'anomaly-detector',
    'ml',
    'Anomaly Detector',
    'Flag the weird bars.',
    'Unsupervised detection of unusual market states so the bot can stand down instead of extrapolating.',
    ['FeatureVector'],
    ['Signal'],
    'starter',
    249,
    [
      { key: 'sensitivity', label: 'Sensitivity', type: 'slider', min: 1, max: 10, step: 1, value: 7 },
      { key: 'action', label: 'On anomaly', type: 'select', options: ['Warn only', 'Reduce size', 'Halt entries'], value: 'Reduce size' },
    ],
    'Protects against trading confidently through a flash crash.',
    [
      { key: 'algorithm', label: 'Detector Algorithm', type: 'select', options: ['IsolationForest', 'OneClassSVM', 'AutoEncoder', 'LocalOutlierFactor'], value: 'IsolationForest' },
      { key: 'contamination', label: 'Expected Outlier Ratio', type: 'slider', min: 0.01, max: 0.2, step: 0.01, value: 0.05 },
      { key: 'numTrees', label: 'Number of Isolation Trees', type: 'slider', min: 50, max: 500, step: 50, value: 150 },
    ],
    {
      whenToUse: 'Place before execution to halt trades during flash crashes, orderbook glints, or abnormal spread widening.',
      whenToSkip: 'Skip if your strategy explicitly profits from extreme volatility tail spikes.',
      bestPractices: ['Set action to "Reduce size" to gracefully de-risk during structural shifts.'],
      commonMistakes: ['Setting sensitivity too high, which blocks valid high-momentum trend breakouts.'],
    },
  ),
  c(
    'meta-labeler',
    'ml',
    'Meta Labeler',
    'Should you act on this signal?',
    'A second model that predicts whether the primary signal is likely to be correct, filtering low-quality entries.',
    ['Signal', 'FeatureVector'],
    ['Signal'],
    'pro',
    399,
    [
      { key: 'threshold', label: 'Act threshold', type: 'slider', min: 0.5, max: 0.95, step: 0.01, value: 0.62 },
    ],
    'Cuts trade count sharply while often improving win rate.',
    [
      { key: 'tripleBarrierPt', label: 'Profit-Taking Barrier (σ multiplier)', type: 'slider', min: 0.5, max: 5.0, step: 0.25, value: 2.0, unit: 'σ' },
      { key: 'tripleBarrierSl', label: 'Stop-Loss Barrier (σ multiplier)', type: 'slider', min: 0.5, max: 5.0, step: 0.25, value: 1.5, unit: 'σ' },
      { key: 'holdingPeriod', label: 'Max Holding Horizon (Time Barrier)', type: 'slider', min: 5, max: 120, step: 5, value: 30, unit: ' bars' },
    ],
    {
      whenToUse: 'Use as a secondary filter on top of technical or LLM agent signals to eliminate false positives.',
      whenToSkip: 'Skip on strategies with fewer than 100 historical trades.',
      bestPractices: ['Label training samples using Marcos Lopez de Prado Triple Barrier Method.'],
      commonMistakes: ['Allowing the primary model to size positions before the meta-labeler validates the entry.'],
    },
  ),

  // ==========================================
  // ---------- V. Reinforcement Learning -----
  // ==========================================
  c(
    'sizing-policy',
    'rl',
    'Position Sizing Policy',
    'Learns how much to bet.',
    'An RL policy that maps state and confidence to position size, trained against your backtest environment.',
    ['Signal', 'FeatureVector'],
    ['Signal'],
    'pro',
    449,
    [
      { key: 'maxSize', label: 'Max size', type: 'slider', min: 1, max: 100, step: 1, value: 25, unit: '% equity' },
      { key: 'reward', label: 'Reward function', type: 'select', options: ['Sharpe', 'Return / drawdown', 'Raw P&L', 'Sortino Ratio'], value: 'Return / drawdown' },
    ],
    'Replace a fixed 2% rule with something that adapts to conditions.',
    [
      { key: 'actionSpace', label: 'Action Space', type: 'select', options: ['Continuous (0-100%)', 'Discrete Steps (25/50/75/100%)', 'Fractional Kelly Multiplier'], value: 'Continuous (0-100%)' },
      { key: 'gammaDiscount', label: 'Gamma Discount Factor (γ)', type: 'slider', min: 0.8, max: 0.999, step: 0.005, value: 0.98 },
      { key: 'entropyCoeff', label: 'Entropy Exploration Coefficient', type: 'slider', min: 0.001, max: 0.1, step: 0.005, value: 0.02 },
    ],
    {
      whenToUse: 'Use to adaptively allocate capital based on multi-factor market confidence and current drawdown.',
      whenToSkip: 'Skip for strict fixed-lot compliance portfolios.',
      bestPractices: ['Reward policies based on Sortino or Calmar ratio rather than raw P&L.'],
      commonMistakes: ['Training RL policies on un-penalized leverage, causing extreme volatility.'],
    },
  ),
  c(
    'entry-timing',
    'rl',
    'Entry Timing Policy',
    'Learns when to pull the trigger.',
    'Decides whether to act now, wait for a better price, or skip the setup entirely.',
    ['Signal'],
    ['Signal'],
    'pro',
    449,
    [
      { key: 'patience', label: 'Max wait', type: 'slider', min: 1, max: 40, step: 1, value: 8, unit: ' bars' },
    ],
    'Reduces the cost of chasing a signal that already ran.',
    [
      { key: 'rewardSlackPenalty', label: 'Time Waiting Penalty', type: 'slider', min: 0.0, max: 1.0, step: 0.05, value: 0.15 },
      { key: 'actionThreshold', label: 'Act vs Wait Policy Cutoff', type: 'slider', min: 0.1, max: 0.9, step: 0.05, value: 0.5 },
    ],
    {
      whenToUse: 'Use on momentum breakout strategies to avoid buying at the absolute peak of the impulse candle.',
      whenToSkip: 'Skip for fast market orders where fill speed is prioritized over price improvement.',
      bestPractices: ['Set max wait time to under 10 bars on intraday charts.'],
      commonMistakes: ['Waiting too long and completely missing trending continuation moves.'],
    },
  ),
  c(
    'exit-policy',
    'rl',
    'Exit Policy',
    'Learns when to get out.',
    'Trained exit logic balancing let-it-run against give-it-back, using live position state.',
    ['Signal', 'TradeOutcome'],
    ['Signal'],
    'pro',
    449,
    [
      { key: 'style', label: 'Bias', type: 'select', options: ['Protect gains', 'Balanced', 'Let it run'], value: 'Balanced' },
    ],
    'Often the highest-leverage improvement to an already-working entry.',
    [
      { key: 'trailingRatio', label: 'Dynamic Trailing Stop Ratio', type: 'slider', min: 0.5, max: 3.0, step: 0.1, value: 1.5 },
      { key: 'timeDecayPenalty', label: 'Position Holding Time Penalty', type: 'slider', min: 0.0, max: 0.5, step: 0.05, value: 0.1 },
    ],
    {
      whenToUse: 'Use to replace rigid fixed take-profit targets with dynamic market-aware exits.',
      whenToSkip: 'Skip if trading defined-risk option spreads with binary expiry outcomes.',
      bestPractices: ['Train exit policies separately from entry policies.'],
      commonMistakes: ['Over-optimizing exits on historical outliers that never recur.'],
    },
  ),
  c(
    'rl-trainer',
    'rl',
    'Policy Trainer',
    'The training loop itself.',
    'Configures the environment, reward shaping and training budget for every RL policy in the graph.',
    ['TradeOutcome'],
    ['Signal'],
    'pro',
    499,
    [
      { key: 'algo', label: 'Algorithm', type: 'select', options: ['PPO (Proximal Policy Optimization)', 'SAC (Soft Actor-Critic)', 'DQN (Deep Q-Network)'], value: 'PPO (Proximal Policy Optimization)' },
      { key: 'episodes', label: 'Episodes', type: 'number', value: 2000, min: 100, max: 100000 },
      { key: 'walkForward', label: 'Walk-forward validation', type: 'switch', value: true },
    ],
    'Required if you want your policies to keep improving after launch.',
    [
      { key: 'learningRate', label: 'Policy Actor Learning Rate', type: 'slider', min: 0.0001, max: 0.01, step: 0.0005, value: 0.0003 },
      { key: 'clipRange', label: 'PPO Clip Range (ε)', type: 'slider', min: 0.1, max: 0.4, step: 0.05, value: 0.2 },
      { key: 'gaeLambda', label: 'GAE Lambda (λ)', type: 'slider', min: 0.8, max: 0.99, step: 0.01, value: 0.95 },
    ],
    {
      whenToUse: 'Place in graph when training position sizing or exit RL agents on historical market data.',
      whenToSkip: 'Skip if using pure deterministic heuristics or classical ML regressors.',
      bestPractices: ['Always enable walk-forward validation to detect policy degradation.'],
      commonMistakes: ['Training for 100,000 episodes on 1 year of data, leading to severe overfitting.'],
    },
  ),

  // ==========================================
  // ---------- VI. Debate Layer --------------
  // ==========================================
  c(
    'bull-bear',
    'debate',
    'Bull vs Bear Rounds',
    'Structured disagreement.',
    'Two opposing cases are argued over N rounds, each round required to answer the other side directly.',
    ['Signal'],
    ['Signal'],
    'starter',
    279,
    [
      { key: 'rounds', label: 'Rounds', type: 'slider', min: 1, max: 6, step: 1, value: 2 },
      { key: 'transcript', label: 'Keep transcript', type: 'switch', value: true, help: 'Stored with each trade for post-mortems.' },
    ],
    'Stops a single loud agent from dominating every decision.',
    [
      {
        key: 'model',
        label: 'Debate Engine LLM',
        type: 'model-select',
        value: { providerId: 'anthropic', modelId: 'claude-sonnet', temperature: 0.6, maxTokens: 2048 },
      },
      {
        key: 'systemPrompt',
        label: 'Debate Round Protocol',
        type: 'prompt',
        value: 'Conduct a structured adversarial debate between the Bull case and the Bear case based on input signals: {{input}}. Each round must directly address and refute the opposing claim with empirical evidence from the features.',
      },
      { key: 'agentWeights', label: 'Agent Input Weights', type: 'weighted-list', options: ['Bull Argument', 'Bear Argument', 'Macro Context'], value: { 'Bull Argument': 40, 'Bear Argument': 40, 'Macro Context': 20 } },
    ],
    {
      whenToUse: 'Use when pairing multiple agent views (e.g. Technical + Contrarian) to eliminate single-agent hallucinations.',
      whenToSkip: 'Skip for simple rule-based momentum systems where direct signal thresholding suffices.',
      bestPractices: ['Keep rounds between 2 and 3 to prevent debate degradation and latency bloat.'],
      commonMistakes: ['Running 6 debate rounds on a 1-minute scalping strategy.'],
    },
  ),
  c(
    'moderator',
    'debate',
    'Moderator',
    'Scores the argument.',
    'Judges which case was better supported by evidence and emits a resolved view with a margin.',
    ['Signal'],
    ['Signal'],
    'starter',
    279,
    [
      { key: 'criteria', label: 'Criteria', type: 'checklist', options: ['Evidence quality', 'Falsifiability', 'Base rates', 'Risk asymmetry'], value: ['Evidence quality', 'Risk asymmetry'] },
    ],
    'Turns a messy debate into one actionable number.',
    [
      {
        key: 'model',
        label: 'Moderator Judge LLM',
        type: 'model-select',
        value: { providerId: 'openai', modelId: 'gpt-5', temperature: 0.2, maxTokens: 1024 },
      },
      {
        key: 'systemPrompt',
        label: 'Judicial Scoring Prompt',
        type: 'prompt',
        value: 'You are an impartial quant arbitration judge scoring a debate between bull and bear cases in {{input}}. Weigh argument quality, empirical data citations, and risk-reward asymmetry over mere confidence. Output the winning side and a net conviction score (0.0 to 1.0).',
      },
      { key: 'minMargin', label: 'Minimum Victory Margin', type: 'slider', min: 0.1, max: 0.5, step: 0.05, value: 0.2 },
      { key: 'decisionRubric', label: 'Judicial Scoring Rubric JSON', type: 'json', value: '{\n  "evidence_weight": 0.4,\n  "tail_risk_weight": 0.35,\n  "momentum_weight": 0.25\n}' },
    ],
    {
      whenToUse: 'Place immediately after Bull vs Bear rounds or multi-agent consensus layers to derive a unified decision.',
      whenToSkip: 'Skip if using simple weighted mathematical averaging without LLM arbitration.',
      bestPractices: ['Set temperature low (0.2) to ensure consistent, repeatable judicial scoring.'],
      commonMistakes: ['Judging debates on rhetorical flair rather than quantitative feature support.'],
    },
  ),
  c(
    'devils-advocate',
    'debate',
    "Devil's Advocate",
    'Attacks the winning case.',
    'A final adversarial pass that must find the strongest objection to whatever the moderator chose.',
    ['Signal'],
    ['Signal'],
    'pro',
    349,
    [
      { key: 'vetoPower', label: 'Can veto', type: 'switch', value: false, help: 'If on, a strong objection blocks the trade entirely.' },
    ],
    'Catches consensus mistakes in unusual market conditions.',
    [
      {
        key: 'model',
        label: 'Adversarial Model',
        type: 'model-select',
        value: { providerId: 'deepseek', modelId: 'deepseek-r1', temperature: 0.6, maxTokens: 1024 },
      },
      {
        key: 'systemPrompt',
        label: 'Adversarial Challenge Prompt',
        type: 'prompt',
        value: 'You are the Devil\'s Advocate. The committee has chosen a trade setup from {{input}}. Attack this thesis with maximum skepticism. Identify the worst-case scenario that invalidates this trade.',
      },
      { key: 'challengeRigor', label: 'Adversarial Rigor Threshold', type: 'slider', min: 0.5, max: 0.95, step: 0.05, value: 0.75 },
    ],
    {
      whenToUse: 'Use to stress-test high-conviction trade entries against tail-risk events.',
      whenToSkip: 'Skip for quick mean-reversion scalp setups.',
      bestPractices: ['Enable veto power only on large swing positions.'],
      commonMistakes: ['Allowing trivial objections to paralyze the trading pipeline.'],
    },
  ),
  c(
    'evidence-ledger',
    'debate',
    'Evidence Ledger',
    'Every claim, sourced.',
    'Records which data each argument leaned on so you can audit why a trade happened months later.',
    ['Signal'],
    ['Signal'],
    'starter',
    249,
    [{ key: 'retention', label: 'Retention', type: 'select', options: ['30 days', '1 year', 'Forever'], value: '1 year' }],
    'Essential once you have more than a handful of live decisions.',
    [
      { key: 'hashIntegrity', label: 'Cryptographic SHA-256 Hash Verification', type: 'switch', value: true },
      { key: 'fullAuditTrace', label: 'Store Raw Prompt & Response Traces', type: 'switch', value: true },
      { key: 'retentionDays', label: 'Audit Retention Horizon', type: 'slider', min: 30, max: 1825, step: 30, value: 365, unit: ' days' },
    ],
    {
      whenToUse: 'Mandatory for institutional trade compliance, regulatory audits, and post-trade attribution.',
      whenToSkip: 'Skip during rapid sandbox prototyping where memory footprint is prioritized.',
      bestPractices: ['Retain decision logs for at least 1 year.'],
      commonMistakes: ['Discarding prompt inputs, making post-mortems impossible to reconstruct.'],
    },
  ),

  // ==========================================
  // ---------- VII. Confidence Engine --------
  // ==========================================
  c(
    'calibrator',
    'confidence',
    'Probability Calibrator',
    'Make 70% actually mean 70%.',
    'Isotonic or Platt calibration so downstream thresholds and sizing use honest probabilities.',
    ['Signal'],
    ['Signal'],
    'free',
    0,
    [
      { key: 'method', label: 'Method', type: 'select', options: ['Isotonic', 'Platt', 'Temperature Scaling'], value: 'Isotonic' },
    ],
    'Cheap, boring, and one of the highest-value nodes in the catalog.',
    [
      { key: 'nBins', label: 'Calibration Bins', type: 'slider', min: 5, max: 50, step: 5, value: 15 },
      { key: 'regularization', label: 'Regularization L2 Strength', type: 'slider', min: 0.01, max: 1.0, step: 0.05, value: 0.1 },
    ],
    {
      whenToUse: 'Place after any ML or LLM classification node before sizing or risk gates.',
      whenToSkip: 'Skip if using rank-based sorting rather than absolute probability thresholds.',
      bestPractices: ['Use Isotonic calibration for non-parametric flexibility with over 1000 samples.'],
      commonMistakes: ['Assuming raw model softmax outputs represent true empirical win probabilities.'],
    },
  ),
  c(
    'agreement-score',
    'confidence',
    'Agreement Score',
    'How much do the agents concur?',
    'Measures dispersion across agent and model views, treating unanimity and deep splits differently.',
    ['Signal'],
    ['Signal'],
    'free',
    0,
    [
      { key: 'minAgreement', label: 'Min agreement to act', type: 'slider', min: 0, max: 100, step: 5, value: 60, unit: '%' },
    ],
    'Skip trades where your own components cannot agree.',
    [
      { key: 'dispersionMetric', label: 'Dispersion Metric', type: 'select', options: ['Entropy', 'Standard Deviation', 'Gini Coefficient'], value: 'Entropy' },
      { key: 'consensusThreshold', label: 'Unanimity Threshold', type: 'slider', min: 0.5, max: 0.95, step: 0.05, value: 0.75 },
    ],
    {
      whenToUse: 'Use when multi-agent graphs have 3+ independent analyst opinions.',
      whenToSkip: 'Skip for single-model or linear rule-based graphs.',
      bestPractices: ['Require at least 60% agreement before committing full risk.'],
      commonMistakes: ['Confusing unanimous agreement with a guaranteed winning trade.'],
    },
  ),
  c(
    'uncertainty-bands',
    'confidence',
    'Uncertainty Bands',
    'A range, not a point.',
    'Conformal prediction intervals around forecasts, widening automatically in unfamiliar states.',
    ['Signal'],
    ['Signal'],
    'starter',
    249,
    [
      { key: 'coverage', label: 'Target coverage', type: 'slider', min: 50, max: 99, step: 1, value: 90, unit: '%' },
    ],
    'Feed the width into sizing so uncertain trades get smaller.',
    [
      { key: 'alphaLevel', label: 'Conformal Miscoverage Alpha (α)', type: 'slider', min: 0.01, max: 0.2, step: 0.01, value: 0.05 },
      { key: 'bandwidthKernel', label: 'Bandwidth Smoothing Kernel', type: 'select', options: ['Gaussian', 'Epanechnikov', 'Triangular'], value: 'Gaussian' },
    ],
    {
      whenToUse: 'Use around continuous return forecasts to determine dynamic stop and profit zones.',
      whenToSkip: 'Skip for binary yes/no execution signals.',
      bestPractices: ['Automatically scale position size inversely with the uncertainty band width.'],
      commonMistakes: ['Ignoring wide prediction bands during market regime shifts.'],
    },
  ),
  c(
    'confidence-gate',
    'confidence',
    'Confidence Gate',
    'Drop the weak signals.',
    'A hard threshold with hysteresis so the bot does not flip-flop around the cutoff.',
    ['Signal'],
    ['Signal'],
    'free',
    0,
    [
      { key: 'threshold', label: 'Threshold', type: 'slider', min: 0.5, max: 0.95, step: 0.01, value: 0.6 },
      { key: 'hysteresis', label: 'Hysteresis', type: 'slider', min: 0, max: 0.2, step: 0.01, value: 0.05 },
    ],
    'The simplest way to cut your trade count in half.',
    [
      { key: 'coolDownBars', label: 'Cool-down Re-arm Bars', type: 'slider', min: 0, max: 20, step: 1, value: 3, unit: ' bars' },
      { key: 'hardCutoff', label: 'Emergency Reject Threshold', type: 'slider', min: 0.4, max: 0.7, step: 0.05, value: 0.45 },
    ],
    {
      whenToUse: 'Place immediately prior to Risk or Execution layers to eliminate low-conviction churn.',
      whenToSkip: 'Skip if your strategy relies on continuous small lot market-making.',
      bestPractices: ['Set hysteresis to at least 0.05 to prevent rapid order oscillation around the cutoff.'],
      commonMistakes: ['Setting the threshold to 0.9, resulting in 0 executed trades in a year.'],
    },
  ),
  c(
    'drift-monitor',
    'confidence',
    'Drift Monitor',
    'Is the model still in its element?',
    'Compares live feature distributions to training data and decays confidence as drift grows.',
    ['FeatureVector', 'Signal'],
    ['Signal'],
    'pro',
    329,
    [
      { key: 'metric', label: 'Drift metric', type: 'select', options: ['PSI (Population Stability Index)', 'KL divergence', 'Wasserstein Distance'], value: 'PSI (Population Stability Index)' },
      { key: 'action', label: 'On high drift', type: 'select', options: ['Warn', 'Halve size', 'Halt'], value: 'Halve size' },
    ],
    'Your early warning that a model needs retraining.',
    [
      { key: 'refWindowBars', label: 'Reference Historical Baseline Window', type: 'slider', min: 100, max: 5000, step: 100, value: 1000, unit: ' bars' },
      { key: 'criticalPsiThreshold', label: 'Critical PSI Alarm Cutoff', type: 'slider', min: 0.1, max: 0.5, step: 0.05, value: 0.25 },
    ],
    {
      whenToUse: 'Essential for live ML deployments to catch silent model decay caused by macroeconomic regime shifts.',
      whenToSkip: 'Skip during rapid backtesting.',
      bestPractices: ['Wire drift monitor triggers directly to an automated Retrainer node in Layer XI.'],
      commonMistakes: ['Ignoring PSI alerts above 0.25 until large unexpected losses occur.'],
    },
  ),

  // ==========================================
  // ---------- VIII. Risk Management ---------
  // ==========================================
  c(
    'position-cap',
    'risk',
    'Position Size Cap',
    'A hard ceiling per trade.',
    'Caps notional and percentage exposure per position, per symbol and per sector.',
    ['Signal'],
    ['RiskDecision'],
    'free',
    0,
    [
      { key: 'maxPct', label: 'Max per position', type: 'slider', min: 1, max: 50, step: 1, value: 10, unit: '% equity' },
      { key: 'maxSector', label: 'Max per sector', type: 'slider', min: 5, max: 100, step: 5, value: 30, unit: '% equity' },
    ],
    'The one risk node no bot should ship without.',
    [
      { key: 'maxLeverage', label: 'Max gross leverage', type: 'slider', min: 1, max: 10, step: 0.5, value: 2, unit: 'x' },
      { key: 'enforceCashFloor', label: 'Enforce 10% cash buffer', type: 'switch', value: true },
      { key: 'sectorExposureTable', label: 'Custom Sector Cap Overrides', type: 'key-value', value: [{ key: 'Financials', value: '25%' }, { key: 'IT', value: '20%' }] },
    ],
    {
      whenToUse: 'Mandatory on every strategy to protect portfolio longevity and prevent single-asset blowups.',
      whenToSkip: 'Never skip.',
      bestPractices: ['Set max position size to 5–10% of portfolio equity.'],
      commonMistakes: ['Setting max position size to 100% on volatile options strategies.'],
    },
  ),
  c(
    'drawdown-brake',
    'risk',
    'Drawdown Brake',
    'Slow down when losing.',
    'Progressively reduces size as drawdown deepens and halts entirely past a floor.',
    ['Signal', 'TradeOutcome'],
    ['RiskDecision'],
    'free',
    0,
    [
      { key: 'softStop', label: 'Reduce size at', type: 'slider', min: 2, max: 30, step: 1, value: 8, unit: '% DD' },
      { key: 'hardStop', label: 'Halt at', type: 'slider', min: 5, max: 50, step: 1, value: 15, unit: '% DD' },
    ],
    'Turns a bad week into a survivable one.',
    [
      { key: 'recoveryCoolOffHours', label: 'Post-Halt Cool-Off Time', type: 'slider', min: 1, max: 72, step: 1, value: 24, unit: ' hours' },
      { key: 'escalationSteps', label: 'Size Reduction De-escalation Steps', type: 'slider', min: 2, max: 5, step: 1, value: 3 },
    ],
    {
      whenToUse: 'Mandatory for preserving capital during prolonged market chop or black-swan drawdowns.',
      whenToSkip: 'Never skip in live trading.',
      bestPractices: ['Set hard stop at your personal maximum pain threshold (e.g. 15%).'],
      commonMistakes: ['Disabling the drawdown brake immediately after it halts a strategy.'],
    },
  ),
  c(
    'risk-gate',
    'risk',
    'Risk Gate',
    'The final yes or no.',
    'Evaluates every proposed trade against all limits and emits an explicit allow/block with a reason.',
    ['Signal'],
    ['RiskDecision'],
    'free',
    0,
    [
      { key: 'threshold', label: 'Block threshold', type: 'slider', min: 0, max: 100, step: 1, value: 65, unit: ' risk score' },
      { key: 'fpCost', label: 'False-positive cost weight', type: 'slider', min: 0, max: 10, step: 0.5, value: 3, help: 'How badly you mind blocking a good trade.' },
      { key: 'fnCost', label: 'False-negative cost weight', type: 'slider', min: 0, max: 10, step: 0.5, value: 7, help: 'How badly you mind allowing a bad trade.' },
      { key: 'maxPosition', label: 'Max position', type: 'slider', min: 1, max: 100, step: 1, value: 20, unit: '% equity' },
    ],
    'Every execution path should pass through a gate like this.',
    [
      { key: 'customRiskRule', label: 'Custom Risk Policy Script (Python)', type: 'code', language: 'python', value: '# def evaluate_risk(order, portfolio):\n#   if portfolio.daily_drawdown > 0.05:\n#     return False, "Exceeded daily drawdown"\n#   return True, "Approved"' },
      { key: 'strictMode', label: 'Strict mode (block on missing data)', type: 'switch', value: true },
      { key: 'blockOnMissingData', label: 'Block executions if telemetry latency exceeds 500ms', type: 'switch', value: true },
    ],
    {
      whenToUse: 'Place as the sole conduit before any Execution Layer node.',
      whenToSkip: 'Never skip.',
      bestPractices: ['Set false-negative cost weight higher than false-positive cost.'],
      commonMistakes: ['Bypassing the risk gate to wire signals directly into order execution.'],
    },
  ),
  c(
    'correlation-guard',
    'risk',
    'Correlation Guard',
    'Stop accidental concentration.',
    'Blocks new positions that are highly correlated with existing exposure.',
    ['Signal'],
    ['RiskDecision'],
    'starter',
    259,
    [
      { key: 'maxCorr', label: 'Max correlation', type: 'slider', min: 0.3, max: 0.99, step: 0.01, value: 0.7 },
      { key: 'window', label: 'Window', type: 'slider', min: 20, max: 250, step: 10, value: 60, unit: ' bars' },
    ],
    'Prevents four positions that are all just one index bet.',
    [
      { key: 'covarianceDecay', label: 'Covariance Decay Factor', type: 'slider', min: 0.85, max: 0.99, step: 0.01, value: 0.94 },
      { key: 'eigenCutoff', label: 'Principal Component Eigenvalue Cap', type: 'slider', min: 0.5, max: 0.95, step: 0.05, value: 0.8 },
    ],
    {
      whenToUse: 'Use when trading multi-symbol stock universes to prevent piling into the same momentum basket.',
      whenToSkip: 'Skip on single-asset trading graphs.',
      bestPractices: ['Set max correlation to 0.70 to guarantee diversification.'],
      commonMistakes: ['Holding 5 different banking stocks assuming they are independent positions.'],
    },
  ),
  c(
    'daily-loss-limit',
    'risk',
    'Daily Loss Limit',
    'Stop for the day.',
    'Halts all new entries once a daily loss threshold is hit and optionally flattens open positions.',
    ['TradeOutcome'],
    ['RiskDecision'],
    'free',
    0,
    [
      { key: 'limit', label: 'Daily loss limit', type: 'number', value: 5000, unit: '₹' },
      { key: 'flatten', label: 'Flatten open positions', type: 'switch', value: false },
    ],
    'A simple circuit breaker that has saved a lot of accounts.',
    [
      { key: 'autoCancelPending', label: 'Auto-cancel all open limit orders on trigger', type: 'switch', value: true },
      { key: 'lockoutUntilNextSession', label: 'Hard lockout until next market session', type: 'switch', value: true },
    ],
    {
      whenToUse: 'Essential intraday circuit breaker to prevent revenge trading or software runaway.',
      whenToSkip: 'Never skip on live intraday accounts.',
      bestPractices: ['Set daily loss limit to 1–2% of total capital.'],
      commonMistakes: ['Manually overriding the daily loss limit mid-session.'],
    },
  ),
  c(
    'event-blackout',
    'risk',
    'Event Blackout',
    'Sit out the coin flips.',
    'Blocks entries inside configurable windows around scheduled high-impact events.',
    ['NewsFeed', 'Signal'],
    ['RiskDecision'],
    'starter',
    229,
    [
      { key: 'before', label: 'Before event', type: 'slider', min: 0, max: 120, step: 5, value: 15, unit: ' min' },
      { key: 'after', label: 'After event', type: 'slider', min: 0, max: 120, step: 5, value: 30, unit: ' min' },
    ],
    'Avoid holding a leveraged position into a rate decision.',
    [
      { key: 'emergencyClose', label: 'Close open scalps 2 min before event', type: 'switch', value: true },
      { key: 'customBlackoutWindows', label: 'Custom Manual Blackout Windows', type: 'key-value', value: [{ key: 'RBI Policy', value: '09:45 - 10:30' }] },
    ],
    {
      whenToUse: 'Use around central bank announcements, CPI releases, and earnings prints.',
      whenToSkip: 'Skip for long-term multi-month swing strategies.',
      bestPractices: ['Set buffer to at least 15 min before and 30 min after.'],
      commonMistakes: ['Holding market orders open through binary macroeconomic releases.'],
    },
  ),
  c(
    'var-monitor',
    'risk',
    'VaR / Stress Monitor',
    'What could a bad day cost?',
    'Rolling value-at-risk plus scripted stress scenarios applied to current exposure.',
    ['TradeOutcome'],
    ['RiskDecision'],
    'pro',
    379,
    [
      { key: 'confidence', label: 'Confidence', type: 'select', options: ['95%', '99%'], value: '95%' },
      { key: 'scenarios', label: 'Stress scenarios', type: 'checklist', options: ['2008', 'Covid crash', 'Rate shock', 'Liquidity freeze'], value: ['Covid crash', 'Rate shock'] },
    ],
    'For when you are running enough capital to care about tails.',
    [
      { key: 'monteCarloIterations', label: 'Monte Carlo Simulations', type: 'slider', min: 1000, max: 50000, step: 1000, value: 10000 },
      { key: 'decayLambda', label: 'Decay Lambda for Historical VaR', type: 'slider', min: 0.9, max: 0.99, step: 0.01, value: 0.94 },
    ],
    {
      whenToUse: 'Use on multi-asset institutional portfolios to monitor tail-risk and capital at risk.',
      whenToSkip: 'Skip on small single-contract retail accounts.',
      bestPractices: ['Stress-test against historical liquidity freezes (e.g. March 2020).'],
      commonMistakes: ['Relying solely on parametric Gaussian VaR without stress scenarios.'],
    },
  ),

  // ==========================================
  // ---------- IX. Execution -----------------
  // ==========================================
  c(
    'paper-executor',
    'execution',
    'Paper Trading Executor',
    'Trade with no money at risk.',
    'Simulates fills against real quotes with configurable slippage and fee assumptions. The default execution node.',
    ['RiskDecision'],
    ['ExecutionOrder'],
    'free',
    0,
    [
      { key: 'slippage', label: 'Assumed slippage', type: 'slider', min: 0, max: 100, step: 1, value: 8, unit: ' bps' },
      { key: 'fees', label: 'Fees', type: 'slider', min: 0, max: 50, step: 0.5, value: 3, unit: ' bps' },
      { key: 'partialFills', label: 'Model partial fills', type: 'switch', value: true },
    ],
    'Where every bot should live until it has earned real capital.',
    [
      { key: 'fillModel', label: 'Fill simulation model', type: 'select', options: ['Next Bar Open', 'Midpoint + Slippage', 'Orderbook Cross Simulation'], value: 'Midpoint + Slippage' },
      { key: 'latencySimMs', label: 'Simulated Network Latency', type: 'slider', min: 0, max: 500, step: 10, value: 50, unit: ' ms' },
      { key: 'logOrders', label: 'Emit detailed execution events', type: 'switch', value: true },
      { key: 'datasetRef', label: 'Execution Replay Dataset', type: 'dataset-ref', value: 'ds-nifty50-1m' },
    ],
    {
      whenToUse: 'Default execution target for all new strategies during research and forward paper validation.',
      whenToSkip: 'Skip only when deploying real capital to a verified broker API endpoint.',
      bestPractices: ['Set slippage to at least 8–10 bps to ensure realistic performance results.'],
      commonMistakes: ['Assuming zero slippage and zero broker commissions in backtests.'],
    },
  ),
  c(
    'market-order',
    'execution',
    'Market Order',
    'Get filled now.',
    'Immediate execution with a slippage budget and abort threshold if the book is too thin.',
    ['RiskDecision'],
    ['ExecutionOrder'],
    'free',
    0,
    [
      { key: 'maxSlippage', label: 'Abort above', type: 'slider', min: 1, max: 200, step: 1, value: 25, unit: ' bps' },
    ],
    'Fine for liquid names, dangerous for small caps.',
    [
      { key: 'timeInForce', label: 'Time in Force', type: 'select', options: ['IOC (Immediate or Cancel)', 'FOK (Fill or Kill)', 'DAY'], value: 'IOC (Immediate or Cancel)' },
      { key: 'splitChunks', label: 'Split into micro-slices', type: 'slider', min: 1, max: 10, step: 1, value: 1 },
    ],
    {
      whenToUse: 'Use when immediate execution certainty outweighs price improvement (e.g. urgent momentum entry).',
      whenToSkip: 'Skip in illiquid names with wide bid-ask spreads.',
      bestPractices: ['Always set an abort threshold above 25–30 bps.'],
      commonMistakes: ['Blasting market orders into an empty Level 2 book.'],
    },
  ),
  c(
    'limit-ladder',
    'execution',
    'Limit Ladder',
    'Work the order patiently.',
    'Places a ladder of limit orders with configurable spacing, refresh and timeout-to-market behaviour.',
    ['RiskDecision'],
    ['ExecutionOrder'],
    'starter',
    269,
    [
      { key: 'levels', label: 'Ladder levels', type: 'slider', min: 2, max: 10, step: 1, value: 4 },
      { key: 'spacing', label: 'Spacing', type: 'slider', min: 1, max: 50, step: 1, value: 5, unit: ' bps' },
      { key: 'timeout', label: 'Timeout to market', type: 'slider', min: 0, max: 60, step: 1, value: 10, unit: ' min' },
    ],
    'Reduce cost on entries where you are not in a hurry.',
    [
      { key: 'pegReference', label: 'Peg Reference Anchor', type: 'select', options: ['Midpoint', 'Best Bid/Ask', 'VWAP Reference'], value: 'Midpoint' },
      { key: 'chaseIntervalSec', label: 'Order Ladder Refresh Frequency', type: 'slider', min: 1, max: 60, step: 1, value: 5, unit: 's' },
    ],
    {
      whenToUse: 'Use when accumulating large positions over time without moving the market.',
      whenToSkip: 'Skip for momentum breakouts that run away immediately.',
      bestPractices: ['Set timeout to convert unfilled tail slices to market.'],
      commonMistakes: ['Leaving wide limit orders resting overnight.'],
    },
  ),
  c(
    'twap-vwap',
    'execution',
    'TWAP / VWAP Slicer',
    'Spread a big order out.',
    'Slices large orders across time or volume to reduce market impact.',
    ['RiskDecision'],
    ['ExecutionOrder'],
    'starter',
    269,
    [
      { key: 'algo', label: 'Algorithm', type: 'select', options: ['TWAP', 'VWAP', 'POV (Percentage of Volume)'], value: 'VWAP' },
      { key: 'duration', label: 'Duration', type: 'slider', min: 5, max: 240, step: 5, value: 30, unit: ' min' },
    ],
    'Once your size is a meaningful fraction of average volume.',
    [
      { key: 'randomizeChunks', label: 'Randomize Chunk Sizes (anti-detection)', type: 'switch', value: true },
      { key: 'participationRate', label: 'Max Volume Participation Rate', type: 'slider', min: 1, max: 30, step: 1, value: 10, unit: '%' },
      { key: 'urgency', label: 'Slicing Urgency Bias', type: 'select', options: ['Passive', 'Neutral', 'Aggressive'], value: 'Neutral' },
    ],
    {
      whenToUse: 'Use when order notional exceeds 1% of average 5-minute volume.',
      whenToSkip: 'Skip for small retail orders where slicing fees outweigh market impact.',
      bestPractices: ['Enable randomized chunk sizes to avoid detection by adverse HFT algorithms.'],
      commonMistakes: ['Executing a 3-hour TWAP right before an earnings announcement.'],
    },
  ),
  c(
    'live-broker',
    'execution',
    'Live Broker Connection',
    'Real orders, real money.',
    'Routes orders to a connected brokerage account. Requires separate verification and an explicit opt-in.',
    ['RiskDecision'],
    ['ExecutionOrder'],
    'pro',
    0,
    [
      { key: 'venue', label: 'Venue', type: 'select', options: ['Zerodha', 'Upstox', 'Interactive Brokers', 'Alpaca'], value: 'Zerodha' },
      { key: 'orderType', label: 'Default order type', type: 'select', options: ['Market', 'Limit', 'SL-M'], value: 'Limit' },
      { key: 'apiKey', label: 'Broker API Key', type: 'credential', provider: 'Broker Gateway', value: '' },
      { key: 'confirmEach', label: 'Confirm each order manually', type: 'switch', value: true },
    ],
    'Only after a bot has a long paper record you actually trust.',
    [
      { key: 'webhookPayload', label: 'Custom Webhook Dispatch JSON', type: 'json', value: '{\n  "source": "aether-execution-engine",\n  "venue": "NSE",\n  "audit": true\n}' },
      { key: 'maxNotionalPerOrder', label: 'Max Notional Per Order (₹)', type: 'number', value: 200000 },
      { key: 'brokerSecret', label: 'Broker API Secret / TOTP Key', type: 'password' },
    ],
    {
      whenToUse: 'Use exclusively for production live execution after passing paper trading hurdles.',
      whenToSkip: 'Never use during experimental graph design.',
      bestPractices: ['Keep manual confirmation enabled for the first 30 live executions.'],
      commonMistakes: ['Connecting live keys before validating daily loss brakes in Layer VIII.'],
    },
  ),
  c(
    'smart-router',
    'execution',
    'Smart Order Router',
    'Pick the best venue per order.',
    'Routes each slice to the venue offering the best expected net price after fees and expected impact.',
    ['RiskDecision'],
    ['ExecutionOrder'],
    'pro',
    399,
    [
      { key: 'venues', label: 'Venues', type: 'checklist', options: ['NSE', 'BSE', 'Dark pool proxy'], value: ['NSE', 'BSE'] },
    ],
    'Marginal gains that compound at high turnover.',
    [
      { key: 'feeWeighting', label: 'Exchange Fee Sensitivity Weight', type: 'slider', min: 0.0, max: 1.0, step: 0.1, value: 0.5 },
      { key: 'darkPoolRouting', label: 'Attempt Dark Pool Liquidity Probe First', type: 'switch', value: true },
    ],
    {
      whenToUse: 'Use on multi-listed equities and dual exchange instruments (NSE/BSE).',
      whenToSkip: 'Skip for single-venue derivative contracts (Nifty Index Futures).',
      bestPractices: ['Account for exchange transaction charges in the routing cost function.'],
      commonMistakes: ['Routing to secondary venues during wide illiquid spread periods.'],
    },
  ),

  // ==========================================
  // ---------- X. Trade Monitoring -----------
  // ==========================================
  c(
    'pnl-tracker',
    'monitoring',
    'P&L Tracker',
    'Live position and P&L state.',
    'Tracks realised and unrealised P&L, exposure and per-position age in real time.',
    ['ExecutionOrder'],
    ['TradeOutcome'],
    'free',
    0,
    [
      { key: 'currency', label: 'Display currency', type: 'select', options: ['INR', 'USD'], value: 'INR' },
      { key: 'markTo', label: 'Mark to', type: 'select', options: ['Last', 'Mid', 'Bid/Ask'], value: 'Mid' },
    ],
    'Required input for self-learning and drawdown logic.',
    [
      { key: 'benchmarkSymbol', label: 'Alpha Benchmark Symbol', type: 'text', value: 'NIFTY50' },
      { key: 'trackMfeMae', label: 'Track Max Favorable & Adverse Excursions (MFE/MAE)', type: 'switch', value: true },
    ],
    {
      whenToUse: 'Essential telemetry node for every live and backtested strategy graph.',
      whenToSkip: 'Never skip.',
      bestPractices: ['Mark to Mid to prevent unrealized P&L distortion across wide spreads.'],
      commonMistakes: ['Evaluating strategy alpha without comparing against benchmark return.'],
    },
  ),
  c(
    'decision-log',
    'monitoring',
    'Decision Audit Log',
    'Why did it do that?',
    'Immutable record of every decision with the inputs, agent views and gate verdicts that produced it.',
    ['ExecutionOrder', 'Signal'],
    ['TradeOutcome'],
    'free',
    0,
    [
      { key: 'verbosity', label: 'Verbosity', type: 'select', options: ['Decisions only', 'Decisions + inputs', 'Full trace'], value: 'Decisions + inputs' },
    ],
    'The first thing you will want when a bot surprises you.',
    [
      { key: 'snapshotFeatures', label: 'Snapshot all 300+ input features per tick', type: 'switch', value: true },
      { key: 'exportFormat', label: 'Export Telemetry Format', type: 'select', options: ['JSONL', 'Parquet', 'CSV'], value: 'JSONL' },
    ],
    {
      whenToUse: 'Use to record complete rationale, prompt traces, and feature vectors for every trade decision.',
      whenToSkip: 'Skip during rapid high-frequency simulations if disk throughput is constrained.',
      bestPractices: ['Keep verbosity on "Decisions + inputs" for the first 3 months of live trading.'],
      commonMistakes: ['Running blind bots without decision audit trails.'],
    },
  ),
  c(
    'latency-watch',
    'monitoring',
    'Latency Watch',
    'Catch a slow pipeline.',
    'Measures per-node processing latency and alerts when the graph is too slow for its horizon.',
    ['ExecutionOrder'],
    ['TradeOutcome'],
    'starter',
    199,
    [
      { key: 'budget', label: 'Latency budget', type: 'slider', min: 50, max: 5000, step: 50, value: 800, unit: ' ms' },
    ],
    'Matters a lot for intraday, barely at all for weekly rebalances.',
    [
      { key: 'alertWebhook', label: 'Ops Alert Webhook URL', type: 'text', value: 'https://hooks.slack.com/services/...' },
      { key: 'sampleIntervalMs', label: 'Telemetry Profiling Interval', type: 'slider', min: 10, max: 500, step: 10, value: 100, unit: ' ms' },
    ],
    {
      whenToUse: 'Use on intraday and LLM-heavy graphs to prevent lag build-up.',
      whenToSkip: 'Skip for daily swing strategies where execution latency is non-critical.',
      bestPractices: ['Set latency budget to half of your bar interval.'],
      commonMistakes: ['Running heavy 32k-token LLMs on 1-minute scalping strategies.'],
    },
  ),
  c(
    'anomaly-alerts',
    'monitoring',
    'Anomaly Alerts',
    'Tell me when it is weird.',
    'Detects unusual bot behaviour — trade frequency spikes, sizing outliers, repeated rejections.',
    ['TradeOutcome'],
    ['TradeOutcome'],
    'starter',
    199,
    [
      { key: 'channels', label: 'Notify via', type: 'checklist', options: ['In-app', 'Email', 'Webhook', 'Telegram'], value: ['In-app', 'Email'] },
    ],
    'Your smoke alarm for a bot that has started misbehaving.',
    [
      { key: 'rateLimitAlertsMin', label: 'Alert Throttle Window', type: 'slider', min: 1, max: 60, step: 1, value: 10, unit: ' min' },
    ],
    {
      whenToUse: 'Mandatory monitoring node for all unattended algorithmic trading bots.',
      whenToSkip: 'Never skip on production bots.',
      bestPractices: ['Route critical alerts to Telegram or Webhook for immediate notification.'],
      commonMistakes: ['Silencing alert notifications instead of investigating anomalous sizing.'],
    },
  ),
  c(
    'attribution',
    'monitoring',
    'Layer Attribution',
    'Which layer earned its keep?',
    'Attributes P&L and blocked losses to individual nodes so you can prune dead weight.',
    ['TradeOutcome'],
    ['TradeOutcome'],
    'pro',
    349,
    [
      { key: 'granularity', label: 'Granularity', type: 'select', options: ['Per layer', 'Per node'], value: 'Per node' },
    ],
    'Tells you which expensive node you can safely switch off.',
    [
      { key: 'shapleyValues', label: 'Compute Exact Shapley Attribution Values', type: 'switch', value: true },
      { key: 'rollingDecay', label: 'Attribution Lookback Window', type: 'slider', min: 10, max: 200, step: 10, value: 60, unit: ' trades' },
    ],
    {
      whenToUse: 'Use to evaluate the marginal value added by each intelligence agent or filter node.',
      whenToSkip: 'Skip for simple 2-node linear graphs.',
      bestPractices: ['Prune nodes with negative or zero Shapley attribution scores.'],
      commonMistakes: ['Retaining expensive paid API models that contribute 0% incremental alpha.'],
    },
  ),

  // ==========================================
  // ---------- XI. Self-Learning -------------
  // ==========================================
  c(
    'post-mortem',
    'learning',
    'Trade Post-mortem',
    'Study every closed trade.',
    'Generates a structured review of each closed trade: what was expected, what happened, what to change.',
    ['TradeOutcome'],
    ['TradeOutcome'],
    'starter',
    299,
    [
      { key: 'depth', label: 'Review depth', type: 'select', options: ['Losses only', 'Outliers', 'Every trade'], value: 'Outliers' },
    ],
    'Where most of the actual learning in this system comes from.',
    [
      { key: 'llmReviewPrompt', label: 'Post-Mortem Evaluation Prompt', type: 'prompt', value: 'Analyze the trade outcome from {{input}}. Identify if the loss resulted from execution slippage, false breakout, or unexpected news event.' },
      { key: 'minPnLDelta', label: 'Outlier P&L Threshold (₹)', type: 'number', value: 2000 },
    ],
    {
      whenToUse: 'Use to automatically generate diagnostic learning reviews for closed losing trades.',
      whenToSkip: 'Skip during rapid backtests.',
      bestPractices: ['Feed post-mortem reviews into the Rule Miner node in Layer XI.'],
      commonMistakes: ['Reviewing every $1 scalp individually rather than focusing on tail loss events.'],
    },
  ),
  c(
    'rule-miner',
    'learning',
    'Rule Miner',
    'Derive new rules from history.',
    'Mines recurring loss patterns into candidate rules you can review and promote into the risk layer.',
    ['TradeOutcome'],
    ['Signal'],
    'pro',
    429,
    [
      { key: 'minSupport', label: 'Min support', type: 'slider', min: 5, max: 200, step: 5, value: 25, unit: ' trades' },
      { key: 'autoPromote', label: 'Auto-promote rules', type: 'switch', value: false, help: 'Off by default — review rules yourself first.' },
    ],
    '"Never take this setup in the last 30 minutes" — found automatically.',
    [
      { key: 'minConfidence', label: 'Min Rule Mining Confidence', type: 'slider', min: 0.5, max: 0.95, step: 0.05, value: 0.8 },
      { key: 'maxRuleComplexity', label: 'Max Conjunction Predicates', type: 'slider', min: 1, max: 6, step: 1, value: 3 },
    ],
    {
      whenToUse: 'Use to discover hidden systematic loss conditions from trade outcome history.',
      whenToSkip: 'Skip when trade history has fewer than 100 closed positions.',
      bestPractices: ['Keep auto-promote disabled; manually verify mined rules in the Risk Gate.'],
      commonMistakes: ['Mining rules with support under 10 trades, resulting in spurious correlations.'],
    },
  ),
  c(
    'retrainer',
    'learning',
    'Scheduled Retrainer',
    'Keep models current.',
    'Retrains models on a schedule or on drift triggers, with automatic champion/challenger comparison.',
    ['TradeOutcome', 'FeatureVector'],
    ['Signal'],
    'pro',
    429,
    [
      { key: 'frequency', label: 'Frequency', type: 'select', options: ['Daily', 'Weekly', 'Monthly', 'On drift only'], value: 'Weekly' },
      { key: 'challenger', label: 'Require challenger to win', type: 'switch', value: true },
      { key: 'modules', label: 'Retrain modules', type: 'checklist', options: ['Forecast models', 'RL policies', 'Calibrator', 'Meta labeler'], value: ['Forecast models', 'Calibrator'] },
    ],
    'Prevents slow decay as the market changes underneath you.',
    [
      { key: 'minWinRateAdvantage', label: 'Min Challenger Advantage Required', type: 'slider', min: 1, max: 15, step: 1, value: 3, unit: '%' },
      { key: 'validationMetrics', label: 'Challenger Acceptance Gate', type: 'checklist', options: ['Sharpe Ratio', 'Max Drawdown', 'Profit Factor'], value: ['Sharpe Ratio', 'Profit Factor'] },
    ],
    {
      whenToUse: 'Use to automate periodic ML model updates without manual intervention.',
      whenToSkip: 'Skip for static deterministic rule sets.',
      bestPractices: ['Require the challenger model to outperform the champion by at least 3% out-of-sample.'],
      commonMistakes: ['Deploying retrained models without out-of-fold champion vs challenger validation.'],
    },
  ),
  c(
    'regime-adapter',
    'learning',
    'Regime Adapter',
    'Different playbook per regime.',
    'Maintains separate parameter sets per detected regime and switches between them automatically.',
    ['FeatureVector', 'TradeOutcome'],
    ['Signal'],
    'pro',
    429,
    [
      { key: 'minSamples', label: 'Min samples per regime', type: 'slider', min: 20, max: 500, step: 10, value: 100 },
    ],
    'For bots that need to survive both trending and choppy markets.',
    [
      { key: 'smoothTransitions', label: 'Smooth Linear Parameter Blending', type: 'switch', value: true },
      { key: 'hysteresisBars', label: 'Regime Switch Hysteresis Buffer', type: 'slider', min: 5, max: 50, step: 5, value: 15, unit: ' bars' },
    ],
    {
      whenToUse: 'Use when a strategy needs distinct parameter profiles for high-volatility vs low-volatility regimes.',
      whenToSkip: 'Skip for single-regime specialized breakout bots.',
      bestPractices: ['Ensure each regime has at least 100 historical samples before fitting parameters.'],
      commonMistakes: ['Switching parameter sets abruptly bar-to-bar during chop.'],
    },
  ),
  c(
    'shadow-tester',
    'learning',
    'Shadow Tester',
    'Test changes without risking anything.',
    'Runs proposed changes in parallel on live data without executing, comparing against the live bot.',
    ['Signal', 'TradeOutcome'],
    ['TradeOutcome'],
    'starter',
    299,
    [
      { key: 'duration', label: 'Shadow period', type: 'slider', min: 1, max: 90, step: 1, value: 14, unit: ' days' },
    ],
    'The safe way to change a bot that is currently working.',
    [
      { key: 'discrepancyThreshold', label: 'Decision Divergence Alarm (α)', type: 'slider', min: 0.01, max: 0.2, step: 0.01, value: 0.05 },
      { key: 'logShadowDecisions', label: 'Emit Shadow Simulation Order Trace', type: 'switch', value: true },
    ],
    {
      whenToUse: 'Use when testing graph adjustments or new agent prompts alongside an active profitable live bot.',
      whenToSkip: 'Skip during initial development phase.',
      bestPractices: ['Run shadow tests for at least 14 live trading days before promoting changes.'],
      commonMistakes: ['Promoting untested parameter modifications directly to live capital.'],
    },
  ),

  // ==========================================
  // ---------- XII. Memory -------------------
  // ==========================================
  c(
    'setup-recall',
    'memory',
    'Similar Setup Recall',
    'Have I seen this before?',
    'Vector search over historical states to surface the closest past setups and how they resolved.',
    ['FeatureVector'],
    ['FeatureVector'],
    'starter',
    259,
    [
      { key: 'k', label: 'Neighbours', type: 'slider', min: 3, max: 50, step: 1, value: 10 },
      { key: 'minSimilarity', label: 'Min similarity', type: 'slider', min: 0.5, max: 0.99, step: 0.01, value: 0.82 },
    ],
    'Give the debate layer historical base rates instead of vibes.',
    [
      { key: 'distanceMetric', label: 'Vector Metric', type: 'select', options: ['Cosine', 'Euclidean', 'Dot Product'], value: 'Cosine' },
      { key: 'annIndexType', label: 'Index Algorithm', type: 'select', options: ['HNSW (Fast Hierarchical)', 'IVFFlat (Inverted File)', 'Flat (Exact Search)'], value: 'HNSW (Fast Hierarchical)' },
    ],
    {
      whenToUse: 'Use to inject historical precedent and resolution win-rates into LLM agent prompts.',
      whenToSkip: 'Skip for simple technical indicator momentum graphs.',
      bestPractices: ['Require at least 0.82 cosine similarity to avoid retrieving irrelevant historical bars.'],
      commonMistakes: ['Relying on past setup outcomes during completely novel black swan market regimes.'],
    },
  ),
  c(
    'outcome-store',
    'memory',
    'Outcome Store',
    'Long-term memory of results.',
    'Durable store of every decision and its outcome, queryable by any node in the graph.',
    ['TradeOutcome'],
    ['FeatureVector'],
    'free',
    0,
    [
      { key: 'retention', label: 'Retention', type: 'select', options: ['90 days', '1 year', '5 years'], value: '1 year' },
    ],
    'The substrate every self-learning node reads from.',
    [
      { key: 'storageTier', label: 'Storage Engine', type: 'select', options: ['InMemory + Disk Sync', 'SQLite Local', 'ClickHouse Remote'], value: 'InMemory + Disk Sync' },
    ],
    {
      whenToUse: 'Essential database node for all self-learning, rule-mining, and post-mortem review workflows.',
      whenToSkip: 'Never skip on multi-session strategies.',
      bestPractices: ['Retain outcomes for at least 1 year across multiple market cycles.'],
      commonMistakes: ['Wiping outcome history during bot parameter updates.'],
    },
  ),
  c(
    'lesson-bank',
    'memory',
    'Shared Lesson Bank',
    'Lessons across all your bots.',
    'Cross-bot memory so a mistake learned in one agent is available to the others.',
    ['TradeOutcome'],
    ['FeatureVector'],
    'pro',
    379,
    [
      { key: 'scope', label: 'Scope', type: 'select', options: ['This bot only', 'All my bots', 'My bots + public lessons'], value: 'All my bots' },
    ],
    'Useful once you are running several bots on related markets.',
    [
      { key: 'sharingPolicy', label: 'Sync Policy', type: 'select', options: ['Read-Only', 'Bidirectional Sync', 'Isolated'], value: 'Bidirectional Sync' },
    ],
    {
      whenToUse: 'Use when operating a portfolio of multiple correlated algorithmic bots.',
      whenToSkip: 'Skip if running a single stand-alone bot.',
      bestPractices: ['Enable bidirectional sync so rules discovered in equity bots protect index bots.'],
      commonMistakes: ['Applying low-liquidity penny stock lessons to high-liquidity index futures.'],
    },
  ),
  c(
    'working-memory',
    'memory',
    'Working Memory',
    'Short-term context within a session.',
    'Rolling context of recent decisions and market state, so the bot is not amnesiac bar to bar.',
    ['FeatureVector', 'Signal'],
    ['FeatureVector'],
    'free',
    0,
    [
      { key: 'span', label: 'Span', type: 'slider', min: 5, max: 200, step: 5, value: 40, unit: ' bars' },
    ],
    'Stops a bot re-entering the same failed trade three times in a row.',
    [
      { key: 'bufferStrategy', label: 'Buffer Eviction Strategy', type: 'select', options: ['FIFO Queue', 'Priority by Volatility', 'Surprise Sampling'], value: 'FIFO Queue' },
    ],
    {
      whenToUse: 'Place before intelligence agents to provide recent multi-bar decision memory.',
      whenToSkip: 'Skip for purely stateless time-invariant models.',
      bestPractices: ['Set span to 30–50 bars to provide context on recent false breakouts.'],
      commonMistakes: ['Allowing working memory span to grow too large, causing LLM context bloat.'],
    },
  ),
  c(
    'embedding-index',
    'memory',
    'Embedding Index',
    'The index behind recall.',
    'Maintains and compacts the vector index used by recall and lesson lookups.',
    ['FeatureVector'],
    ['FeatureVector'],
    'starter',
    229,
    [
      { key: 'dims', label: 'Dimensions', type: 'select', options: ['256', '512', '1024'], value: '512' },
      { key: 'compact', label: 'Auto-compact', type: 'switch', value: true },
    ],
    'Required infrastructure if you use more than one memory node.',
    [
      { key: 'mHnsw', label: 'HNSW Graph M-Connections', type: 'slider', min: 8, max: 64, step: 4, value: 16 },
      { key: 'efSearch', label: 'HNSW Search Depth (ef_search)', type: 'slider', min: 16, max: 256, step: 16, value: 64 },
    ],
    {
      whenToUse: 'Required alongside Setup Recall or Shared Lesson Bank to manage indexing throughput.',
      whenToSkip: 'Skip if not utilizing vector memory retrieval.',
      bestPractices: ['Enable auto-compact to prevent index memory fragmentation.'],
      commonMistakes: ['Setting HNSW search depth above 256 for real-time tick execution.'],
    },
  ),
]

export const COMPONENT_MAP: Record<string, ComponentDef> = COMPONENTS.reduce(
  (acc, comp) => {
    acc[comp.id] = comp
    return acc
  },
  {} as Record<string, ComponentDef>,
)

export function componentsByLayer(layer: LayerId) {
  return COMPONENTS.filter((comp) => comp.layer === layer)
}

export const TIER_LABEL: Record<PlanTier, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
}

/** Structural rules surfaced by the Validate button. */
export const CONNECTION_RULES: { from: LayerId; to: LayerId; reason: string }[] = [
  {
    from: 'data',
    to: 'execution',
    reason: 'Execution cannot read raw data directly — route it through risk management first.',
  },
  {
    from: 'data',
    to: 'risk',
    reason: 'Risk needs a signal or trade outcome to judge, not a raw feed.',
  },
  {
    from: 'features',
    to: 'execution',
    reason: 'Execution needs a risk decision, not a feature vector.',
  },
]
