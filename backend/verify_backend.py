from __future__ import annotations

import asyncio

import httpx
import socketio

BASE_URL = "http://localhost:8000"


async def check_http(client: httpx.AsyncClient, label: str, path: str) -> None:
    try:
        response = await client.get(f"{BASE_URL}{path}", timeout=20.0)
        response.raise_for_status()
        print(f"PASS {label}")
    except Exception as exc:
        print(f"FAIL {label}: {exc}")


async def check_socketio() -> None:
    client = socketio.AsyncClient()
    received = asyncio.Event()

    @client.on("satellite_positions")
    async def on_positions(data):
        received.set()

    try:
        await client.connect(BASE_URL, transports=["websocket", "polling"])
        await asyncio.wait_for(received.wait(), timeout=75.0)
        print("PASS socketio satellite_positions")
    except Exception as exc:
        print(f"FAIL socketio satellite_positions: {exc}")
    finally:
        if client.connected:
            await client.disconnect()


async def main() -> None:
    async with httpx.AsyncClient() as client:
        await check_http(client, "health", "/health")
        await check_http(client, "satellites", "/api/satellites")
        await check_http(client, "iss", "/api/satellites/25544")
        await check_http(client, "propagate iss", "/api/propagate/25544")
        await check_http(client, "conjunctions", "/api/conjunctions")
    await check_socketio()


if __name__ == "__main__":
    asyncio.run(main())
