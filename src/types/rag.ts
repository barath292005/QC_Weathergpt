export type QueryClassification = 'WEATHER' | 'CLIMATE' | 'RISK' | 'ALERT' | 'RAG' | 'GENERAL';

export interface RAGSourceCitation {
  document_id: string;
  title: string;
  organization: string;
  url: string;
  category?: string;
  relevance?: number;
}

export interface RAGChunk {
  chunk_id: string;
  document_id: string;
  text: string;
  metadata: {
    title: string;
    organization: string;
    url: string;
    category: string;
    publication_date?: string;
  };
}

export interface RAGDocument {
  document_id: string;
  title: string;
  source: string;
  organization: string;
  url: string;
  category: string;
  publication_date: string;
  retrieved_at: string;
  content: string;
  metadata?: Record<string, any>;
}

export interface RAGQueryResponse {
  answer: string;
  tool_used: QueryClassification;
  sources: RAGSourceCitation[];
  classification_reason?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  tool_used?: QueryClassification;
  sources?: RAGSourceCitation[];
  loading?: boolean;
}
