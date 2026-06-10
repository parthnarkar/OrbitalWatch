from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, utcnow


class SatelliteModel(Base):
    __tablename__ = "satellites"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    norad_id: Mapped[str] = mapped_column(String(10), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    object_type: Mapped[str] = mapped_column(String(20), nullable=False, default="unknown")
    tle_line1: Mapped[str] = mapped_column(String(80), nullable=False)
    tle_line2: Mapped[str] = mapped_column(String(80), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)


Satellite = SatelliteModel
