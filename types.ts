
export type Theme = 'light' | 'dark';

export type MessageRole = 'user' | 'assistant' | 'system';

export type ChatStatus = 'ACTIVE' | 'COMPLETED' | 'FAILED';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  status?: 'RUNNING' | 'COMPLETED' | 'FAILED';
  agentName?: string; // Used for "Thinking..." or Tool names
}

export interface ChatRequest {
  message: string;
  repoUrl?: string; // New conversations
  conversationId?: string; // Follow-up
  userId?: string;
  branch?: string;
  mode?: 'EXPLORE' | 'DEBUG' | 'IMPLEMENT' | 'REVIEW';
}

export interface ChatResponse {
  success: boolean;
  conversationId: string;
  response?: string;
}

export interface ConversationSummary {
  conversationId: string;
  repoUrl: string;
  repoName?: string;
  status: string;
  createdAt: string; // ISO string
  lastActivity: string; // ISO string
  messageCount: number;
}

export interface ChatStreamUpdate {
  conversationId: string;
  content?: string; // The accumulator text or status message
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  type: 'THINKING' | 'TOOL' | 'PARTIAL' | 'COMPLETE' | 'ERROR' | 'CONNECTED';
  agentName?: string;
}

// --- Metrics Interfaces ---

export interface LLMCallMetrics {
  id?: string;
  timestamp: string;
  agentName: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  cost: number;
  status: 'SUCCESS' | 'FAILURE';
  errorMessage?: string;
}

export interface DashboardResponse {
  cost_last_24h: number;
  timestamp: string;
}

export interface ConversationMetricsResponse {
  conversationId: string;
  totalCalls: number;
  totalTokens: number;
  totalCost: number;
  averageLatencyMs: number;
  calls: LLMCallMetrics[];
}
