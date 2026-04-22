from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path


@dataclass
class AnimalProfile:
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
    file_path: str

    def to_dict(self) -> dict:
        return {
            "species_name": self.species_name,
            "scientific_name": self.scientific_name,
            "family": self.family,
            "conservation_status": self.conservation_status,
            "habitats": self.habitats,
            "regions": self.regions,
            "diet": self.diet,
            "average_lifespan_years": self.average_lifespan_years,
            "top_speed_kmh": self.top_speed_kmh,
            "facts": self.facts,
            "safety_notes": self.safety_notes,
            "aliases": self.aliases,
            "record_path": self.file_path,
        }


# Curated base profiles from multiple world regions. Missing species are auto-generated.
GLOBAL_BASE_PROFILES: dict[str, dict] = {
    "elephant": {
        "scientific_name": "Loxodonta africana / Elephas maximus",
        "family": "Elephantidae",
        "conservation_status": "Vulnerable",
        "habitats": ["Savanna", "Forest", "Grassland"],
        "regions": ["Africa", "South Asia", "Southeast Asia"],
        "diet": "Herbivore",
        "average_lifespan_years": "50-70",
        "top_speed_kmh": 40,
        "facts": ["Largest living land animals", "Use infrasound for long-distance communication"],
        "safety_notes": "Keep distance, especially from mothers with calves.",
        "aliases": ["african elephant", "asian elephant"],
    },
    "lion": {
        "scientific_name": "Panthera leo",
        "family": "Felidae",
        "conservation_status": "Vulnerable",
        "habitats": ["Savanna", "Grassland"],
        "regions": ["Sub-Saharan Africa", "India"],
        "diet": "Carnivore",
        "average_lifespan_years": "10-16",
        "top_speed_kmh": 80,
        "facts": ["Social cats living in prides", "Roars can be heard up to 8 km"],
        "safety_notes": "Do not approach on foot; maintain protected observation distance.",
        "aliases": ["african lion"],
    },
    "tiger": {
        "scientific_name": "Panthera tigris",
        "family": "Felidae",
        "conservation_status": "Endangered",
        "habitats": ["Forest", "Mangrove", "Grassland"],
        "regions": ["South Asia", "Southeast Asia", "Russian Far East"],
        "diet": "Carnivore",
        "average_lifespan_years": "10-20",
        "top_speed_kmh": 65,
        "facts": ["Each stripe pattern is unique", "Excellent swimmers"],
        "safety_notes": "Avoid dense habitat edge at dawn/dusk in tiger range.",
        "aliases": ["bengal tiger", "siberian tiger"],
    },
    "leopard": {
        "scientific_name": "Panthera pardus",
        "family": "Felidae",
        "conservation_status": "Vulnerable",
        "habitats": ["Forest", "Savanna", "Mountain"],
        "regions": ["Africa", "Middle East", "Asia"],
        "diet": "Carnivore",
        "average_lifespan_years": "12-17",
        "top_speed_kmh": 58,
        "facts": ["Highly adaptable predator", "Can drag prey into trees"],
        "safety_notes": "Do not corner or surprise; avoid moving alone at night.",
        "aliases": ["african leopard"],
    },
    "giraffe": {
        "scientific_name": "Giraffa camelopardalis",
        "family": "Giraffidae",
        "conservation_status": "Vulnerable",
        "habitats": ["Savanna", "Open woodland"],
        "regions": ["Sub-Saharan Africa"],
        "diet": "Herbivore",
        "average_lifespan_years": "20-25",
        "top_speed_kmh": 60,
        "facts": ["Tallest land animal", "Long tongues adapted for thorny acacia"],
        "safety_notes": "Respect space; defensive kicks can be dangerous.",
        "aliases": [],
    },
    "zebra": {
        "scientific_name": "Equus quagga / Equus zebra",
        "family": "Equidae",
        "conservation_status": "Near Threatened",
        "habitats": ["Savanna", "Grassland"],
        "regions": ["Eastern Africa", "Southern Africa"],
        "diet": "Herbivore",
        "average_lifespan_years": "20-25",
        "top_speed_kmh": 65,
        "facts": ["Stripe patterns are unique", "Travel in social herds"],
        "safety_notes": "Avoid close approach; they can bite and kick.",
        "aliases": [],
    },
    "bear": {
        "scientific_name": "Ursidae (family)",
        "family": "Ursidae",
        "conservation_status": "Varies by species",
        "habitats": ["Forest", "Mountain", "Arctic"],
        "regions": ["North America", "Europe", "Asia"],
        "diet": "Omnivore",
        "average_lifespan_years": "20-30",
        "top_speed_kmh": 56,
        "facts": ["Most species hibernate seasonally", "Strong sense of smell"],
        "safety_notes": "Never feed; store food securely in bear country.",
        "aliases": ["brown bear", "black bear", "polar bear"],
    },
    "wolf": {
        "scientific_name": "Canis lupus",
        "family": "Canidae",
        "conservation_status": "Least Concern",
        "habitats": ["Forest", "Tundra", "Steppe"],
        "regions": ["North America", "Europe", "Asia"],
        "diet": "Carnivore",
        "average_lifespan_years": "8-13",
        "top_speed_kmh": 60,
        "facts": ["Pack social structure", "Communicate by howl and scent"],
        "safety_notes": "Rarely dangerous to humans, but avoid habituating wildlife.",
        "aliases": ["gray wolf"],
    },
    "deer": {
        "scientific_name": "Cervidae (family)",
        "family": "Cervidae",
        "conservation_status": "Varies by species",
        "habitats": ["Forest", "Grassland", "Wetland"],
        "regions": ["Worldwide except Antarctica"],
        "diet": "Herbivore",
        "average_lifespan_years": "6-20",
        "top_speed_kmh": 80,
        "facts": ["Many species shed antlers annually", "Strong crepuscular activity"],
        "safety_notes": "Drive cautiously in deer crossing zones.",
        "aliases": ["stag", "doe"],
    },
    "boar": {
        "scientific_name": "Sus scrofa",
        "family": "Suidae",
        "conservation_status": "Least Concern",
        "habitats": ["Forest", "Scrubland", "Farmland"],
        "regions": ["Europe", "Asia", "North Africa", "Introduced globally"],
        "diet": "Omnivore",
        "average_lifespan_years": "10-14",
        "top_speed_kmh": 48,
        "facts": ["Highly adaptable omnivore", "Can cause major crop damage"],
        "safety_notes": "Give a clear escape route; avoid cornering.",
        "aliases": ["wild boar", "feral hog"],
    },
    "crocodile": {
        "scientific_name": "Crocodylidae (family)",
        "family": "Crocodylidae",
        "conservation_status": "Varies by species",
        "habitats": ["Rivers", "Wetlands", "Estuaries"],
        "regions": ["Africa", "Asia", "Australia", "Americas"],
        "diet": "Carnivore",
        "average_lifespan_years": "35-70",
        "top_speed_kmh": 17,
        "facts": ["Powerful ambush predators", "Can remain submerged for long periods"],
        "safety_notes": "Never stand at water edge in crocodile habitat.",
        "aliases": ["nile crocodile", "saltwater crocodile"],
    },
    "alligator": {
        "scientific_name": "Alligator mississippiensis / Alligator sinensis",
        "family": "Alligatoridae",
        "conservation_status": "Least Concern / Critically Endangered",
        "habitats": ["Swamps", "Marshes", "Slow rivers"],
        "regions": ["Southeastern United States", "Eastern China"],
        "diet": "Carnivore",
        "average_lifespan_years": "30-50",
        "top_speed_kmh": 18,
        "facts": ["Temperature-dependent sex determination", "Important wetland apex predator"],
        "safety_notes": "Do not feed; maintain distance from shoreline nests.",
        "aliases": [],
    },
    "camel": {
        "scientific_name": "Camelus dromedarius / Camelus bactrianus",
        "family": "Camelidae",
        "conservation_status": "Domesticated / Critically Endangered wild Bactrian",
        "habitats": ["Desert", "Semi-arid steppe"],
        "regions": ["Middle East", "North Africa", "Central Asia"],
        "diet": "Herbivore",
        "average_lifespan_years": "40-50",
        "top_speed_kmh": 65,
        "facts": ["Adapted for long water scarcity", "Humps store fat, not water"],
        "safety_notes": "Handle domesticated camels calmly; avoid startling.",
        "aliases": ["dromedary", "bactrian camel"],
    },
    "panda": {
        "scientific_name": "Ailuropoda melanoleuca",
        "family": "Ursidae",
        "conservation_status": "Vulnerable",
        "habitats": ["Temperate mountain forest"],
        "regions": ["Central China"],
        "diet": "Mostly bamboo",
        "average_lifespan_years": "20-30",
        "top_speed_kmh": 32,
        "facts": ["Specialized pseudo-thumb for bamboo", "Symbol of global conservation"],
        "safety_notes": "Avoid direct proximity in sanctuaries unless authorized.",
        "aliases": ["giant panda"],
    },
    "gorilla": {
        "scientific_name": "Gorilla gorilla / Gorilla beringei",
        "family": "Hominidae",
        "conservation_status": "Endangered / Critically Endangered",
        "habitats": ["Tropical forest", "Montane forest"],
        "regions": ["Central Africa"],
        "diet": "Herbivore",
        "average_lifespan_years": "35-45",
        "top_speed_kmh": 40,
        "facts": ["Largest living primates", "Complex social behavior"],
        "safety_notes": "Keep distance and avoid eye contact in close encounters.",
        "aliases": [],
    },
    "chimpanzee": {
        "scientific_name": "Pan troglodytes",
        "family": "Hominidae",
        "conservation_status": "Endangered",
        "habitats": ["Tropical forest", "Woodland"],
        "regions": ["Central and West Africa"],
        "diet": "Omnivore",
        "average_lifespan_years": "30-40",
        "top_speed_kmh": 40,
        "facts": ["Use tools in the wild", "High cognitive ability"],
        "safety_notes": "Do not approach; can be aggressive if threatened.",
        "aliases": [],
    },
    "otter": {
        "scientific_name": "Lutrinae (subfamily)",
        "family": "Mustelidae",
        "conservation_status": "Varies by species",
        "habitats": ["Rivers", "Coasts", "Wetlands"],
        "regions": ["North America", "Europe", "Asia", "South America", "Africa"],
        "diet": "Carnivore",
        "average_lifespan_years": "8-16",
        "top_speed_kmh": 11,
        "facts": ["Use rocks as tools", "Dense fur for insulation"],
        "safety_notes": "Observe quietly; avoid disturbing resting groups.",
        "aliases": ["river otter", "sea otter"],
    },
    "fox": {
        "scientific_name": "Vulpes vulpes and related",
        "family": "Canidae",
        "conservation_status": "Least Concern (common species)",
        "habitats": ["Forest", "Grassland", "Urban edge"],
        "regions": ["North America", "Europe", "Asia", "North Africa"],
        "diet": "Omnivore",
        "average_lifespan_years": "3-10",
        "top_speed_kmh": 50,
        "facts": ["Adapt well to urban environments", "Excellent hearing"],
        "safety_notes": "Do not feed wildlife in populated zones.",
        "aliases": ["red fox"],
    },
    "eagle": {
        "scientific_name": "Accipitridae (family)",
        "family": "Accipitridae",
        "conservation_status": "Varies by species",
        "habitats": ["Mountains", "Coasts", "Open country"],
        "regions": ["Worldwide"],
        "diet": "Carnivore",
        "average_lifespan_years": "15-30",
        "top_speed_kmh": 160,
        "facts": ["Excellent eyesight", "Many species are apex avian predators"],
        "safety_notes": "Avoid nest disturbance during breeding season.",
        "aliases": ["golden eagle", "bald eagle"],
    },
    "owl": {
        "scientific_name": "Strigiformes (order)",
        "family": "Various families",
        "conservation_status": "Varies by species",
        "habitats": ["Forest", "Grassland", "Desert"],
        "regions": ["Worldwide"],
        "diet": "Carnivore",
        "average_lifespan_years": "5-20",
        "top_speed_kmh": 80,
        "facts": ["Silent flight from specialized feathers", "Mostly nocturnal hunters"],
        "safety_notes": "Limit flashlight use near roosting owls.",
        "aliases": [],
    },
}


class AnimalKnowledgeBase:
    def __init__(self, data_dir: Path) -> None:
        self.data_dir = data_dir
        self.data_dir.mkdir(parents=True, exist_ok=True)

    def _slugify(self, species_name: str) -> str:
        slug = "".join(ch.lower() if ch.isalnum() else "-" for ch in species_name)
        while "--" in slug:
            slug = slug.replace("--", "-")
        return slug.strip("-") or "unknown-animal"

    def _profile_file(self, species_name: str) -> Path:
        return self.data_dir / f"{self._slugify(species_name)}.json"

    def _default_profile(self, species_name: str) -> dict:
        return {
            "species_name": species_name,
            "scientific_name": "Unknown",
            "family": "Unknown",
            "conservation_status": "Not evaluated",
            "habitats": ["Unknown"],
            "regions": ["Global"],
            "diet": "Unknown",
            "average_lifespan_years": "Unknown",
            "top_speed_kmh": None,
            "facts": ["Profile auto-generated from species list."],
            "safety_notes": "Observe from a safe distance.",
            "aliases": [],
        }

    def _curated_or_default(self, species_name: str) -> dict:
        key = species_name.lower().strip()
        base = GLOBAL_BASE_PROFILES.get(key)
        if base is None:
            return self._default_profile(species_name)
        merged = self._default_profile(species_name)
        merged.update(base)
        merged["species_name"] = species_name
        return merged

    def ensure_profile(self, species_name: str) -> Path:
        file_path = self._profile_file(species_name)
        if not file_path.exists():
            payload = self._curated_or_default(species_name)
            file_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        return file_path

    def bootstrap_profiles(self, species_names: list[str]) -> None:
        for species_name in species_names:
            if species_name.strip():
                self.ensure_profile(species_name.strip().lower())

    def _load_profile(self, file_path: Path) -> AnimalProfile:
        payload = json.loads(file_path.read_text(encoding="utf-8"))
        return AnimalProfile(
            species_name=payload.get("species_name", "unknown"),
            scientific_name=payload.get("scientific_name", "Unknown"),
            family=payload.get("family", "Unknown"),
            conservation_status=payload.get("conservation_status", "Not evaluated"),
            habitats=list(payload.get("habitats", ["Unknown"])),
            regions=list(payload.get("regions", ["Global"])),
            diet=payload.get("diet", "Unknown"),
            average_lifespan_years=payload.get("average_lifespan_years", "Unknown"),
            top_speed_kmh=payload.get("top_speed_kmh"),
            facts=list(payload.get("facts", [])),
            safety_notes=payload.get("safety_notes", "Observe from a safe distance."),
            aliases=list(payload.get("aliases", [])),
            file_path=str(file_path).replace("\\", "/"),
        )

    def list_profiles(self) -> list[AnimalProfile]:
        profiles: list[AnimalProfile] = []
        for file_path in sorted(self.data_dir.glob("*.json")):
            profiles.append(self._load_profile(file_path))
        return profiles

    def find_profile(self, label: str) -> AnimalProfile | None:
        query = label.strip().lower()
        if not query:
            return None

        # Fast path: exact filename/species match.
        fast_file = self._profile_file(query)
        if fast_file.exists():
            return self._load_profile(fast_file)

        best_match: AnimalProfile | None = None
        for profile in self.list_profiles():
            species = profile.species_name.lower()
            aliases = [alias.lower() for alias in profile.aliases]

            if query == species or query in aliases:
                return profile
            if query in species or species in query:
                best_match = profile
                continue
            for alias in aliases:
                if query in alias or alias in query:
                    best_match = profile
                    break

        return best_match

    def get_profile(self, species_name: str) -> AnimalProfile | None:
        """
        Convenience method for retrieving a profile by species name.
        Returns None if not found, unlike find_profile which returns best match.
        Used by intelligent alert engine for threat assessment.
        """
        if not species_name or not isinstance(species_name, str):
            return None
        return self.find_profile(species_name)

    def upsert_profile(self, payload: dict) -> AnimalProfile:
        species_name = str(payload.get("species_name", "")).strip().lower()
        if not species_name:
            raise ValueError("species_name is required")

        current_file = self._profile_file(species_name)
        base = self._curated_or_default(species_name)
        base.update(payload)
        base["species_name"] = species_name

        current_file.write_text(json.dumps(base, indent=2), encoding="utf-8")
        return self._load_profile(current_file)

    def delete_profile(self, species_name: str) -> bool:
        file_path = self._profile_file(species_name.strip().lower())
        if not file_path.exists():
            return False
        file_path.unlink()
        return True
