
export enum EventName {
  ESSAY_WRITING = 'essay_writing',
  CHAT = 'chat',
  SYSTEM = 'system'
}

export enum EventBy {
  USER = 'user',
  AI = 'AI',
  SYSTEM = 'system'
}

export interface WritingEvent {
  session_id: string;
  user_name: string;
  event_start_time: number; // timestamp
  event_name: EventName;
  event_by: EventBy;
  event_result: string;
}

export interface ChatMessage {
  role: 'user' | 'model' | 'assistant';
  parts: { text: string }[];
}

export type LLMProvider = 'gemini' | 'azure';

export interface AzureConfig {
  endpoint: string;
  apiKey: string;
  deploymentName: string;
  apiVersion: string;
}

export interface AppConfig {
  provider: LLMProvider;
  azure?: AzureConfig;
  writingPrompt: string;
  systemPrompt: string;
  timeLimit: number; // in seconds
}

export interface AppState {
  userName: string;
  essayContent: string;
  chatHistory: ChatMessage[];
  timeLeft: number;
  isTimerRunning: boolean;
  sessionId: string;
}
