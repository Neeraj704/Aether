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
      'Indicators, normalisation, rolling windows and embeddings. Converts messy feeds into a clean feature vector.',
    hue: '#00a3c4',
  },
  {
    id: 'agents',
    roman: 'III',
    name: 'Intelligence Agents',
    short: 'Specialist readers that each form an opinion.',
    description:
      'Independent analysts  technical, macro, sentiment, flow  each producing a view with its own reasoning trace.',
    hue: '#00b894',
  },
  {
    id: 'ml',
    roman: 'IV',
    name: 'ML Prediction',
    short: 'Statistical forecasts over your feature set.',
    description:
      'Gradient boosting, sequence models and classifiers that turn features into directional or volatility forecasts.',
    hue: '#30d158',
  },
  {
    id: 'rl',
    roman: 'V',
    name: 'Reinforcement Learning',
    short: 'Policies that learn sizing and timing from outcomes.',
    description:
      'Agents trained against your own backtest environment to learn when to press and when to sit out.',
    hue: '#a3d900',
  },
  {
    id: 'debate',
    roman: 'VI',
    name: 'Debate Layer',
    short: 'Make the opinions argue before you trade them.',
    description:
      'Structured disagreement between agents  bull vs bear rounds, critique passes and a moderator that scores the argument.',
    hue: '#ffd60a',
  },
  {
    id: 'confidence',
    roman: 'VII',
    name: 'Confidence Engine',
    short: 'How sure is the agent, really?',
    description:
      'Calibration, ensemble agreement and uncertainty bands that gate weak signals before they reach risk.',
    hue: '#ff9f0a',
  },
  {
    id: 'risk',
    roman: 'VIII',
    name: 'Risk Management',
    short: 'The layer that says no.',
    description:
      'Position caps, exposure limits, drawdown brakes, correlation checks and hard kill conditions.',
    hue: '#ff6a3d',
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

export type FieldDef =
  | { key: string; label: string; type: 'text'; placeholder?: string; help?: string; value?: string }
  | { key: string; label: string; type: 'password'; placeholder?: string; help?: string }
  | {
    key: string
    label: string
    type: 'select'
    options: string[]
    value?: string
    help?: string
  }
  | {
    key: string
    label: string
    type: 'slider'
    min: number
    max: number
    step: number
    value: number
    unit?: string
    help?: string
  }
  | { key: string; label: string; type: 'switch'; value: boolean; help?: string }
  | {
    key: string
    label: string
    type: 'checklist'
    options: string[]
    value: string[]
    help?: string
  }
  | {
    key: string
    label: string
    type: 'number'
    value: number
    min?: number
    max?: number
    unit?: string
    help?: string
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
): ComponentDef {
  return { id, name, layer, tagline, description, inputs, outputs, tier, price, fields, useCase }
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
  // ---------- I. Data Collection ----------
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
    'The default starting point for almost every bot  most feature nodes expect a candle series.',
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
      { key: 'apiKey', label: 'Provider API key', type: 'password', placeholder: 'sk_live_...' },
      intervalField,
    ],
    'Feed a sentiment agent so your bot reacts to narrative, not just price.',
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
  ),

  // ---------- II. Feature Engineering ----------
  c(
    'ta-indicators',
    'features',
    'Technical Indicators',
    'The classics, correctly windowed.',
    'RSI, MACD, ATR, Bollinger, ADX and 40 more, computed with configurable lookbacks and no lookahead.',
    ['MarketData'],
    ['FeatureVector'],
    'free',
    0,
    [
      { key: 'set', label: 'Indicators', type: 'checklist', options: ['RSI', 'MACD', 'ATR', 'Bollinger', 'ADX', 'Stochastic'], value: ['RSI', 'MACD', 'ATR'] },
      { key: 'lookback', label: 'Lookback', type: 'slider', min: 5, max: 200, step: 1, value: 14, unit: ' bars' },
    ],
    'The cheapest way to give a model some market context.',
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
      { key: 'method', label: 'Method', type: 'select', options: ['Z-score', 'Min-max', 'Rank'], value: 'Z-score' },
      { key: 'window', label: 'Window', type: 'slider', min: 20, max: 500, step: 10, value: 120, unit: ' bars' },
    ],
    'Required if you are feeding a model that assumes stationary inputs.',
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
      { key: 'regimes', label: 'Regime set', type: 'select', options: ['Trend / Chop', 'Vol quartiles', 'HMM 4-state'], value: 'Trend / Chop' },
      { key: 'smoothing', label: 'Smoothing', type: 'slider', min: 0, max: 20, step: 1, value: 5, unit: ' bars' },
    ],
    'Turn off a mean-reversion bot the moment a trend regime is detected.',
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
      { key: 'model', label: 'Embedding model', type: 'select', options: ['Compact (fast)', 'Balanced', 'Large (slow)'], value: 'Balanced' },
      { key: 'halfLife', label: 'Recency half-life', type: 'slider', min: 1, max: 72, step: 1, value: 6, unit: 'h' },
    ],
    'Give a sentiment agent something richer than a keyword count.',
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
      { key: 'method', label: 'Method', type: 'select', options: ['Mutual information', 'Permutation importance', 'L1 path'], value: 'Mutual information' },
    ],
    'Fights overfitting when you have wired in more feeds than data.',
  ),

  // ---------- III. Intelligence Agents ----------
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
  ),
  c(
    'contrarian-agent',
    'agents',
    'Contrarian',
    'Argues the other side, deliberately.',
    'Constructs the strongest case against the consensus view  designed to be wrong often but valuable when right.',
    ['FeatureVector', 'Signal'],
    ['Signal'],
    'pro',
    349,
    [
      { key: 'aggression', label: 'Aggression', type: 'slider', min: 1, max: 10, step: 1, value: 5 },
    ],
    'Feed the debate layer so your bull case gets stress-tested.',
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
  ),

  // ---------- IV. ML Prediction ----------
  c(
    'gbdt-forecast',
    'ml',
    'Gradient Boosting Forecast',
    'Strong tabular baseline.',
    'Boosted trees predicting forward returns or direction, with feature importance surfaced per prediction.',
    ['FeatureVector'],
    ['Signal'],
    'free',
    0,
    [
      { key: 'target', label: 'Target', type: 'select', options: ['Direction', 'Forward return', 'Volatility'], value: 'Direction' },
      { key: 'horizon', label: 'Prediction horizon', type: 'slider', min: 1, max: 60, step: 1, value: 5, unit: ' bars' },
      { key: 'depth', label: 'Max depth', type: 'slider', min: 2, max: 12, step: 1, value: 6 },
    ],
    'The model to beat before you try anything fancier.',
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
      { key: 'arch', label: 'Architecture', type: 'select', options: ['GRU', 'LSTM', 'Small transformer'], value: 'GRU' },
    ],
    'Useful when the order of events matters, not just the current snapshot.',
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
      { key: 'model', label: 'Model', type: 'select', options: ['GARCH(1,1)', 'EWMA', 'ML hybrid'], value: 'EWMA' },
      { key: 'horizon', label: 'Horizon', type: 'slider', min: 1, max: 30, step: 1, value: 5, unit: ' bars' },
    ],
    'Size positions by expected volatility instead of a fixed lot.',
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
      { key: 'meta', label: 'Meta-learner', type: 'select', options: ['Ridge', 'Logistic', 'Shallow GBDT'], value: 'Ridge' },
    ],
    'Squeeze a little more out of models you already trust.',
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
  ),

  // ---------- V. Reinforcement Learning ----------
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
      { key: 'reward', label: 'Reward function', type: 'select', options: ['Sharpe', 'Return / drawdown', 'Raw P&L'], value: 'Return / drawdown' },
    ],
    'Replace a fixed 2% rule with something that adapts to conditions.',
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
      { key: 'algo', label: 'Algorithm', type: 'select', options: ['PPO', 'SAC', 'DQN'], value: 'PPO' },
      { key: 'episodes', label: 'Episodes', type: 'number', value: 2000, min: 100, max: 100000 },
      { key: 'walkForward', label: 'Walk-forward validation', type: 'switch', value: true },
    ],
    'Required if you want your policies to keep improving after launch.',
  ),

  // ---------- VI. Debate Layer ----------
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
  ),

  // ---------- VII. Confidence Engine ----------
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
      { key: 'method', label: 'Method', type: 'select', options: ['Isotonic', 'Platt', 'Temperature'], value: 'Isotonic' },
    ],
    'Cheap, boring, and one of the highest-value nodes in the catalog.',
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
      { key: 'metric', label: 'Drift metric', type: 'select', options: ['PSI', 'KL divergence', 'Wasserstein'], value: 'PSI' },
      { key: 'action', label: 'On high drift', type: 'select', options: ['Warn', 'Halve size', 'Halt'], value: 'Halve size' },
    ],
    'Your early warning that a model needs retraining.',
  ),

  // ---------- VIII. Risk Management ----------
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
  ),

  // ---------- IX. Execution ----------
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
      { key: 'algo', label: 'Algorithm', type: 'select', options: ['TWAP', 'VWAP', 'POV'], value: 'VWAP' },
      { key: 'duration', label: 'Duration', type: 'slider', min: 5, max: 240, step: 5, value: 30, unit: ' min' },
    ],
    'Once your size is a meaningful fraction of average volume.',
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
      { key: 'apiKey', label: 'Broker API key', type: 'password', placeholder: 'Stored encrypted' },
      { key: 'confirmEach', label: 'Confirm each order manually', type: 'switch', value: true },
    ],
    'Only after a bot has a long paper record you actually trust.',
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
  ),

  // ---------- X. Trade Monitoring ----------
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
  ),
  c(
    'anomaly-alerts',
    'monitoring',
    'Anomaly Alerts',
    'Tell me when it is weird.',
    'Detects unusual bot behaviour  trade frequency spikes, sizing outliers, repeated rejections.',
    ['TradeOutcome'],
    ['TradeOutcome'],
    'starter',
    199,
    [
      { key: 'channels', label: 'Notify via', type: 'checklist', options: ['In-app', 'Email', 'Webhook'], value: ['In-app', 'Email'] },
    ],
    'Your smoke alarm for a bot that has started misbehaving.',
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
  ),

  // ---------- XI. Self-Learning ----------
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
      { key: 'autoPromote', label: 'Auto-promote rules', type: 'switch', value: false, help: 'Off by default  review rules yourself first.' },
    ],
    '"Never take this setup in the last 30 minutes"  found automatically.',
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
  ),

  // ---------- XII. Memory ----------
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
    reason: 'Execution cannot read raw data directly  route it through risk management first.',
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
