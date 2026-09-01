from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from .config import settings
from .routers import health, validate, backtest
from .db.session import engine

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure database schema is migrated
    try:
        async with engine.begin() as conn:
            await conn.execute(text("ALTER TABLE trades ADD COLUMN IF NOT EXISTS execution_flow JSONB;"))
    except Exception as e:
        print(f"[Engine Startup] Migration notice: {e}")
    yield

app = FastAPI(
    title="AETHER Backtest Engine",
    version="1.0.0",
    description="Algorithmic Quantitative Strategy Simulation and DAG Validation Engine",
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

@app.get("/health")
def root_health():
    return {"status": "ok"}

@app.get("/")
def root():
    return {"name": "AETHER Backtest Engine", "status": "running"}

