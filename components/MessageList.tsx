import React, { useRef, useState, useEffect } from 'react';
import ChatMessage from './ChatMessage';
import { ChatMessage as IChatMessage } from '../types';
import { ArrowDown, Terminal } from './Icons';

interface MessageListProps {
  messages: IChatMessage[];
  isLoading: boolean;
}

const MessageList: React.FC<MessageListProps> = ({ messages }) => {
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
    const isUserMessage = lastMessage.sender === 'user';

    // If it's a user message, force scroll to bottom always
    if (isUserMessage) {
      scrollToBottom();
    } else {
      // If agent message, only scroll if we were already at the bottom
      if (autoScrollEnabled) {
        scrollToBottom();
      } else {
        // Only show notification if we are NOT auto-scrolling (user scrolled up)
        setShowNewMessagesBtn(true);
      }
    }
  // Remove autoScrollEnabled from dependency array.
  // We only want to evaluate this logic when *messages* change.
  // If the user scrolls up (changing autoScrollEnabled), we do NOT want to show the button immediately.
  // The button should only appear if a NEW message/token arrives while they are scrolled up.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  return (
    <div className="relative w-full h-full flex flex-col">
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 md:px-6 scroll-smooth"
      >
        {/* 
            Padding Top: Space for the fixed header (approx 70px) + visual gap
            Padding Bottom: Space for the floating input (approx 140px) + visual gap 
        */}
        <div className="max-w-3xl mx-auto min-h-full pt-24 pb-48">
            {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center pt-20 animate-fade-in text-center px-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-blue-500/30 mb-6 ring-4 ring-white/10">
                        <Terminal className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3 tracking-tight">AutoFlow</h2>
                    <p className="text-gray-500 dark:text-gray-400 max-w-md text-lg leading-relaxed">
                        Your intelligent coding companion. <br/>
                        Connect a repository to start.
                    </p>
                </div>
            )}
          
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
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