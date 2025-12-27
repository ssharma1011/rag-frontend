import React from 'react';
import { X, Link, MessageCirclePlus } from './Icons';
import { Conversation } from '../types';

interface HistorySidebarProps {
  isOpen: boolean;
  conversations: Conversation[];
  onSelectConversation: (id: string) => void;
  onClose: () => void;
}

const HistorySidebar: React.FC<HistorySidebarProps> = ({ 
  isOpen, 
  conversations, 
  onSelectConversation, 
  onClose 
}) => {
  if (!isOpen) return null;

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (days === 1) return 'Yesterday';
    return date.toLocaleDateString();
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div 
        className="absolute inset-0 bg-gray-900/30 backdrop-blur-sm transition-opacity duration-300" 
        onClick={onClose}
      />
      
      <div className="relative w-80 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border-r border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden flex flex-col h-full animate-in slide-in-from-left duration-300">
        
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Past Sessions</h2>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors text-gray-500">
              <X className="w-5 h-5" />
            </button>
        </div>

        <div className="p-3 flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                <MessageCirclePlus className="w-8 h-8 mb-2 opacity-50" />
                <span className="text-sm">No history yet</span>
            </div>
          ) : (
            <div className="space-y-2">
                {conversations.map((conv) => (
                <div
                    key={conv.id}
                    onClick={() => onSelectConversation(conv.id)}
                    className="group p-3 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-all border border-transparent hover:border-gray-200 dark:hover:border-gray-700"
                >
                    <div className="text-sm font-medium text-gray-800 dark:text-gray-200 line-clamp-2 mb-2 leading-relaxed">
                    {conv.messages[0]?.content || "New Conversation"}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono">
                    <div className="flex items-center gap-1.5 truncate max-w-[65%] text-gray-500 dark:text-gray-500 group-hover:text-blue-500 transition-colors">
                        <Link className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{conv.repoUrl.replace('https://', '').replace('http://', '')}</span>
                    </div>
                    <span>{formatTime(conv.timestamp)}</span>
                    </div>
                </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HistorySidebar;