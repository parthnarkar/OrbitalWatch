from __future__ import annotations

import asyncio
import json
import logging

import socketio
from redis.asyncio import Redis
from sqlalchemy import select

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.satellite import SatelliteModel
from app.services.propagation import propagate_satellite
from app.websocket.manager import manager

logger = logging.getLogger(__name__)

cors_origins = settings.CORS_ORIGINS
if "*" in cors_origins:
    cors_origins = "*"

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins=cors_origins)


last_broadcast_positions: list[dict[str, object]] = []

# Set to True by rescan endpoint so next loop iteration broadcasts immediately
_broadcast_now = asyncio.Event()


@sio.on("connect")
async def connect(sid: str, environ: dict) -> None:
    await manager.connect(sid, environ)
    await sio.emit("connected", {"status": "ok"}, to=sid)
    if last_broadcast_positions:
        await sio.emit("satellite_positions", last_broadcast_positions, to=sid)


@sio.on("disconnect")
async def disconnect(sid: str) -> None:
    await manager.disconnect(sid)


@sio.on("subscribe_satellites")
async def subscribe_satellites(sid: str, data: dict | None = None) -> None:
    await sio.emit("subscription_updated", {"status": "ok", "norad_ids": (data or {}).get("norad_ids", [])}, to=sid)
    if last_broadcast_positions:
        await sio.emit("satellite_positions", last_broadcast_positions, to=sid)


def _position_payload(satellite: SatelliteModel) -> dict[str, object] | None:
    position = propagate_satellite(satellite)
    if position is None:
        return None
    return {
        "norad_id": satellite.norad_id,
        "name": satellite.name,
        "lat": position["latitude"],
        "lon": position["longitude"],
        "alt": position["altitude_km"],
        "latitude": position["latitude"],
        "longitude": position["longitude"],
        "altitude_km": position["altitude_km"],
        "velocity_kms": position["velocity_kms"],
        "timestamp": position["timestamp"].isoformat(),
        "type": satellite.object_type,
        "object_type": satellite.object_type,
    }


async def broadcast_positions() -> None:
    """Broadcast propagated satellite positions every 5 seconds.
    
    Wakes up immediately when trigger_immediate_broadcast() is called,
    so a rescan is reflected on the globe within ~1 second.
    """
    global last_broadcast_positions
    while True:
        try:
            async with AsyncSessionLocal() as session:
                result = await session.execute(
                    select(SatelliteModel).order_by(SatelliteModel.norad_id).limit(500)
                )
                satellites = list(result.scalars().all())

            data = []
            for satellite in satellites:
                payload = _position_payload(satellite)
                if payload is not None:
                    data.append(payload)

            last_broadcast_positions = data
            if manager.get_active_connections():
                await sio.emit("satellite_positions", data)
        except asyncio.CancelledError:
            logger.info("Position broadcast task cancelled")
            break
        except Exception:
            logger.exception("Position broadcast failed")

        # Wait 5 s OR wake up early if rescan triggered an immediate broadcast
        _broadcast_now.clear()
        try:
            await asyncio.wait_for(_broadcast_now.wait(), timeout=5.0)
        except asyncio.TimeoutError:
            pass


def trigger_immediate_broadcast() -> None:
    """Call this after a rescan so the globe updates within ~1 second."""
    _broadcast_now.set()


async def listen_for_alerts(redis: Redis | None) -> None:
    try:
        if redis is None:
            while True:
                await asyncio.sleep(10)
            return

        pubsub = redis.pubsub()
        await pubsub.subscribe("new_alerts")
        async for message in pubsub.listen():
            if message.get("type") != "message":
                continue
            raw = message.get("data")
            data = json.loads(raw.decode("utf-8") if isinstance(raw, bytes) else raw)
            if isinstance(data, dict) and "data" in data:
                await sio.emit("new_alert", data["data"])
            else:
                await sio.emit("new_alert", data)
    except asyncio.CancelledError:
        logger.info("Alert listener cancelled")
    except Exception:
        logger.exception("Redis alert listener failed")
    finally:
        if redis is not None:
            try:
                await pubsub.close()
            except Exception:
                pass
