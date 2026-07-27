from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, HTTPException

from app.services import scheduler
from app.services.scheduler import run_refresh_flow

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/refresh", tags=["refresh"])

# Minimum seconds between manual refresh requests (rate limit)
_REFRESH_COOLDOWN_SECONDS = 60
_last_manual_refresh: datetime | None = None


@router.post("")
async def trigger_refresh(background_tasks: BackgroundTasks) -> dict[str, object]:
    """Trigger a background conjunction rescan.

    Rate-limited to once per 60 seconds to prevent abuse of the CPU-intensive scan.
    """
    global _last_manual_refresh

    now = datetime.now(timezone.utc)
    if _last_manual_refresh is not None:
        elapsed = (now - _last_manual_refresh).total_seconds()
        if elapsed < _REFRESH_COOLDOWN_SECONDS:
            remaining = int(_REFRESH_COOLDOWN_SECONDS - elapsed)
            raise HTTPException(
                status_code=429,
                detail=f"Refresh rate limited. Please wait {remaining}s before trying again.",
            )

    _last_manual_refresh = now
    scheduler.last_scan_at = now
    logger.info("[Refresh] Telemetry refresh requested.")
    background_tasks.add_task(run_refresh_flow)

    return {
        "success": True,
        "message": "Telemetry refresh initiated successfully.",
        "timestamp": now.isoformat(),
    }
