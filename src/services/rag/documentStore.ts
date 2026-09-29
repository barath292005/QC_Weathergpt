import type { RAGChunk, RAGSourceCitation, RAGDocument } from '../../types/rag';
import { OFFICIAL_KNOWLEDGE_DOCUMENTS } from '../../data/knowledgeBase';
import { chunkDocument } from './chunker';

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
  'is', 'are', 'was', 'were', 'it', 'this', 'that', 'what', 'how', 'when', 'where',
  'who', 'why', 'can', 'should', 'i', 'do', 'does', 'did', 'be', 'been', 'have', 'has',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

export class LocalDocumentStore {
  private chunks: RAGChunk[] = [];
  private documents: Map<string, RAGDocument> = new Map();

  constructor() {
    this.ingestOfficialDocuments(OFFICIAL_KNOWLEDGE_DOCUMENTS);
  }

  public ingestOfficialDocuments(docs: RAGDocument[]) {
    for (const doc of docs) {
      this.documents.set(doc.document_id, doc);
      const generatedChunks = chunkDocument(doc);
      this.chunks.push(...generatedChunks);
    }
  }

  public search(query: string, topK = 4): { chunk: RAGChunk; score: number }[] {
    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) return [];

    const scored = this.chunks.map((chunk) => {
      const chunkTokens = tokenize(chunk.text + ' ' + chunk.metadata.title + ' ' + chunk.metadata.category);
      const chunkTokenSet = new Set(chunkTokens);

      let directMatches = 0;
      let partialMatches = 0;

      for (const qt of queryTokens) {
        if (chunkTokenSet.has(qt)) {
          directMatches++;
        } else if (qt.length >= 4) {
          // Check root match (e.g. flood vs flooding, cyclone vs cyclonic)
          for (const ct of chunkTokenSet) {
            if (ct.startsWith(qt.slice(0, 4)) || qt.startsWith(ct.slice(0, 4))) {
              partialMatches += 0.5;
              break;
            }
          }
        }
      }

      // If no direct or significant root match at all, score is 0
      if (directMatches === 0 && partialMatches < 1.0) {
        return { chunk, score: 0 };
      }

      // Bonus for title matches
      let titleBonus = 0;
      const titleLower = chunk.metadata.title.toLowerCase();
      for (const qt of queryTokens) {
        if (titleLower.includes(qt)) {
          titleBonus += 0.5;
        }
      }

      const score = (directMatches + partialMatches + titleBonus) / Math.max(queryTokens.length, 1);
      return { chunk, score };
    });

    return scored
      .filter((item) => item.score >= 0.35)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  public getDocuments(): RAGDocument[] {
    return Array.from(this.documents.values());
  }

  public getChunks(): RAGChunk[] {
    return this.chunks;
  }
}

export const documentStore = new LocalDocumentStore();
