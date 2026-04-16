from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class SensorPayload(BaseModel):
    source_id: str = Field(default="sensor-1")
    values: dict[str, Any] = Field(default_factory=dict)


class DetectionScore(BaseModel):
    label: str
    score: float


class DetectionResponse(BaseModel):
    label: str
    confidence: float
    scores: list[DetectionScore]
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
    image_urls: list[str] = Field(default_factory=list)


class AuthSignUpIn(BaseModel):
    username: str
    password: str


class AuthSignInIn(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    id: int
    username: str
    is_admin: bool


class AuthTokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


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
    image_url: str | None = None
    taxonomy_class: str = "Unknown"
    taxonomy_order: str = "Unknown"
    geography_scope: str = "Unknown"


class InventoryUpsertIn(BaseModel):
    species_name: str
    category: str = "wildlife"
    habitat_region: str = "Unknown"
    habitat_lat: float | None = None
    habitat_lng: float | None = None
    notes: str = ""


class GlobalSpeciesRecordOut(BaseModel):
    id: int
    species_name: str
    scientific_name: str
    common_name: str
    kingdom: str
    phylum: str
    taxonomy_class: str
    taxonomy_order: str
    family: str
    genus: str
    conservation_status: str
    habitats: list[str] = Field(default_factory=list)
    regions: list[str] = Field(default_factory=list)
    details: str = ""
    image_url: str | None = None
    image_source: str | None = None
    source: str
    sightings: int = 0


class GlobalSpeciesSyncOut(BaseModel):
    class_name: str
    requested: int
    imported: int
    updated: int
    total_catalog_size: int
