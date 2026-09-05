import uuid
import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, MagicMock
from sqlalchemy import select, delete

from apps.engine.app.db.session import AsyncSessionLocal
from apps.engine.app.db.models import NewsItemModel, MacroEventModel, Profile
from apps.engine.app.data.news_ingest import ingest_news_batch, extract_symbols
from apps.engine.app.data.macro_blackout import compute_blackout
from apps.engine.app.data.seed_macro_events import seed_macro_events
from apps.engine.app.nodes.base import NodeContext
from apps.engine.app.nodes.data_collection.news_stream import NewsStreamNode
from apps.engine.app.nodes.data_collection.social_sentiment import SocialSentimentNode
from apps.engine.app.nodes.data_collection.macro_calendar import MacroCalendarNode
from apps.engine.app.nodes.intelligence_agents.sentiment_analyst import SentimentAnalystNode
from apps.engine.app.nodes.intelligence_agents.macro_strategist import MacroStrategistNode
from apps.engine.app.nodes.intelligence_agents.event_specialist import EventSpecialistNode

# --------------------------------------------------------------------------
# 1. News Ingestion Unit Tests (CryptoCompare + VADER + Deduplication)
# --------------------------------------------------------------------------
def test_extract_symbols():
    assert extract_symbols("BTC|Trading", "Bitcoin breaks 100k", "") == ["BTC"]
    assert extract_symbols("ETH|DeFi", "Ethereum upgrades network", "") == ["ETH"]
    assert "BTC" in extract_symbols("", "Bitcoin and Ethereum rally", "")
    assert "ETH" in extract_symbols("", "Bitcoin and Ethereum rally", "")
    assert extract_symbols("Macro|Economy", "US Fed holds rates steady", "Markets react") == []

@pytest.mark.asyncio
async def test_ingest_news_batch_mocked():
    test_guid = f"test-news-{uuid.uuid4()}"
    mock_payload = {
        "Type": 100,
        "Data": [
            {
                "id": test_guid,
                "guid": test_guid,
                "source": "cryptocompare_test",
                "title": "Bitcoin surges past new all-time high with massive bullish institutional volume",
                "body": "Optimism across crypto markets as institutional inflows accelerate rapidly.",
                "url": "https://example.com/btc-news",
                "published_on": int(datetime.now(timezone.utc).timestamp()),
                "categories": "BTC|Trading|Market",
            }
        ],
    }

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = mock_payload

    async with AsyncSessionLocal() as session:
        with patch("httpx.AsyncClient.get", return_value=mock_resp):
            count_1 = await ingest_news_batch(session, limit=10)
            assert count_1 >= 1

            # Verify row in database
            stmt = select(NewsItemModel).where(
                NewsItemModel.source == "cryptocompare_test",
                NewsItemModel.external_id == test_guid,
            )
            res = await session.execute(stmt)
            item = res.scalars().first()
            assert item is not None
            assert "BTC" in item.symbols
            assert item.sentiment_compound is not None
            assert float(item.sentiment_compound) > 0.4  # Strongly bullish headline
            assert float(item.sentiment_pos) > 0.0

            # Test idempotency: re-running exact same batch inserts 0 duplicate rows
            count_2 = await ingest_news_batch(session, limit=10)
            assert count_2 == 0

        # Cleanup
        await session.execute(
            delete(NewsItemModel).where(NewsItemModel.external_id == test_guid)
        )
        await session.commit()

# --------------------------------------------------------------------------
# 2. NewsStreamNode Sentiment & Lookahead Bias Tests
# --------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_news_stream_node_with_positive_sentiment():
    now_utc = datetime.now(timezone.utc)
    cached_news = [
        {
            "external_id": "news-1",
            "title": "Bitcoin rallies sharply",
            "published_at": now_utc - timedelta(minutes=10),
            "symbols": ["BTC"],
            "sentiment_compound": 0.85,
        },
        {
            "external_id": "news-2",
            "title": "Crypto sentiment strongly bullish",
            "published_at": now_utc - timedelta(minutes=20),
            "symbols": ["BTC"],
            "sentiment_compound": 0.75,
        },
    ]

    ctx = NodeContext(
        candle={"symbol": "BTCUSDT", "close": 95000.0, "open_time": now_utc.isoformat()},
        portfolio=MagicMock(equity=100000.0),
        upstream_outputs={},
        mode="historical",
        news_items_cache=cached_news,
        macro_events_cache=[],
    )

    node = NewsStreamNode()
    out = await node.run(ctx, {"lookbackMinutes": 60})

    assert out["type"] == "NewsFeed"
    assert out["symbol"] == "BTCUSDT"
    assert out["articleCount"] == 2
    assert out["sentimentScore"] > 0.70
    assert out["blackoutActive"] is False

@pytest.mark.asyncio
async def test_news_stream_node_no_matching_articles():
    now_utc = datetime.now(timezone.utc)
    ctx = NodeContext(
        candle={"symbol": "ETHUSDT", "close": 3500.0, "open_time": now_utc.isoformat()},
        portfolio=MagicMock(equity=100000.0),
        upstream_outputs={},
        mode="historical",
        news_items_cache=[],  # Empty cache
        macro_events_cache=[],
    )

    node = NewsStreamNode()
    out = await node.run(ctx, {"lookbackMinutes": 60})

    assert out["type"] == "NewsFeed"
    assert out["articleCount"] == 0
    assert out["sentimentScore"] == 0.0
    assert out["blackoutActive"] is False

@pytest.mark.asyncio
async def test_news_stream_no_lookahead_bias():
    candle_time = datetime(2025, 6, 1, 12, 0, tzinfo=timezone.utc)
    
    # One article 15 minutes before candle
    article_before = {
        "external_id": "past-news",
        "title": "Bullish news before candle",
        "published_at": candle_time - timedelta(minutes=15),
        "symbols": ["BTC"],
        "sentiment_compound": 0.80,
    }
    
    # One article 5 minutes AFTER candle open_time (future lookahead!)
    article_future = {
        "external_id": "future-news",
        "title": "Bearish crash news from the future",
        "published_at": candle_time + timedelta(minutes=5),
        "symbols": ["BTC"],
        "sentiment_compound": -0.90,
    }

    ctx = NodeContext(
        candle={"symbol": "BTCUSDT", "close": 70000.0, "open_time": candle_time},
        portfolio=MagicMock(equity=100000.0),
        upstream_outputs={},
        mode="historical",
        news_items_cache=[article_before, article_future],
        macro_events_cache=[],
    )

    node = NewsStreamNode()
    out = await node.run(ctx, {"lookbackMinutes": 60})

    # The future article must be strictly excluded
    assert out["articleCount"] == 1
    assert out["sentimentScore"] > 0.60
    assert out["sentimentScore"] == pytest.approx(0.80, abs=0.01)

# --------------------------------------------------------------------------
# 3. Macro Blackout Calculation Tests
# --------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_compute_blackout_inside_and_outside_window():
    event_time = datetime(2025, 3, 19, 18, 0, tzinfo=timezone.utc)
    event_cache = [
        {
            "event_type": "fomc_meeting",
            "label": "FOMC Rate Decision",
            "scheduled_at": event_time,
            "blackout_before_minutes": 60,
            "blackout_after_minutes": 60,
        }
    ]

    # Inside window (30 mins before)
    active, reason = await compute_blackout(
        reference_time=event_time - timedelta(minutes=30),
        macro_events_cache=event_cache,
    )
    assert active is True
    assert "FOMC Rate Decision" in reason

    # Inside window (45 mins after)
    active_after, reason_after = await compute_blackout(
        reference_time=event_time + timedelta(minutes=45),
        macro_events_cache=event_cache,
    )
    assert active_after is True

    # Outside window (90 mins before)
    outside_before, _ = await compute_blackout(
        reference_time=event_time - timedelta(minutes=90),
        macro_events_cache=event_cache,
    )
    assert outside_before is False

    # Outside window (90 mins after)
    outside_after, _ = await compute_blackout(
        reference_time=event_time + timedelta(minutes=90),
        macro_events_cache=event_cache,
    )
    assert outside_after is False

@pytest.mark.asyncio
async def test_compute_blackout_cache_vs_db_equivalence():
    event_time = datetime(2025, 1, 29, 19, 0, tzinfo=timezone.utc)
    
    async with AsyncSessionLocal() as session:
        # Clean and insert test event into DB
        await session.execute(
            delete(MacroEventModel).where(MacroEventModel.scheduled_at == event_time)
        )
        test_evt = MacroEventModel(
            event_type="fomc_meeting",
            label="Test FOMC Decision",
            scheduled_at=event_time,
            blackout_before_minutes=60,
            blackout_after_minutes=60,
        )
        session.add(test_evt)
        await session.commit()

        ref_time = event_time - timedelta(minutes=15)

        # 1. DB query path
        db_active, db_reason = await compute_blackout(reference_time=ref_time, db=session)
        
        # 2. In-memory cache path
        cache_active, cache_reason = await compute_blackout(
            reference_time=ref_time,
            db=None,
            macro_events_cache=[test_evt],
        )

        assert db_active == cache_active == True
        assert db_reason == cache_reason

        # Cleanup
        await session.execute(
            delete(MacroEventModel).where(MacroEventModel.scheduled_at == event_time)
        )
        await session.commit()

# --------------------------------------------------------------------------
# 4. Social Sentiment Node & Macro Calendar Node Tests
# --------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_social_sentiment_node_proxy_tag():
    now_utc = datetime.now(timezone.utc)
    ctx = NodeContext(
        candle={"symbol": "BTCUSDT", "close": 95000.0, "open_time": now_utc},
        portfolio=MagicMock(equity=100000.0),
        upstream_outputs={},
        mode="historical",
        news_items_cache=[],
        macro_events_cache=[],
    )

    node = SocialSentimentNode()
    out = await node.run(ctx, {})

    assert out["type"] == "NewsFeed"
    assert "sourceNote" in out
    assert "no live social media firehose" in out["sourceNote"]

@pytest.mark.asyncio
async def test_macro_calendar_node():
    event_time = datetime(2025, 4, 10, 12, 30, tzinfo=timezone.utc)
    event_cache = [
        {
            "event_type": "cpi_release",
            "label": "US CPI Release",
            "scheduled_at": event_time,
            "blackout_before_minutes": 30,
            "blackout_after_minutes": 30,
        }
    ]

    ctx = NodeContext(
        candle={"symbol": "BTCUSDT", "close": 85000.0, "open_time": event_time},
        portfolio=MagicMock(equity=100000.0),
        upstream_outputs={},
        mode="historical",
        macro_events_cache=event_cache,
    )

    node = MacroCalendarNode()
    out = await node.run(ctx, {})

    assert out["type"] == "NewsFeed"
    assert out["sentimentScore"] == 0.0
    assert out["articleCount"] == 0
    assert out["blackoutActive"] is True
    assert "US CPI Release" in out["blackoutReason"]

# --------------------------------------------------------------------------
# 5. End-to-End: NewsStream / MacroCalendar -> Intelligence Agents
# --------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_e2e_news_stream_to_sentiment_agent():
    now_utc = datetime.now(timezone.utc)
    cached_news = [
        {
            "external_id": "news-bullish",
            "title": "Bitcoin surges with immense buying demand and strong adoption",
            "published_at": now_utc - timedelta(minutes=5),
            "symbols": ["BTC"],
            "sentiment_compound": 0.88,
        }
    ]

    # Step 1: Run NewsStreamNode
    news_node = NewsStreamNode()
    ctx = NodeContext(
        candle={"symbol": "BTCUSDT", "close": 90000.0, "open_time": now_utc},
        portfolio=MagicMock(equity=100000.0),
        upstream_outputs={},
        mode="historical",
        news_items_cache=cached_news,
        macro_events_cache=[],
    )
    news_output = await news_node.run(ctx, {})
    assert news_output["sentimentScore"] > 0.50

    # Step 2: Feed into SentimentAnalystNode
    ctx.upstream_outputs["node_news"] = news_output
    sentiment_agent = SentimentAnalystNode()
    agent_output = await sentiment_agent.run(ctx, {"bullishThreshold": 0.3})

    assert agent_output["direction"] == "long"
    assert agent_output["confidence"] >= 0.65
    assert "Bullish narrative tone" in agent_output["rationale"]

@pytest.mark.asyncio
async def test_e2e_macro_calendar_blackout_to_macro_and_event_agents():
    event_time = datetime(2025, 9, 17, 18, 0, tzinfo=timezone.utc)
    event_cache = [
        {
            "event_type": "fomc_meeting",
            "label": "FOMC Meeting Decision",
            "scheduled_at": event_time,
            "blackout_before_minutes": 60,
            "blackout_after_minutes": 60,
        }
    ]

    # Step 1: Run MacroCalendarNode during blackout window
    cal_node = MacroCalendarNode()
    ctx = NodeContext(
        candle={"symbol": "BTCUSDT", "close": 90000.0, "open_time": event_time},
        portfolio=MagicMock(equity=100000.0),
        upstream_outputs={},
        mode="historical",
        macro_events_cache=event_cache,
    )
    cal_output = await cal_node.run(ctx, {})
    assert cal_output["blackoutActive"] is True

    # Step 2: Feed into MacroStrategistNode & EventSpecialistNode
    ctx.upstream_outputs["node_macro_cal"] = cal_output
    
    macro_agent = MacroStrategistNode()
    macro_out = await macro_agent.run(ctx, {})
    assert macro_out["direction"] == "flat"
    assert macro_out["audit"]["applied_rule"] == "Macro_Event_Blackout_Override"

    event_agent = EventSpecialistNode()
    event_out = await event_agent.run(ctx, {})
    assert event_out["direction"] == "flat"
    assert event_out["audit"]["applied_rule"] == "Active_Event_Blackout"
