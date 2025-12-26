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
