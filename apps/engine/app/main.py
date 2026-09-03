from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from .config import settings
from .routers import health, validate, backtest, live, billing
from .db.session import AsyncSessionLocal
from .db.models import LiveSessionModel
from .engine.live_runner import set_scheduler, register_bot_job

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Instantiate and start APScheduler
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
                await register_bot_job(str(b_id), scheduler, session)
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
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router)
app.include_router(validate.router)
app.include_router(backtest.router)
app.include_router(live.router)
app.include_router(billing.router)

@app.get("/health")
def root_health():
    return {"status": "ok"}

@app.get("/")
def root():
    return {"name": "AETHER Engine", "status": "running"}
