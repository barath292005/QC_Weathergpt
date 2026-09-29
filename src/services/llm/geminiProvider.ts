import { GoogleGenAI } from '@google/genai';
import type { LLMProvider, LLMGenerateOptions, LLMResponse } from './provider';

export class GeminiProvider implements LLMProvider {
  public readonly name = 'gemini';
  private ai: GoogleGenAI | null = null;
  private readonly defaultModel: string;

  constructor() {
    this.defaultModel = process.env.LLM_MODEL || 'gemini-3.8-flash';
    if (process.env.GEMINI_API_KEY) {
      try {
        this.ai = new GoogleGenAI();
      } catch (err) {
        console.warn('Failed to initialize GoogleGenAI client:', err);
        this.ai = null;
      }
    }
  }

  public isAvailable(): boolean {
    return this.ai !== null && Boolean(process.env.GEMINI_API_KEY);
  }

  public async healthCheck(): Promise<boolean> {
    if (!this.isAvailable()) return false;
    try {
      const res = await this.ai!.models.generateContent({
        model: this.defaultModel,
        contents: 'ping',
        config: { maxOutputTokens: 5 },
      });
      return Boolean(res.text);
    } catch {
      return false;
    }
  }

  public async generate(prompt: string, options?: LLMGenerateOptions): Promise<LLMResponse> {
    if (!this.ai) {
      throw new Error('Gemini API key is not configured.');
    }

    const model = this.defaultModel;
    const response = await this.ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: options?.systemInstruction,
        temperature: options?.temperature ?? 0.2,
        maxOutputTokens: options?.maxOutputTokens ?? 1024,
      },
    });

    const text = response.text || '';
    return {
      text,
      model,
      provider: 'gemini',
    };
  }
}
