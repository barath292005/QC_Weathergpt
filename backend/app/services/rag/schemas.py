"""Schemas for WeatherGPT RAG / Knowledge Engine."""

from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field

class RAGSourceCitation(BaseModel):
    document_id: str
    title: str
    organization: str
    url: str
    category: Optional[str] = None
    relevance: Optional[float] = None

class RAGChunkMetadata(BaseModel):
    title: str
    organization: str
    url: str
    category: str
    publication_date: Optional[str] = None

class RAGChunk(BaseModel):
    chunk_id: str
    document_id: str
    text: str
    metadata: RAGChunkMetadata

class RAGDocument(BaseModel):
    document_id: str
    title: str
    source: str
    organization: str
    url: str
    category: str
    publication_date: str
    retrieved_at: str
    content: str
    metadata: Dict[str, Any] = Field(default_factory=dict)

class RAGSearchResponse(BaseModel):
    query: str
    count: int
    results: List[Dict[str, Any]]

class RAGQueryRequest(BaseModel):
    query: str
    top_k: int = 4
    lat: Optional[float] = None
    lon: Optional[float] = None

class RAGQueryResponse(BaseModel):
    answer: str
    tool_used: str = "RAG"
    sources: List[RAGSourceCitation] = Field(default_factory=list)
    classification_reason: Optional[str] = None
