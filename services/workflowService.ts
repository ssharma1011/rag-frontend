import { API_BASE_URL } from './config';
import { WorkflowRequest, WorkflowStatusResponse } from '../types';

export const workflowService = {
  /**
   * Start a new workflow
   * Handles both simple JSON requests and Multipart/FormData when logs are present
   */
  startWorkflow: async (request: WorkflowRequest): Promise<WorkflowStatusResponse> => {
    const hasLogs = !!request.logsPasted || (request.logFiles && request.logFiles.length > 0);
    
    let body: string | FormData;
    let headers: HeadersInit = {};

    if (hasLogs) {
      // Use FormData for file uploads or mixed content
      const formData = new FormData();
      formData.append('requirement', request.requirement);
      formData.append('repoUrl', request.repoUrl);
      
      if (request.targetClass) {
        formData.append('targetClass', request.targetClass);
      }

      if (request.logsPasted) {
        formData.append('logsPasted', request.logsPasted);
      }

      if (request.logFiles) {
        request.logFiles.forEach(file => {
          formData.append('logFiles', file);
        });
      }
      
      body = formData;
      // Note: Do NOT set Content-Type header manually for FormData; 
      // the browser sets it with the correct boundary.
    } else {
      // Use simple JSON
      body = JSON.stringify(request);
      headers = {
        'Content-Type': 'application/json',
      };
    }

    try {
      const response = await fetch(`${API_BASE_URL}/workflows/start`, {
        method: 'POST',
        headers,
        body,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error (${response.status}): ${errorText || response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Start Workflow Failed:', error);
      throw error;
    }
  },

  /**
   * Poll for workflow status
   */
  getWorkflowStatus: async (conversationId: string): Promise<WorkflowStatusResponse> => {
    try {
      const response = await fetch(`${API_BASE_URL}/workflows/${conversationId}/status`);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error (${response.status}): ${errorText || response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Get Status Failed:', error);
      throw error;
    }
  },

  /**
   * Send developer response/feedback
   */
  respondToWorkflow: async (conversationId: string, responseText: string): Promise<WorkflowStatusResponse> => {
    try {
      const response = await fetch(`${API_BASE_URL}/workflows/${conversationId}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ response: responseText }),
      });

      if (!response.ok) {
        throw new Error(`API Error (${response.status}): ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Respond Failed:', error);
      throw error;
    }
  }
};
