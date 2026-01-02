
import React from 'react';
import { X, Link, MessageCirclePlus, Loader2, FileText, Trash2 } from './Icons';
import { ConversationSummary } from '../types';

interface HistorySidebarProps {
  isOpen: boolean;
  conversations: ConversationSummary[];
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onClose: () => void;
}

const HistorySidebar: React.FC<HistorySidebarProps> = ({ 
  isOpen, 
  conversations, 
  onSelectConversation, 
  onDeleteConversation,
  onClose 
}) => {
  if (!isOpen) return null;

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
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
      
      <div className="relative w-80 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-r border-gray-200 dark:border-gray-800 shadow-2xl overflow-hidden flex flex-col h-full animate-in slide-in-from-left duration-300">
        
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
                {conversations.map((conv) => {
                    const isActive = conv.status === 'ACTIVE';
                    return (
                        <div
                            key={conv.conversationId}
                            className={`
                                group relative p-3 rounded-xl cursor-pointer transition-all border
                                ${isActive 
                                    ? 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800/50 shadow-sm' 
                                    : 'bg-white dark:bg-gray-800/40 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}
                            `}
                        >
                            <div className="flex flex-col gap-1" onClick={() => onSelectConversation(conv.conversationId)}>
                                <div className="flex justify-between items-start gap-2">
                                    <div className="text-sm font-medium text-gray-800 dark:text-gray-200 line-clamp-1">
                                        {conv.repoName || "Conversation"}
                                    </div>
                                    {isActive && (
                                        <span className="w-2 h-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0 animate-pulse" />
                                    )}
                                </div>
                                
                                <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-mono">
                                    <Link className="w-3 h-3 flex-shrink-0" />
                                    <span className="truncate max-w-[120px]">{conv.repoUrl?.replace('https://', '') || 'No Repo'}</span>
                                </div>
                                
                                <div className="flex items-center justify-between text-[10px] text-gray-400 mt-1">
                                    <span>{conv.messageCount} msgs</span>
                                    <span>{formatTime(conv.lastActivity)}</span>
                                </div>
                            </div>

                            {/* Delete Action (visible on hover) */}
                            <button 
                                onClick={(e) => { e.stopPropagation(); onDeleteConversation(conv.conversationId); }}
                                className="absolute top-2 right-2 p-1.5 rounded-md bg-white/80 dark:bg-gray-700/80 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                title="Delete"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    );
                })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HistorySidebar;
