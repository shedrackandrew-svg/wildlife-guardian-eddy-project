from __future__ import annotations

from pathlib import Path
from threading import Lock
from typing import Any

from PIL import Image

from app.config import get_settings


class OpenVocabularyAnimalDetector:
    def __init__(self) -> None:
        self.settings = get_settings()
        self._pipeline = None
        self._lock = Lock()

    def _load_pipeline(self) -> None:
        with self._lock:
            if self._pipeline is None:
                try:
                    from transformers import pipeline

                    self._pipeline = pipeline(
                        task="zero-shot-image-classification",
                        model=self.settings.model_name,
                    )
                except Exception:
                    self._pipeline = None

    def load_species_labels(self) -> list[str]:
        labels_file = self.settings.species_labels_path
        if not labels_file.exists():
            labels_file.parent.mkdir(parents=True, exist_ok=True)
            labels_file.write_text("elephant\ncow\ngoat\nsheep\ndog\ncat\nhorse\nbuffalo\ndeer\nboar\n", encoding="utf-8")

        labels: list[str] = []
        for line in labels_file.read_text(encoding="utf-8").splitlines():
            label = line.strip()
            if label and not label.startswith("#"):
                labels.append(label)
        return labels

    def predict(self, image: Image.Image, labels: list[str] | None = None) -> dict[str, Any]:
        if self._pipeline is None:
            self._load_pipeline()

        candidates = labels or self.load_species_labels()
        if "animal" not in candidates:
            candidates.append("animal")

        if self._pipeline is None:
            # Safe fallback when heavy ML packages are not installed.
            fallback_label = candidates[0].lower() if candidates else "animal"
            return {
                "label": fallback_label,
                "confidence": 0.35,
                "scores": [{"label": fallback_label, "score": 0.35}],
            }

        results = self._pipeline(image, candidate_labels=candidates)
        top = results[0]
        return {
            "label": str(top["label"]).lower(),
            "confidence": float(top["score"]),
            "scores": [
                {"label": str(item["label"]).lower(), "score": float(item["score"])}
                for item in results[: self.settings.detection_top_k]
            ],
        }


detector = OpenVocabularyAnimalDetector()
