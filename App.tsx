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

  // --- 1. Efficient Hydration (Fixes 8s Load Time) ---
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

        // Conversations (Heavy payload)
        // We defer this slightly to let the UI paint the splash screen first if needed
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

    // Small timeout to allow first paint
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

  // --- Real-time Handler (Global for all conversations) ---
  const handleWorkflowUpdate = (status: WorkflowStatusResponse, conversationId: string) => {
    setConversations(prevConvs => {
        return prevConvs.map(c => {
            if (c.id !== conversationId) return c;

            // Found the conversation to update
            const msgs = [...c.messages];
            const lastMsgIndex = msgs.length - 1;
            const lastMsg = msgs[lastMsgIndex];

            if (lastMsg && lastMsg.sender === 'agent') {
                // Update existing agent message (streaming effect)
                const updatedLast = {
                    ...lastMsg,
                    content: status.message,
                    status: status.status,
                    progress: status.progress,
                    agent: status.agent
                };
                msgs[lastMsgIndex] = updatedLast;
            }

            return { ...c, messages: msgs };
        });
    });

    // If this update belongs to the CURRENTLY viewed conversation, update the messages view too
    setCurrentConversationId(currId => {
        if (currId === conversationId) {
            // We duplicate logic here because 'messages' state drives the view
            // In a more complex app, we'd select 'messages' derived from 'conversations'
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

            // Update loading state for current view
            if (status.status === 'COMPLETED' || status.status === 'FAILED') {
                setIsLoading(false);
            }
        }
        return currId;
    });

    // Cleanup stream if done
    if (status.status === 'COMPLETED' || status.status === 'FAILED') {
        const es = activeStreamsRef.current.get(conversationId);
        if (es) {
            es.close();
            activeStreamsRef.current.delete(conversationId);
        }
    }
  };

  // --- Conversation Management ---
  const startNewChat = () => {
    // Note: We do NOT close existing streams. Background chats can continue.
    setCurrentConversationId(null);
    setMessages([]);
    setIsRepoLocked(false);
    setIsLoading(false);
  };

  const loadConversation = async (id: string) => {
    const conv = conversations.find(c => c.id === id);
    if (conv) {
      setCurrentConversationId(conv.id);
      setIsRepoLocked(true); 
      setRepoUrl(conv.repoUrl);
      setMessages(conv.messages);
      setIsHistoryOpen(false);
      
      // Determine if this chat is currently running (based on last message)
      const lastMsg = conv.messages[conv.messages.length - 1];
      const isRunning = lastMsg && lastMsg.sender === 'agent' && lastMsg.status === 'RUNNING';
      setIsLoading(isRunning || false);

      // Check if we need to re-attach a stream? 
      // Ideally streams are kept in 'activeStreamsRef'. 
      // If the user refreshed the page, the stream is lost. We might need to reconnect.
      if (isRunning && !activeStreamsRef.current.has(id)) {
         // Reconnect logic would go here if backend supports re-attaching to existing jobs easily
         // For now, we assume streams are only live per session.
         // If a page refresh happened, the stream is dead, but we can try to fetch history to see if it finished.
         try {
             const historyData = await workflowService.getHistory(id);
             if (historyData.status === 'COMPLETED' || historyData.status === 'FAILED') {
                 // It finished while we were gone
                 setIsLoading(false);
                 // Update the specific conversation with final state
                 const completedMsg: ChatMessage = {
                     ...lastMsg!,
                     status: historyData.status as WorkflowStatus,
                     // We might want to update content here if the history API returns full content
                 };
                 // Update local state
                 setMessages(prev => [...prev.slice(0, -1), completedMsg]);
                 setConversations(prev => prev.map(c => c.id === id ? {...c, messages: [...c.messages.slice(0,-1), completedMsg]} : c));
             }
         } catch (e) {
             console.warn("Could not check status of running chat", e);
         }
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
      
      // Update Conversation List
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
      // We store it in the Map so it persists across navigation
      if (activeStreamsRef.current.has(conversationId)) {
          activeStreamsRef.current.get(conversationId)?.close();
      }

      const es = workflowService.connectToWorkflowStream(
        conversationId,
        (data) => handleWorkflowUpdate(data, conversationId),
        (error) => {
            console.error("SSE Error:", error);
            // Optionally handle stream disconnect error visual here
        }
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
              c.id === currentConversationId 
                  ? { ...c, messages: messagesWithError, timestamp: new Date() } 
                  : c
          ));
      } else {
          // If we failed before getting a conversation ID (e.g., startup failure)
          // We can't easily save it to a specific ID unless we gen one.
          // For now, just show in UI.
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