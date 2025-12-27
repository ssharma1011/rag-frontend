import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import MessageList from './components/MessageList';
import ChatInput from './components/ChatInput';
import HistorySidebar from './components/HistorySidebar';
import MetricsModal from './components/MetricsModal';
import { Theme, ChatMessage, Conversation, WorkflowStatus, WorkflowStatusResponse } from './types';
import { workflowService } from './services/workflowService';
import { Loader2 } from './components/Icons';

const App: React.FC = () => {
  // --- Initialization State ---
  const [isAppReady, setIsAppReady] = useState(false);

  // --- Theme State ---
  const [theme, setTheme] = useState<Theme>('light'); // Default to light, hydrate later

  // --- App State ---
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [repoUrl, setRepoUrl] = useState('');
  const [isRepoLocked, setIsRepoLocked] = useState(false);
  
  // UI State
  const [isLoading, setIsLoading] = useState(false); // Only for current chat input disabled state
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isMetricsOpen, setIsMetricsOpen] = useState(false);
  
  // Store multiple active event sources: Map<conversationId, EventSource>
  const activeStreamsRef = useRef<Map<string, EventSource>>(new Map());

  // --- 1. Efficient Hydration ---
  useEffect(() => {
    const hydrate = async () => {
      try {
        // Theme
        let savedTheme = localStorage.getItem('theme') as Theme;
        if (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches) {
          savedTheme = 'dark';
        }
        if (savedTheme) setTheme(savedTheme || 'light');

        // Repo
        const savedRepo = localStorage.getItem('lastRepoUrl');
        if (savedRepo) setRepoUrl(savedRepo);

        // Conversations
        const savedConvs = localStorage.getItem('conversations');
        if (savedConvs) {
          const parsed = JSON.parse(savedConvs).map((c: any) => ({
            ...c,
            timestamp: new Date(c.timestamp),
            messages: c.messages.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }))
          }));
          setConversations(parsed);
        }
      } catch (e) {
        console.error('Failed to hydrate state', e);
      } finally {
        setIsAppReady(true);
      }
    };

    setTimeout(hydrate, 10);
  }, []);

  // --- Theme Effect ---
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

  // --- Persistence ---
  useEffect(() => {
    if (isAppReady) {
        localStorage.setItem('conversations', JSON.stringify(conversations));
    }
  }, [conversations, isAppReady]);

  useEffect(() => {
    if (isAppReady) {
        localStorage.setItem('lastRepoUrl', repoUrl);
    }
  }, [repoUrl, isAppReady]);

  // Cleanup EventSources on unmount
  useEffect(() => {
    return () => {
      activeStreamsRef.current.forEach(es => es.close());
      activeStreamsRef.current.clear();
    };
  }, []);

  // --- Helper to cleanup stream ---
  const closeStream = (conversationId: string) => {
    const es = activeStreamsRef.current.get(conversationId);
    if (es) {
        es.close();
        activeStreamsRef.current.delete(conversationId);
    }
  };

  // --- Real-time Handler (Success) ---
  const handleWorkflowUpdate = (status: WorkflowStatusResponse, conversationId: string) => {
    // 1. Update Conversations List (Background state)
    setConversations(prevConvs => {
        return prevConvs.map(c => {
            if (c.id !== conversationId) return c;

            // Found the conversation to update
            const msgs = [...c.messages];
            const lastMsgIndex = msgs.length - 1;
            const lastMsg = msgs[lastMsgIndex];

            if (lastMsg && lastMsg.sender === 'agent') {
                const updatedLast = {
                    ...lastMsg,
                    content: status.message,
                    status: status.status,
                    progress: status.progress,
                    agent: status.agent
                };
                msgs[lastMsgIndex] = updatedLast;
            }

            // Create a NEW object to ensure React detects change
            return { ...c, messages: msgs };
        });
    });

    // 2. Update Messages View (If currently viewing this chat)
    setCurrentConversationId(currId => {
        if (currId === conversationId) {
            setMessages(prevMsgs => {
                const lastMsg = prevMsgs[prevMsgs.length - 1];
                if (lastMsg && lastMsg.sender === 'agent') {
                     return [...prevMsgs.slice(0, -1), {
                        ...lastMsg,
                        content: status.message,
                        status: status.status,
                        progress: status.progress,
                        agent: status.agent
                     }];
                }
                return prevMsgs;
            });

            if (status.status === 'COMPLETED' || status.status === 'FAILED') {
                setIsLoading(false);
            }
        }
        return currId;
    });

    // 3. Cleanup if done
    if (status.status === 'COMPLETED' || status.status === 'FAILED') {
        closeStream(conversationId);
    }
  };

  // --- Real-time Handler (Error) ---
  // Fixes the "infinite spinner" issue by forcing state to FAILED on stream error
  const handleWorkflowError = (error: any, conversationId: string) => {
    console.error(`Stream error for ${conversationId}:`, error);
    
    const failStatus: WorkflowStatusResponse = {
        conversationId,
        status: 'FAILED',
        message: 'Connection lost. Please check your network or try again.',
        agent: 'System',
        progress: 0
    };

    // Reuse update logic to force UI into failed state
    handleWorkflowUpdate(failStatus, conversationId);
    closeStream(conversationId);
  };

  // --- Conversation Management ---
  const startNewChat = () => {
    setCurrentConversationId(null);
    setMessages([]);
    setIsRepoLocked(false);
    setIsLoading(false);
  };

  const loadConversation = async (id: string) => {
    const conv = conversations.find(c => c.id === id);
    if (!conv) return;

    setCurrentConversationId(conv.id);
    setIsRepoLocked(true); 
    setRepoUrl(conv.repoUrl);
    
    // 1. Optimistic Load from Local Storage
    setMessages(conv.messages);
    setIsHistoryOpen(false);
    
    const lastMsgLocal = conv.messages[conv.messages.length - 1];
    const isRunningLocal = lastMsgLocal && lastMsgLocal.sender === 'agent' && lastMsgLocal.status === 'RUNNING';
    
    // Show loading based on local state initially
    setIsLoading(isRunningLocal || false); 

    try {
        // 2. Fetch Authoritative History from Backend
        console.log(`Fetching history for conversation: ${id}`);
        const historyData = await workflowService.getHistory(id);
        
        // Transform timestamps from ISO string to Date objects
        const fetchedMessages: ChatMessage[] = historyData.messages.map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp)
        }));

        // Update Messages View with fresh data
        setMessages(fetchedMessages);

        // Update Conversations List with fresh data
        setConversations(prev => prev.map(c => 
            c.id === id ? { ...c, messages: fetchedMessages, timestamp: new Date() } : c
        ));

        // 3. Handle Status & Stream Resumption
        const serverStatus = historyData.status; // 'RUNNING', 'COMPLETED', etc.
        
        if (serverStatus === 'RUNNING') {
            setIsLoading(true);

            // Check if we need to connect/reconnect stream
            if (!activeStreamsRef.current.has(id)) {
                console.log(`🔄 Resuming disconnected stream for conversation: ${id}`);
                const es = workflowService.connectToWorkflowStream(
                    id,
                    (data) => handleWorkflowUpdate(data, id),
                    (error) => handleWorkflowError(error, id)
                );
                activeStreamsRef.current.set(id, es);
            }
        } else {
            // It is finished on server
            setIsLoading(false);
            // If we had a local stream but server says done, close it
            closeStream(id);
        }

    } catch (e) {
        console.warn(`Failed to sync history for ${id} (using local data)`, e);
        // Fallback: If local said running, we preserve that state, 
        // effectively waiting for user action or a later refresh if network is down.
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

    try {
      const response = await workflowService.startWorkflow({
        requirement: data.content,
        repoUrl: newRepoUrl,
        logsPasted: data.logsPasted,
        logFiles: data.logFiles,
      });

      const conversationId = response.conversationId;
      setCurrentConversationId(conversationId);

      // Initialize placeholder Agent message
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
      
      // Update Conversation List (Prepend new conversation)
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
      closeStream(conversationId); // Ensure no dupes

      const es = workflowService.connectToWorkflowStream(
        conversationId,
        (data) => handleWorkflowUpdate(data, conversationId),
        (error) => handleWorkflowError(error, conversationId)
      );
      
      activeStreamsRef.current.set(conversationId, es);

    } catch (error: any) {
      console.error("Failed to start workflow", error);
      setIsLoading(false);
      
      const errorMsg: ChatMessage = {
          id: `err_${Date.now()}`,
          sender: 'agent',
          content: `❌ **Error**: ${error.message || 'Unknown error occurred'}`,
          timestamp: new Date(),
          status: 'FAILED'
      };

      const messagesWithError = [...newMessages, errorMsg];
      setMessages(messagesWithError);
      
      // Sync error to conversation list if possible
      if (currentConversationId) {
          setConversations(prev => prev.map(c => 
              c.id === currentConversationId ? { ...c, messages: messagesWithError, timestamp: new Date() } : c
          ));
      }
    }
  };

  // --- Loading Screen ---
  if (!isAppReady) {
    return (
        <div className="h-screen w-full flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-950 text-gray-400">
            <Loader2 className="w-10 h-10 animate-spin mb-4 text-blue-500" />
            <p className="font-mono text-sm">Loading AutoFlow...</p>
        </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden font-sans relative">
      <Header
        theme={theme}
        toggleTheme={toggleTheme}
        showHistoryButton={true} 
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
            currentConversationId={currentConversationId}
        />
      </div>
    </div>
  );
};

export default App;