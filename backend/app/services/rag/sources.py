"""Configured authoritative knowledge sources for WeatherGPT."""

from typing import List
from app.services.rag.schemas import RAGDocument

OFFICIAL_SOURCES: List[RAGDocument] = [
    RAGDocument(
        document_id="ndma-flood-guidelines-2023",
        title="NDMA Disaster Management Guidelines: Flood Safety & Urban Inundation",
        source="National Disaster Management Guidelines",
        organization="National Disaster Management Authority (NDMA)",
        url="https://ndma.gov.in/Natural-Hazards/Floods",
        category="flood_preparedness",
        publication_date="2023-04-15",
        retrieved_at="2026-09-29T00:00:00Z",
        content=(
            "BEFORE A FLOOD: Know evacuation routes and community shelter locations. "
            "Assemble an emergency survival kit containing non-perishable food, potable drinking water, torch, radio, and first aid kit. "
            "Elevate critical electrical circuit breakers above flood levels. "
            "DURING A FLOOD: Move immediately to designated higher ground. Never walk, swim, or drive through moving flood waters. "
            "Switch off main electricity breakers and gas supplies before evacuating. Do not drink untreated flood water. "
            "AFTER A FLOOD: Return home only after local authorities declare the area safe. Disinfect all items contaminated by flood water."
        ),
        metadata={"jurisdiction": "India", "hazard": "Floods"}
    ),
    RAGDocument(
        document_id="ndma-cyclone-sop-2023",
        title="NDMA Standard Operating Procedure: Cyclone Preparedness & Coastal Evacuation",
        source="NDMA Cyclone Safety Manual",
        organization="National Disaster Management Authority (NDMA)",
        url="https://ndma.gov.in/Natural-Hazards/Cyclones",
        category="cyclone_preparedness",
        publication_date="2023-05-10",
        retrieved_at="2026-09-29T00:00:00Z",
        content=(
            "PRE-CYCLONE PREPAREDNESS: Check the building roof and secure loose tiles or tin sheets. "
            "Trim overhanging tree branches close to houses and power cables. Keep battery radios tuned to IMD bulletins. "
            "Ensure mobile phones and rechargeable lamps are fully charged. Fishermen must strictly avoid venturing into the open sea. "
            "DURING CYCLONE PASSAGE: Remain indoors in the safest central room away from glass windows. "
            "If the storm suddenly subsides, DO NOT step outdoors immediately as this may be the Eye of the Cyclone."
        ),
        metadata={"jurisdiction": "India", "hazard": "Cyclones"}
    ),
    RAGDocument(
        document_id="imd-weather-terminology-2023",
        title="IMD Weather Forecasting Terminology and Rainfall Classification Criteria",
        source="IMD Meteorological Standards",
        organization="India Meteorological Department (IMD)",
        url="https://mausam.imd.gov.in",
        category="meteorological_concepts",
        publication_date="2023-01-10",
        retrieved_at="2026-09-29T00:00:00Z",
        content=(
            "IMD 24-HOUR RAINFALL CLASSIFICATION SCALE: "
            "Very Light Rain: 0.1 to 2.4 mm in 24 hours. "
            "Light Rain: 2.5 to 15.5 mm in 24 hours. "
            "Moderate Rain: 15.6 to 64.4 mm in 24 hours. "
            "Heavy Rain: 64.5 to 115.5 mm in 24 hours (triggers alert status). "
            "Very Heavy Rain: 115.6 to 204.4 mm in 24 hours. "
            "Extremely Heavy Rain: 204.5 mm or more in 24 hours. "
            "Relative Humidity is the ratio of water vapor in air relative to saturation at current temperature."
        ),
        metadata={"jurisdiction": "India", "topic": "Meteorology"}
    ),
]
