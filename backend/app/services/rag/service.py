"""RAG Service orchestrator."""

from typing import List, Optional
from app.services.rag.schemas import RAGQueryResponse, RAGSourceCitation
from app.services.rag.retriever import KnowledgeRetriever
from app.services.rag.context_builder import build_context
from app.services.rag.exceptions import EmptyQueryError

class RAGService:
    def __init__(self, retriever: Optional[KnowledgeRetriever] = None, llm_client=None):
        self.retriever = retriever or KnowledgeRetriever()
        self.llm_client = llm_client

    def search(self, query: str, top_k: int = 4):
        if not query or not query.strip():
            raise EmptyQueryError("Query cannot be empty.")
        return self.retriever.retrieve(query.strip(), top_k=top_k)

    async def answer_query(self, query: str, top_k: int = 4) -> RAGQueryResponse:
        if not query or not query.strip():
            raise EmptyQueryError("Query cannot be empty.")

        results = self.search(query, top_k=top_k)
        if not results:
            return RAGQueryResponse(
                answer="I couldn't find enough information in the configured trusted sources to answer that reliably.",
                tool_used="RAG",
                sources=[],
                classification_reason="No documents met relevance threshold.",
            )

        prompt, sources = build_context(query, results)

        if self.llm_client:
            try:
                answer = await self.llm_client.generate(prompt)
                return RAGQueryResponse(answer=answer, tool_used="RAG", sources=sources)
            except Exception:
                pass

        # Grounded deterministic fallback from primary source chunk
        primary_chunk = results[0][0]
        answer = (
            f"According to official guidance from {primary_chunk.metadata.organization} "
            f"({primary_chunk.metadata.title}):\n\n{primary_chunk.text}\n\n"
            f"Official resource: {primary_chunk.metadata.url}"
        )
        return RAGQueryResponse(answer=answer, tool_used="RAG", sources=sources)
