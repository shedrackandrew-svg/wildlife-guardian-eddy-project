from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class SensorPayload(BaseModel):
    source_id: str = Field(default="sensor-1")
    values: dict[str, Any] = Field(default_factory=dict)


class DetectionResponse(BaseModel):
    label: str
    confidence: float
    scores: list[dict[str, float]]
    alert_triggered: bool
    inventory_id: int | None = None
    animal_info: "AnimalProfileOut | None" = None


class AnimalProfileOut(BaseModel):
    species_name: str
    scientific_name: str
    family: str
    conservation_status: str
    habitats: list[str]
    regions: list[str]
    diet: str
    average_lifespan_years: str
    top_speed_kmh: int | None
    facts: list[str]
    safety_notes: str
    aliases: list[str]
    record_path: str


class AnimalProfileUpsertIn(BaseModel):
    species_name: str
    scientific_name: str = "Unknown"
    family: str = "Unknown"
    conservation_status: str = "Not evaluated"
    habitats: list[str] = Field(default_factory=lambda: ["Unknown"])
    regions: list[str] = Field(default_factory=lambda: ["Global"])
    diet: str = "Unknown"
    average_lifespan_years: str = "Unknown"
    top_speed_kmh: int | None = None
    facts: list[str] = Field(default_factory=list)
    safety_notes: str = "Observe from a safe distance."
    aliases: list[str] = Field(default_factory=list)


class DetectionRecordOut(BaseModel):
    id: int
    created_at: datetime
    source: str
    top_label: str
    confidence: float
    image_path: str


class AlertRecordOut(BaseModel):
    id: int
    created_at: datetime
    alert_type: str
    message: str
    channel: str
    status: str
    detection_id: int


class InventoryRecordOut(BaseModel):
    id: int
    species_name: str
    category: str
    count_seen: int
    last_confidence: float
    habitat_region: str
    habitat_lat: float | None
    habitat_lng: float | None
    notes: str


class InventoryUpsertIn(BaseModel):
    species_name: str
    category: str = "wildlife"
    habitat_region: str = "Unknown"
    habitat_lat: float | None = None
    habitat_lng: float | None = None
    notes: str = ""
