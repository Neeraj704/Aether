import json
import uuid
import pytest
from datetime import datetime, timezone
from unittest.mock import patch, MagicMock, AsyncMock

from apps.engine.app.db.session import AsyncSessionLocal
from apps.engine.app.db.models import Profile
from apps.engine.app.nodes.base import NodeContext
from apps.engine.app.data.orderbook_snapshot import compute_imbalance, fetch_orderbook_snapshot
from apps.engine.app.nodes.data_collection.orderbook_depth import OrderbookDepthNode
from apps.engine.app.nodes.intelligence_agents.flow_analyst import FlowAnalystNode
from apps.engine.app.nodes.intelligence_agents.contrarian import ContrarianAgentNode

# --------------------------------------------------------------------------
# 1. Order Book Imbalance Calculation Unit Tests
# --------------------------------------------------------------------------
def test_compute_imbalance_heavy_bids():
    # Bids: 100 BTC total across top levels, Asks: 20 BTC total
    bids = [["95000.0", "50.0"], ["94990.0", "30.0"], ["94980.0", "20.0"]]
    asks = [["95010.0", "10.0"], ["95020.0", "10.0"]]

    res = compute_imbalance(bids, asks, depth_levels=5)
    assert res["bidVolume"] == 100.0
    assert res["askVolume"] == 20.0
    assert res["imbalanceRatio"] == 5.0
    # Imbalance pct: (100 - 20) / 120 = 80 / 120 = 0.6667
    assert res["imbalancePct"] == pytest.approx(0.6667, abs=0.001)

def test_compute_imbalance_heavy_asks():
    bids = [["95000.0", "10.0"]]
    asks = [["95010.0", "90.0"]]

    res = compute_imbalance(bids, asks, depth_levels=5)
    assert res["bidVolume"] == 10.0
    assert res["askVolume"] == 90.0
    # Imbalance pct: (10 - 90) / 100 = -0.80
    assert res["imbalancePct"] == -0.80

def test_compute_imbalance_empty():
    res = compute_imbalance([], [], depth_levels=10)
    assert res["bidVolume"] == 0.0
    assert res["askVolume"] == 0.0
    assert res["imbalancePct"] == 0.0

# --------------------------------------------------------------------------
# 2. OrderbookDepthNode Real vs. Proxy Tests
# --------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_orderbook_depth_paper_mode_live_snapshot():
    mock_payload = {
        "bids": [["90000.0", "15.0"], ["89990.0", "10.0"]],
        "asks": [["90010.0", "5.0"], ["90020.0", "5.0"]],
    }
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = mock_payload

    ctx = NodeContext(
        candle={"symbol": "BTCUSDT", "open": 90000.0, "close": 90000.0, "high": 90100.0, "low": 89900.0, "volume": 50.0},
        portfolio=MagicMock(equity=100000.0),
        upstream_outputs={},
        mode="paper",
    )

    with patch("httpx.AsyncClient.get", return_value=mock_resp):
        node = OrderbookDepthNode()
        out = await node.run(ctx, {"levels": 5})

        assert out["type"] == "MarketData"
        assert out["dataQuality"] == "real_orderbook"
        assert out["bidVolume"] == 25.0
        assert out["askVolume"] == 10.0
        assert out["imbalancePct"] > 0.40

@pytest.mark.asyncio
async def test_orderbook_depth_paper_mode_fetch_failure_fallback():
    # If Binance endpoint fails or raises, fallback to proxy gracefully without crashing
    ctx = NodeContext(
        candle={"symbol": "BTCUSDT", "open": 90000.0, "close": 90500.0, "high": 90600.0, "low": 89900.0, "volume": 100.0},
        portfolio=MagicMock(equity=100000.0),
        upstream_outputs={},
        mode="paper",
    )

    with patch("httpx.AsyncClient.get", side_effect=Exception("Binance network timeout")):
        node = OrderbookDepthNode()
        out = await node.run(ctx, {"levels": 10})

        assert out["type"] == "MarketData"
        assert out["dataQuality"] == "proxy_from_ohlcv"
        assert out["imbalancePct"] > 0.0  # Bullish close > open
        assert out["bidVolume"] > out["askVolume"]

@pytest.mark.asyncio
async def test_orderbook_depth_historical_mode_never_calls_http():
    ctx = NodeContext(
        candle={"symbol": "BTCUSDT", "open": 80000.0, "close": 79000.0, "high": 80200.0, "low": 78800.0, "volume": 80.0},
        portfolio=MagicMock(equity=100000.0),
        upstream_outputs={},
        mode="historical",
    )

    with patch("httpx.AsyncClient.get") as mock_get:
        node = OrderbookDepthNode()
        out = await node.run(ctx, {})

        mock_get.assert_not_called()
        assert out["dataQuality"] == "proxy_from_ohlcv"
        assert out["imbalancePct"] < 0.0  # Bearish close < open

# --------------------------------------------------------------------------
# 3. FlowAnalystNode Baseline & Data-Quality Confidence Scaling Tests
# --------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_flow_analyst_confidence_scaling_proxy_vs_real():
    # Identical heavy buy imbalance (+0.80) under proxy vs real
    proxy_book_data = {
        "type": "MarketData",
        "symbol": "BTCUSDT",
        "bidVolume": 90.0,
        "askVolume": 10.0,
        "imbalancePct": 0.80,
        "dataQuality": "proxy_from_ohlcv",
    }

    real_book_data = {
        "type": "MarketData",
        "symbol": "BTCUSDT",
        "bidVolume": 90.0,
        "askVolume": 10.0,
        "imbalancePct": 0.80,
        "dataQuality": "real_orderbook",
    }

    node = FlowAnalystNode()

    # 1. Evaluate with proxy data
    ctx_proxy = NodeContext(
        candle={"symbol": "BTCUSDT", "close": 95000.0},
        portfolio=MagicMock(equity=100000.0),
        upstream_outputs={"node_ob": proxy_book_data},
        mode="historical",
    )
    out_proxy = await node.run(ctx_proxy, {"imbalanceThreshold": 0.25})

    assert out_proxy["direction"] == "long"
    # Proxy confidence must be capped at <= 0.65
    assert out_proxy["confidence"] <= 0.65
    assert "ProxyEstimate" in out_proxy["audit"]["applied_rule"]

    # 2. Evaluate with real orderbook data
    ctx_real = NodeContext(
        candle={"symbol": "BTCUSDT", "close": 95000.0},
        portfolio=MagicMock(equity=100000.0),
        upstream_outputs={"node_ob": real_book_data},
        mode="historical",
    )
    out_real = await node.run(ctx_real, {"imbalanceThreshold": 0.25})

    assert out_real["direction"] == "long"
    # Real orderbook confidence scales up beyond proxy ceiling
    assert out_real["confidence"] > 0.75
    assert "RealOrderbook" in out_real["audit"]["applied_rule"]

@pytest.mark.asyncio
async def test_flow_analyst_bearish_and_neutral_baselines():
    node = FlowAnalystNode()

    # Bearish flow
    bearish_book = {
        "type": "MarketData",
        "imbalancePct": -0.60,
        "dataQuality": "real_orderbook",
    }
    ctx_bear = NodeContext(
        candle={"close": 90000.0},
        portfolio=MagicMock(equity=100000.0),
        upstream_outputs={"node_ob": bearish_book},
        mode="historical",
    )
    out_bear = await node.run(ctx_bear, {"imbalanceThreshold": 0.25})
    assert out_bear["direction"] == "short"
    assert out_bear["confidence"] >= 0.70

    # Neutral flow
    neutral_book = {
        "type": "MarketData",
        "imbalancePct": 0.05,
        "dataQuality": "real_orderbook",
    }
    ctx_neut = NodeContext(
        candle={"close": 90000.0},
        portfolio=MagicMock(equity=100000.0),
        upstream_outputs={"node_ob": neutral_book},
        mode="historical",
    )
    out_neut = await node.run(ctx_neut, {"imbalanceThreshold": 0.25})
    assert out_neut["direction"] == "flat"
    assert out_neut["confidence"] == 0.50

@pytest.mark.asyncio
async def test_flow_analyst_no_data_fallback():
    node = FlowAnalystNode()
    ctx = NodeContext(
        candle={"close": 90000.0},
        portfolio=MagicMock(equity=100000.0),
        upstream_outputs={},
        mode="historical",
    )
    out = await node.run(ctx, {})
    assert out["direction"] == "flat"
    assert out["confidence"] == 0.0
    assert out["audit"]["applied_rule"] == "Default Flat (No Data)"

# --------------------------------------------------------------------------
# 4. ContrarianAgentNode Consensus Fade vs Deferral Tests
# --------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_contrarian_agent_fades_overextended_consensus():
    node = ContrarianAgentNode()

    # Extreme bullish signal with 0.92 confidence -> contrarian should fade to SHORT
    upstream_signal = {
        "type": "Signal",
        "direction": "long",
        "confidence": 0.92,
        "rationale": "Massive breakout with unstoppable momentum",
    }

    ctx = NodeContext(
        candle={"close": 100000.0},
        portfolio=MagicMock(equity=100000.0),
        upstream_outputs={"node_tech": upstream_signal},
        mode="historical",
    )

    out = await node.run(ctx, {"fadeThreshold": 0.85})

    assert out["direction"] == "short"  # Opposite direction!
    assert 0.40 <= out["confidence"] <= 0.70  # Moderated contrarian confidence
    assert "Contrarian_Fade_Overextended_Conviction" in out["audit"]["applied_rule"]
    assert "Fading crowded conviction" in out["rationale"]

@pytest.mark.asyncio
async def test_contrarian_agent_defers_to_moderate_consensus():
    node = ContrarianAgentNode()

    # Moderate bullish signal with 0.60 confidence -> contrarian should DEFER to LONG
    upstream_signal = {
        "type": "Signal",
        "direction": "long",
        "confidence": 0.60,
        "rationale": "Mild EMA crossover",
    }

    ctx = NodeContext(
        candle={"close": 100000.0},
        portfolio=MagicMock(equity=100000.0),
        upstream_outputs={"node_tech": upstream_signal},
        mode="historical",
    )

    out = await node.run(ctx, {"fadeThreshold": 0.85})

    assert out["direction"] == "long"  # Agrees / defers to incoming view
    assert out["confidence"] == pytest.approx(0.48, abs=0.01)  # 0.60 * 0.80
    assert "Contrarian_Defers_No_Crowding_Detected" in out["audit"]["applied_rule"]
    assert "No crowding detected" in out["rationale"]

@pytest.mark.asyncio
async def test_contrarian_agent_no_upstream_signal_fallback():
    node = ContrarianAgentNode()
    ctx = NodeContext(
        candle={"close": 100000.0},
        portfolio=MagicMock(equity=100000.0),
        upstream_outputs={},
        mode="historical",
    )

    out = await node.run(ctx, {})

    assert out["direction"] == "flat"
    assert out["confidence"] == 0.0
    assert "No upstream directional signal to evaluate" in out["rationale"]

# --------------------------------------------------------------------------
# 5. Multi-Agent Pipeline Integration Test
# --------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_e2e_orderbook_flow_and_contrarian_pipeline():
    # Setup chain: OrderbookDepthNode -> FlowAnalystNode -> ContrarianAgentNode
    ob_node = OrderbookDepthNode()
    flow_node = FlowAnalystNode()
    contrarian_node = ContrarianAgentNode()

    # Step 1: Run OrderbookDepthNode with mock real orderbook (heavy ask resistance: -0.90 imbalance)
    mock_depth_resp = MagicMock()
    mock_depth_resp.status_code = 200
    mock_depth_resp.json.return_value = {
        "bids": [["90000.0", "5.0"]],
        "asks": [["90010.0", "95.0"]],
    }

    ctx = NodeContext(
        candle={"symbol": "BTCUSDT", "close": 90000.0, "open": 90000.0, "high": 90100.0, "low": 89900.0, "volume": 100.0},
        portfolio=MagicMock(equity=100000.0),
        upstream_outputs={},
        mode="paper",
    )

    with patch("httpx.AsyncClient.get", return_value=mock_depth_resp):
        ob_output = await ob_node.run(ctx, {"levels": 5})

    assert ob_output["dataQuality"] == "real_orderbook"
    assert ob_output["imbalancePct"] < -0.80

    # Step 2: Feed into FlowAnalystNode
    ctx.upstream_outputs["node_ob"] = ob_output
    flow_output = await flow_node.run(ctx, {"imbalanceThreshold": 0.25})

    assert flow_output["direction"] == "short"
    assert flow_output["confidence"] >= 0.88

    # Step 3: Feed FlowAnalyst Signal into ContrarianAgentNode
    # Since flow confidence >= 0.88 exceeds 0.85, Contrarian should FADE short -> LONG
    ctx.upstream_outputs["node_flow"] = flow_output
    contrarian_output = await contrarian_node.run(ctx, {"fadeThreshold": 0.85})

    assert contrarian_output["direction"] == "long"
    assert "Contrarian_Fade_Overextended_Conviction" in contrarian_output["audit"]["applied_rule"]
