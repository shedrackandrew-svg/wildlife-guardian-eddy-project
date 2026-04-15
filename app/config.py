from functools import lru_cache
import os
from pathlib import Path
from dataclasses import dataclass


def _load_dotenv(dotenv_path: str = ".env") -> None:
    path = Path(dotenv_path)
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        row = line.strip()
        if not row or row.startswith("#") or "=" not in row:
            continue
        key, value = row.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


@dataclass
class Settings:
    app_name: str = "WildGuard"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    database_url: str = "sqlite:///./data/wildlife.db"
    image_save_dir: str = "./data/images"
    species_labels_file: str = "./app/species_labels.txt"
    animal_knowledge_dir: str = "./data/animal_profiles"
    species_images_dir: str = "./data/species_images"
    admin_token: str = ""
    jwt_secret_key: str = "change-me-wildguard-jwt-secret"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60

    model_name: str = "openai/clip-vit-base-patch32"
    detection_top_k: int = 5
    animal_confidence_threshold: float = 0.22
    detection_min_score_gap: float = 0.08

    alert_watchlist: str = "elephant,lion,tiger,leopard,hyena,wolf,bear,cow,sheep,goat,horse,pig,deer,boar"
    alert_channels: str = "console"

    enable_sms: bool = False
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_from: str = ""
    sms_to: str = ""

    enable_gsm: bool = False
    gsm_serial_port: str = "COM3"

    enable_lora: bool = False
    lora_mqtt_broker: str = "localhost"
    lora_mqtt_port: int = 1883
    lora_topic: str = "wildlife/alerts"

    @property
    def watchlist(self) -> list[str]:
        return [item.strip().lower() for item in self.alert_watchlist.split(",") if item.strip()]

    @property
    def channels(self) -> list[str]:
        return [item.strip().lower() for item in self.alert_channels.split(",") if item.strip()]

    @property
    def images_dir_path(self) -> Path:
        return Path(self.image_save_dir)

    @property
    def species_labels_path(self) -> Path:
        return Path(self.species_labels_file)

    @property
    def animal_knowledge_path(self) -> Path:
        return Path(self.animal_knowledge_dir)

    @property
    def species_images_path(self) -> Path:
        return Path(self.species_images_dir)


@lru_cache
def get_settings() -> Settings:
    _load_dotenv(".env")

    def _get_bool(name: str, default: bool) -> bool:
        raw = os.getenv(name)
        if raw is None:
            return default
        return raw.strip().lower() in {"1", "true", "yes", "on"}

    return Settings(
        app_name=os.getenv("APP_NAME", "WildGuard"),
        api_host=os.getenv("API_HOST", "0.0.0.0"),
        api_port=int(os.getenv("API_PORT", "8000")),
        database_url=os.getenv("DATABASE_URL", "sqlite:///./data/wildlife.db"),
        image_save_dir=os.getenv("IMAGE_SAVE_DIR", "./data/images"),
        species_labels_file=os.getenv("SPECIES_LABELS_FILE", "./app/species_labels.txt"),
        animal_knowledge_dir=os.getenv("ANIMAL_KNOWLEDGE_DIR", "./data/animal_profiles"),
        species_images_dir=os.getenv("SPECIES_IMAGES_DIR", "./data/species_images"),
        admin_token=os.getenv("ADMIN_TOKEN", ""),
        jwt_secret_key=os.getenv("JWT_SECRET_KEY", "change-me-wildguard-jwt-secret"),
        jwt_algorithm=os.getenv("JWT_ALGORITHM", "HS256"),
        jwt_access_token_expire_minutes=int(os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "60")),
        model_name=os.getenv("MODEL_NAME", "openai/clip-vit-base-patch32"),
        detection_top_k=int(os.getenv("DETECTION_TOP_K", "5")),
        animal_confidence_threshold=float(os.getenv("ANIMAL_CONFIDENCE_THRESHOLD", "0.22")),
        detection_min_score_gap=float(os.getenv("DETECTION_MIN_SCORE_GAP", "0.08")),
        alert_watchlist=os.getenv(
            "ALERT_WATCHLIST",
            "elephant,lion,tiger,leopard,hyena,wolf,bear,cow,sheep,goat,horse,pig,deer,boar",
        ),
        alert_channels=os.getenv("ALERT_CHANNELS", "console"),
        enable_sms=_get_bool("ENABLE_SMS", False),
        twilio_account_sid=os.getenv("TWILIO_ACCOUNT_SID", ""),
        twilio_auth_token=os.getenv("TWILIO_AUTH_TOKEN", ""),
        twilio_from=os.getenv("TWILIO_FROM", ""),
        sms_to=os.getenv("SMS_TO", ""),
        enable_gsm=_get_bool("ENABLE_GSM", False),
        gsm_serial_port=os.getenv("GSM_SERIAL_PORT", "COM3"),
        enable_lora=_get_bool("ENABLE_LORA", False),
        lora_mqtt_broker=os.getenv("LORA_MQTT_BROKER", "localhost"),
        lora_mqtt_port=int(os.getenv("LORA_MQTT_PORT", "1883")),
        lora_topic=os.getenv("LORA_TOPIC", "wildlife/alerts"),
    )
