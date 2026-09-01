from typing import Protocol, Any, Dict, Optional
from datetime import datetime

class ClosedTrade:
    def __init__(
        self,
        id: str,
        symbol: str,
        side: str,
        entry_time: datetime,
        exit_time: datetime,
        size: float,
        pnl: float,
        pnl_pct: float,
        trigger_node: str,
        confidence: float,
        execution_flow: Optional[Dict[str, Any]] = None,
    ):
        self.id = id
        self.symbol = symbol
        self.side = side
        self.entry_time = entry_time
        self.exit_time = exit_time
        self.size = size
        self.pnl = pnl
        self.pnl_pct = pnl_pct
        self.trigger_node = trigger_node
        self.confidence = confidence
        self.execution_flow = execution_flow or {}

class NodeContext:
    """Carries the current bar/candle, running portfolio state, and prior nodes' outputs."""
    def __init__(
        self,
        candle: Any,
        portfolio: Any,
        upstream_outputs: Dict[str, Any],
        historical_window: Optional[Any] = None,
    ):
        self.candle = candle
        self.portfolio = portfolio
        self.upstream_outputs = upstream_outputs
        self.historical_window = historical_window

class Node(Protocol):
    component_id: str
    async def run(self, ctx: NodeContext, config: dict) -> Any:
        ...
