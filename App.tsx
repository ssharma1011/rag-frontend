import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import MessageList from './components/MessageList';
import ChatInput from './components/ChatInput';
import HistorySidebar from './components/HistorySidebar';
import { Theme, ChatMessage, Conversation } from './types';
import { workflowService } from './services/workflowService'; // Switched to real service

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
    if (currentConversationId && messages.length > 0) {
        // Already updated via state sync
    }
    setCurrentConversationId(null);
    setMessages([]);
    setIsRepoLocked(false);
    setIsLoading(false);
    if (pollingId) {
        clearInterval(pollingId);
        setPollingId(null);
    }
  };

  const loadConversation = (id: string) => {
    const conv = conversations.find(c => c.id === id);
    if (conv) {
      setCurrentConversationId(conv.id);
      setMessages(conv.messages);
      setRepoUrl(conv.repoUrl);
      setIsRepoLocked(true); 
      setIsHistoryOpen(false);
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
    if (!conversationId) {
        conversationId = `conv_${Date.now()}`;
        setCurrentConversationId(conversationId);
        const newConv: Conversation = {
            id: conversationId,
            repoUrl: newRepoUrl,
            messages: newMessages,
            timestamp: new Date()
        };
        setConversations(prev => [newConv, ...prev]);
    } else {
        setConversations(prev => prev.map(c => 
            c.id === conversationId 
                ? { ...c, messages: newMessages, timestamp: new Date() } 
                : c
        ));
    }

    try {
      const response = await workflowService.startWorkflow({
        requirement: data.content,
        repoUrl: newRepoUrl,
        logsPasted: data.logsPasted,
        logFiles: data.logFiles
      });

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
      
      setConversations(prev => prev.map(c => 
        c.id === conversationId 
            ? { ...c, messages: messagesWithAgent } 
            : c
      ));

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
                     content: last.content + "\n\n❌ **Connection Error**: Could not reach backend at localhost:8080."
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
          content: 'Failed to start workflow. Ensure your backend is running at http://localhost:8080',
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
      {/* Header positioned absolutely/fixed to allow content to scroll behind */}
      <Header
        theme={theme}
        toggleTheme={toggleTheme}
        showHistoryButton={isRepoLocked} 
        repoUrl={repoUrl}
        isRepoLocked={isRepoLocked}
        onHistoryClick={() => setIsHistoryOpen(true)}
        onNewChat={startNewChat}
        className="absolute top-0 left-0 right-0 w-full"
      />

      {/* Main Layout Area - Center constrained for ultra-wide monitors */}
      <div className="flex-1 relative flex flex-col max-w-5xl mx-auto w-full h-full">
        {/* MessageList takes full height of this container, padding accounts for header/input */}
        <MessageList 
            messages={messages} 
            isLoading={isLoading} 
        />
        
        {/* Input sits on top of message list visually at the bottom */}
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
      </div>
    </div>
  );
};

export default App;
