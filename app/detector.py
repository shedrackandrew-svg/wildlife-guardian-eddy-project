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

        candidates = [c.strip().lower() for c in (labels or self.load_species_labels()) if c.strip()]
        if "animal" not in candidates:
            candidates.append("animal")

        non_animal_sentinels = [
            "person",
            "human",
            "clothing",
            "vehicle",
            "building",
            "furniture",
            "phone",
            "computer",
        ]

        # Short prompt engineering significantly improves CLIP-style matching for wildlife.
        prompted_candidates: list[str] = []
        for item in candidates:
            prompted_candidates.append(f"a wildlife photo of a {item}")
            prompted_candidates.append(f"a camera trap image of a {item}")

        for item in non_animal_sentinels:
            prompted_candidates.append(f"a photo of a {item}")

        def _normalize_label(raw: str) -> str:
            text = raw.lower().strip()
            prefixes = [
                "a wildlife photo of a ",
                "a camera trap image of a ",
                "a photo of a ",
                "image of ",
            ]
            for prefix in prefixes:
                if text.startswith(prefix):
                    text = text[len(prefix) :]
            return text.strip()

        if self._pipeline is None:
            # Safe fallback when heavy ML packages are not installed.
            fallback_label = candidates[0].lower() if candidates else "animal"
            return {
                "label": fallback_label,
                "confidence": 0.35,
                "scores": [{"label": fallback_label, "score": 0.35}],
            }

        results = self._pipeline(image, candidate_labels=prompted_candidates)

        aggregated: dict[str, float] = {}
        for item in results:
            label = _normalize_label(str(item["label"]))
            score = float(item["score"])
            previous = aggregated.get(label, 0.0)
            if score > previous:
                aggregated[label] = score

        sentinel_scores = {key: float(aggregated.get(key, 0.0)) for key in non_animal_sentinels}
        non_animal_best = max(sentinel_scores.values()) if sentinel_scores else 0.0

        for sentinel in non_animal_sentinels:
            aggregated.pop(sentinel, None)

        ranked = sorted(aggregated.items(), key=lambda x: x[1], reverse=True)
        if not ranked:
            ranked = [("animal", 0.35)]

        top_label, top_score = ranked[0]
        second_score = ranked[1][1] if len(ranked) > 1 else 0.0
        required_confidence = max(0.3, self.settings.animal_confidence_threshold)
        min_gap = max(0.04, self.settings.detection_min_score_gap)

        # Reject likely non-animal scenes and weak confidence predictions.
        if (
            non_animal_best >= top_score + 0.05
            or top_score < required_confidence
            or (second_score > 0 and (top_score - second_score) < min_gap and top_score < 0.6)
        ):
            return {
                "label": "no_animal_detected",
                "confidence": max(non_animal_best, top_score),
                "scores": [
                    {"label": "no_animal_detected", "score": max(non_animal_best, top_score)},
                    {"label": top_label, "score": top_score},
                ],
            }

        # Reduce frequent domestic-animal confusion when big cats score very close.
        if len(ranked) > 1 and ranked[0][0] in {"dog", "cat"}:
            for label, score in ranked[1:4]:
                if label in {"lion", "tiger", "leopard", "cheetah"} and score >= ranked[0][1] - 0.05:
                    ranked.insert(0, (label, score + 1e-6))
                    break

        confusion_pairs = {
            "monkey": {"person", "human"},
            "snake": {"clothing"},
        }
        top_label, top_score = ranked[0]
        blocked = confusion_pairs.get(top_label)
        if blocked:
            blocker = max((sentinel_scores.get(item, 0.0) for item in blocked), default=0.0)
            if blocker >= top_score + 0.04:
                return {
                    "label": "no_animal_detected",
                    "confidence": blocker,
                    "scores": [{"label": "no_animal_detected", "score": blocker}],
                }

        top = ranked[0]
        return {
            "label": top[0],
            "confidence": top[1],
            "scores": [
                {"label": label, "score": score}
                for label, score in ranked[: self.settings.detection_top_k]
            ],
        }


detector = OpenVocabularyAnimalDetector()
