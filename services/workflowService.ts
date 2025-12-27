import { API_BASE_URL } from './config';
import { WorkflowRequest, WorkflowStatusResponse, ChatMessage } from '../types';

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
   * Connect to a Server-Sent Events stream for real-time updates.
   * Replaces the need for polling.
   */
  connectToWorkflowStream: (
    conversationId: string, 
    onUpdate: (data: WorkflowStatusResponse) => void,
    onError: (error: any) => void
  ): EventSource => {
    // Determine absolute URL because EventSource constructor doesn't always handle relative paths with proxies identically to fetch
    // However, if using Vite proxy, relative path usually works. 
    // We will use the relative path aligned with API_BASE_URL.
    const streamUrl = `${API_BASE_URL}/workflows/${conversationId}/stream`;
    
    const eventSource = new EventSource(streamUrl);

    eventSource.onmessage = (event) => {
      try {
        const data: WorkflowStatusResponse = JSON.parse(event.data);
        onUpdate(data);
        
        // Auto-close on completion states to save resources
        if (data.status === 'COMPLETED' || data.status === 'FAILED') {
            eventSource.close();
        }
      } catch (e) {
        console.error('Error parsing SSE data', e);
      }
    };

    eventSource.onerror = (error) => {
        // SSE often fires error on connection close, we let the caller handle cleanup
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
      throw new Error(`API Error (${response.status}): ${response.statusText}`);
    }
    return await response.json();
  },

  /**
   * Get full conversation history from backend
   */
  getHistory: async (conversationId: string): Promise<{ messages: any[], status: string }> => {
    const response = await fetch(`${API_BASE_URL}/workflows/${conversationId}/history`);
    if (!response.ok) {
      throw new Error(`API Error (${response.status})`);
    }
    const data = await response.json();
    return {
        messages: data.messages || [],
        status: data.status
    };
  },

  /**
   * Get Dashboard Metrics
   */
  getDashboardMetrics: async (): Promise<any> => {
    const response = await fetch(`${API_BASE_URL}/metrics/dashboard`);
    if (!response.ok) {
      throw new Error(`API Error (${response.status})`);
    }
    return await response.json();
  }
};