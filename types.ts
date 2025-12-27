export type Theme = 'light' | 'dark';

export type MessageSender = 'user' | 'agent';

export type WorkflowStatus = 'RUNNING' | 'COMPLETED' | 'FAILED' | 'WAITING_FOR_DEVELOPER';

export interface ChatMessage {
  id: string;
  sender: MessageSender;
  content: string;
  timestamp: Date;
  agent?: string;
  status?: WorkflowStatus;
  progress?: number; // 0-1
}

export interface WorkflowRequest {
  requirement: string;
  repoUrl: string;
  targetClass?: string;
  logsPasted?: string;
  logFiles?: File[];
}

export interface WorkflowStatusResponse {
  conversationId: string;
  status: WorkflowStatus;
  message: string;
  agent?: string;
  progress?: number;
}

export interface Conversation {
  id: string;
  repoUrl: string;
  messages: ChatMessage[];
  timestamp: Date;
}

// --- Metrics Interfaces (Matching Java DTOs) ---

export interface LLMCallMetrics {
  id?: string;
  timestamp: string; // ISO DateTime
  agentName: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  cost: number;
  status: 'SUCCESS' | 'FAILURE';
  errorMessage?: string;
  retryCount?: number;
}

export interface ConversationMetricsResponse {
  conversationId: string;
  totalCalls: number;
  totalTokens: number;
  totalCost: number;
  averageLatencyMs: number;
  calls: LLMCallMetrics[];
}

export interface AgentPerformanceStats {
  agentName: string;
  totalCalls: number;
  avgLatencyMs: number;
  successRate: number; // 0.0 to 1.0
  totalCost: number;
}

export interface DashboardResponse {
  cost_last_24h: number;
  timestamp: string;
  // Add other dashboard fields if backend provides them
}