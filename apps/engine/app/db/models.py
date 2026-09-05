import uuid
from datetime import datetime
from sqlalchemy import (
    Column,
    String,
    Boolean,
    Integer,
    Numeric,
    DateTime,
    ForeignKey,
    Index,
    JSON,
    ARRAY,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

class Profile(Base):
    __tablename__ = "profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    display_name = Column(Text, nullable=True)
    bio = Column(Text, nullable=True)
    plan = Column(String, nullable=False, default="free")
    credits = Column(Integer, nullable=False, default=240)
    public_profile = Column(Boolean, nullable=False, default=False)
    avatar_color = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

class BotModel(Base):
    __tablename__ = "bots"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    name = Column(Text, nullable=False, default="Untitled bot")
    description = Column(Text, nullable=False, default="")
    status = Column(String, nullable=False, default="draft")
    graph = Column(JSONB, nullable=False, default=lambda: {"nodes": [], "edges": [], "notes": [], "frames": [], "schemaVersion": 2})
    headline_metric = Column(JSONB, nullable=True)
    visibility = Column(String, nullable=False, default="private")
    tags = Column(ARRAY(Text), nullable=False, default=list)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    versions = relationship("BotVersionModel", back_populates="bot", cascade="all, delete-orphan")
    runs = relationship("BacktestRunModel", back_populates="bot", cascade="all, delete-orphan")
    live_sessions = relationship("LiveSessionModel", back_populates="bot", cascade="all, delete-orphan")

class BotVersionModel(Base):
    __tablename__ = "bot_versions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bot_id = Column(UUID(as_uuid=True), ForeignKey("bots.id", ondelete="cascade"), nullable=False, index=True)
    label = Column(Text, nullable=False)
    note = Column(Text, nullable=False, default="")
    node_count = Column(Integer, nullable=False, default=0)
    graph = Column(JSONB, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    bot = relationship("BotModel", back_populates="versions")

class CandleModel(Base):
    __tablename__ = "candles"

    symbol = Column(Text, primary_key=True, nullable=False)
    resolution = Column(Text, primary_key=True, nullable=False)
    open_time = Column(DateTime(timezone=True), primary_key=True, nullable=False)
    open = Column(Numeric, nullable=False)
    high = Column(Numeric, nullable=False)
    low = Column(Numeric, nullable=False)
    close = Column(Numeric, nullable=False)
    volume = Column(Numeric, nullable=False)

    __table_args__ = (
        Index("candles_symbol_res_time_idx", "symbol", "resolution", "open_time"),
    )

class BacktestRunModel(Base):
    __tablename__ = "backtest_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bot_id = Column(UUID(as_uuid=True), ForeignKey("bots.id", ondelete="cascade"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    status = Column(String, nullable=False, default="queued")
    config = Column(JSONB, nullable=False)
    metrics = Column(JSONB, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    bot = relationship("BotModel", back_populates="runs")
    trades = relationship("TradeModel", back_populates="run", cascade="all, delete-orphan")
    equity_points = relationship("EquityPointModel", back_populates="run", cascade="all, delete-orphan")

class TradeModel(Base):
    __tablename__ = "trades"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    run_id = Column(UUID(as_uuid=True), ForeignKey("backtest_runs.id", ondelete="cascade"), nullable=False, index=True)
    symbol = Column(Text, nullable=False)
    side = Column(String, nullable=False)
    entry_time = Column(DateTime(timezone=True), nullable=False)
    exit_time = Column(DateTime(timezone=True), nullable=False)
    size = Column(Numeric, nullable=False)
    pnl = Column(Numeric, nullable=False)
    pnl_pct = Column(Numeric, nullable=False)
    trigger_node = Column(Text, nullable=False)
    confidence = Column(Numeric, nullable=False)
    execution_flow = Column(JSONB, nullable=True)

    run = relationship("BacktestRunModel", back_populates="trades")

class EquityPointModel(Base):
    __tablename__ = "equity_points"

    run_id = Column(UUID(as_uuid=True), ForeignKey("backtest_runs.id", ondelete="cascade"), primary_key=True, nullable=False, index=True)
    ts = Column(DateTime(timezone=True), primary_key=True, nullable=False)
    equity = Column(Numeric, nullable=False)
    benchmark = Column(Numeric, nullable=False)
    drawdown = Column(Numeric, nullable=False)

    run = relationship("BacktestRunModel", back_populates="equity_points")

class LiveSessionModel(Base):
    __tablename__ = "live_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bot_id = Column(UUID(as_uuid=True), ForeignKey("bots.id", ondelete="cascade"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    status = Column(String, nullable=False, default="running")
    symbol = Column(Text, nullable=False)
    capital = Column(Numeric, nullable=False)
    cash = Column(Numeric, nullable=False)
    equity = Column(Numeric, nullable=False)
    position = Column(JSONB, nullable=True)
    peak_equity = Column(Numeric, nullable=False)
    max_drawdown = Column(Numeric, nullable=False, default=0.0)
    last_bar_time = Column(DateTime(timezone=True), nullable=True)
    started_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    stopped_at = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(Text, nullable=True)

    bot = relationship("BotModel", back_populates="live_sessions")
    trades = relationship("LiveTradeModel", back_populates="session", cascade="all, delete-orphan")
    equity_points = relationship("LiveEquityPointModel", back_populates="session", cascade="all, delete-orphan")

class LiveTradeModel(Base):
    __tablename__ = "live_trades"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    live_session_id = Column(UUID(as_uuid=True), ForeignKey("live_sessions.id", ondelete="cascade"), nullable=False, index=True)
    symbol = Column(Text, nullable=False)
    side = Column(String, nullable=False)
    entry_time = Column(DateTime(timezone=True), nullable=False)
    exit_time = Column(DateTime(timezone=True), nullable=False)
    size = Column(Numeric, nullable=False)
    pnl = Column(Numeric, nullable=False)
    pnl_pct = Column(Numeric, nullable=False)
    trigger_node = Column(Text, nullable=False)
    confidence = Column(Numeric, nullable=False)
    execution_flow = Column(JSONB, nullable=True)

    session = relationship("LiveSessionModel", back_populates="trades")

class LiveEquityPointModel(Base):
    __tablename__ = "live_equity_points"

    live_session_id = Column(UUID(as_uuid=True), ForeignKey("live_sessions.id", ondelete="cascade"), primary_key=True, nullable=False, index=True)
    ts = Column(DateTime(timezone=True), primary_key=True, nullable=False)
    equity = Column(Numeric, nullable=False)
    drawdown = Column(Numeric, nullable=False)

    session = relationship("LiveSessionModel", back_populates="equity_points")

class SubscriptionModel(Base):
    __tablename__ = "subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, unique=True, index=True)
    plan = Column(String, nullable=False, default="free")
    status = Column(String, nullable=False, default="active")
    razorpay_subscription_id = Column(Text, nullable=True)
    razorpay_customer_id = Column(Text, nullable=True)
    current_period_end = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

class CreditWalletModel(Base):
    __tablename__ = "credit_wallets"

    user_id = Column(UUID(as_uuid=True), primary_key=True, nullable=False)
    balance = Column(Numeric, nullable=False, default=0)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

class CreditTransactionModel(Base):
    __tablename__ = "credit_transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    amount = Column(Numeric, nullable=False)
    reason = Column(Text, nullable=False)
    razorpay_payment_id = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

class PaymentModel(Base):
    __tablename__ = "payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    razorpay_order_id = Column(Text, nullable=False, index=True)
    razorpay_payment_id = Column(Text, nullable=True)
    razorpay_signature = Column(Text, nullable=True)
    amount = Column(Numeric, nullable=False)
    currency = Column(String, nullable=False, default="INR")
    kind = Column(String, nullable=False)  # 'subscription', 'credit_topup'
    status = Column(String, nullable=False, default="created")  # 'created', 'paid', 'failed'
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

class LlmCallLogModel(Base):
    __tablename__ = "llm_call_log"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    bot_id = Column(UUID(as_uuid=True), ForeignKey("bots.id", ondelete="cascade"), nullable=False, index=True)
    run_id = Column(UUID(as_uuid=True), ForeignKey("backtest_runs.id", ondelete="cascade"), nullable=True, index=True)
    live_session_id = Column(UUID(as_uuid=True), ForeignKey("live_sessions.id", ondelete="cascade"), nullable=True, index=True)
    node_id = Column(Text, nullable=False)
    component_id = Column(Text, nullable=False)
    provider = Column(Text, nullable=False)
    model = Column(Text, nullable=False)
    status = Column(Text, nullable=False)
    prompt_tokens = Column(Integer, nullable=True)
    completion_tokens = Column(Integer, nullable=True)
    latency_ms = Column(Integer, nullable=True)
    credits_charged = Column(Numeric, nullable=False, default=0)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

class UserProviderKeyModel(Base):
    __tablename__ = "user_provider_keys"

    user_id = Column(UUID(as_uuid=True), primary_key=True, nullable=False)
    provider_id = Column(Text, primary_key=True, nullable=False)
    encrypted_key = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class NewsItemModel(Base):
    __tablename__ = "news_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source = Column(Text, nullable=False)
    external_id = Column(Text, nullable=False)
    title = Column(Text, nullable=False)
    body_snippet = Column(Text, nullable=False, default="")
    url = Column(Text, nullable=False)
    published_at = Column(DateTime(timezone=True), nullable=False, index=True)
    symbols = Column(ARRAY(Text), nullable=False, default=list)
    sentiment_compound = Column(Numeric, nullable=True)
    sentiment_pos = Column(Numeric, nullable=True)
    sentiment_neg = Column(Numeric, nullable=True)
    sentiment_neu = Column(Numeric, nullable=True)
    fetched_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("source", "external_id", name="news_items_source_external_id_key"),
        Index("news_items_published_at_idx", published_at.desc()),
    )


class MacroEventModel(Base):
    __tablename__ = "macro_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_type = Column(Text, nullable=False)  # 'fomc_meeting', 'cpi_release', 'nfp_release'
    label = Column(Text, nullable=False)
    scheduled_at = Column(DateTime(timezone=True), nullable=False, index=True)
    blackout_before_minutes = Column(Integer, nullable=False, default=60)
    blackout_after_minutes = Column(Integer, nullable=False, default=60)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("event_type", "scheduled_at", name="macro_events_event_type_scheduled_at_key"),
        Index("macro_events_scheduled_at_idx", "scheduled_at"),
    )


