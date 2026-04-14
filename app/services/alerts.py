from __future__ import annotations

from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Alert, Detection
from app.services.notifiers import dispatcher


settings = get_settings()


def should_alert(label: str, confidence: float) -> bool:
    if confidence < settings.animal_confidence_threshold:
        return False

    if not settings.watchlist:
        return True

    lowered = label.lower()
    return any(watch in lowered for watch in settings.watchlist)


async def process_alerts(db: Session, detection: Detection) -> list[Alert]:
    if not should_alert(detection.top_label, detection.confidence):
        return []

    message = (
        f"Animal detected: {detection.top_label} "
        f"(confidence={detection.confidence:.2f}, source={detection.source})"
    )

    dispatch_results = await dispatcher.dispatch(message, settings.channels)
    alerts: list[Alert] = []

    for result in dispatch_results:
        alert = Alert(
            alert_type="animal_detection",
            message=message,
            channel=result["channel"],
            status=result["status"],
            detection_id=detection.id,
        )
        db.add(alert)
        alerts.append(alert)

    db.commit()
    for alert in alerts:
        db.refresh(alert)
    return alerts
