import os
import pytest
import pytest_asyncio

# Force the database URL to point to a test database BEFORE any app modules are loaded
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test_orbitalwatch.db"

from app.core.database import init_db, engine
from app.models.satellite import SatelliteModel
from app.models.conjunction import ConjunctionModel

@pytest_asyncio.fixture(autouse=True, scope="function")
async def setup_test_db():
    # Create all tables in the test database
    await init_db()
    yield
    # Clean up connections
    await engine.dispose()

@pytest.fixture(scope="session", autouse=True)
def cleanup_test_db():
    yield
    # Clean up the test database file after all tests finish
    test_db_path = "./test_orbitalwatch.db"
    if os.path.exists(test_db_path):
        try:
            os.remove(test_db_path)
        except Exception:
            pass
