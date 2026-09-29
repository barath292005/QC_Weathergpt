"""Tool registry enforcing controlled allowlist."""

from typing import Dict, Any, Callable, Awaitable, Optional
from app.services.agent.schemas import ToolCallTrace

class ToolRegistry:
    def __init__(self):
        self._tools: Dict[str, Dict[str, Any]] = {}

    def register(self, name: str, description: str, handler: Callable[..., Awaitable[Any]]) -> None:
        self._tools[name] = {
            "name": name,
            "description": description,
            "handler": handler,
        }

    def is_allowed(self, name: str) -> bool:
        return name in self._tools

    async def execute(self, name: str, params: Dict[str, Any]) -> Any:
        if name not in self._tools:
            raise ValueError(f"Tool '{name}' is not in the registered allowlist.")
        handler = self._tools[name]["handler"]
        return await handler(**params)
