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

// Helper to sanitize errors
const handleApiError = async (response: Response) => {
  const contentType = response.headers.get("content-type");
  let errorMessage = `API Error (${response.status})`;

  if (contentType && contentType.indexOf("application/json") !== -1) {
    try {
      const json = await response.json();
      errorMessage = json.message || json.error || errorMessage;
    } catch {
      // ignore json parse error
    }
  } else {
    // If text/html (likely a stack trace), do NOT show it.
    errorMessage = `The server encountered an error (${response.status}). Please check backend logs.`;
  }
  
  throw new Error(errorMessage);
};

const SIMULATION_PREFIX = 'sim_test_';

export const workflowService = {
  /**
   * Start a new workflow
   */
  startWorkflow: async (request: WorkflowRequest): Promise<WorkflowStatusResponse> => {
    // --- SIMULATION MODE ---
    if (request.requirement.trim().toLowerCase() === '/test') {
        console.log("🧪 Starting Simulation Mode");
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    conversationId: `${SIMULATION_PREFIX}${Date.now()}`,
                    status: 'RUNNING',
                    message: '🧪 Simulation Started. Initializing agents...',
                    agent: 'TestController',
                    progress: 0.05
                });
            }, 500);
        });
    }
    // -----------------------

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

    try {
      const response = await fetch(`${API_BASE_URL}/workflows/start`, {
        method: 'POST',
        headers,
        body,
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
   * Connect to SSE stream
   */
  connectToWorkflowStream: (
    conversationId: string, 
    onUpdate: (data: WorkflowStatusResponse) => void,
    onError: (error: any) => void
  ): EventSource => {
    
    // --- SIMULATION MODE STREAM ---
    if (conversationId.startsWith(SIMULATION_PREFIX)) {
        console.log(`🔌 Connected to Simulated Stream: ${conversationId}`);
        let progress = 0.05;
        const steps = [
            { msg: "Analyzing requirements...", agent: "RequirementAnalyst" },
            { msg: "Scanning repository structure...", agent: "RepoScanner" },
            { msg: "Identifying relevant files...", agent: "ContextBuilder" },
            { msg: "Drafting solution plan...", agent: "Architect" },
            { msg: "Generating code changes...", agent: "CodeGenerator" },
            { msg: "Running static analysis...", agent: "Reviewer" },
            { msg: "Finalizing response...", agent: "System" },
            { msg: "Done. Simulation complete.", agent: "System", status: "COMPLETED" }
        ];
        
        let stepIndex = 0;
        
        const interval = setInterval(() => {
            const step = steps[stepIndex];
            progress += 0.12;
            if (progress > 1) progress = 1;

            const update: WorkflowStatusResponse = {
                conversationId,
                status: (step.status as any) || 'RUNNING',
                message: step.msg,
                agent: step.agent,
                progress: progress
            };

            onUpdate(update);
            
            if (update.status === 'COMPLETED') {
                clearInterval(interval);
            }
            stepIndex++;
            if (stepIndex >= steps.length) clearInterval(interval);

        }, 1500); // Update every 1.5 seconds

        // Return a fake EventSource object that allows 'close'
        return { close: () => clearInterval(interval) } as any;
    }
    // ----------------------------

    const streamUrl = `${API_BASE_URL}/workflows/${conversationId}/stream`;
    console.log(`📡 Connecting to SSE: ${streamUrl}`);
    
    const eventSource = new EventSource(streamUrl);

    eventSource.onopen = () => {
      console.log(`✅ SSE Connection Opened: ${streamUrl}`);
    };

    // Handler for named 'workflow-update' events
    eventSource.addEventListener('workflow-update', (event) => {
      console.log('📨 SSE Named Event received:', event.data);
      try {
        const data: WorkflowStatusResponse = JSON.parse(event.data);
        onUpdate(data);
        if (data.status === 'COMPLETED' || data.status === 'FAILED') {
            console.log('🏁 Workflow finished (Named Event), closing stream.');
            eventSource.close();
        }
      } catch (e) {
        console.error('❌ Error parsing SSE Named Event data', e);
      }
    });

    // Handler for standard message events
    eventSource.onmessage = (event) => {
      console.log('📨 SSE Standard Message received:', event.data);
      try {
        const data: WorkflowStatusResponse = JSON.parse(event.data);
        onUpdate(data);
        if (data.status === 'COMPLETED' || data.status === 'FAILED') {
            console.log('🏁 Workflow finished (Standard Message), closing stream.');
            eventSource.close();
        }
      } catch (e) {
        // Only log error if it looks like JSON but failed
        if (event.data.trim().startsWith('{')) {
             console.error('❌ Error parsing SSE Standard Message data', e);
        }
      }
    };

    eventSource.onerror = (error) => {
        // Only trigger error if not cleanly closed
        if (eventSource.readyState !== EventSource.CLOSED) {
            console.error('⚠️ SSE Connection Error:', error);
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
    try {
      const response = await fetch(`${API_BASE_URL}/workflows/${conversationId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: responseText }),
      });

      if (!response.ok) {
        await handleApiError(response);
      }
      return await response.json();
    } catch (e: any) {
      throw e;
    }
  },

  /**
   * Get full conversation history
   */
  getHistory: async (conversationId: string): Promise<{ messages: any[], status: string }> => {
    try {
      const response = await fetch(`${API_BASE_URL}/workflows/${conversationId}/history`);
      if (!response.ok) await handleApiError(response);
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