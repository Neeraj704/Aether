from typing import Dict, Type
from .data_collection.ohlcv_feed import OhlcvFeedNode
from .data_collection.orderbook_depth import OrderbookDepthNode
from .data_collection.news_stream import NewsStreamNode
from .data_collection.social_sentiment import SocialSentimentNode
from .data_collection.macro_calendar import MacroCalendarNode
from .feature_engineering.technical_indicators import TechnicalIndicatorsNode
from .intelligence_agents.technical_analyst import TechnicalAnalystNode
from .intelligence_agents.sentiment_analyst import SentimentAnalystNode
from .intelligence_agents.macro_strategist import MacroStrategistNode
from .intelligence_agents.flow_analyst import FlowAnalystNode
from .intelligence_agents.contrarian import ContrarianAgentNode
from .intelligence_agents.event_specialist import EventSpecialistNode
from .risk_management.risk_gate import RiskGateNode
from .execution.paper_executor import PaperExecutorNode
from .ml.gbdt_forecast import GbdtForecastNode
from .universal import create_node_factory

# Primary specialized nodes
REGISTRY: Dict[str, Type] = {
    # Layer I: Data Collection
    "ohlcv-feed": OhlcvFeedNode,
    "orderbook-depth": OrderbookDepthNode,
    "news-stream": NewsStreamNode,
    "social-sentiment": SocialSentimentNode,
    "macro-calendar": MacroCalendarNode,
    "fundamentals": create_node_factory("fundamentals", "data", "Fundamentals Snapshot"),
    "options-chain": create_node_factory("options-chain", "data", "Options Chain"),
    "onchain-feed": create_node_factory("onchain-feed", "data", "On-chain Feed"),

    # Layer II: Feature Engineering
    "ta-indicators": TechnicalIndicatorsNode,
    "technical-indicators": TechnicalIndicatorsNode,
    "normalizer": create_node_factory("normalizer", "features", "Rolling Normaliser"),
    "regime-tagger": create_node_factory("regime-tagger", "features", "Regime Tagger"),
    "nlp-embedder": create_node_factory("nlp-embedder", "features", "Headline Embedder"),
    "cross-asset": create_node_factory("cross-asset", "features", "Cross-asset Correlation"),
    "microstructure": create_node_factory("microstructure", "features", "Microstructure Features"),
    "feature-selector": create_node_factory("feature-selector", "features", "Feature Selector"),

    # Layer III: Intelligence Agents
    "technical-agent": TechnicalAnalystNode,
    "technical-analyst": TechnicalAnalystNode,
    "sentiment-agent": SentimentAnalystNode,
    "macro-agent": MacroStrategistNode,
    "flow-agent": FlowAnalystNode,
    "contrarian-agent": ContrarianAgentNode,
    "event-agent": EventSpecialistNode,

    # Layer IV: ML Predictive Models
    # gbdt-forecast is the only real, trained-artifact inference node in Phase 19.
    # The other five remain UniversalNode stubs until their own dedicated phases.
    "gbdt-forecast": GbdtForecastNode,
    "sequence-model": create_node_factory("sequence-model", "ml", "Sequence Model"),
    "vol-forecast": create_node_factory("vol-forecast", "ml", "Volatility Forecast"),
    "ensemble-stacker": create_node_factory("ensemble-stacker", "ml", "Ensemble Stacker"),
    "anomaly-detector": create_node_factory("anomaly-detector", "ml", "Anomaly Detector"),
    "meta-labeler": create_node_factory("meta-labeler", "ml", "Meta Labeler"),

    # Layer V: Reinforcement Learning
    "sizing-policy": create_node_factory("sizing-policy", "rl", "Position Sizing Policy"),
    "entry-timing": create_node_factory("entry-timing", "rl", "Entry Timing Policy"),
    "exit-policy": create_node_factory("exit-policy", "rl", "Exit Policy"),
    "rl-trainer": create_node_factory("rl-trainer", "rl", "Policy Trainer"),

    # Layer VI: Debate & Consensus
    "bull-bear": create_node_factory("bull-bear", "debate", "Bull vs Bear Rounds"),
    "moderator": create_node_factory("moderator", "debate", "Moderator"),
    "evidence-ledger": create_node_factory("evidence-ledger", "debate", "Evidence Ledger"),

    # Layer VII: Confidence & Calibration
    "calibrator": create_node_factory("calibrator", "confidence", "Probability Calibrator"),
    "agreement-score": create_node_factory("agreement-score", "confidence", "Agreement Score"),
    "uncertainty-bands": create_node_factory("uncertainty-bands", "confidence", "Uncertainty Bands"),
    "confidence-gate": create_node_factory("confidence-gate", "confidence", "Confidence Gate"),
    "drift-monitor": create_node_factory("drift-monitor", "confidence", "Drift Monitor"),

    # Layer VIII: Risk Management
    "position-cap": create_node_factory("position-cap", "risk", "Position Size Cap"),
    "drawdown-brake": create_node_factory("drawdown-brake", "risk", "Drawdown Brake"),
    "risk-gate": RiskGateNode,
    "correlation-guard": create_node_factory("correlation-guard", "risk", "Correlation Guard"),
    "daily-loss-limit": create_node_factory("daily-loss-limit", "risk", "Daily Loss Limit"),
    "event-blackout": create_node_factory("event-blackout", "risk", "Event Blackout"),
    "var-monitor": create_node_factory("var-monitor", "risk", "VaR / Stress Monitor"),

    # Layer IX: Execution
    "paper-executor": PaperExecutorNode,
    "market-order": PaperExecutorNode,
    "limit-ladder": PaperExecutorNode,
    "twap-vwap": PaperExecutorNode,
    "live-broker": PaperExecutorNode,
    "smart-router": PaperExecutorNode,

    # Layer X: Trade Monitoring
    "pnl-tracker": create_node_factory("pnl-tracker", "monitoring", "P&L Tracker"),
    "decision-log": create_node_factory("decision-log", "monitoring", "Decision Audit Log"),
    "latency-watch": create_node_factory("latency-watch", "monitoring", "Latency Watch"),
    "anomaly-alerts": create_node_factory("anomaly-alerts", "monitoring", "Anomaly Alerts"),
    "attribution": create_node_factory("attribution", "monitoring", "Layer Attribution"),

    # Layer XI: Self-Learning
    "post-mortem": create_node_factory("post-mortem", "learning", "Trade Post-mortem"),
    "rule-miner": create_node_factory("rule-miner", "learning", "Rule Miner"),
    "retrainer": create_node_factory("retrainer", "learning", "Scheduled Retrainer"),
    "regime-adapter": create_node_factory("regime-adapter", "learning", "Regime Adapter"),
    "shadow-tester": create_node_factory("shadow-tester", "learning", "Shadow Tester"),

    # Layer XII: Memory
    "setup-recall": create_node_factory("setup-recall", "memory", "Similar Setup Recall"),
    "outcome-store": create_node_factory("outcome-store", "memory", "Outcome Store"),
    "lesson-bank": create_node_factory("lesson-bank", "memory", "Shared Lesson Bank"),
    "working-memory": create_node_factory("working-memory", "memory", "Working Memory"),
    "embedding-index": create_node_factory("embedding-index", "memory", "Embedding Index"),
}
