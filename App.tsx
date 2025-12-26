import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import MessageList from './components/MessageList';
import ChatInput from './components/ChatInput';
import HistorySidebar from './components/HistorySidebar';
import MetricsModal from './components/MetricsModal';
import { Theme, ChatMessage, Conversation, WorkflowStatus } from './types';
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
  const [pollingId, setPollingId] = useState<NodeJS.Timeout | null>(null);

  // --- Persistence ---
  useEffect(() => {
    localStorage.setItem('conversations', JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    localStorage.setItem('lastRepoUrl', repoUrl);
  }, [repoUrl]);

  // --- Conversation Management ---
  const startNewChat = () => {
    // Clear current ID and messages to show empty state
    setCurrentConversationId(null);
    setMessages([]);
    setIsRepoLocked(false);
    setIsLoading(false);
    
    // Stop any active polling
    if (pollingId) {
        clearInterval(pollingId);
        setPollingId(null);
    }
  };

  const loadConversation = async (id: string) => {
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
        // Assumes backend format is [{role: 'user'|'assistant', content: string, timestamp: string}]
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
        // Fallback to local state which is already set
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

    // Create or Update Conversation in State
    let conversationId = currentConversationId;
    
    // If we are starting fresh or resumed a chat, manage ID
    if (!conversationId) {
        // Optimistic ID, will be updated if backend returns a real one
        conversationId = `conv_${Date.now()}`; 
    }

    try {
      let response;
      
      // If we are in an existing conversation, we might use respondToWorkflow if it's awaiting input
      // But for now, we assume standard flow starts new workflow or appends
      // Actually, if conversationId exists, we should probably check status, but `startWorkflow` creates a NEW one usually
      // The requirement implies `startWorkflow` starts a fresh flow.
      
      response = await workflowService.startWorkflow({
        requirement: data.content,
        repoUrl: newRepoUrl,
        logsPasted: data.logsPasted,
        logFiles: data.logFiles,
        // user_id if needed
      });

      // Update Conversation ID with real one from backend
      conversationId = response.conversationId;
      setCurrentConversationId(conversationId);

      const agentMsg: ChatMessage = {
        id: `msg_${Date.now()}_a`,
        sender: 'agent',
        content: response.message,
        timestamp: new Date(),
        agent: response.agent,
        status: response.status,
        progress: response.progress
      };

      const messagesWithAgent = [...newMessages, agentMsg];
      setMessages(messagesWithAgent);
      
      // Update or Add to Conversation List
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

      // Start Polling
      const intervalId = setInterval(async () => {
        try {
          const status = await workflowService.getWorkflowStatus(response.conversationId);
          
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last.sender === 'agent') {
              const updatedLast = {
                ...last,
                content: status.message,
                status: status.status,
                progress: status.progress,
                agent: status.agent
              };
              
              setConversations(convs => convs.map(c => 
                c.id === conversationId 
                    ? { ...c, messages: [...prev.slice(0, -1), updatedLast] } 
                    : c
              ));

              return [...prev.slice(0, -1), updatedLast];
            }
            return prev;
          });

          if (status.status === 'COMPLETED' || status.status === 'FAILED') {
            clearInterval(intervalId);
            setIsLoading(false);
          }
        } catch (error) {
          console.error("Polling error", error);
          clearInterval(intervalId);
          setIsLoading(false);
          
          setMessages(prev => {
             const last = prev[prev.length - 1];
             if(last.sender === 'agent' && last.status === 'RUNNING') {
                 return [...prev.slice(0, -1), { 
                     ...last, 
                     status: 'FAILED', 
                     content: last.content + "\n\n❌ **Connection Lost**: Unable to reach the server. Please check your connection."
                 }];
             }
             return prev;
          });
        }
      }, 2000);

      setPollingId(intervalId);

    } catch (error) {
      console.error("Failed to start workflow", error);
      setIsLoading(false);
      setMessages(prev => [...prev, {
          id: `err_${Date.now()}`,
          sender: 'agent',
          content: '❌ **Error**: Failed to start workflow.\n\nPlease ensure the backend is running on port 8080.',
          timestamp: new Date(),
          status: 'FAILED'
      }]);
    }
  };

  useEffect(() => {
    return () => {
      if (pollingId) clearInterval(pollingId);
    };
  }, [pollingId]);

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