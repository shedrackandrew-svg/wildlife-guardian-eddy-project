"""
Integrated Intelligence Engine for Wild Guard.

Provides human-like decision-making across:
- Pattern recognition from historical data
- Threat assessment based on animal behavior
- Contextual alert filtering
- Data enrichment and analysis
- Conservation-aware alerting

This module makes the system behave intelligently, not robotically.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from app.animal_knowledge import AnimalKnowledgeBase, AnimalProfile
from app.config import get_settings
from app.models import Alert, Detection, AnimalInventory


settings = get_settings()


class ThreatAssessment:
    """
    Evaluates threat level of animal detection with context.
    Humans don't treat every animal the same - context matters.
    """
    
    # Threat multipliers by diet type
    DIET_THREAT_MULTIPLIERS = {
        "carnivore": 1.4,
        "apex predator": 1.5,
        "omnivore": 1.1,
        "herbivore": 0.8,
        "insectivore": 0.7,
        "frugivore": 0.8,
    }
    
    # Conservation protection reduces alerting (endangered species)
    CONSERVATION_MULTIPLIERS = {
        "extinct": 0.0,
        "extinct in the wild": 0.0,
        "critically endangered": 0.7,
        "endangered": 0.8,
        "vulnerable": 0.9,
        "near threatened": 0.95,
        "least concern": 0.9,
        "not evaluated": 1.0,
    }
    
    # Size-based threat factors
    SIZE_INDICATORS = {
        "largest": 1.3,
        "large": 1.2,
        "big": 1.15,
        "giant": 1.4,
        "tiny": 0.5,
        "small": 0.8,
    }
    
    @staticmethod
    def calculate(profile: AnimalProfile | None, confidence: float) -> float:
        """
        Calculate threat score 0-1 based on animal characteristics.
        Higher = more threatening.
        """
        if not profile or confidence < 0.3:
            return 0.0
        
        score = confidence
        
        # Diet-based threat
        diet_lower = profile.diet.lower()
        for diet_type, multiplier in ThreatAssessment.DIET_THREAT_MULTIPLIERS.items():
            if diet_type in diet_lower:
                score *= multiplier
                break
        
        # Conservation status (ethical consideration)
        status_lower = profile.conservation_status.lower()
        for status, multiplier in ThreatAssessment.CONSERVATION_MULTIPLIERS.items():
            if status in status_lower:
                score *= multiplier
                break
        
        # Size from facts
        facts_text = " ".join(profile.facts).lower()
        for size_word, multiplier in ThreatAssessment.SIZE_INDICATORS.items():
            if size_word in facts_text:
                score *= multiplier
                break
        
        # Apex predator boost
        if "apex" in facts_text:
            score *= 1.15
        
        # Speed indicator
        if profile.top_speed_kmh and profile.top_speed_kmh > 60:
            score *= 1.1
        
        return min(score, 1.0)


class PatternAnalyzer:
    """
    Analyzes historical detection patterns to provide context.
    Humans notice patterns - this helps avoid alert fatigue.
    """
    
    def __init__(self, db: Session):
        self.db = db
        self.lookback_days = 30
    
    def get_species_history(self, species: str) -> dict[str, Any]:
        """Get historical sighting data for this species."""
        now = datetime.utcnow()
        lookback = now - timedelta(days=self.lookback_days)
        
        # Count by time period
        detections = self.db.query(Detection).filter(
            and_(
                Detection.top_label == species,
                Detection.created_at >= lookback,
            )
        ).all()
        
        today_count = sum(1 for d in detections 
                         if d.created_at > now - timedelta(hours=24))
        week_count = sum(1 for d in detections 
                        if d.created_at > now - timedelta(days=7))
        
        # Time-of-day patterns
        hour_counts = {}
        for detection in detections:
            hour = detection.created_at.hour
            hour_counts[hour] = hour_counts.get(hour, 0) + 1
        
        peak_hour = max(hour_counts, key=hour_counts.get) if hour_counts else None
        
        # Confidence trend
        recent_scores = [d.confidence for d in detections[-10:]]
        avg_confidence = sum(recent_scores) / len(recent_scores) if recent_scores else 0
        
        return {
            "total_sightings": len(detections),
            "sightings_today": today_count,
            "sightings_week": week_count,
            "is_routine": week_count >= 5,
            "peak_hour": peak_hour,
            "avg_confidence": avg_confidence,
            "last_sighting": max((d.created_at for d in detections), default=None),
        }
    
    def is_new_sighting(self, species: str) -> bool:
        """Is this a new species for the area?"""
        history = self.get_species_history(species)
        return history["total_sightings"] == 0
    
    def is_routine_sighting(self, species: str) -> bool:
        """Is this a routine, expected sighting?"""
        history = self.get_species_history(species)
        return history["is_routine"] and history["sightings_today"] > 2


class AlertIntelligence:
    """
    Determines whether a detection warrants an alert using full context.
    This prevents alert fatigue from routine sightings while catching important events.
    """
    
    def __init__(self, db: Session, kb: AnimalKnowledgeBase):
        self.db = db
        self.kb = kb
        self.analyzer = PatternAnalyzer(db)
    
    def should_suppress_as_duplicate(self, detection: Detection, window_minutes: int = 15) -> bool:
        """
        Suppress if another recent high-confidence detection exists.
        Prevents alerting on same animal standing still for photos.
        """
        cutoff = detection.created_at - timedelta(minutes=window_minutes)
        
        recent = self.db.query(Detection).filter(
            and_(
                Detection.source == detection.source,
                Detection.top_label == detection.top_label,
                Detection.created_at >= cutoff,
                Detection.created_at < detection.created_at,
            )
        ).order_by(Detection.created_at.desc()).first()
        
        if not recent:
            return False
        
        # Same confidence within margin = same animal
        return abs(detection.confidence - recent.confidence) < 0.15
    
    def get_alert_priority(self, detection: Detection) -> str:
        """Determine alert priority: CRITICAL, HIGH, MEDIUM, LOW, SUPPRESS."""
        profile = self.kb.find_profile(detection.top_label)
        threat_score = ThreatAssessment.calculate(profile, detection.confidence)
        
        # Step 1: Check deduplication
        if self.should_suppress_as_duplicate(detection):
            return "SUPPRESS"
        
        # Step 2: Confidence threshold
        if detection.confidence < settings.animal_confidence_threshold:
            return "SUPPRESS"
        
        # Step 3: Watchlist priority
        on_watchlist = False
        if settings.watchlist:
            lowered = detection.top_label.lower()
            on_watchlist = any(w in lowered for w in settings.watchlist)
        
        if on_watchlist:
            return "CRITICAL" if threat_score > 0.6 else "HIGH"
        
        # Step 4: Threat-based logic
        if threat_score > 0.85:
            return "CRITICAL"
        elif threat_score > 0.70:
            return "HIGH"
        elif threat_score > 0.50:
            return "MEDIUM"
        elif threat_score > 0.35 and self.analyzer.is_new_sighting(detection.top_label):
            return "MEDIUM"  # First time seeing this species = notable
        else:
            return "LOW"
        
    def should_create_alert(self, detection: Detection) -> bool:
        """Should we actually create an alert for this detection?"""
        priority = self.get_alert_priority(detection)
        return priority in ("CRITICAL", "HIGH", "MEDIUM")


class DataEnricher:
    """
    Adds context and insights to detections and alerts.
    Makes data more useful for humans analyzing the system.
    """
    
    @staticmethod
    def enrich_detection_context(db: Session, kb: AnimalKnowledgeBase, 
                                detection: Detection) -> dict[str, Any]:
        """Add rich context to a detection."""
        profile = kb.find_profile(detection.top_label)
        analyzer = PatternAnalyzer(db)
        threat = ThreatAssessment.calculate(profile, detection.confidence)
        history = analyzer.get_species_history(detection.top_label)
        
        return {
            "species": detection.top_label,
            "confidence": detection.confidence,
            "threat_level": threat,
            "is_new_species": analyzer.is_new_sighting(detection.top_label),
            "is_routine": analyzer.is_routine_sighting(detection.top_label),
            "historical_context": history,
            "profile": profile.to_dict() if profile else None,
        }
    
    @staticmethod
    def create_intelligent_alert_message(db: Session, kb: AnimalKnowledgeBase,
                                        detection: Detection) -> str:
        """Create a human-readable, context-aware alert message."""
        profile = kb.find_profile(detection.top_label)
        threat = ThreatAssessment.calculate(profile, detection.confidence)
        analyzer = PatternAnalyzer(db)
        history = analyzer.get_species_history(detection.top_label)
        
        # Build message components
        parts = []
        
        # Priority indicator
        if threat > 0.70:
            parts.append("🚨")
        elif threat > 0.50:
            parts.append("⚠️")
        else:
            parts.append("ℹ️")
        
        # Species name
        parts.append(f"{detection.top_label.title()}")
        
        # If predator, add warning
        if profile and "carnivore" in profile.diet.lower():
            parts.append("(Predator)")
        
        # Frequency context
        if history["is_routine"]:
            parts.append(f"Routine sighting (#{history['sightings_week']} this week)")
        elif history["sightings_today"] > 0:
            parts.append(f"Seen {history['sightings_today']}x today")
        elif analyzer.is_new_sighting(detection.top_label):
            parts.append("🆕 NEW SPECIES")
        
        # Confidence and source
        parts.append(f"[{detection.confidence:.0%}] via {detection.source}")
        
        # Safety tip if dangerous
        if profile and threat > 0.60 and "carnivore" in profile.diet.lower():
            parts.append(f"\nSafety: {profile.safety_notes}")
        
        return " ".join(parts)
