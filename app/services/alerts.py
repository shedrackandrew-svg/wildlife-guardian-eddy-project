"""
Smart alert processing for Wild Guard.

Integrates with the intelligence engine to make human-like
alert decisions based on threat level, patterns, and context.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Alert, Detection
from app.services.notifiers import dispatcher
from app.animal_knowledge import AnimalKnowledgeBase
from app.intelligence import AlertIntelligence, DataEnricher


settings = get_settings()


async def process_alerts(db: Session, detection: Detection) -> list[Alert]:
    """
    Process detection with intelligent, human-like alert logic.
    Uses pattern recognition, threat assessment, and contextual decision-making
    to avoid alert fatigue while catching important events.
    
    This system thinks like a conservation expert:
    - Recognizes routine sightings vs. anomalies
    - Considers threat level and conservation status
    - Deduplicates nearby detections in time
    - Prioritizes watchlist items
    - Enriches alerts with contextual information
    """
    # Initialize knowledge base for this processing
    knowledge_base = AnimalKnowledgeBase(settings.animal_knowledge_path)
    
    # Use the integrated intelligence system
    intelligence = AlertIntelligence(db, knowledge_base)
    
    # Get alert priority using full contextual analysis
    priority = intelligence.get_alert_priority(detection)
    
    # Suppress or don't create alert if below threshold
    if priority == "SUPPRESS":
        return []
    
    # Create intelligent, context-aware message
    message = DataEnricher.create_intelligent_alert_message(db, knowledge_base, detection)
    
    # Dispatch alert
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

