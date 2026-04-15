from __future__ import annotations

import json
import os
import re
import sys
import uuid
from io import BytesIO
from pathlib import Path
from threading import Thread

# Support direct execution: python app/main.py
if __package__ in {None, ""}:
    project_root = Path(__file__).resolve().parents[1]
    root_str = str(project_root)
    if root_str not in sys.path:
        sys.path.insert(0, root_str)

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image
from sqlalchemy.orm import Session

from app.config import get_settings
from app.auth import create_access_token, decode_access_token, hash_password, verify_password
from app.animal_knowledge import AnimalKnowledgeBase
from app.database import Base, engine, get_db
from app.detector import detector
from app.models import Alert, AnimalInventory, Detection, User
from app.schemas import (
    AuthSignInIn,
    AuthSignUpIn,
    AuthTokenOut,
    AnimalProfileOut,
    AnimalProfileUpsertIn,
    AlertRecordOut,
    DetectionRecordOut,
    DetectionResponse,
    InventoryRecordOut,
    InventoryUpsertIn,
    SensorPayload,
    UserOut,
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
settings.species_images_path.mkdir(parents=True, exist_ok=True)
Base.metadata.create_all(bind=engine)

knowledge_base = AnimalKnowledgeBase(settings.animal_knowledge_path)
knowledge_base.bootstrap_profiles(detector.load_species_labels())

app.mount("/static", StaticFiles(directory="app/static"), name="static")
app.mount("/media", StaticFiles(directory=str(settings.images_dir_path)), name="media")
app.mount("/species-media", StaticFiles(directory=str(settings.species_images_path)), name="species-media")


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

REGION_COORDINATES: dict[str, tuple[float, float]] = {
    "africa": (0.5, 20.0),
    "east africa": (-2.5, 36.8),
    "southern africa": (-19.0, 24.0),
    "north africa": (28.0, 10.0),
    "europe": (51.0, 10.0),
    "northern europe": (60.0, 12.0),
    "asia": (33.0, 95.0),
    "south asia": (21.0, 79.0),
    "southeast asia": (13.0, 103.0),
    "middle east": (25.0, 45.0),
    "north america": (45.0, -100.0),
    "south america": (-15.0, -60.0),
    "oceania": (-22.0, 140.0),
    "australia": (-25.0, 133.0),
    "global": (10.0, 0.0),
}

BIOLOGY_CLASS_KEYWORDS: dict[str, tuple[str, str]] = {
    "lion": ("Mammalia", "Carnivora"),
    "tiger": ("Mammalia", "Carnivora"),
    "leopard": ("Mammalia", "Carnivora"),
    "cheetah": ("Mammalia", "Carnivora"),
    "wolf": ("Mammalia", "Carnivora"),
    "dog": ("Mammalia", "Carnivora"),
    "cat": ("Mammalia", "Carnivora"),
    "bear": ("Mammalia", "Carnivora"),
    "elephant": ("Mammalia", "Proboscidea"),
    "giraffe": ("Mammalia", "Artiodactyla"),
    "zebra": ("Mammalia", "Perissodactyla"),
    "deer": ("Mammalia", "Artiodactyla"),
    "antelope": ("Mammalia", "Artiodactyla"),
    "boar": ("Mammalia", "Artiodactyla"),
    "camel": ("Mammalia", "Artiodactyla"),
    "cow": ("Mammalia", "Artiodactyla"),
    "buffalo": ("Mammalia", "Artiodactyla"),
    "goat": ("Mammalia", "Artiodactyla"),
    "sheep": ("Mammalia", "Artiodactyla"),
    "horse": ("Mammalia", "Perissodactyla"),
    "monkey": ("Mammalia", "Primates"),
    "chimpanzee": ("Mammalia", "Primates"),
    "gorilla": ("Mammalia", "Primates"),
    "eagle": ("Aves", "Accipitriformes"),
    "hawk": ("Aves", "Accipitriformes"),
    "owl": ("Aves", "Strigiformes"),
    "duck": ("Aves", "Anseriformes"),
    "parrot": ("Aves", "Psittaciformes"),
    "crow": ("Aves", "Passeriformes"),
    "sparrow": ("Aves", "Passeriformes"),
    "peacock": ("Aves", "Galliformes"),
    "snake": ("Reptilia", "Squamata"),
    "turtle": ("Reptilia", "Testudines"),
    "tortoise": ("Reptilia", "Testudines"),
    "crocodile": ("Reptilia", "Crocodylia"),
    "alligator": ("Reptilia", "Crocodylia"),
    "bee": ("Insecta", "Hymenoptera"),
    "ant": ("Insecta", "Hymenoptera"),
    "butterfly": ("Insecta", "Lepidoptera"),
    "dragonfly": ("Insecta", "Odonata"),
    "spider": ("Arachnida", "Araneae"),
}


@app.on_event("startup")
def warmup_detector() -> None:
    # Warm model in background to reduce first-request latency.
    def _worker() -> None:
        try:
            detector._load_pipeline()
        except Exception:
            pass

    Thread(target=_worker, daemon=True).start()


def _inventory_habitat_for_species(species_name: str) -> tuple[str, float | None, float | None]:
    for key, value in DEFAULT_HABITAT_HINTS.items():
        if key in species_name.lower():
            return value
    return ("Unknown", None, None)


def _taxonomy_for_species(species_name: str) -> tuple[str, str]:
    name = species_name.lower()
    words = [w for w in re.split(r"[^a-z]+", name) if w]

    def _matches(keyword: str) -> bool:
        if " " in keyword:
            return keyword in name
        return any(word == keyword or word == f"{keyword}s" for word in words)

    for key, taxonomy in BIOLOGY_CLASS_KEYWORDS.items():
        if _matches(key):
            return taxonomy
    return ("Unknown", "Unknown")


def _region_points(regions: list[str]) -> list[dict[str, float | str]]:
    points: list[dict[str, float | str]] = []
    seen: set[str] = set()
    for region in regions:
        normalized = region.strip().lower()
        if not normalized:
            continue
        if normalized in REGION_COORDINATES:
            lat, lng = REGION_COORDINATES[normalized]
            if normalized in seen:
                continue
            seen.add(normalized)
            points.append({"region": region, "lat": lat, "lng": lng})
            continue

        for key, coords in REGION_COORDINATES.items():
            if key in normalized:
                if key in seen:
                    break
                seen.add(key)
                points.append({"region": region, "lat": coords[0], "lng": coords[1]})
                break
    return points


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


def _slugify_species(species_name: str) -> str:
    clean = "".join(ch.lower() if ch.isalnum() else "-" for ch in species_name.strip())
    while "--" in clean:
        clean = clean.replace("--", "-")
    return clean.strip("-") or "unknown"


def _species_dir(species_name: str) -> Path:
    path = settings.species_images_path / _slugify_species(species_name)
    path.mkdir(parents=True, exist_ok=True)
    return path


def _list_species_image_urls(species_name: str) -> list[str]:
    species_path = settings.species_images_path / _slugify_species(species_name)
    if not species_path.exists():
        return []
    out: list[str] = []
    for image_path in sorted(species_path.iterdir()):
        if image_path.is_file() and image_path.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}:
            out.append(f"/species-media/{species_path.name}/{image_path.name}")

    cover_file = species_path / "cover.txt"
    if cover_file.exists():
        cover_name = cover_file.read_text(encoding="utf-8").strip()
        if cover_name:
            cover_url = f"/species-media/{species_path.name}/{cover_name}"
            if cover_url in out:
                out.remove(cover_url)
                out.insert(0, cover_url)
    return out


def _profile_payload(profile) -> dict:
    payload = profile.to_dict()
    payload["image_urls"] = _list_species_image_urls(profile.species_name)
    return payload


def _detector_candidates() -> list[str]:
    labels = set(detector.load_species_labels())
    for profile in knowledge_base.list_profiles():
        labels.add(profile.species_name.lower())
        for alias in profile.aliases:
            if alias.strip():
                labels.add(alias.strip().lower())
    return sorted(labels)


def _get_bearer_token(authorization: str | None) -> str | None:
    if not authorization:
        return None
    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    return parts[1].strip() or None


def _current_user_from_auth_header(authorization: str | None, db: Session) -> User | None:
    token = _get_bearer_token(authorization)
    if not token:
        return None
    payload = decode_access_token(token=token, secret_key=settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    if not payload:
        return None
    user_id = payload.get("uid")
    if not isinstance(user_id, int):
        return None
    return db.query(User).filter(User.id == user_id).first()


@app.get("/")
def index():
    return FileResponse("app/static/index.html")


@app.get("/dashboard")
def dashboard_page():
    return FileResponse("app/static/dashboard.html")


@app.get("/admin")
def admin_page():
    return FileResponse("app/static/admin.html")


@app.get("/live")
def live_page():
    return FileResponse("app/static/live.html")


@app.get("/onboarding")
def onboarding_page():
    return FileResponse("app/static/onboarding.html")


@app.get("/remote-camera")
def remote_camera_page():
    return FileResponse("app/static/remote_camera.html")


@app.get("/library")
def library_page():
    return FileResponse("app/static/library.html")


@app.get("/history")
def history_page():
    return FileResponse("app/static/history.html")


@app.get("/map")
def map_page():
    return FileResponse("app/static/map.html")


@app.get("/settings")
def settings_page():
    return FileResponse("app/static/settings.html")


def require_admin(
    x_admin_token: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    if settings.admin_token and x_admin_token == settings.admin_token:
        return

    user = _current_user_from_auth_header(authorization, db)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")


def require_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    user = _current_user_from_auth_header(authorization, db)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return user


@app.get("/health")
def health():
    return {"status": "ok", "app": settings.app_name}


@app.post("/api/auth/sign-up", response_model=AuthTokenOut)
def auth_sign_up(payload: AuthSignUpIn, db: Session = Depends(get_db)):
    username = payload.username.strip().lower()
    password = payload.password.strip()

    if len(username) < 3 or len(password) < 6:
        raise HTTPException(status_code=400, detail="Username or password too short")

    existing = db.query(User).filter(User.username == username).first()
    if existing:
        raise HTTPException(status_code=409, detail="Username already exists")

    has_users = db.query(User).count() > 0
    user = User(
        username=username,
        password_hash=hash_password(password),
        is_admin=not has_users,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(
        secret_key=settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
        subject=user.username,
        user_id=user.id,
        is_admin=user.is_admin,
        expires_minutes=settings.jwt_access_token_expire_minutes,
    )
    return AuthTokenOut(access_token=token, user=UserOut(id=user.id, username=user.username, is_admin=user.is_admin))


@app.post("/api/auth/sign-in", response_model=AuthTokenOut)
def auth_sign_in(payload: AuthSignInIn, db: Session = Depends(get_db)):
    username = payload.username.strip().lower()
    user = db.query(User).filter(User.username == username).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token(
        secret_key=settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
        subject=user.username,
        user_id=user.id,
        is_admin=user.is_admin,
        expires_minutes=settings.jwt_access_token_expire_minutes,
    )
    return AuthTokenOut(access_token=token, user=UserOut(id=user.id, username=user.username, is_admin=user.is_admin))


@app.get("/api/auth/me", response_model=UserOut)
def auth_me(current_user: User = Depends(require_user)):
    return UserOut(id=current_user.id, username=current_user.username, is_admin=current_user.is_admin)


@app.post("/api/detect/image", response_model=DetectionResponse)
async def detect_image(
    file: UploadFile = File(...),
    source: str = Form(default="external-camera"),
    db: Session = Depends(get_db),
):
    content = await file.read()
    image = Image.open(BytesIO(content)).convert("RGB")

    prediction = detector.predict(image, labels=_detector_candidates())
    matched_profile = knowledge_base.find_profile(prediction["label"])
    if matched_profile is not None:
        prediction["label"] = matched_profile.species_name

        normalized_scores: list[dict[str, float | str]] = []
        seen: set[str] = set()
        for item in prediction["scores"]:
            score_profile = knowledge_base.find_profile(item["label"])
            canonical = score_profile.species_name if score_profile else item["label"]
            if canonical in seen:
                continue
            seen.add(canonical)
            normalized_scores.append({"label": canonical, "score": float(item["score"])})
        prediction["scores"] = normalized_scores
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
        animal_info=AnimalProfileOut(**_profile_payload(profile)) if profile else None,
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


@app.get("/api/gallery")
def gallery(limit: int = 24, db: Session = Depends(get_db)):
    rows = (
        db.query(Detection)
        .filter(Detection.image_path.isnot(None), Detection.image_path != "")
        .order_by(Detection.created_at.desc())
        .limit(max(1, min(limit, 120)))
        .all()
    )

    payload: list[dict[str, str | float]] = []
    for row in rows:
        profile = knowledge_base.find_profile(row.top_label)
        payload.append(
            {
                "label": row.top_label,
                "confidence": row.confidence,
                "captured_at": row.created_at.isoformat(),
                "image_url": f"/{row.image_path.lstrip('/')}".replace("/data/images/", "/media/"),
                "scientific_name": profile.scientific_name if profile else "Unknown",
                "conservation_status": profile.conservation_status if profile else "Not evaluated",
            }
        )
    return payload


@app.get("/api/admin/species-images/{species_label}", dependencies=[Depends(require_admin)])
def list_species_images(species_label: str):
    return {
        "species": species_label.lower(),
        "images": _list_species_image_urls(species_label),
    }


@app.post("/api/admin/species-images/{species_label}", dependencies=[Depends(require_admin)])
async def upload_species_image(species_label: str, file: UploadFile = File(...)):
    suffix = Path(file.filename or "upload.jpg").suffix.lower()
    if suffix not in {".jpg", ".jpeg", ".png", ".webp"}:
        raise HTTPException(status_code=400, detail="Unsupported image format")

    species_path = _species_dir(species_label)
    filename = f"{uuid.uuid4().hex}{suffix}"
    destination = species_path / filename
    content = await file.read()
    destination.write_bytes(content)

    return {
        "status": "uploaded",
        "url": f"/species-media/{species_path.name}/{filename}",
        "filename": filename,
    }


@app.delete("/api/admin/species-images/{species_label}", dependencies=[Depends(require_admin)])
def delete_species_image(species_label: str, filename: str = Query(...)):
    clean_name = os.path.basename(filename)
    target = _species_dir(species_label) / clean_name
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="Image not found")
    target.unlink()

    species_path = _species_dir(species_label)
    cover_file = species_path / "cover.txt"
    if cover_file.exists() and cover_file.read_text(encoding="utf-8").strip() == clean_name:
        cover_file.unlink()

    return {"status": "deleted", "filename": clean_name}


@app.post("/api/admin/species-images/{species_label}/cover", dependencies=[Depends(require_admin)])
def set_species_cover(species_label: str, filename: str = Query(...)):
    clean_name = os.path.basename(filename)
    species_path = _species_dir(species_label)
    target = species_path / clean_name
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="Image not found")

    (species_path / "cover.txt").write_text(clean_name, encoding="utf-8")
    return {"status": "ok", "cover": clean_name}


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
    out: list[InventoryRecordOut] = []
    for row in rows:
        image_urls = _list_species_image_urls(row.species_name)
        taxonomy_class, taxonomy_order = _taxonomy_for_species(row.species_name)
        out.append(
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
                image_url=image_urls[0] if image_urls else None,
                taxonomy_class=taxonomy_class,
                taxonomy_order=taxonomy_order,
                geography_scope=row.habitat_region or "Unknown",
            )
        )
    return out


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
    image_urls = _list_species_image_urls(row.species_name)
    taxonomy_class, taxonomy_order = _taxonomy_for_species(row.species_name)
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
        image_url=image_urls[0] if image_urls else None,
        taxonomy_class=taxonomy_class,
        taxonomy_order=taxonomy_order,
        geography_scope=row.habitat_region or "Unknown",
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

    return [AnimalProfileOut(**_profile_payload(profile)) for profile in profiles[:limit]]


@app.get("/api/wildlife/zones")
def wildlife_zones(limit: int = 500, db: Session = Depends(get_db)):
    profiles = knowledge_base.list_profiles()[: max(1, min(limit, 2000))]
    inventory_rows = db.query(AnimalInventory).all()
    sightings = {row.species_name.lower(): row.count_seen for row in inventory_rows}

    payload: list[dict[str, str | int | float | None | list[str]]] = []
    for profile in profiles:
        region, lat, lng = _inventory_habitat_for_species(profile.species_name)
        geography_points = _region_points(profile.regions)
        if not geography_points and lat is not None and lng is not None:
            geography_points = [{"region": region, "lat": lat, "lng": lng}]
        payload.append(
            {
                "species_name": profile.species_name,
                "scientific_name": profile.scientific_name,
                "family": profile.family,
                "taxonomy_class": _taxonomy_for_species(profile.species_name)[0],
                "taxonomy_order": _taxonomy_for_species(profile.species_name)[1],
                "conservation_status": profile.conservation_status,
                "habitats": profile.habitats,
                "regions": profile.regions,
                "zone": region,
                "lat": lat,
                "lng": lng,
                "geo_points": geography_points,
                "image_url": (_list_species_image_urls(profile.species_name)[0] if _list_species_image_urls(profile.species_name) else None),
                "sightings": int(sightings.get(profile.species_name.lower(), 0)),
            }
        )
    return payload


@app.get("/api/wildlife/classification")
def wildlife_classification(limit: int = 500, db: Session = Depends(get_db)):
    profiles = knowledge_base.list_profiles()[: max(1, min(limit, 3000))]
    inventory_rows = db.query(AnimalInventory).all()
    sightings = {row.species_name.lower(): row.count_seen for row in inventory_rows}

    data: list[dict[str, str | int | list[str]]] = []
    for profile in profiles:
        taxonomy_class, taxonomy_order = _taxonomy_for_species(profile.species_name)
        data.append(
            {
                "species_name": profile.species_name,
                "scientific_name": profile.scientific_name,
                "family": profile.family,
                "taxonomy_class": taxonomy_class,
                "taxonomy_order": taxonomy_order,
                "conservation_status": profile.conservation_status,
                "habitats": profile.habitats,
                "regions": profile.regions,
                "geography_scope": ", ".join(profile.regions[:3]) if profile.regions else "Unknown",
                "sightings": int(sightings.get(profile.species_name.lower(), 0)),
            }
        )
    return data


@app.get("/api/wildlife/history")
def wildlife_history(limit: int = 250, db: Session = Depends(get_db)):
    rows = db.query(Detection).order_by(Detection.created_at.desc()).limit(max(1, min(limit, 2000))).all()
    timeline = [
        {
            "species": row.top_label,
            "confidence": row.confidence,
            "source": row.source,
            "captured_at": row.created_at.isoformat(),
        }
        for row in rows
    ]

    species_totals: dict[str, int] = {}
    for row in rows:
        key = row.top_label.lower()
        species_totals[key] = species_totals.get(key, 0) + 1

    dominant_species = sorted(
        [{"species": k, "detections": v} for k, v in species_totals.items()],
        key=lambda item: item["detections"],
        reverse=True,
    )[:15]

    return {
        "timeline": timeline,
        "dominant_species": dominant_species,
        "total_events": len(timeline),
    }


@app.get("/api/settings/database-info")
def database_info(db: Session = Depends(get_db)):
    detection_count = db.query(Detection).count()
    inventory_count = db.query(AnimalInventory).count()
    alert_count = db.query(Alert).count()
    user_count = db.query(User).count()

    return {
        "database_url": settings.database_url,
        "detections": detection_count,
        "inventory_items": inventory_count,
        "alerts": alert_count,
        "users": user_count,
    }


@app.get("/api/animals/{species_label}", response_model=AnimalProfileOut)
def get_animal_profile(species_label: str):
    profile = knowledge_base.find_profile(species_label)
    if profile is None:
        raise HTTPException(status_code=404, detail=f"No profile found for '{species_label}'")
    return AnimalProfileOut(**_profile_payload(profile))


@app.post("/api/admin/animals", response_model=AnimalProfileOut, dependencies=[Depends(require_admin)])
def admin_upsert_animal_profile(payload: AnimalProfileUpsertIn):
    profile = knowledge_base.upsert_profile(payload.model_dump())
    return AnimalProfileOut(**_profile_payload(profile))


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


if __name__ == "__main__":
    import uvicorn

    host = settings.api_host
    port = settings.api_port

    print("\n=== WildGuard Local Server ===")
    print(f"Home: http://127.0.0.1:{port}/")
    print(f"Dashboard: http://127.0.0.1:{port}/dashboard")
    print(f"Live: http://127.0.0.1:{port}/live")
    print(f"Settings: http://127.0.0.1:{port}/settings")
    print("==============================\n")

    uvicorn.run(app, host=host, port=port)
