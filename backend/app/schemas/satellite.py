from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class SatelliteBase(BaseModel):
    norad_id: str
    name: str
    object_type: str
    tle_line1: str
    tle_line2: str


class SatelliteCreate(SatelliteBase):
    pass


class SatelliteResponse(SatelliteBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PositionVector(BaseModel):
    latitude: float
    longitude: float
    altitude_km: float
    velocity_kms: float


class PositionResponse(BaseModel):
    norad_id: str
    name: str
    timestamp: datetime
    latitude: float
    longitude: float
    altitude_km: float
    velocity_kms: float
    orbital_period_min: float
    object_type: str
    position: PositionVector


class ConjunctionResponse(BaseModel):
    id: int
    sat1_norad_id: str
    sat1_name: str = ""
    sat2_norad_id: str
    sat2_name: str = ""
    approach_time: datetime
    miss_distance_km: float
    risk_level: str
    probability: float = Field(ge=0.0)

    model_config = ConfigDict(from_attributes=True)
