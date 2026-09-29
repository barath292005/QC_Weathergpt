import type { AgentChatMessage } from '../../types/agent';

export class ConversationMemory {
  private sessions = new Map<string, { messages: AgentChatMessage[]; lastActive: number }>();
  private readonly maxMessagesPerSession = 10;
  private readonly sessionTtlMs = 3600 * 1000; // 1 hour

  public getHistory(conversationId: string): AgentChatMessage[] {
    this.cleanExpiredSessions();
    const session = this.sessions.get(conversationId);
    return session ? [...session.messages] : [];
  }

  public addMessage(conversationId: string, message: AgentChatMessage) {
    let session = this.sessions.get(conversationId);
    if (!session) {
      session = { messages: [], lastActive: Date.now() };
      this.sessions.set(conversationId, session);
    }

    session.messages.push(message);
    session.lastActive = Date.now();

    // Bounded window
    if (session.messages.length > this.maxMessagesPerSession) {
      session.messages = session.messages.slice(-this.maxMessagesPerSession);
    }
  }

  public clear(conversationId: string) {
    this.sessions.delete(conversationId);
  }

  private cleanExpiredSessions() {
    const now = Date.now();
    for (const [id, session] of this.sessions.entries()) {
      if (now - session.lastActive > this.sessionTtlMs) {
        this.sessions.delete(id);
      }
    }
  }
}

export const conversationMemory = new ConversationMemory();
