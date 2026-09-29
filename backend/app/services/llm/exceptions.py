"""Exceptions for LLM service."""

class LLMServiceError(Exception):
    """Base exception for LLM operations."""
    pass

class MissingAPIKeyError(LLMServiceError):
    """Raised when GEMINI_API_KEY is not configured."""
    pass

class RateLimitError(LLMServiceError):
    """Raised when provider rate limits are exceeded."""
    pass

class InvalidResponseError(LLMServiceError):
    """Raised when provider returns an empty or invalid response."""
    pass
