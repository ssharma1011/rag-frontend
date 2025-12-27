import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import MessageList from './components/MessageList';
import ChatInput from './components/ChatInput';
import HistorySidebar from './components/HistorySidebar';
import MetricsModal from './components/MetricsModal';
import { Theme, ChatMessage, Conversation, WorkflowStatus, WorkflowStatusResponse } from './types';
import { workflowService } from './services/workflowService';

const App: React.FC = () => {
  // --- Theme State ---
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved === 'dark' || saved === 'light') return saved;
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    }
    return 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => (prev === 'light' ? 'dark' : 'light'));

  // --- App State ---
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    try {
      const saved = localStorage.getItem('conversations');
      if (saved) {
        return JSON.parse(saved).map((c: any) => ({
          ...c,
          timestamp: new Date(c.timestamp),
          messages: c.messages.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }))
        }));
      }
    } catch (e) {
      console.error('Failed to parse conversations', e);
    }
    return [];
  });

  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [repoUrl, setRepoUrl] = useState(() => localStorage.getItem('lastRepoUrl') || '');
  const [isRepoLocked, setIsRepoLocked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isMetricsOpen, setIsMetricsOpen] = useState(false);
  
  // Ref to hold the active EventSource so we can close it on unmount or new chat
  const eventSourceRef = useRef<EventSource | null>(null);

  // --- Persistence ---
  useEffect(() => {
    localStorage.setItem('conversations', JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    localStorage.setItem('lastRepoUrl', repoUrl);
  }, [repoUrl]);

  // Cleanup EventSource on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // --- Conversation Management ---
  const startNewChat = () => {
    // Close existing stream if any
    if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
    }

    // Clear current ID and messages to show empty state
    setCurrentConversationId(null);
    setMessages([]);
    setIsRepoLocked(false);
    setIsLoading(false);
  };

  const loadConversation = async (id: string) => {
    // Close existing stream if any when switching
    if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
    }

    const conv = conversations.find(c => c.id === id);
    if (conv) {
      setCurrentConversationId(conv.id);
      setIsRepoLocked(true); 
      setRepoUrl(conv.repoUrl);
      
      // Initial load from local state for speed
      setMessages(conv.messages);
      setIsHistoryOpen(false);

      // Fetch latest history from backend to sync
      try {
        const historyData = await workflowService.getHistory(id);
        
        // Map backend messages to frontend format
        const mappedMessages: ChatMessage[] = historyData.messages.map((m: any, idx: number) => ({
            id: `hist_${id}_${idx}`,
            sender: m.role === 'user' ? 'user' : 'agent',
            content: m.content,
            timestamp: new Date(m.timestamp || Date.now()),
            status: (idx === historyData.messages.length - 1 && historyData.status !== 'COMPLETED' ? historyData.status : 'COMPLETED') as WorkflowStatus
        }));

        setMessages(mappedMessages);
        
        // Update local state with fresh data
        setConversations(prev => prev.map(c => 
            c.id === id ? { ...c, messages: mappedMessages } : c
        ));

      } catch (err) {
        console.error("Failed to sync history from backend:", err);
      }
    }
  };

  // --- Real-time Handler ---
  const handleWorkflowUpdate = (status: WorkflowStatusResponse, conversationId: string) => {
    setMessages(prev => {
        // Find if the last message is an agent message that we should update
        const lastMsg = prev[prev.length - 1];
        
        if (lastMsg && lastMsg.sender === 'agent') {
            // Update existing agent message (streaming effect)
            const updatedLast = {
                ...lastMsg,
                content: status.message, // Assuming backend sends full accumulated text or we append. Usually SSE sends full snapshot or delta. Here assuming snapshot based on previous logic.
                status: status.status,
                progress: status.progress,
                agent: status.agent
            };
            
            // Sync with conversation list
            setConversations(convs => convs.map(c => 
                c.id === conversationId 
                    ? { ...c, messages: [...prev.slice(0, -1), updatedLast] } 
                    : c
            ));

            return [...prev.slice(0, -1), updatedLast];
        } else {
            // Edge case: Agent message doesn't exist yet (rare with SSE start delay), append it
            // Or if previous was user, append new agent message
            return prev; // Should be handled by initialization in handleSendMessage
        }
    });

    if (status.status === 'COMPLETED' || status.status === 'FAILED') {
        setIsLoading(false);
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }
    }
  };

  // --- Messaging Logic ---
  const handleSendMessage = async (data: {
    content: string;
    repoUrl: string;
    logsPasted?: string;
    logFiles?: File[];
  }) => {
    const newRepoUrl = data.repoUrl;
    setRepoUrl(newRepoUrl);
    setIsRepoLocked(true);

    const newUserMsg: ChatMessage = {
      id: `msg_${Date.now()}_u`,
      sender: 'user',
      content: data.content,
      timestamp: new Date()
    };

    const newMessages = [...messages, newUserMsg];
    setMessages(newMessages);
    setIsLoading(true);

    // Close previous stream if exists
    if (eventSourceRef.current) {
        eventSourceRef.current.close();
    }

    try {
      const response = await workflowService.startWorkflow({
        requirement: data.content,
        repoUrl: newRepoUrl,
        logsPasted: data.logsPasted,
        logFiles: data.logFiles,
      });

      const conversationId = response.conversationId;
      setCurrentConversationId(conversationId);

      // Initialize the placeholder Agent message immediately
      const agentMsg: ChatMessage = {
        id: `msg_${Date.now()}_a`,
        sender: 'agent',
        content: response.message || "Initializing...",
        timestamp: new Date(),
        agent: response.agent || "System",
        status: response.status || "RUNNING",
        progress: response.progress || 0
      };

      const messagesWithAgent = [...newMessages, agentMsg];
      setMessages(messagesWithAgent);
      
      // Save initial state
      setConversations(prev => {
        const exists = prev.some(c => c.id === conversationId);
        if (exists) {
            return prev.map(c => c.id === conversationId ? { ...c, messages: messagesWithAgent, timestamp: new Date() } : c);
        } else {
            return [{
                id: conversationId!,
                repoUrl: newRepoUrl,
                messages: messagesWithAgent,
                timestamp: new Date()
            }, ...prev];
        }
      });

      // --- START STREAMING (SSE) ---
      eventSourceRef.current = workflowService.connectToWorkflowStream(
        conversationId,
        (data) => handleWorkflowUpdate(data, conversationId),
        (error) => {
            console.error("SSE Error:", error);
            // Only stop loading if we are fairly sure it's a fatal error, 
            // otherwise SSE might just be reconnecting.
            // For now, we assume close() logic in service handles fatal.
            // We can add a timeout check here if needed.
        }
      );

    } catch (error) {
      console.error("Failed to start workflow", error);
      setIsLoading(false);
      setMessages(prev => [...prev, {
          id: `err_${Date.now()}`,
          sender: 'agent',
          content: '❌ **Error**: Failed to start workflow.\n\nPlease ensure the backend is running.',
          timestamp: new Date(),
          status: 'FAILED'
      }]);
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden font-sans relative">
      <Header
        theme={theme}
        toggleTheme={toggleTheme}
        showHistoryButton={true} // Always show history button for access
        repoUrl={repoUrl}
        isRepoLocked={isRepoLocked}
        onHistoryClick={() => setIsHistoryOpen(true)}
        onNewChat={startNewChat}
        onMetricsClick={() => setIsMetricsOpen(true)}
        className="absolute top-0 left-0 right-0 w-full"
      />

      <div className="flex-1 relative flex flex-col max-w-5xl mx-auto w-full h-full">
        <MessageList 
            messages={messages} 
            isLoading={isLoading} 
        />
        
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-6 pt-2 z-20 pointer-events-none">
            <div className="pointer-events-auto">
                <ChatInput 
                    disabled={isLoading}
                    initialRepoUrl={repoUrl}
                    isRepoLocked={isRepoLocked}
                    onSend={handleSendMessage}
                />
            </div>
        </div>

        <HistorySidebar
            isOpen={isHistoryOpen}
            conversations={conversations}
            onSelectConversation={loadConversation}
            onClose={() => setIsHistoryOpen(false)}
        />

        <MetricsModal 
            isOpen={isMetricsOpen}
            onClose={() => setIsMetricsOpen(false)}
        />
      </div>
    </div>
  );
};

export default App;