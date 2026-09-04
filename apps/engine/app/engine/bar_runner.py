from typing import Optional, List, Tuple, Any, Dict
from ..nodes.base import NodeContext, ClosedTrade
from ..nodes.registry import REGISTRY

def build_node_instances(
    ordered_nodes: list,
    config: Optional[Any] = None,
    slippage_multiplier: float = 1.0,
) -> List[Tuple[Any, Any, Dict[str, Any]]]:
    """
    Instantiates node classes from the registry for a compiled list of ordered nodes.
    Returns list of (node, node_instance, merged_config).
    """
    node_instances = []
    base_slippage = getattr(config, "slippage", 8.0) if config else 8.0

    for node in ordered_nodes:
        node_cls = REGISTRY.get(node.componentId)
        if node_cls:
            merged_cfg = dict(node.config)
            if node.componentId == "paper-executor" and slippage_multiplier != 1.0:
                base_slip = float(merged_cfg.get("slippage", base_slippage))
                merged_cfg["slippage"] = base_slip * slippage_multiplier
            node_instance = node_cls(merged_cfg)
            node_instances.append((node, node_instance, merged_cfg))

    return node_instances

async def run_one_bar(
    node_instances: list,
    candle: Any,
    portfolio: Any,
    return_context: bool = False,
    historical_window: Optional[Any] = None,
    mode: str = "historical",
    user_id: Optional[str] = None,
    bot_id: Optional[str] = None,
    run_id: Optional[str] = None,
    live_session_id: Optional[str] = None,
    db: Optional[Any] = None,
) -> Any:
    """
    Runs one bar through the compiled node pipeline against a portfolio.
    Returns (closed_trade_or_None, current_equity) or (closed_trade_or_None, current_equity, ctx).
    """
    ctx = NodeContext(
        candle=candle,
        portfolio=portfolio,
        upstream_outputs={},
        historical_window=historical_window,
        mode=mode,
        user_id=user_id,
        bot_id=bot_id,
        run_id=run_id,
        live_session_id=live_session_id,
        db=db,
    )
    closed_trade = None

    for node, node_instance, merged_cfg in node_instances:
        output = await node_instance.run(ctx, merged_cfg)
        ctx.upstream_outputs[node.id] = output
        if isinstance(output, ClosedTrade):
            closed_trade = output

    close_p = float(candle["close"] if isinstance(candle, dict) else getattr(candle, "close", 0.0))
    portfolio.update_unrealized(close_p)

    if return_context:
        return closed_trade, portfolio.equity, ctx
    return closed_trade, portfolio.equity
