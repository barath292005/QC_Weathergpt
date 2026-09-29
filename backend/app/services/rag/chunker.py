"""Document chunking utility for WeatherGPT RAG."""

from typing import List
from app.services.rag.schemas import RAGDocument, RAGChunk, RAGChunkMetadata

def chunk_document(doc: RAGDocument, max_chunk_chars: int = 1000) -> List[RAGChunk]:
    """Splits a document into semantic chunks while preserving source metadata."""
    sentences = doc.content.split(". ")
    chunks: List[RAGChunk] = []
    current_text = ""
    chunk_index = 0

    for sent in sentences:
        if len(current_text) + len(sent) > max_chunk_chars and current_text:
            chunks.append(
                RAGChunk(
                    chunk_id=f"{doc.document_id}-chunk-{chunk_index}",
                    document_id=doc.document_id,
                    text=current_text.strip(),
                    metadata=RAGChunkMetadata(
                        title=doc.title,
                        organization=doc.organization,
                        url=doc.url,
                        category=doc.category,
                        publication_date=doc.publication_date,
                    ),
                )
            )
            chunk_index += 1
            current_text = ""
        current_text += (sent + ". ").strip() + " "

    if current_text.strip():
        chunks.append(
            RAGChunk(
                chunk_id=f"{doc.document_id}-chunk-{chunk_index}",
                document_id=doc.document_id,
                text=current_text.strip(),
                metadata=RAGChunkMetadata(
                    title=doc.title,
                    organization=doc.organization,
                    url=doc.url,
                    category=doc.category,
                    publication_date=doc.publication_date,
                ),
            )
        )

    return chunks
