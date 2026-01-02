
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
  // We now fetch conversations from server, so this is just the summary list for sidebar
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
                // For THINKING or TOOL, we might just show it as the current content or status
                // For PARTIAL, content is the accumulated text
                
                let displayContent = content || "";
                
                // If we receive "THINKING" but already have partial content, 
                // we might want to preserve the partial content or append status.
                // For simplicity in this migration:
                // If type is PARTIAL or COMPLETE, use content as main text.
                // If type is THINKING/TOOL, update agentName status but keep text if possible, 
                // OR simply display the thinking status if no text yet.
                
                if (type === 'THINKING' || type === 'TOOL') {
                   // Optional: You could have a separate 'statusMessage' field in ChatMessage
                   // For now, if we have no content yet, show the thinking message
                   if (lastMsg.content === '' || lastMsg.status === 'RUNNING') {
                       // Don't overwrite actual partial content with "Thinking"
                       if (type === 'THINKING' && !displayContent.startsWith('Thinking')) {
                           displayContent = `_${displayContent}_`; // Italics for status
                       }
                   }
                }

                msgs[msgs.length - 1] = {
                    ...lastMsg,
                    content: displayContent,
                    status: status,
                    agentName: agentName
                };
                return msgs;
            } 
            
            // If we don't have an assistant message yet, create one
            if ((!lastMsg || lastMsg.role === 'user') && (content || type === 'THINKING')) {
                return [...msgs, {
                    id: `msg_${Date.now()}`,
                    role: 'assistant',
                    content: content || "...",
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
            refreshConversationList(userId); // Refresh list to update timestamps/counts
        } else {
            setIsLoading(true);
        }
    }
  };

  const handleStreamError = (error: any, conversationId: string) => {
    console.error(`Stream error for ${conversationId}`, error);
    if (currentConversationIdRef.current === conversationId) {
        setMessages(prev => [...prev, {
            id: `err_${Date.now()}`,
            role: 'assistant',
            content: '❌ Connection lost.',
            timestamp: new Date(),
            status: 'FAILED',
            agentName: 'System'
        }]);
        setIsLoading(false);
    }
    closeStream(conversationId);
  };

  // --- Conversation Actions ---

  const startNewChat = () => {
    setCurrentConversationId(null);
    setMessages([]);
    setIsRepoLocked(false);
    setIsLoading(false);
    setRepoUrl(''); // Clear repo for clean slate
  };

  const loadConversation = async (id: string) => {
    // Check if valid
    const summary = conversationList.find(c => c.conversationId === id);
    if (!summary && conversationList.length > 0) return; // Allow loading if list empty/loading? No.

    console.log(`📂 Loading conversation: ${id}`);
    
    // 1. Set Context
    setCurrentConversationId(id);
    if (summary) {
        setRepoUrl(summary.repoUrl);
        setIsRepoLocked(true);
    }
    setIsHistoryOpen(false);
    setMessages([]); // Clear previous
    setIsLoading(true);

    try {
        // 2. Fetch History
        const data = await chatService.getHistory(id);
        const mappedMessages: ChatMessage[] = data.messages.map((m: any) => ({
            id: `hist_${Math.random()}`,
            role: m.role, // 'user' | 'assistant'
            content: m.content,
            timestamp: new Date(m.timestamp),
            status: 'COMPLETED',
            agentName: m.role === 'assistant' ? 'Assistant' : undefined
        }));
        
        setMessages(mappedMessages);
        
        // 3. Check status (if active, resume stream)
        // If the summary says ACTIVE, we can try to connect to stream
        if (summary?.status === 'ACTIVE') {
             // Close existing
             closeStream(id);
             const es = chatService.connectToStream(
                 id, 
                 (d) => handleStreamUpdate(d), 
                 (e) => handleStreamError(e, id)
             );
             activeStreamsRef.current.set(id, es);
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
        
        // Update list
        setConversationList(prev => prev.filter(c => c.conversationId !== id));
        
        // If current, reset
        if (currentConversationId === id) {
            startNewChat();
        }
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
    
    // Combine logs into message since API is JSON only
    let finalMessage = data.content;
    
    // Process Log Files content
    if (data.logFiles && data.logFiles.length > 0) {
        finalMessage += "\n\n--- ATTACHED LOG FILES ---\n";
        for (const file of data.logFiles) {
            const text = await file.text();
            finalMessage += `\n[File: ${file.name}]\n\`\`\`\n${text.substring(0, 50000)}\n\`\`\`\n`; // Cap size to avoid huge payloads
        }
    }

    // Process Pasted Logs
    if (data.logsPasted) {
         finalMessage += `\n\n--- PASTED LOGS ---\n\`\`\`\n${data.logsPasted}\n\`\`\``;
    }

    const isNew = !currentConversationId;

    // Optimistic UI Update
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
        // Send API Request
        const response = await chatService.sendMessage({
            message: finalMessage,
            repoUrl: isNew ? data.repoUrl : undefined,
            conversationId: isNew ? undefined : currentConversationId!,
            userId: userId,
            mode: 'EXPLORE' // Default mode
        });

        const convId = response.conversationId;
        
        if (isNew) {
            setCurrentConversationId(convId);
            // Add temp to list
            setConversationList(prev => [{
                conversationId: convId,
                repoUrl: data.repoUrl,
                status: 'ACTIVE',
                createdAt: new Date().toISOString(),
                lastActivity: new Date().toISOString(),
                messageCount: 1
            }, ...prev]);
        }

        // Connect Stream
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
