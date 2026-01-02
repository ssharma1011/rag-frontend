
import React, { useMemo } from 'react';
import { X, MessageCirclePlus, Trash2, Github, Clock } from './Icons';
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
  
  // Group conversations by time period
  const groupedConversations = useMemo(() => {
    const groups: Record<string, ConversationSummary[]> = {
      'Today': [],
      'Yesterday': [],
      'Previous 7 Days': [],
      'Older': []
    };

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);

    // Sort descending first
    const sorted = [...conversations].sort((a, b) => 
        new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
    );

    sorted.forEach(conv => {
      const date = new Date(conv.lastActivity);
      const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

      if (dateOnly.getTime() === today.getTime()) {
        groups['Today'].push(conv);
      } else if (dateOnly.getTime() === yesterday.getTime()) {
        groups['Yesterday'].push(conv);
      } else if (dateOnly > lastWeek) {
        groups['Previous 7 Days'].push(conv);
      } else {
        groups['Older'].push(conv);
      }
    });

    return groups;
  }, [conversations]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300" 
        onClick={onClose}
      />
      
      {/* Sidebar Panel */}
      <div className="relative w-80 lg:w-96 bg-white/95 dark:bg-[#0B0C15]/95 backdrop-blur-2xl border-r border-gray-200 dark:border-gray-800 shadow-2xl flex flex-col h-full animate-slide-in">
        
        {/* Header */}
        <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 font-sans">
                History
            </h2>
            <button 
                onClick={onClose} 
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400 dark:text-gray-600">
                <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                    <MessageCirclePlus className="w-6 h-6 opacity-50" />
                </div>
                <p className="text-sm font-medium">No conversations yet</p>
                <p className="text-xs mt-1 opacity-70">Start a new chat to see it here</p>
            </div>
          ) : (
            <div className="space-y-8">
              {Object.entries(groupedConversations).map(([group, items]) => (
                items.length > 0 && (
                  <div key={group} className="animate-fade-in">
                    <h3 className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3 px-2">
                        {group}
                    </h3>
                    <div className="space-y-1">
                        {items.map((conv, idx) => {
                            const isActive = conv.status === 'ACTIVE';
                            const repoName = conv.repoName || conv.repoUrl?.split('/').pop() || "Untitled Session";
                            
                            return (
                                <div
                                    key={conv.conversationId}
                                    className={`
                                        group relative p-3 rounded-xl cursor-pointer transition-all duration-200 border
                                        ${isActive 
                                            ? 'bg-primary-50 dark:bg-primary-900/10 border-primary-200 dark:border-primary-800/30 shadow-sm' 
                                            : 'bg-transparent border-transparent hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:border-gray-100 dark:hover:border-gray-800'}
                                    `}
                                    style={{ animationDelay: `${idx * 50}ms` }}
                                    onClick={() => onSelectConversation(conv.conversationId)}
                                >
                                    <div className="flex flex-col gap-1.5">
                                        {/* Top Row: Title & Status */}
                                        <div className="flex justify-between items-start gap-3">
                                            <span className={`text-sm font-medium line-clamp-1 ${isActive ? 'text-primary-700 dark:text-primary-300' : 'text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white'}`}>
                                                {repoName}
                                            </span>
                                            {isActive && (
                                                <span className="w-2 h-2 rounded-full bg-primary-500 shadow-[0_0_8px_rgba(14,165,233,0.6)] flex-shrink-0 animate-pulse mt-1.5" />
                                            )}
                                        </div>
                                        
                                        {/* Bottom Row: Metadata */}
                                        <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
                                            <div className="flex items-center gap-1 min-w-0">
                                                <Github className="w-3 h-3 flex-shrink-0" />
                                                <span className="truncate font-mono opacity-80">
                                                    {conv.repoUrl ? conv.repoUrl.replace('https://github.com/', '') : 'Local'}
                                                </span>
                                            </div>
                                            <span className="w-0.5 h-0.5 rounded-full bg-gray-300 dark:bg-gray-600 flex-shrink-0" />
                                            <span className="flex-shrink-0 whitespace-nowrap">
                                                {new Date(conv.lastActivity).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Delete Button (visible on group hover) */}
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onDeleteConversation(conv.conversationId); }}
                                        className="absolute top-1/2 -translate-y-1/2 right-2 p-2 rounded-lg 
                                                   bg-white dark:bg-gray-800 
                                                   text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 
                                                   border border-gray-100 dark:border-gray-700
                                                   opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-lg translate-x-2 group-hover:translate-x-0"
                                        title="Delete"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                  </div>
                )
              ))}
            </div>
          )}
        </div>
        
        {/* Footer Gradient Fade */}
        <div className="h-6 bg-gradient-to-t from-white dark:from-[#0B0C15] to-transparent pointer-events-none absolute bottom-0 left-0 right-0" />
      </div>
    </div>
  );
};

export default HistorySidebar;
