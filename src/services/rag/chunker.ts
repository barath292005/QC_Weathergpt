import type { RAGDocument, RAGChunk } from '../../types/rag';

export function chunkDocument(doc: RAGDocument, maxChunkSizeChars = 1200): RAGChunk[] {
  const paragraphs = doc.content.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const chunks: RAGChunk[] = [];
  let currentText = '';
  let chunkIndex = 0;

  for (const para of paragraphs) {
    if (currentText.length + para.length > maxChunkSizeChars && currentText.length > 0) {
      chunks.push({
        chunk_id: `${doc.document_id}-chunk-${chunkIndex++}`,
        document_id: doc.document_id,
        text: currentText.trim(),
        metadata: {
          title: doc.title,
          organization: doc.organization,
          url: doc.url,
          category: doc.category,
          publication_date: doc.publication_date,
        },
      });
      currentText = '';
    }
    currentText += (currentText ? '\n\n' : '') + para;
  }

  if (currentText.trim().length > 0) {
    chunks.push({
      chunk_id: `${doc.document_id}-chunk-${chunkIndex++}`,
      document_id: doc.document_id,
      text: currentText.trim(),
      metadata: {
        title: doc.title,
        organization: doc.organization,
        url: doc.url,
        category: doc.category,
        publication_date: doc.publication_date,
      },
    });
  }

  return chunks;
}
