"""Main Agent Controller executing intent classification, tools, and grounded LLM synthesis."""

import time
from typing import Dict, Any, List, Optional
from app.services.agent.schemas import ChatRequest, ChatResponse, AgentIntent, ToolCallTrace
from app.services.agent.task_classifier import TaskClassifier
from app.services.agent.planner import AgentPlanner
from app.services.agent.tool_registry import ToolRegistry
from app.services.llm.service import LLMService

class AgentController:
    def __init__(self, tool_registry: Optional[ToolRegistry] = None, llm_service: Optional[LLMService] = None):
        self.tool_registry = tool_registry or ToolRegistry()
        self.llm_service = llm_service or LLMService()
        self._conversations: Dict[str, List[Dict[str, str]]] = {}

    async def handle_message(self, request: ChatRequest) -> ChatResponse:
        start_time = time.time()
        conv_id = request.conversation_id or "default"
        history = self._conversations.get(conv_id, [])

        intent, _ = TaskClassifier.classify(request.message, history)
        planned_steps = AgentPlanner.plan(intent, request.message, request.lat, request.lon)

        tool_calls: List[ToolCallTrace] = []
        collected_data: Dict[str, Any] = {
            "intent": intent.value,
            "location": {"latitude": request.lat, "longitude": request.lon, "name": "Selected Location"},
        }

        for step in planned_steps:
            t_name = step["tool_name"]
            params = step["params"]
            t_start = time.time()
            try:
                if self.tool_registry.is_allowed(t_name):
                    res = await self.tool_registry.execute(t_name, params)
                    collected_data[t_name] = res
                    tool_calls.append(
                        ToolCallTrace(
                            tool_name=t_name,
                            parameters=params,
                            status="success",
                            summary=f"Executed {t_name}",
                            execution_time_ms=int((time.time() - t_start) * 1000)
                        )
                    )
            except Exception as e:
                tool_calls.append(
                    ToolCallTrace(
                        tool_name=t_name,
                        parameters=params,
                        status="failed",
                        summary=str(e),
                        execution_time_ms=int((time.time() - t_start) * 1000)
                    )
                )

        llm_res = await self.llm_service.generate_explanation(
            user_message=request.message,
            context=collected_data,
            history=history
        )

        history.append({"role": "user", "content": request.message})
        history.append({"role": "assistant", "content": llm_res.text})
        self._conversations[conv_id] = history[-10:]

        return ChatResponse(
            answer=llm_res.text,
            intent=intent,
            tool_calls=tool_calls,
            sources=collected_data.get("sources", []),
            risk=collected_data.get("risk_assessment"),
            alert=collected_data.get("active_alerts"),
            weather=collected_data.get("weather_current"),
            climate=collected_data.get("climate_comparison"),
            metadata={
                "model": llm_res.model,
                "provider": llm_res.provider,
                "fallback_used": llm_res.fallback_used,
                "execution_time_ms": int((time.time() - start_time) * 1000)
            }
        )
