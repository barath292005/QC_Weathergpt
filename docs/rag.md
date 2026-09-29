# WeatherGPT RAG / Official Weather Knowledge Engine (Step 7)

## 1. Architecture Overview

The Retrieval-Augmented Generation (RAG) Engine powers WeatherGPT's grounded conversational intelligence:

```
User Query (e.g. "What should I do during a flood?")
                     ↓
         Tool & Query Classifier
  ┌──────────────────┴──────────────────┐
  │                                     │
RAG Query                          Live Engine
  │                               (Weather/Risk/Alert)
  ↓                                     │
Knowledge Retriever                     │
  ↓                                     │
Relevant Document Chunks                │
  ↓                                     │
Context Builder                         │
  ↓                                     │
Gemini 3.8 Flash / Grounded Fallback    │
  │                                     │
  └──────────────────┬──────────────────┘
                     ↓
        Grounded Answer + Official Citations
```

---

## 2. Ingestion & Authoritative Knowledge Sources

WeatherGPT ingests only verified, public domain disaster management standard operating procedures and meteorological glossary definitions:

1. **National Disaster Management Authority (NDMA)**:
   - *Guidelines on Floods & Urban Inundation* (`https://ndma.gov.in/Natural-Hazards/Floods`)
   - *Standard Operating Procedures: Cyclone Preparedness & Evacuation* (`https://ndma.gov.in/Natural-Hazards/Cyclones`)
   - *Heatwave Action Plan & Prevention Guidelines* (`https://ndma.gov.in/Natural-Hazards/Heat-Wave`)
   - *72-Hour Citizen Emergency Survival Kit Checklist* (`https://ndma.gov.in`)

2. **India Meteorological Department (IMD)**:
   - *Weather Forecasting Terminology and Rainfall Scale Criteria* (`https://mausam.imd.gov.in`)
   - *4-Stage Colour-Coded Weather Warning Matrix* (`https://mausam.imd.gov.in`)

No fake sources, arbitrary scraped web data, or unverified claims are admitted into the store.

---

## 3. Chunking & Local Document Store

- **Chunker**: Splits long-form administrative manuals into clean semantic paragraphs (approx. 1,000 to 1,200 characters).
- **Metadata Preservation**: Every chunk retains:
  - `document_id`
  - `title`
  - `organization` (e.g. NDMA, IMD)
  - `url`
  - `category` (e.g. `flood_preparedness`, `cyclone_preparedness`, `meteorological_concepts`)
- **Document Store**: In-memory tokenized TF-IDF keyword indexing with sub-token matching and title boosting.

---

## 4. Anti-Hallucination & Prompt Injection Defenses

- **Untrusted Reference Data**: All retrieved passages are framed as pure reference data within `<REFERENCE_PASSAGES>` demarcations. The LLM is explicitly forbidden from interpreting passages as instructions.
- **Strict Evidence Boundary**: If the user asks a question whose answer is not present in the retrieved passages, the engine returns:
  `"I couldn't find enough information in the configured trusted sources to answer that reliably."`
- **Official Warning Distinction**: The engine never claims system-generated risk alerts are statutory IMD warnings.

---

## 5. Tool Routing Matrix

The query classifier routes inputs to ensure users receive live telemetry when asking about current numbers and knowledge retrieval when asking about safety protocols:

| Intent | Sample Queries | Routed Engine |
|---|---|---|
| `WEATHER` | "What is the temperature now?", "Will it rain tomorrow?" | Real-Time Weather Engine |
| `CLIMATE` | "Is this rainfall unusual?", "Historical climate trend" | Historical Climate Engine |
| `RISK` | "What is the flood risk?", "Why is the risk score high?" | Impact-Based Risk Engine |
| `ALERT` | "Are there active warnings?", "What is the alert status?" | Alerts & Early Warning Engine |
| `RAG` | "What should I do during a flood?", "Cyclone safety checklist", "What does humidity mean?" | RAG Knowledge Engine + Gemini |
| `GENERAL` | "Hello", "What can WeatherGPT do?" | Core Assistant |

---

## 6. API Specifications

### `GET /api/v1/rag/search`
- Query Params: `query` (string), `top_k` (integer, default: 4)
- Response: Matching chunk texts, source organizations, and relevance scores.

### `POST /api/v1/rag/query`
- Request Body: `{"query": string, "top_k": number, "lat": number, "lon": number}`
- Response:
  ```json
  {
    "answer": "...",
    "tool_used": "RAG",
    "sources": [
      {
        "document_id": "ndma-flood-guidelines-2023",
        "title": "NDMA Disaster Management Guidelines: Flood Safety & Urban Inundation",
        "organization": "National Disaster Management Authority (NDMA)",
        "url": "https://ndma.gov.in/Natural-Hazards/Floods"
      }
    ]
  }
  ```

---

## 7. Future Vector Database Upgrade Path

The `DocumentStore` interface is decoupled from the retrieval orchestrator. Future production deployments can swap the in-memory index for:
- PostgreSQL with `pgvector`
- Vertex AI Vector Search
- Qdrant / Pinecone

without modifying the `RAGService` or API contracts.
