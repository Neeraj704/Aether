import pytest_asyncio
from apps.engine.app.db.session import engine

@pytest_asyncio.fixture(autouse=True)
async def dispose_db_engine():
    yield
    await engine.dispose()
