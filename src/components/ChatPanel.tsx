import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  BookOpen,
  ExternalLink,
  ShieldCheck,
  CloudRain,
  AlertOctagon,
  HelpCircle,
  RotateCcw,
  Zap,
  MapPin,
  SlidersHorizontal,
} from 'lucide-react';
import type { AgentIntent, ChatMessageResponse, ToolCallTrace } from '../types/agent';
import { getApiBaseUrl } from '../utils/api';

interface ChatPanelProps {
  lat?: number;
  lon?: number;
}

interface MessageItem {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
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
  metadata?: {
    model?: string;
    provider?: string;
    fallback_used?: boolean;
    execution_time_ms?: number;
  };
}

const INTENT_BADGES: Record<
  AgentIntent,
  { label: string; badge: string; icon: React.ReactNode }
> = {
  WEATHER: {
    label: 'Live Weather',
    badge: 'bg-cyan-950/80 text-cyan-300 border-cyan-700/60',
    icon: <CloudRain className="w-3 h-3 text-cyan-400" />,
  },
  CLIMATE: {
    label: 'Climate Baseline',
    badge: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60',
    icon: <ShieldCheck className="w-3 h-3 text-emerald-400" />,
  },
  RISK: {
    label: 'Impact Risk',
    badge: 'bg-orange-950/80 text-orange-300 border-orange-700/60',
    icon: <AlertOctagon className="w-3 h-3 text-orange-400" />,
  },
  ALERT: {
    label: 'Early Warning',
    badge: 'bg-amber-950/80 text-amber-300 border-amber-700/60',
    icon: <Sparkles className="w-3 h-3 text-amber-400" />,
  },
  RAG: {
    label: 'Grounded SOPs',
    badge: 'bg-indigo-950/80 text-indigo-300 border-indigo-700/60',
    icon: <BookOpen className="w-3 h-3 text-indigo-400" />,
  },
  WHAT_IF: {
    label: 'What-If Simulation',
    badge: 'bg-purple-950/80 text-purple-300 border-purple-700/60',
    icon: <SlidersHorizontal className="w-3 h-3 text-purple-400" />,
  },
  MAP: {
    label: 'Geospatial Context',
    badge: 'bg-teal-950/80 text-teal-300 border-teal-700/60',
    icon: <MapPin className="w-3 h-3 text-teal-400" />,
  },
  GENERAL: {
    label: 'Conversational Agent',
    badge: 'bg-slate-800 text-slate-300 border-slate-700',
    icon: <HelpCircle className="w-3 h-3 text-slate-400" />,
  },
};

const SUGGESTED_QUERIES = [
  "What's the weather now?",
  'Will it rain tomorrow?',
  'Is there flood risk?',
  'Why is the risk high?',
  'What should I do during flooding?',
  'Are there active alerts?',
  'What happens if rainfall reaches 60 mm?',
];

export const ChatPanel: React.FC<ChatPanelProps> = ({ lat = 12.8342, lon = 79.7036 }) => {
  const [conversationId] = useState<string>(() => `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
  const [messages, setMessages] = useState<MessageItem[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: 'Hello, I am WeatherGPT — your Gemini-powered weather impact intelligence assistant. Ask me about real-time weather telemetry, flood impact risks, early-warning alerts, or official NDMA/IMD disaster safety protocols.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      intent: 'GENERAL',
      metadata: {
        model: 'gemini-3.8-flash',
        provider: 'gemini',
      },
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputValue).trim();
    if (!query || loading) return;

    const userMessage: MessageItem = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setLoading(true);

    try {
      const apiBaseUrl = getApiBaseUrl();
      const response = await fetch(`${apiBaseUrl}/api/v1/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          lat,
          lon,
          conversation_id: conversationId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Chat API error! Status ${response.status}`);
      }

      const data: ChatMessageResponse = await response.json();

      const assistantMessage: MessageItem = {
        id: `assistant-${Date.now()}`,
        sender: 'assistant',
        text: data.answer,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        intent: data.intent,
        tool_calls: data.tool_calls,
        sources: data.sources,
        metadata: data.metadata,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error('Conversational agent error:', err);
      const errorMessage: MessageItem = {
        id: `error-${Date.now()}`,
        sender: 'assistant',
        text: "I couldn't process your request right now. Please verify your connection or try another query.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        intent: 'GENERAL',
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleResetChat = () => {
    setMessages([
      {
        id: 'welcome',
        sender: 'assistant',
        text: 'Conversation history reset. How can I assist you with meteorological telemetry, risk assessments, or disaster protocols?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        intent: 'GENERAL',
      },
    ]);
  };

  return (
    <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-xl p-5 shadow-sm space-y-4 h-full flex flex-col min-h-[580px]">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-1.5 bg-indigo-950 border border-indigo-500/30 rounded-lg text-indigo-400">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base font-semibold text-slate-100">WeatherGPT Conversational Agent</h3>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center space-x-1">
                <Zap className="w-2.5 h-2.5" />
                <span>Step 8 • Gemini</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Intent Planner, Multi-Tool Execution & Grounded Explanations</p>
          </div>
        </div>

        <button
          onClick={handleResetChat}
          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded-lg border border-slate-700 text-xs transition"
          title="Reset conversation session"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 bg-slate-950/70 p-4 rounded-xl border border-slate-800/80 overflow-y-auto space-y-3.5 max-h-[460px]">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          const intentBadge = msg.intent ? INTENT_BADGES[msg.intent] : null;

          return (
            <div
              key={msg.id}
              className={`flex items-start space-x-2.5 ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}
            >
              {/* Avatar Icon */}
              <div
                className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                  isUser
                    ? 'bg-cyan-950 border border-cyan-700/60 text-cyan-300'
                    : 'bg-indigo-950 border border-indigo-700/60 text-indigo-300'
                }`}
              >
                {isUser ? <Sparkles className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              {/* Message Bubble */}
              <div
                className={`max-w-[88%] p-3.5 rounded-2xl text-xs space-y-2 leading-relaxed ${
                  isUser
                    ? 'bg-cyan-950/60 border border-cyan-800/50 text-cyan-100 rounded-tr-none'
                    : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none'
                }`}
              >
                {/* Assistant Intent Badge & Tools Trace */}
                {!isUser && (
                  <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-slate-800/80 pb-1.5 mb-1.5">
                    <span className="font-semibold text-indigo-400 flex items-center space-x-1">
                      <span>WeatherGPT Agent</span>
                    </span>
                    <div className="flex items-center space-x-1.5">
                      {intentBadge && (
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono border flex items-center space-x-1 ${intentBadge.badge}`}>
                          {intentBadge.icon}
                          <span>{intentBadge.label}</span>
                        </span>
                      )}
                      {msg.metadata?.model && (
                        <span className="text-[9px] font-mono text-slate-500 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                          {msg.metadata.model}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Tool Calls Trace */}
                {!isUser && msg.tool_calls && msg.tool_calls.length > 0 && (
                  <div className="bg-slate-950/70 px-2.5 py-1.5 rounded border border-slate-800/80 text-[10px] font-mono text-slate-400 flex flex-wrap items-center gap-1.5">
                    <span className="text-slate-500">Tools executed:</span>
                    {msg.tool_calls.map((t, idx) => (
                      <span
                        key={idx}
                        className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700/60 text-cyan-300"
                        title={t.summary}
                      >
                        {t.tool_name} ({t.execution_time_ms}ms)
                      </span>
                    ))}
                  </div>
                )}

                {/* Body Text */}
                <div className="whitespace-pre-wrap">{msg.text}</div>

                {/* Source Citations */}
                {!isUser && msg.sources && msg.sources.length > 0 && (
                  <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
                      <span className="flex items-center space-x-1">
                        <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Trusted Source Citations</span>
                      </span>
                      <span className="font-mono text-[10px] text-slate-500">
                        {msg.sources.length} {msg.sources.length === 1 ? 'Citation' : 'Citations'}
                      </span>
                    </div>

                    <div className="space-y-1">
                      {msg.sources.map((src, idx) => (
                        <div
                          key={idx}
                          className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/60 flex items-start justify-between gap-2 text-[11px]"
                        >
                          <div className="space-y-0.5">
                            <div className="font-medium text-slate-200">{src.title}</div>
                            <div className="text-[10px] text-indigo-400 font-mono">
                              Authoritative Body: {src.organization}
                            </div>
                          </div>
                          <a
                            href={src.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cyan-400 hover:text-cyan-300 p-1 shrink-0 transition"
                            title={`Open source: ${src.url}`}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Timestamp */}
                <div className="text-[10px] text-slate-500 text-right font-mono">{msg.timestamp}</div>
              </div>
            </div>
          );
        })}

        {/* Loading Indicator */}
        {loading && (
          <div className="flex items-start space-x-2.5">
            <div className="p-1.5 rounded-lg bg-indigo-950 border border-indigo-700/60 text-indigo-300 shrink-0 mt-0.5">
              <Bot className="w-4 h-4 animate-spin" />
            </div>
            <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl rounded-tl-none text-xs text-slate-400 flex items-center space-x-2">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
              <span>Analyzing intent, executing domain tools, and synthesizing grounded answer...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Query Chips */}
      <div className="space-y-1.5">
        <div className="text-[10px] uppercase tracking-wide font-semibold text-slate-400">
          Suggested Inquiries:
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTED_QUERIES.map((sq, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(sq)}
              disabled={loading}
              className="text-[11px] px-2.5 py-1 rounded-md bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 border border-slate-800 hover:border-cyan-800/60 transition text-left truncate max-w-full"
            >
              {sq}
            </button>
          ))}
        </div>
      </div>

      {/* Input Prompt Box */}
      <div className="relative flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            placeholder="Ask WeatherGPT: 'Is there flood risk?', 'What should I do during flooding?'..."
            className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-4 pr-10 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
          />
        </div>
        <button
          onClick={() => handleSendMessage()}
          disabled={loading || !inputValue.trim()}
          className="p-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white disabled:text-slate-500 rounded-lg font-medium transition shrink-0 cursor-pointer disabled:cursor-not-allowed"
          title="Send query"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
