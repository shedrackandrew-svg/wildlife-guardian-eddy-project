from __future__ import annotations

import json
import uuid
from io import BytesIO
from pathlib import Path

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image
from sqlalchemy.orm import Session

from app.config import get_settings
from app.animal_knowledge import AnimalKnowledgeBase
from app.database import Base, engine, get_db
from app.detector import detector
from app.models import Alert, AnimalInventory, Detection
from app.schemas import (
    AnimalProfileOut,
    AnimalProfileUpsertIn,
    AlertRecordOut,
    DetectionRecordOut,
    DetectionResponse,
    InventoryRecordOut,
    InventoryUpsertIn,
    SensorPayload,
)
from app.services.alerts import process_alerts

settings = get_settings()

app = FastAPI(title=settings.app_name)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

settings.images_dir_path.mkdir(parents=True, exist_ok=True)
settings.animal_knowledge_path.mkdir(parents=True, exist_ok=True)
Base.metadata.create_all(bind=engine)

knowledge_base = AnimalKnowledgeBase(settings.animal_knowledge_path)
knowledge_base.bootstrap_profiles(detector.load_species_labels())

app.mount("/static", StaticFiles(directory="app/static"), name="static")


DEFAULT_HABITAT_HINTS: dict[str, tuple[str, float, float]] = {
    "elephant": ("Africa", -1.9579, 37.2972),
    "lion": ("East Africa", -2.3333, 34.8333),
    "tiger": ("South Asia", 26.8467, 80.9462),
    "bear": ("North America", 58.3019, -134.4197),
    "wolf": ("Northern Europe", 60.4720, 8.4689),
    "zebra": ("Southern Africa", -19.0154, 29.1549),
    "giraffe": ("East Africa", -3.3869, 36.6820),
    "deer": ("Europe", 50.1109, 8.6821),
    "boar": ("Europe", 52.5200, 13.4050),
    "camel": ("Middle East", 24.7136, 46.6753),
}


def _inventory_habitat_for_species(species_name: str) -> tuple[str, float | None, float | None]:
    for key, value in DEFAULT_HABITAT_HINTS.items():
        if key in species_name.lower():
            return value
    return ("Unknown", None, None)


def upsert_inventory_for_detection(db: Session, label: str, confidence: float) -> AnimalInventory:
    item = db.query(AnimalInventory).filter(AnimalInventory.species_name == label).first()
    now_region, now_lat, now_lng = _inventory_habitat_for_species(label)

    if item is None:
        item = AnimalInventory(
            species_name=label,
            category="wildlife",
            count_seen=1,
            last_confidence=confidence,
            last_seen_at=None,
            habitat_region=now_region,
            habitat_lat=now_lat,
            habitat_lng=now_lng,
            notes="Auto-created from live detection",
        )
        db.add(item)
    else:
        item.count_seen += 1
        item.last_confidence = confidence

    from datetime import datetime

    item.last_seen_at = datetime.utcnow()
    db.commit()
    db.refresh(item)
    return item


@app.get("/")
def index():
    return FileResponse("app/static/index.html")


@app.get("/admin")
def admin_page():
    return FileResponse("app/static/admin.html")


@app.get("/live")
def live_page():
    return FileResponse("app/static/live.html")


def require_admin(x_admin_token: str | None = Header(default=None)):
    if settings.admin_token and x_admin_token != settings.admin_token:
        raise HTTPException(status_code=401, detail="Unauthorized admin token")


@app.get("/health")
def health():
    return {"status": "ok", "app": settings.app_name}


@app.post("/api/detect/image", response_model=DetectionResponse)
async def detect_image(
    file: UploadFile = File(...),
    source: str = Form(default="external-camera"),
    db: Session = Depends(get_db),
):
    content = await file.read()
    image = Image.open(BytesIO(content)).convert("RGB")

    prediction = detector.predict(image)
    image_id = f"{uuid.uuid4().hex}.jpg"
    image_path = settings.images_dir_path / image_id
    image.save(image_path, format="JPEG", quality=90)

    detection = Detection(
        source=source,
        top_label=prediction["label"],
        confidence=prediction["confidence"],
        all_scores_json=json.dumps(prediction["scores"]),
        image_path=str(Path("data/images") / image_id).replace("\\", "/"),
        raw_sensor_json="{}",
    )
    db.add(detection)
    db.commit()
    db.refresh(detection)

    inventory_item = upsert_inventory_for_detection(db, detection.top_label, detection.confidence)
    detection.inventory_id = inventory_item.id
    db.add(detection)
    db.commit()
    db.refresh(detection)

    alerts = await process_alerts(db, detection)
    profile = knowledge_base.find_profile(prediction["label"])

    return DetectionResponse(
        label=prediction["label"],
        confidence=prediction["confidence"],
        scores=[{"label": item["label"], "score": item["score"]} for item in prediction["scores"]],
        alert_triggered=len(alerts) > 0,
        inventory_id=detection.inventory_id,
        animal_info=AnimalProfileOut(**profile.to_dict()) if profile else None,
    )


@app.post("/api/sensor")
async def ingest_sensor(payload: SensorPayload, db: Session = Depends(get_db)):
    # Sensor data is logged as a detection placeholder and can be fused with camera results upstream.
    detection = Detection(
        source=payload.source_id,
        top_label="sensor_event",
        confidence=1.0,
        all_scores_json="[]",
        image_path="",
        raw_sensor_json=json.dumps(payload.values),
    )
    db.add(detection)
    db.commit()
    db.refresh(detection)
    return {"status": "logged", "detection_id": detection.id}


@app.get("/api/detections", response_model=list[DetectionRecordOut])
def list_detections(limit: int = 50, db: Session = Depends(get_db)):
    rows = db.query(Detection).order_by(Detection.created_at.desc()).limit(limit).all()
    return [
        DetectionRecordOut(
            id=row.id,
            created_at=row.created_at,
            source=row.source,
            top_label=row.top_label,
            confidence=row.confidence,
            image_path=row.image_path,
        )
        for row in rows
    ]


@app.get("/api/alerts", response_model=list[AlertRecordOut])
def list_alerts(limit: int = 50, db: Session = Depends(get_db)):
    rows = db.query(Alert).order_by(Alert.created_at.desc()).limit(limit).all()
    return [
        AlertRecordOut(
            id=row.id,
            created_at=row.created_at,
            alert_type=row.alert_type,
            message=row.message,
            channel=row.channel,
            status=row.status,
            detection_id=row.detection_id,
        )
        for row in rows
    ]


@app.get("/api/inventory", response_model=list[InventoryRecordOut])
def list_inventory(db: Session = Depends(get_db)):
    rows = db.query(AnimalInventory).order_by(AnimalInventory.count_seen.desc()).all()
    return [
        InventoryRecordOut(
            id=row.id,
            species_name=row.species_name,
            category=row.category,
            count_seen=row.count_seen,
            last_confidence=row.last_confidence,
            habitat_region=row.habitat_region,
            habitat_lat=row.habitat_lat,
            habitat_lng=row.habitat_lng,
            notes=row.notes,
        )
        for row in rows
    ]


@app.post("/api/inventory", response_model=InventoryRecordOut)
def upsert_inventory(payload: InventoryUpsertIn, db: Session = Depends(get_db)):
    row = db.query(AnimalInventory).filter(AnimalInventory.species_name == payload.species_name.lower()).first()
    if row is None:
        row = AnimalInventory(
            species_name=payload.species_name.lower(),
            category=payload.category,
            habitat_region=payload.habitat_region,
            habitat_lat=payload.habitat_lat,
            habitat_lng=payload.habitat_lng,
            notes=payload.notes,
            count_seen=0,
            last_confidence=0.0,
        )
        db.add(row)
    else:
        row.category = payload.category
        row.habitat_region = payload.habitat_region
        row.habitat_lat = payload.habitat_lat
        row.habitat_lng = payload.habitat_lng
        row.notes = payload.notes

    db.commit()
    db.refresh(row)
    return InventoryRecordOut(
        id=row.id,
        species_name=row.species_name,
        category=row.category,
        count_seen=row.count_seen,
        last_confidence=row.last_confidence,
        habitat_region=row.habitat_region,
        habitat_lat=row.habitat_lat,
        habitat_lng=row.habitat_lng,
        notes=row.notes,
    )


@app.get("/api/animals", response_model=list[AnimalProfileOut])
def list_animals(search: str = "", limit: int = 200):
    query = search.strip().lower()
    profiles = knowledge_base.list_profiles()

    if query:
        profiles = [
            p
            for p in profiles
            if query in p.species_name.lower()
            or any(query in alias.lower() for alias in p.aliases)
            or any(query in region.lower() for region in p.regions)
        ]

    return [AnimalProfileOut(**profile.to_dict()) for profile in profiles[:limit]]


@app.get("/api/animals/{species_label}", response_model=AnimalProfileOut)
def get_animal_profile(species_label: str):
    profile = knowledge_base.find_profile(species_label)
    if profile is None:
        raise HTTPException(status_code=404, detail=f"No profile found for '{species_label}'")
    return AnimalProfileOut(**profile.to_dict())


@app.post("/api/admin/animals", response_model=AnimalProfileOut, dependencies=[Depends(require_admin)])
def admin_upsert_animal_profile(payload: AnimalProfileUpsertIn):
    profile = knowledge_base.upsert_profile(payload.model_dump())
    return AnimalProfileOut(**profile.to_dict())


@app.delete("/api/admin/animals/{species_label}", dependencies=[Depends(require_admin)])
def admin_delete_animal_profile(species_label: str):
    deleted = knowledge_base.delete_profile(species_label)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"No profile found for '{species_label}'")
    return {"status": "deleted", "species_name": species_label.lower()}


@app.post("/api/admin/bootstrap", dependencies=[Depends(require_admin)])
def admin_bootstrap_species_profiles():
    labels = detector.load_species_labels()
    knowledge_base.bootstrap_profiles(labels)
    return {"status": "ok", "count": len(labels)}
