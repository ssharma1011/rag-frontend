
import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import MessageList from './components/MessageList';
import ChatInput from './components/ChatInput';
import HistorySidebar from './components/HistorySidebar';
import MetricsModal from './components/MetricsModal';
import { Theme, ChatMessage, ConversationSummary, ChatStreamUpdate } from './types';
import { chatService } from './services/workflowService';
import { Loader2 } from './components/Icons';

const App: React.FC = () => {
  // --- Initialization State ---
  const [isAppReady, setIsAppReady] = useState(false);
  const [userId, setUserId] = useState('');

  // --- Theme State ---
  const [theme, setTheme] = useState<Theme>('light');

  // --- App State ---
  const [conversationList, setConversationList] = useState<ConversationSummary[]>([]);
  
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  
  const [repoUrl, setRepoUrl] = useState('');
  const [isRepoLocked, setIsRepoLocked] = useState(false);
  
  // UI State
  const [isLoading, setIsLoading] = useState(false); 
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isMetricsOpen, setIsMetricsOpen] = useState(false);
  
  // Refs for stable access
  const activeStreamsRef = useRef<Map<string, EventSource>>(new Map());
  const currentConversationIdRef = useRef<string | null>(null);

  useEffect(() => {
    currentConversationIdRef.current = currentConversationId;
  }, [currentConversationId]);

  // --- 1. Hydration & User ID ---
  useEffect(() => {
    const hydrate = async () => {
      try {
        // Theme
        let savedTheme = localStorage.getItem('theme') as Theme;
        if (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches) {
          savedTheme = 'dark';
        }
        if (savedTheme) setTheme(savedTheme || 'light');

        // User Identity
        let storedUserId = localStorage.getItem('autoFlowUserId');
        if (!storedUserId) {
            storedUserId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            localStorage.setItem('autoFlowUserId', storedUserId);
        }
        setUserId(storedUserId);

        // Initial Fetch
        await refreshConversationList(storedUserId);

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

  const refreshConversationList = async (uid: string) => {
    const list = await chatService.getConversations(uid);
    setConversationList(list);
  };

  // --- Stream Management ---
  const closeStream = (conversationId: string) => {
    const es = activeStreamsRef.current.get(conversationId);
    if (es) {
        es.close();
        activeStreamsRef.current.delete(conversationId);
    }
  };

  // --- Real-time Handler ---
  const handleStreamUpdate = (data: ChatStreamUpdate) => {
    const { conversationId, content, status, type, agentName } = data;

    // Only update UI if we are looking at this conversation
    if (currentConversationIdRef.current === conversationId) {
        setMessages(prev => {
            const msgs = [...prev];
            const lastMsg = msgs[msgs.length - 1];

            // If last message is from assistant, update it
            if (lastMsg && lastMsg.role === 'assistant') {
                let displayContent = content || "";
                
                if (type === 'THINKING' || type === 'TOOL') {
                   if (lastMsg.content === '' || lastMsg.status === 'RUNNING') {
                       if (type === 'THINKING' && displayContent && !displayContent.startsWith('Thinking')) {
                           displayContent = `_${displayContent}_`; 
                       }
                   }
                }

                msgs[msgs.length - 1] = {
                    ...lastMsg,
                    content: displayContent || lastMsg.content, // Keep old content if new is empty
                    status: status,
                    agentName: agentName
                };
                return msgs;
            } 
            
            // If we don't have an assistant message yet, create one
            if (!lastMsg || lastMsg.role === 'user') {
                return [...msgs, {
                    id: `msg_${Date.now()}`,
                    role: 'assistant',
                    content: content || "",
                    timestamp: new Date(),
                    status: 'RUNNING',
                    agentName: agentName || 'System'
                }];
            }

            return prev;
        });

        if (status === 'COMPLETED' || status === 'FAILED') {
            setIsLoading(false);
            closeStream(conversationId);
            refreshConversationList(userId);
        } else {
            setIsLoading(true);
        }
    }
  };

  const handleStreamError = (error: any, conversationId: string) => {
    console.error(`Stream error for ${conversationId}`, error);
    if (currentConversationIdRef.current === conversationId) {
        setMessages(prev => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg && lastMsg.status === 'FAILED') return prev;
            return [...prev, {
                id: `err_${Date.now()}`,
                role: 'assistant',
                content: '❌ Connection lost.',
                timestamp: new Date(),
                status: 'FAILED',
                agentName: 'System'
            }];
        });
        setIsLoading(false);
    }
    closeStream(conversationId);
  };

  // --- Conversation Actions ---

  const startNewChat = () => {
    setCurrentConversationId(null);
    currentConversationIdRef.current = null;
    setMessages([]);
    setIsRepoLocked(false);
    setIsLoading(false);
    setRepoUrl(''); 
  };

  const loadConversation = async (id: string) => {
    const summary = conversationList.find(c => c.conversationId === id);
    if (!summary && conversationList.length > 0) return;

    console.log(`📂 Loading conversation: ${id}`);
    
    // 1. Set Context
    setCurrentConversationId(id);
    currentConversationIdRef.current = id;

    if (summary) {
        setRepoUrl(summary.repoUrl);
        setIsRepoLocked(true);
    }
    setIsHistoryOpen(false);
    setMessages([]); 
    setIsLoading(true);

    try {
        const [historyData, statusData] = await Promise.all([
             chatService.getHistory(id),
             chatService.getConversationStatus(id)
        ]);

        const mappedMessages: ChatMessage[] = historyData.messages.map((m: any) => ({
            id: `hist_${Math.random()}`,
            role: m.role,
            content: m.content,
            timestamp: new Date(m.timestamp),
            status: 'COMPLETED',
            agentName: m.role === 'assistant' ? 'Assistant' : undefined
        }));
        
        setMessages(mappedMessages);
        
        if (statusData.hasActiveStream) {
             console.log("🌊 Active stream detected, reconnecting...");
             closeStream(id);
             const es = chatService.connectToStream(
                 id, 
                 (d) => handleStreamUpdate(d), 
                 (e) => handleStreamError(e, id)
             );
             activeStreamsRef.current.set(id, es);
             setIsLoading(true);
        } else {
            setIsLoading(false);
        }

    } catch (e) {
        console.error("Failed to load conversation", e);
        setIsLoading(false);
    }
  };

  const handleDeleteConversation = async (id: string) => {
    if(!confirm("Are you sure you want to delete this conversation?")) return;
    try {
        await chatService.deleteConversation(id);
        setConversationList(prev => prev.filter(c => c.conversationId !== id));
        if (currentConversationId === id) startNewChat();
    } catch (e) {
        alert("Failed to delete conversation");
    }
  };

  const handleSendMessage = async (data: {
    content: string;
    repoUrl: string;
    logsPasted?: string;
    logFiles?: File[];
  }) => {
    
    let finalMessage = data.content;
    
    if (data.logFiles && data.logFiles.length > 0) {
        finalMessage += "\n\n--- ATTACHED LOG FILES ---\n";
        for (const file of data.logFiles) {
            const text = await file.text();
            finalMessage += `\n[File: ${file.name}]\n\`\`\`\n${text.substring(0, 50000)}\n\`\`\`\n`; 
        }
    }

    if (data.logsPasted) {
         finalMessage += `\n\n--- PASTED LOGS ---\n\`\`\`\n${data.logsPasted}\n\`\`\``;
    }

    const isNew = !currentConversationId;

    const userMsg: ChatMessage = {
        id: `msg_${Date.now()}_u`,
        role: 'user',
        content: finalMessage,
        timestamp: new Date(),
        status: 'COMPLETED'
    };
    
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);
    setRepoUrl(data.repoUrl);
    setIsRepoLocked(true);

    try {
        const response = await chatService.sendMessage({
            message: finalMessage,
            repoUrl: isNew ? data.repoUrl : undefined,
            conversationId: isNew ? undefined : currentConversationId!,
            userId: userId,
            branch: 'main', 
            mode: 'EXPLORE'
        });

        const convId = response.conversationId;
        
        if (isNew) {
            setCurrentConversationId(convId);
            currentConversationIdRef.current = convId; 
            
            setConversationList(prev => [{
                conversationId: convId,
                repoUrl: data.repoUrl,
                status: 'ACTIVE',
                createdAt: new Date().toISOString(),
                lastActivity: new Date().toISOString(),
                messageCount: 1
            }, ...prev]);
        }

        closeStream(convId);
        const es = chatService.connectToStream(
            convId,
            (d) => handleStreamUpdate(d),
            (e) => handleStreamError(e, convId)
        );
        activeStreamsRef.current.set(convId, es);

    } catch (e: any) {
        console.error("Failed to send message", e);
        setMessages(prev => [...prev, {
            id: `err_${Date.now()}`,
            role: 'assistant',
            content: `Error: ${e.message}`,
            timestamp: new Date(),
            status: 'FAILED'
        }]);
        setIsLoading(false);
    }
  };

  if (!isAppReady) {
    return (
        <div className="h-screen w-full flex flex-col items-center justify-center bg-gray-50 dark:bg-[#0B0C15] text-gray-400">
            <Loader2 className="w-10 h-10 animate-spin mb-4 text-primary-500" />
            <p className="font-mono text-sm tracking-widest uppercase">Initializing AutoFlow...</p>
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
            conversations={conversationList}
            onSelectConversation={loadConversation}
            onDeleteConversation={handleDeleteConversation}
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
