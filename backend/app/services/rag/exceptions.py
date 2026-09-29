"""Exceptions for WeatherGPT RAG Engine."""

class RAGServiceError(Exception):
    """Base exception for RAG operations."""
    pass

class EmptyQueryError(RAGServiceError):
    """Raised when an empty or whitespace query is submitted."""
    pass

class KnowledgeSourceUnavailableError(RAGServiceError):
    """Raised when document store or knowledge base cannot be accessed."""
    pass

class PromptInjectionDetectedError(RAGServiceError):
    """Raised when malicious prompt manipulation is detected."""
    pass
