from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field

class EquityPoint(BaseModel):
    date: str
    equity: float
    benchmark: float
    drawdown: float

class Trade(BaseModel):
    id: str
    symbol: str
    side: Literal['long', 'short']
    entryTime: str
    exitTime: str
    size: float
    pnl: float
    pnlPct: float
    triggerNode: str
    confidence: float
    executionFlow: Optional[Dict[str, Any]] = None

class BacktestMetrics(BaseModel):
    totalReturn: float
    winRate: float
    maxDrawdown: float
    sharpe: float
    trades: int
    avgR: float
    profitFactor: float
    exposure: float
    cappedToBars: Optional[int] = None
    notes: Optional[str] = None

class LayerContribution(BaseModel):
    layer: str
    label: str
    detail: str
    impact: float
    positive: bool

class BacktestInsight(BaseModel):
    title: str
    body: str
    kind: Literal['rule', 'postmortem']

class BacktestConfig(BaseModel):
    from_: str = Field(alias='from', default='2024-01-01')
    to: str = Field(default='2024-12-31')
    symbols: str = 'BTCUSDT'
    capital: float = 100000.0
    fees: float = 10.0
    slippage: float = 8.0
    seed: int = 42
    type: Literal['historical', 'walk-forward', 'monte-carlo', 'paper', 'ab'] = 'historical'

    class Config:
        populate_by_name = True

class BacktestRequest(BaseModel):
    bot_id: Optional[str] = Field(None, alias='botId')
    botId: Optional[str] = None
    config: BacktestConfig

    def get_bot_id(self) -> str:
        res = self.bot_id or self.botId
        if not res:
            raise ValueError("botId is required")
        return res

class BacktestRunResponse(BaseModel):
    id: str
    botId: str
    botName: str
    createdAt: str
    config: BacktestConfig
    metrics: Optional[BacktestMetrics] = None
    equity: List[EquityPoint] = Field(default_factory=list)
    trades: List[Trade] = Field(default_factory=list)
    contributions: List[LayerContribution] = Field(default_factory=list)
    insights: List[BacktestInsight] = Field(default_factory=list)
    status: str = 'queued'
    errorMessage: Optional[str] = None
