import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.asyncio
async def test_root_and_ping_endpoints() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res_root = await ac.get("/")
        assert res_root.status_code == 200
        assert "message" in res_root.json()

        res_ping = await ac.get("/ping")
        assert res_ping.status_code == 200
        assert res_ping.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_health_endpoint() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "db" in data
    assert "timestamp" in data


@pytest.mark.asyncio
async def test_stats_endpoint() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/api/stats")
    assert response.status_code == 200
    data = response.json()
    assert "total_satellites" in data
    assert "active_conjunctions" in data
    assert "debris_count" in data


@pytest.mark.asyncio
async def test_refresh_endpoint() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post("/api/refresh")
    assert response.status_code == 200
    data = response.json()
    assert data.get("success") is True
    assert "timestamp" in data
