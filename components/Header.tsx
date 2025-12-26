import React from 'react';
import { Home, History, MessageCirclePlus, BarChart2, Moon, Sun, Github } from './Icons';
import { Theme } from '../types';

interface HeaderProps {
  theme: Theme;
  toggleTheme: () => void;
  showHistoryButton: boolean;
  repoUrl: string;
  isRepoLocked: boolean;
  onHistoryClick: () => void;
  onNewChat: () => void;
  onMetricsClick: () => void;
  className?: string;
}

const Header: React.FC<HeaderProps> = ({ 
  theme, 
  toggleTheme, 
  showHistoryButton, 
  repoUrl, 
  isRepoLocked, 
  onHistoryClick, 
  onNewChat,
  onMetricsClick,
  className = ''
}) => {
  return (
    <header className={`px-6 py-3 z-50 border-b border-gray-200/50 dark:border-gray-800/50 bg-white/70 dark:bg-gray-950/70 backdrop-blur-xl transition-all duration-300 ${className}`}>
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        {/* Left: Branding */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 group cursor-default">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-shadow">
                <Home className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-lg font-bold tracking-tight text-gray-900 dark:text-white leading-none font-sans">AutoFlow</h1>
              <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 tracking-wider uppercase">AI Agent</span>
            </div>
          </div>

          {showHistoryButton && (
            <button 
              onClick={onHistoryClick}
              className="ml-4 flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-gray-800/50 transition-all"
            >
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">History</span>
            </button>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
            {/* Repo chip (only if locked) */}
            {isRepoLocked && (
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-gray-100/50 dark:bg-gray-900/50 rounded-full border border-gray-200/50 dark:border-gray-700/50 mr-2 backdrop-blur-md">
                    <Github className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                    <span className="text-xs font-mono text-gray-600 dark:text-gray-300 max-w-[150px] truncate">
                        {repoUrl.replace('https://github.com/', '')}
                    </span>
                </div>
            )}

          <button 
            onClick={onNewChat}
            className="p-2 text-gray-500 hover:text-green-600 dark:text-gray-400 dark:hover:text-green-400 transition-colors"
            title="New Chat"
          >
            <MessageCirclePlus className="w-5 h-5" />
          </button>

          <button 
             onClick={onMetricsClick}
             className="p-2 text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400 transition-colors"
             title="Metrics"
          >
            <BarChart2 className="w-5 h-5" />
          </button>

          <div className="w-px h-6 bg-gray-200 dark:bg-gray-800 mx-1"></div>

          <button 
            onClick={toggleTheme}
            className="p-2 rounded-full bg-gray-100/50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;