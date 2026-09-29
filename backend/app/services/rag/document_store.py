"""In-memory local document store and indexer."""

import re
from typing import List, Tuple, Dict
from app.services.rag.schemas import RAGDocument, RAGChunk
from app.services.rag.chunker import chunk_document
from app.services.rag.sources import OFFICIAL_SOURCES

STOP_WORDS = {
    "a", "an", "the", "and", "or", "in", "on", "at", "to", "for", "of", "with",
    "is", "are", "was", "were", "what", "how", "when", "why", "do", "should"
}

def tokenize(text: str) -> List[str]:
    cleaned = re.sub(r"[^a-zA-Z0-9\s]", " ", text.lower())
    return [w for w in cleaned.split() if len(w) > 1 and w not in STOP_WORDS]

class DocumentStore:
    def __init__(self, initial_docs: List[RAGDocument] = None):
        self.documents: Dict[str, RAGDocument] = {}
        self.chunks: List[RAGChunk] = []
        if initial_docs is None:
            initial_docs = OFFICIAL_SOURCES
        self.ingest_documents(initial_docs)

    def ingest_documents(self, docs: List[RAGDocument]) -> None:
        for doc in docs:
            self.documents[doc.document_id] = doc
            new_chunks = chunk_document(doc)
            self.chunks.extend(new_chunks)

    def search(self, query: str, top_k: int = 4) -> List[Tuple[RAGChunk, float]]:
        q_tokens = tokenize(query)
        if not q_tokens:
            return []

        results = []
        for chunk in self.chunks:
            c_tokens = set(tokenize(chunk.text + " " + chunk.metadata.title + " " + chunk.metadata.category))
            matched = sum(1 for qt in q_tokens if qt in c_tokens)
            if matched > 0:
                score = matched / len(q_tokens)
                results.append((chunk, score))

        results.sort(key=lambda x: x[1], reverse=True)
        return results[:top_k]
