from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Detection(Base):
    __tablename__ = "detections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    source: Mapped[str] = mapped_column(String(50), nullable=False)
    top_label: Mapped[str] = mapped_column(String(120), nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    all_scores_json: Mapped[str] = mapped_column(Text, nullable=False)
    image_path: Mapped[str] = mapped_column(String(255), nullable=False)
    raw_sensor_json: Mapped[str] = mapped_column(Text, default="{}", nullable=False)
    inventory_id: Mapped[int | None] = mapped_column(ForeignKey("animal_inventory.id"), nullable=True)

    alerts: Mapped[list["Alert"]] = relationship(back_populates="detection")
    inventory_item: Mapped["AnimalInventory | None"] = relationship(back_populates="detections")


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    alert_type: Mapped[str] = mapped_column(String(60), nullable=False)
    message: Mapped[str] = mapped_column(String(255), nullable=False)
    channel: Mapped[str] = mapped_column(String(40), nullable=False)
    status: Mapped[str] = mapped_column(String(40), nullable=False, default="queued")
    detection_id: Mapped[int] = mapped_column(ForeignKey("detections.id"), nullable=False)

    detection: Mapped[Detection] = relationship(back_populates="alerts")


class AnimalInventory(Base):
    __tablename__ = "animal_inventory"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    species_name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(80), default="wildlife", nullable=False)
    count_seen: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_confidence: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    habitat_region: Mapped[str] = mapped_column(String(120), default="Unknown", nullable=False)
    habitat_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    habitat_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    notes: Mapped[str] = mapped_column(Text, default="", nullable=False)

    detections: Mapped[list[Detection]] = relationship(back_populates="inventory_item")
