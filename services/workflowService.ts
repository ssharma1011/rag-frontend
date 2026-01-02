
import { API_BASE_URL } from './config';
import { 
  ChatRequest, 
  ChatResponse, 
  ChatStreamUpdate,
  ConversationSummary,
  DashboardResponse,
  ConversationMetricsResponse,
  LLMCallMetrics
} from '../types';

// Helper to sanitize errors
const handleApiError = async (response: Response) => {
  const contentType = response.headers.get("content-type");
  let errorMessage = `API Error (${response.status})`;

  if (contentType && contentType.includes("application/json")) {
    try {
      const json = await response.json();
      errorMessage = json.message || json.error || errorMessage;
    } catch {
      // ignore json parse error
    }
  }
  throw new Error(errorMessage);
};

export const chatService = {
  /**
   * Send a message (New conversation or Follow-up)
   */
  sendMessage: async (request: ChatRequest): Promise<ChatResponse> => {
    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        await handleApiError(response);
      }

      return await response.json();
    } catch (e: any) {
      if (e.message.includes('Failed to fetch')) {
        throw new Error("Unable to connect to the server. Is the backend running?");
      }
      throw e;
    }
  },

  /**
   * Get all conversations for a user
   */
  getConversations: async (userId: string): Promise<ConversationSummary[]> => {
    try {
      const response = await fetch(`${API_BASE_URL}/chat/conversations?userId=${encodeURIComponent(userId)}`);
      if (!response.ok) await handleApiError(response);
      return await response.json();
    } catch (e) {
      console.warn('Failed to fetch conversations', e);
      return [];
    }
  },

  /**
   * Get conversation history
   */
  getHistory: async (conversationId: string): Promise<{ messages: any[] }> => {
    try {
      const response = await fetch(`${API_BASE_URL}/chat/${conversationId}/history`);
      if (!response.ok) await handleApiError(response);
      return await response.json();
    } catch (e) {
      console.warn('History fetch failed', e);
      throw e;
    }
  },

  /**
   * Get conversation status (Detailed)
   */
  getConversationStatus: async (conversationId: string): Promise<{ status: string, hasActiveStream: boolean, mode: string }> => {
    try {
      const response = await fetch(`${API_BASE_URL}/chat/${conversationId}/status`);
      if (!response.ok) await handleApiError(response);
      return await response.json();
    } catch (e) {
      console.warn('Status fetch failed', e);
      // Fallback
      return { status: 'UNKNOWN', hasActiveStream: false, mode: 'EXPLORE' };
    }
  },

  /**
   * Delete a conversation
   */
  deleteConversation: async (conversationId: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/chat/${conversationId}`, {
        method: 'DELETE'
    });
    if (!response.ok) await handleApiError(response);
  },

  /**
   * Connect to SSE stream for real-time updates
   */
  connectToStream: (
    conversationId: string, 
    onUpdate: (data: ChatStreamUpdate) => void,
    onError: (error: any) => void
  ): EventSource => {
    const streamUrl = `${API_BASE_URL}/chat/${conversationId}/stream`;
    console.log(`📡 Connecting to SSE: ${streamUrl}`);
    
    const eventSource = new EventSource(streamUrl);
    
    // Internal accumulator for partial token streaming
    let fullContent = ""; 

    // Handle incoming messages
    const handleEvent = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        // data structure: { type: string, message?: string, tool?: string, content?: string }

        switch (data.type) {
            case 'CONNECTED':
                console.log('✅ Stream Connected');
                // Optional: Notify UI of connection
                onUpdate({
                    conversationId,
                    type: 'CONNECTED',
                    status: 'RUNNING',
                    agentName: 'System'
                });
                break;

            case 'THINKING':
                onUpdate({
                    conversationId,
                    type: 'THINKING',
                    status: 'RUNNING',
                    agentName: 'System', // or 'Planning'
                    content: `Thinking: ${data.message}` 
                });
                break;

            case 'TOOL':
                onUpdate({
                    conversationId,
                    type: 'TOOL',
                    status: 'RUNNING',
                    agentName: 'Tool',
                    content: `Executing ${data.tool}: ${data.message}`
                });
                break;

            case 'PARTIAL':
                // Append tokens
                fullContent += (data.content || "");
                onUpdate({
                    conversationId,
                    type: 'PARTIAL',
                    status: 'RUNNING',
                    agentName: 'Assistant',
                    content: fullContent 
                });
                break;

            case 'COMPLETE':
                fullContent = data.content || fullContent; // Use final content if provided, else buffer
                onUpdate({
                    conversationId,
                    type: 'COMPLETE',
                    status: 'COMPLETED',
                    agentName: 'Assistant',
                    content: fullContent
                });
                eventSource.close();
                break;

            case 'ERROR':
                onUpdate({
                    conversationId,
                    type: 'ERROR',
                    status: 'FAILED',
                    agentName: 'System',
                    content: `Error: ${data.message}`
                });
                eventSource.close();
                break;
        }

      } catch (e) {
        console.error('❌ Error parsing SSE data', e, event.data);
      }
    };

    // Listen to specific event name AND default message event to be robust
    eventSource.addEventListener('chat-update', handleEvent);
    eventSource.onmessage = handleEvent;

    eventSource.onerror = (error) => {
        if (eventSource.readyState !== EventSource.CLOSED) {
            console.error('⚠️ SSE Connection Error:', error);
            onError(error);
            eventSource.close();
        }
    };

    return eventSource;
  },

  // --- Metrics Calls ---

  getDashboardMetrics: async (): Promise<DashboardResponse> => {
    try {
      const response = await fetch(`${API_BASE_URL}/metrics/dashboard`);
      if (!response.ok) throw new Error(`API Error (${response.status})`);
      return await response.json();
    } catch {
      return { cost_last_24h: 0, timestamp: new Date().toISOString() };
    }
  },

  getConversationMetrics: async (conversationId: string): Promise<ConversationMetricsResponse> => {
    try {
      const response = await fetch(`${API_BASE_URL}/metrics/conversation/${conversationId}`);
      if (!response.ok) throw new Error(`API Error`);
      return await response.json();
    } catch {
      return { conversationId, totalCalls: 0, totalTokens: 0, totalCost: 0, averageLatencyMs: 0, calls: [] };
    }
  },

  getFailedCalls: async (): Promise<LLMCallMetrics[]> => {
    try {
      const response = await fetch(`${API_BASE_URL}/metrics/failures`);
      return await response.json();
    } catch { return []; }
  }
};
