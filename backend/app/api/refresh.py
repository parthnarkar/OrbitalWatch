from __future__ import annotations

import logging
from datetime import datetime, timezone
from fastapi import APIRouter, BackgroundTasks
from app.services.scheduler import run_conjunction_scan
from app.services import scheduler

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/refresh", tags=["refresh"])


@router.post("")
async def trigger_refresh(background_tasks: BackgroundTasks) -> dict[str, object]:
    """
    Triggers a fresh recalculation of conjunctions/alerts in the background
    and updates the last scan timestamp.
    """
    logger.info("[Refresh] Telemetry refresh requested.")
    # Update last scan time immediately for UI responsiveness
    scheduler.last_scan_at = datetime.now(timezone.utc)
    
    # Run the conjunction scan in the background
    background_tasks.add_task(run_conjunction_scan)
    
    return {
        "success": True,
        "message": "Telemetry refresh initiated successfully.",
        "timestamp": scheduler.last_scan_at.isoformat()
    }
