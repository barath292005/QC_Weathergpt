export type AgentIntent =
  | 'WEATHER'
  | 'CLIMATE'
  | 'RISK'
  | 'ALERT'
  | 'RAG'
  | 'MAP'
  | 'WHAT_IF'
  | 'GENERAL';

export interface ToolCallTrace {
  tool_name: string;
  parameters: Record<string, any>;
  status: 'success' | 'failed' | 'skipped';
  summary?: string;
  execution_time_ms?: number;
}

export interface AgentChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  intent?: AgentIntent;
  tool_calls?: ToolCallTrace[];
  sources?: Array<{
    document_id: string;
    title: string;
    organization: string;
    url: string;
    category?: string;
    relevance?: number;
  }>;
}

export interface ChatMessageRequest {
  message: string;
  lat?: number;
  lon?: number;
  conversation_id?: string;
}

export interface ChatMessageResponse {
  answer: string;
  intent: AgentIntent;
  tool_calls: ToolCallTrace[];
  sources: Array<{
    document_id: string;
    title: string;
    organization: string;
    url: string;
    category?: string;
    relevance?: number;
  }>;
  risk?: any;
  alert?: any;
  weather?: any;
  climate?: any;
  metadata: {
    model: string;
    provider: string;
    conversation_id: string;
    execution_time_ms: number;
    fallback_used: boolean;
  };
}
