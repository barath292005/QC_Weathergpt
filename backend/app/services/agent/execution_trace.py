"""Execution trace tracker for auditability."""

import time
from typing import Dict, Any, Optional
from app.services.agent.schemas import ToolCallTrace

class ExecutionTraceLogger:
    @staticmethod
    def start_trace(tool_name: str, params: Dict[str, Any]) -> Tuple[float, ToolCallTrace]:
        start = time.time()
        trace = ToolCallTrace(
            tool_name=tool_name,
            parameters=params,
            status="pending",
            summary=f"Invoked {tool_name}",
            execution_time_ms=0
        )
        return start, trace

    @staticmethod
    def finish_trace(start_time: float, trace: ToolCallTrace, status: str = "success", summary: Optional[str] = None) -> ToolCallTrace:
        duration_ms = int((time.time() - start_time) * 1000)
        trace.status = status
        trace.execution_time_ms = duration_ms
        if summary:
            trace.summary = summary
        return trace
