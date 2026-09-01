from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text, select
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from .config import settings
from .routers import health, validate, backtest, live
from .db.session import engine, AsyncSessionLocal
from .db.models import LiveSessionModel
from .engine.live_runner import set_scheduler, register_bot_job

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Ensure database schema is migrated / updated
    try:
        async with engine.begin() as conn:
            statements = [
                "ALTER TABLE trades ADD COLUMN IF NOT EXISTS execution_flow JSONB;",
                """
                CREATE TABLE IF NOT EXISTS public.live_sessions (
                  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                  bot_id UUID NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
                  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
                  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','stopped','error')),
                  symbol TEXT NOT NULL,
                  capital NUMERIC NOT NULL,
                  cash NUMERIC NOT NULL,
                  equity NUMERIC NOT NULL,
                  position JSONB,
                  peak_equity NUMERIC NOT NULL,
                  max_drawdown NUMERIC NOT NULL DEFAULT 0,
                  last_bar_time TIMESTAMPTZ,
                  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                  stopped_at TIMESTAMPTZ,
                  error_message TEXT
                );
                """,
                """
                CREATE TABLE IF NOT EXISTS public.live_trades (
                  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                  live_session_id UUID NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
                  symbol TEXT NOT NULL,
                  side TEXT NOT NULL CHECK (side IN ('long','short')),
                  entry_time TIMESTAMPTZ NOT NULL,
                  exit_time TIMESTAMPTZ NOT NULL,
                  size NUMERIC NOT NULL,
                  pnl NUMERIC NOT NULL,
                  pnl_pct NUMERIC NOT NULL,
                  trigger_node TEXT NOT NULL,
                  confidence NUMERIC NOT NULL,
                  execution_flow JSONB
                );
                """,
                """
                CREATE TABLE IF NOT EXISTS public.live_equity_points (
                  live_session_id UUID NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
                  ts TIMESTAMPTZ NOT NULL,
                  equity NUMERIC NOT NULL,
                  drawdown NUMERIC NOT NULL,
                  PRIMARY KEY (live_session_id, ts)
                );
                """,
                "CREATE UNIQUE INDEX IF NOT EXISTS live_sessions_one_active_per_bot ON public.live_sessions(bot_id) WHERE status = 'running';",
                "CREATE INDEX IF NOT EXISTS live_trades_session_idx ON public.live_trades(live_session_id);",
                "CREATE INDEX IF NOT EXISTS live_equity_points_session_idx ON public.live_equity_points(live_session_id);"
            ]
            for stmt in statements:
                await conn.execute(text(stmt))
    except Exception as e:
        print(f"[Engine Startup] Migration notice: {e}")


    # 2. Instantiate and start APScheduler
    scheduler = AsyncIOScheduler()
    set_scheduler(scheduler)
    app.state.scheduler = scheduler
    scheduler.start()
    print("[Engine Startup] APScheduler initialized and started.")

    # 3. Re-register running bots on engine startup
    try:
        async with AsyncSessionLocal() as session:
            stmt = select(LiveSessionModel.bot_id).where(LiveSessionModel.status == "running")
            res = await session.execute(stmt)
            running_bot_ids = res.scalars().all()
            for b_id in running_bot_ids:
                register_bot_job(str(b_id), scheduler)
            if running_bot_ids:
                print(f"[Engine Startup] Resumed scheduled live ticks for {len(running_bot_ids)} active bot(s).")
    except Exception as e:
        print(f"[Engine Startup] Notice on resuming active live bots: {e}")

    yield

    # Shutdown scheduler cleanly
    try:
        scheduler.shutdown(wait=False)
        print("[Engine Shutdown] APScheduler shutdown complete.")
    except Exception as e:
        print(f"[Engine Shutdown] Error shutting down scheduler: {e}")

app = FastAPI(
    title="AETHER Backtest & Live Execution Engine",
    version="1.1.0",
    description="Algorithmic Quantitative Strategy Simulation, Live Paper Trading Loop, and DAG Validation Engine",
    lifespan=lifespan,
)

# CORS setup
origins = settings.ALLOWED_ORIGINS
if not origins or "*" in origins:
    allow_origins = ["*"]
else:
    allow_origins = origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router)
app.include_router(validate.router)
app.include_router(backtest.router)
app.include_router(live.router)

@app.get("/health")
def root_health():
    return {"status": "ok"}

@app.get("/")
def root():
    return {"name": "AETHER Engine", "status": "running"}
