import { API_BASE_URL } from './config';
import { 
  WorkflowRequest, 
  WorkflowStatusResponse, 
  ConversationMetricsResponse, 
  DashboardResponse,
  LLMCallMetrics
} from '../types';

export const workflowService = {
  /**
   * Start a new workflow
   */
  startWorkflow: async (request: WorkflowRequest): Promise<WorkflowStatusResponse> => {
    const hasLogs = !!request.logsPasted || (request.logFiles && request.logFiles.length > 0);
    
    let body: string | FormData;
    let headers: HeadersInit = {};

    if (hasLogs) {
      const formData = new FormData();
      formData.append('requirement', request.requirement);
      formData.append('repoUrl', request.repoUrl);
      
      if (request.targetClass) formData.append('targetClass', request.targetClass);
      if (request.logsPasted) formData.append('logsPasted', request.logsPasted);
      if (request.logFiles) {
        request.logFiles.forEach(file => formData.append('logFiles', file));
      }
      
      body = formData;
    } else {
      body = JSON.stringify(request);
      headers = { 'Content-Type': 'application/json' };
    }

    const response = await fetch(`${API_BASE_URL}/workflows/start`, {
      method: 'POST',
      headers,
      body,
    });

    if (!response.ok) {
      throw new Error(`API Error (${response.status}): ${await response.text()}`);
    }

    return await response.json();
  },

  /**
   * Connect to SSE stream
   */
  connectToWorkflowStream: (
    conversationId: string, 
    onUpdate: (data: WorkflowStatusResponse) => void,
    onError: (error: any) => void
  ): EventSource => {
    const streamUrl = `${API_BASE_URL}/workflows/${conversationId}/stream`;
    const eventSource = new EventSource(streamUrl);

    eventSource.onmessage = (event) => {
      try {
        const data: WorkflowStatusResponse = JSON.parse(event.data);
        onUpdate(data);
        if (data.status === 'COMPLETED' || data.status === 'FAILED') {
            eventSource.close();
        }
      } catch (e) {
        console.error('Error parsing SSE data', e);
      }
    };

    eventSource.onerror = (error) => {
        onError(error);
        eventSource.close();
    };

    return eventSource;
  },

  /**
   * Send developer response
   */
  respondToWorkflow: async (conversationId: string, responseText: string): Promise<WorkflowStatusResponse> => {
    const response = await fetch(`${API_BASE_URL}/workflows/${conversationId}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response: responseText }),
    });

    if (!response.ok) {
      throw new Error(`API Error (${response.status})`);
    }
    return await response.json();
  },

  /**
   * Get full conversation history
   */
  getHistory: async (conversationId: string): Promise<{ messages: any[], status: string }> => {
    const response = await fetch(`${API_BASE_URL}/workflows/${conversationId}/history`);
    if (!response.ok) throw new Error(`API Error (${response.status})`);
    const data = await response.json();
    return { messages: data.messages || [], status: data.status };
  },

  // =================================================================
  // METRICS API CALLS
  // =================================================================

  /**
   * Get dashboard overview
   */
  getDashboardMetrics: async (): Promise<DashboardResponse> => {
    const response = await fetch(`${API_BASE_URL}/metrics/dashboard`);
    if (!response.ok) throw new Error(`API Error (${response.status})`);
    return await response.json();
  },

  /**
   * Get metrics for a specific conversation
   */
  getConversationMetrics: async (conversationId: string): Promise<ConversationMetricsResponse> => {
    const response = await fetch(`${API_BASE_URL}/metrics/conversation/${conversationId}`);
    if (!response.ok) throw new Error(`API Error (${response.status})`);
    return await response.json();
  },

  /**
   * Get failed LLM calls
   */
  getFailedCalls: async (): Promise<LLMCallMetrics[]> => {
    const response = await fetch(`${API_BASE_URL}/metrics/failures`);
    if (!response.ok) throw new Error(`API Error (${response.status})`);
    return await response.json();
  },

  /**
   * Get problematic calls (high retry count)
   */
  getProblematicCalls: async (retryThreshold = 2): Promise<LLMCallMetrics[]> => {
    const response = await fetch(`${API_BASE_URL}/metrics/problematic?retryThreshold=${retryThreshold}`);
    if (!response.ok) throw new Error(`API Error (${response.status})`);
    return await response.json();
  }
};