import { API_BASE_URL } from './config';
import { 
  WorkflowRequest, 
  WorkflowStatusResponse, 
  ConversationMetricsResponse, 
  DashboardResponse,
  LLMCallMetrics
} from '../types';

// --- Mock Data Generators (Fallback) ---
const getMockDashboard = (): DashboardResponse => ({
  cost_last_24h: 1.2450,
  timestamp: new Date().toISOString()
});

const getMockConversationMetrics = (id: string): ConversationMetricsResponse => ({
  conversationId: id,
  totalCalls: 8,
  totalTokens: 12500,
  totalCost: 0.185,
  averageLatencyMs: 1250,
  calls: Array.from({ length: 8 }).map((_, i) => ({
    timestamp: new Date(Date.now() - (8 - i) * 1000 * 60).toISOString(),
    agentName: i % 3 === 0 ? 'RequirementAnalyst' : i % 3 === 1 ? 'CodeGenerator' : 'Reviewer',
    model: 'gpt-4-turbo',
    promptTokens: 500 + Math.floor(Math.random() * 500),
    completionTokens: 200 + Math.floor(Math.random() * 300),
    totalTokens: 700 + Math.floor(Math.random() * 800),
    latencyMs: 800 + Math.floor(Math.random() * 1000),
    cost: 0.01 + Math.random() * 0.02,
    status: 'SUCCESS'
  }))
});

const getMockFailures = (): LLMCallMetrics[] => ([
  {
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    agentName: 'CodeGenerator',
    model: 'gpt-4-turbo',
    promptTokens: 3200,
    completionTokens: 0,
    totalTokens: 3200,
    latencyMs: 30000,
    cost: 0.03,
    status: 'FAILURE',
    errorMessage: 'Timeout waiting for response from upstream provider'
  },
  {
    timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    agentName: 'RequirementAnalyst',
    model: 'gpt-4-turbo',
    promptTokens: 1500,
    completionTokens: 0,
    totalTokens: 1500,
    latencyMs: 450,
    cost: 0.015,
    status: 'FAILURE',
    errorMessage: 'Rate limit exceeded (429)'
  }
]);

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

    // Debug connection status
    eventSource.onopen = () => {
      console.log(`📡 Connected to workflow stream: ${streamUrl}`);
    };

    // Handler for named 'workflow-update' events from Java backend
    eventSource.addEventListener('workflow-update', (event) => {
      try {
        const data: WorkflowStatusResponse = JSON.parse(event.data);
        onUpdate(data);
        if (data.status === 'COMPLETED' || data.status === 'FAILED') {
            eventSource.close();
        }
      } catch (e) {
        console.error('Error parsing SSE data', e);
      }
    });

    // Handler for standard message events (fallback)
    eventSource.onmessage = (event) => {
      try {
        const data: WorkflowStatusResponse = JSON.parse(event.data);
        onUpdate(data);
        if (data.status === 'COMPLETED' || data.status === 'FAILED') {
            eventSource.close();
        }
      } catch (e) {
        // Ignore parsing errors for standard messages if they are not JSON
      }
    };

    eventSource.onerror = (error) => {
        // Only trigger error if not cleanly closed
        if (eventSource.readyState !== EventSource.CLOSED) {
            onError(error);
            eventSource.close();
        }
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
    try {
      const response = await fetch(`${API_BASE_URL}/workflows/${conversationId}/history`);
      if (!response.ok) throw new Error(`API Error (${response.status})`);
      const data = await response.json();
      return { messages: data.messages || [], status: data.status };
    } catch (e) {
      console.warn('History fetch failed, falling back to local.', e);
      throw e; // Let app handle fallback
    }
  },

  // =================================================================
  // METRICS API CALLS (With Mock Fallbacks)
  // =================================================================

  /**
   * Get dashboard overview
   */
  getDashboardMetrics: async (): Promise<DashboardResponse> => {
    try {
      const response = await fetch(`${API_BASE_URL}/metrics/dashboard`);
      if (!response.ok) throw new Error(`API Error (${response.status})`);
      return await response.json();
    } catch (e) {
      console.warn('Metrics API unreachable, using mock data.');
      return getMockDashboard();
    }
  },

  /**
   * Get metrics for a specific conversation
   */
  getConversationMetrics: async (conversationId: string): Promise<ConversationMetricsResponse> => {
    try {
      const response = await fetch(`${API_BASE_URL}/metrics/conversation/${conversationId}`);
      if (!response.ok) throw new Error(`API Error (${response.status})`);
      return await response.json();
    } catch (e) {
      console.warn('Metrics API unreachable, using mock data.');
      return getMockConversationMetrics(conversationId);
    }
  },

  /**
   * Get failed LLM calls
   */
  getFailedCalls: async (): Promise<LLMCallMetrics[]> => {
    try {
      const response = await fetch(`${API_BASE_URL}/metrics/failures`);
      if (!response.ok) throw new Error(`API Error (${response.status})`);
      return await response.json();
    } catch (e) {
      console.warn('Metrics API unreachable, using mock data.');
      return getMockFailures();
    }
  },

  /**
   * Get problematic calls (high retry count)
   */
  getProblematicCalls: async (retryThreshold = 2): Promise<LLMCallMetrics[]> => {
    try {
      const response = await fetch(`${API_BASE_URL}/metrics/problematic?retryThreshold=${retryThreshold}`);
      if (!response.ok) throw new Error(`API Error (${response.status})`);
      return await response.json();
    } catch (e) {
        // Fallback to empty list or failures
        return [];
    }
  }
};