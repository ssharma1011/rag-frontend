
import React, { useRef, useState, useEffect } from 'react';
import ChatMessage from './ChatMessage';
import { ChatMessage as IChatMessage, Theme } from '../types';
import { ArrowDown, Terminal } from './Icons';

interface MessageListProps {
  messages: IChatMessage[];
  isLoading: boolean;
  theme?: Theme;
}

const MessageList: React.FC<MessageListProps> = ({ messages, theme }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showNewMessagesBtn, setShowNewMessagesBtn] = useState(false);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);

  const isNearBottom = () => {
    const container = containerRef.current;
    if (!container) return false;
    const threshold = 150;
    const position = container.scrollHeight - container.scrollTop - container.clientHeight;
    return position < threshold;
  };

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
    setShowNewMessagesBtn(false);
    setAutoScrollEnabled(true);
  };

  const handleScroll = () => {
    const nearBottom = isNearBottom();
    setAutoScrollEnabled(nearBottom);
    if (nearBottom) {
      setShowNewMessagesBtn(false);
    }
  };

  useEffect(() => {
    if (messages.length === 0) return;

    const lastMessage = messages[messages.length - 1];
    const isUserMessage = lastMessage.role === 'user';

    if (isUserMessage) {
      scrollToBottom();
    } else {
      if (autoScrollEnabled) {
        scrollToBottom();
      } else {
        setShowNewMessagesBtn(true);
      }
    }
  }, [messages]);

  return (
    <div className="relative w-full h-full flex flex-col">
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 md:px-8 scroll-smooth"
      >
        <div className="max-w-6xl mx-auto min-h-full pt-24 pb-40">
            {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center pt-32 animate-fade-in text-center px-4">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-blue-50 to-indigo-600 flex items-center justify-center shadow-2xl shadow-blue-500/30 mb-8 ring-4 ring-white/10">
                        <Terminal className="w-10 h-10 text-white" />
                    </div>
                    <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4 tracking-tight">AutoFlow</h2>
                    <p className="text-gray-500 dark:text-gray-400 max-w-lg text-xl leading-relaxed">
                        Your intelligent coding companion. <br/>
                        Connect a repository to start analyzing.
                    </p>
                </div>
            )}
          
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} theme={theme} />
          ))}
          <div ref={messagesEndRef} className="h-1" />
        </div>
      </div>

      {showNewMessagesBtn && (
        <button
          onClick={() => scrollToBottom()}
          className="absolute bottom-32 right-8 z-30 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-full shadow-lg shadow-blue-600/30 flex items-center gap-2 transition-all transform animate-in fade-in slide-in-from-bottom-2 text-sm font-medium"
        >
          New messages <ArrowDown className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default MessageList;
