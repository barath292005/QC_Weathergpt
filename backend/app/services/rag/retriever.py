"""Retrieval component for RAG pipeline."""

from typing import List, Tuple
from app.services.rag.schemas import RAGChunk
from app.services.rag.document_store import DocumentStore

class KnowledgeRetriever:
    def __init__(self, store: DocumentStore = None):
        self.store = store or DocumentStore()

    def retrieve(self, query: str, top_k: int = 4) -> List[Tuple[RAGChunk, float]]:
        """Retrieve most relevant chunks with source metadata and relevance score."""
        return self.store.search(query, top_k=top_k)
