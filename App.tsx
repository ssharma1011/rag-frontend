import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import MessageList from './components/MessageList';
import ChatInput from './components/ChatInput';
import HistorySidebar from './components/HistorySidebar';
import MetricsModal from './components/MetricsModal';
import { Theme, ChatMessage, Conversation, WorkflowStatusResponse } from './types';
import { workflowService } from './services/workflowService';
import { Loader2 } from './components/Icons';

const App: React.FC = () => {
  // --- Initialization State ---
  const [isAppReady, setIsAppReady] = useState(false);

  // --- Theme State ---
  const [theme, setTheme] = useState<Theme>('light');

  // --- App State ---
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [repoUrl, setRepoUrl] = useState('');
  const [isRepoLocked, setIsRepoLocked] = useState(false);
  
  // UI State
  const [isLoading, setIsLoading] = useState(false); 
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isMetricsOpen, setIsMetricsOpen] = useState(false);
  
  // Refs for stable access inside closures/callbacks
  const activeStreamsRef = useRef<Map<string, EventSource>>(new Map());
  const currentConversationIdRef = useRef<string | null>(null);

  // Sync ref with state
  useEffect(() => {
    currentConversationIdRef.current = currentConversationId;
  }, [currentConversationId]);

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
          try {
            const parsed = JSON.parse(savedConvs).map((c: any) => ({
                ...c,
                timestamp: new Date(c.timestamp),
                messages: Array.isArray(c.messages) ? c.messages.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })) : []
            }));
            setConversations(parsed);
          } catch (err) {
            console.error("Error parsing saved conversations", err);
            localStorage.removeItem('conversations');
          }
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
        console.log(`🔌 Closing stream for ${conversationId}`);
        es.close();
        activeStreamsRef.current.delete(conversationId);
    }
  };

  // --- Real-time Handler ---
  // Using Ref for current ID check to avoid stale closures and side-effects in setters
  const handleWorkflowUpdate = (status: WorkflowStatusResponse, conversationId: string) => {
    
    // 1. Update Conversations List (Background state)
    setConversations(prevConvs => {
        return prevConvs.map(c => {
            if (c.id !== conversationId) return c;

            const msgs = [...c.messages];
            const lastMsgIndex = msgs.length - 1;
            const lastMsg = msgs[lastMsgIndex];

            // Only update if we have a valid agent message to update
            if (lastMsg && lastMsg.sender === 'agent') {
                const updatedLast = {
                    ...lastMsg,
                    content: status.message,
                    status: status.status,
                    progress: status.progress,
                    agent: status.agent
                };
                msgs[lastMsgIndex] = updatedLast;
            } else if (status.message && (!lastMsg || lastMsg.sender === 'user')) {
                // Edge case: If we received an update but don't have an agent message placeholder yet (latency race)
                msgs.push({
                    id: `msg_${Date.now()}_a`,
                    sender: 'agent',
                    content: status.message,
                    timestamp: new Date(),
                    agent: status.agent,
                    status: status.status,
                    progress: status.progress
                });
            }

            return { ...c, messages: msgs };
        });
    });

    // 2. Update Messages View (ONLY if this is the currently viewed conversation)
    if (currentConversationIdRef.current === conversationId) {
        setMessages(prevMsgs => {
            const msgs = [...prevMsgs];
            const lastMsg = msgs[msgs.length - 1];

            if (lastMsg && lastMsg.sender === 'agent') {
                 msgs[msgs.length - 1] = {
                    ...lastMsg,
                    content: status.message,
                    status: status.status,
                    progress: status.progress,
                    agent: status.agent
                 };
                 return msgs;
            } else if (status.message) {
                // Append if missing (rare race condition)
                return [...msgs, {
                    id: `msg_${Date.now()}_a`,
                    sender: 'agent',
                    content: status.message,
                    timestamp: new Date(),
                    agent: status.agent,
                    status: status.status,
                    progress: status.progress
                }];
            }
            return prevMsgs;
        });

        // Update Loading State based on status
        if (status.status === 'COMPLETED' || status.status === 'FAILED') {
            setIsLoading(false);
        } else {
            setIsLoading(true);
        }
    }

    // 3. Cleanup if done
    if (status.status === 'COMPLETED' || status.status === 'FAILED') {
        closeStream(conversationId);
    }
  };

  // --- Error Handler for Stream ---
  const handleWorkflowError = (error: any, conversationId: string) => {
    console.error(`Stream error for ${conversationId}:`, error);
    
    // Don't close immediately on minor network blips, but for now we assume error = disconnect
    const failStatus: WorkflowStatusResponse = {
        conversationId,
        status: 'FAILED',
        message: 'Connection lost. Please check backend logs or refresh.',
        agent: 'System',
        progress: 0
    };

    handleWorkflowUpdate(failStatus, conversationId);
    closeStream(conversationId);
  };

  // --- Conversation Logic ---
  const startNewChat = () => {
    setCurrentConversationId(null);
    setMessages([]);
    setIsRepoLocked(false);
    setIsLoading(false);
    // Note: We do NOT close background streams for other chats here, they continue updating history
  };

  const loadConversation = async (id: string) => {
    const conv = conversations.find(c => c.id === id);
    if (!conv) return;

    console.log(`📂 Loading conversation: ${id}`);

    // 1. Set Context
    setCurrentConversationId(id);
    setIsRepoLocked(true); 
    setRepoUrl(conv.repoUrl);
    setIsHistoryOpen(false);
    
    // 2. Optimistic Load (Instant UI feedback from local state)
    setMessages(conv.messages || []);
    
    // Check local state to show loading spinner immediately if applicable
    const lastMsgLocal = conv.messages && conv.messages.length > 0 ? conv.messages[conv.messages.length - 1] : null;
    const isRunningLocal = lastMsgLocal && lastMsgLocal.sender === 'agent' && lastMsgLocal.status === 'RUNNING';
    setIsLoading(isRunningLocal || false); 

    try {
        // 3. Fetch Full History from Server
        const historyData = await workflowService.getHistory(id);
        
        if (historyData && Array.isArray(historyData.messages)) {
            const fetchedMessages: ChatMessage[] = historyData.messages.map((m: any) => ({
                ...m,
                timestamp: new Date(m.timestamp)
            }));

            // Update UI with fresh data
            setMessages(fetchedMessages);

            // Update Background List
            setConversations(prev => prev.map(c => 
                c.id === id ? { ...c, messages: fetchedMessages, timestamp: new Date() } : c
            ));
        }

        // 4. Resume Stream if needed
        const serverStatus = historyData?.status; 
        
        if (serverStatus === 'RUNNING') {
            setIsLoading(true);

            // Reconnect if not already connected
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
            setIsLoading(false);
            closeStream(id); // Clean up active stream if server says it's done
        }

    } catch (e) {
        console.warn(`Failed to sync history for ${id} (using local data)`, e);
    }
  };

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

      // Placeholder Agent Message
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
      
      // Add to Conversation List
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

      // Start Stream
      closeStream(conversationId); 

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
      
      if (currentConversationId) {
          setConversations(prev => prev.map(c => 
              c.id === currentConversationId ? { ...c, messages: messagesWithError, timestamp: new Date() } : c
          ));
      }
    }
  };

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
        className="absolute top-0 left-0 right-0 w-full max-w-[1600px] mx-auto"
      />

      <div className="flex-1 relative flex flex-col max-w-[1600px] mx-auto w-full h-full">
        <MessageList 
            messages={messages} 
            isLoading={isLoading} 
            theme={theme}
        />
        
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-6 pt-2 z-20 pointer-events-none">
            <div className="pointer-events-auto max-w-5xl mx-auto">
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