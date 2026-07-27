"""API endpoint integration tests.

Import of `app.main` is deferred until after conftest.py has set DATABASE_URL.
Tests share a single AsyncClient fixture to avoid redundant setup.
"""
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport


@pytest_asyncio.fixture
async def client() -> AsyncClient:
    """Shared AsyncClient. Import is deferred so conftest sets DATABASE_URL first."""
    # Import here — not at module level — to respect conftest.py env var setup
    from app.main import app  # noqa: PLC0415

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_root_and_ping_endpoints(client: AsyncClient) -> None:
    res_root = await client.get("/")
    assert res_root.status_code == 200
    assert "message" in res_root.json()

    res_ping = await client.get("/ping")
    assert res_ping.status_code == 200
    assert res_ping.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_health_endpoint(client: AsyncClient) -> None:
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "db" in data
    assert "timestamp" in data


@pytest.mark.asyncio
async def test_stats_endpoint(client: AsyncClient) -> None:
    response = await client.get("/api/stats")
    assert response.status_code == 200
    data = response.json()
    assert "total_satellites" in data
    assert "active_conjunctions" in data
    assert "debris_count" in data


@pytest.mark.asyncio
async def test_refresh_endpoint(client: AsyncClient) -> None:
    response = await client.post("/api/refresh")
    # 200 on first call; 429 if rate-limited (both are valid test-environment responses)
    assert response.status_code in (200, 429)
    if response.status_code == 200:
        data = response.json()
        assert data.get("success") is True
        assert "timestamp" in data
