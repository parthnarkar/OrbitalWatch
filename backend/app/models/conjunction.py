from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base, utcnow


class ConjunctionModel(Base):
    __tablename__ = "conjunctions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    sat1_norad_id: Mapped[str] = mapped_column(String(10), index=True, nullable=False)
    sat2_norad_id: Mapped[str] = mapped_column(String(10), index=True, nullable=False)
    approach_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    miss_distance_km: Mapped[float] = mapped_column(Float, nullable=False)
    risk_level: Mapped[str] = mapped_column(String(10), nullable=False)
    probability: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    relative_velocity: Mapped[float] = mapped_column(Float, default=7.5, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)


Conjunction = ConjunctionModel
