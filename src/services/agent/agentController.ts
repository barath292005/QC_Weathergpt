import type {
  ChatMessageRequest,
  ChatMessageResponse,
  AgentIntent,
  ToolCallTrace,
} from '../../types/agent';
import { TaskClassifier } from './taskClassifier';
import { AgentPlanner } from './planner';
import { toolRegistry } from './toolRegistry';
import { conversationMemory } from './conversationMemory';
import { llmService } from '../llm/llmService';
import type { StructuredToolContext } from '../llm/promptBuilder';

export class AgentController {
  public async handleMessage(
    request: ChatMessageRequest,
    context: { apiBaseUrl: string }
  ): Promise<ChatMessageResponse> {
    const startTime = Date.now();
    const conversationId = request.conversation_id || 'default_session';
    const lat = request.lat ?? 12.8342;
    const lon = request.lon ?? 79.7036;

    // 1. Retrieve history
    const history = conversationMemory.getHistory(conversationId);

    // 2. Classify intent
    const { intent, reason } = TaskClassifier.classify(request.message, history);

    // 3. Plan tool steps
    const plannedSteps = AgentPlanner.plan(intent, request.message, lat, lon);

    // 4. Execute tools
    const toolTraces: ToolCallTrace[] = [];
    const toolResults: Record<string, any> = {};

    for (const step of plannedSteps) {
      const { result, trace } = await toolRegistry.executeTool(
        step.toolName,
        step.params,
        { apiBaseUrl: context.apiBaseUrl, lat, lon }
      );
      toolTraces.push(trace);
      toolResults[step.toolName] = result;
    }

    // 5. Build structured tool context
    const structuredContext: StructuredToolContext = {
      intent,
      location: {
        latitude: lat,
        longitude: lon,
        name: toolResults.weather_current?.location?.timezone || 'Selected Area',
      },
      weather: toolResults.weather_current || null,
      climate: toolResults.climate_comparison ? { comparison: toolResults.climate_comparison } : null,
      risk: toolResults.risk_assessment || null,
      alerts: toolResults.active_alerts?.alerts || (toolResults.active_alerts?.active_alert ? [toolResults.active_alerts.active_alert] : []),
      sources: toolResults.knowledge_search || [],
      what_if: toolResults.what_if_simulation || null,
      history,
    };

    // 6. Generate grounded response via Gemini (with fallback)
    const { text, model, provider, fallback_used } = await llmService.generateExplanation(
      request.message,
      structuredContext
    );

    // 7. Extract citations if RAG sources were returned
    const sources = (structuredContext.sources || []).map((s: any) => ({
      document_id: s.document_id,
      title: s.title,
      organization: s.organization,
      url: s.url,
      category: s.category,
      relevance: s.relevance,
    }));

    // 8. Update conversation memory
    conversationMemory.addMessage(conversationId, {
      id: `user-${Date.now()}`,
      role: 'user',
      content: request.message,
      timestamp: new Date().toISOString(),
    });

    conversationMemory.addMessage(conversationId, {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: text,
      timestamp: new Date().toISOString(),
      intent,
      tool_calls: toolTraces,
      sources,
    });

    const executionTimeMs = Date.now() - startTime;

    return {
      answer: text,
      intent,
      tool_calls: toolTraces,
      sources,
      risk: structuredContext.risk,
      alert: structuredContext.alerts?.[0] || null,
      weather: structuredContext.weather,
      climate: structuredContext.climate,
      metadata: {
        model,
        provider,
        conversation_id: conversationId,
        execution_time_ms: executionTimeMs,
        fallback_used,
      },
    };
  }
}

export const agentController = new AgentController();
