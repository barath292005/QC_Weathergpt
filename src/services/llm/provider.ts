export interface LLMGenerateOptions {
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface LLMResponse {
  text: string;
  model: string;
  provider: string;
  finishReason?: string;
}

export interface LLMProvider {
  name: string;
  isAvailable(): boolean;
  generate(prompt: string, options?: LLMGenerateOptions): Promise<LLMResponse>;
  healthCheck(): Promise<boolean>;
}
