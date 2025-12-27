import React from 'react';
import ReactMarkdown from 'react-markdown';
import { User, Bot, Loader2, CheckCircle2, XCircle, Clock, Terminal } from './Icons';
import { ChatMessage as IChatMessage } from '../types';

interface ChatMessageProps {
  message: IChatMessage;
}

const AgentMessage: React.FC<{ message: IChatMessage }> = ({ message }) => {
  const isRunning = message.status === 'RUNNING';
  const isCompleted = message.status === 'COMPLETED';
  const isFailed = message.status === 'FAILED';

  return (
    <div className="flex flex-col mb-8 animate-slide-up">
        {/* Header Badge */}
        <div className="flex items-center gap-2 mb-2 ml-1">
            <div className={`
                w-6 h-6 rounded-md flex items-center justify-center transition-colors duration-300
                ${isRunning ? 'bg-blue-500/10 text-blue-500' : 
                  isCompleted ? 'bg-green-500/10 text-green-500' :
                  isFailed ? 'bg-red-500/10 text-red-500' : 'bg-gray-500/10 text-gray-500'}
            `}>
                <Bot className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                {message.agent || 'AutoFlow Agent'}
            </span>
            <span className="text-xs text-gray-400">•</span>
            <span className="text-[10px] text-gray-400 font-mono">
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
        </div>

        {/* Card */}
        <div className={`
            relative overflow-hidden rounded-2xl border transition-all duration-500
            ${isRunning 
                ? 'bg-white dark:bg-gray-800 border-blue-400 dark:border-blue-600 shadow-[0_0_30px_rgba(37,99,235,0.15)] ring-1 ring-blue-500/20' 
                : 'bg-white/80 dark:bg-gray-800/80 border-gray-200 dark:border-gray-700/50 shadow-sm'}
        `}>
            
            {/* PROGRESS BAR - Prominent */}
            {isRunning && (
                 <div className="w-full h-1 bg-gray-100 dark:bg-gray-700">
                    <div 
                        className="h-full bg-blue-500 shadow-[0_0_10px_#3b82f6] transition-all duration-500 ease-out"
                        style={{ width: `${(message.progress || 0) * 100}%` }}
                    />
                 </div>
            )}

            <div className="p-5 md:p-6">
                {/* Status Indicator inside card */}
                {isRunning && (
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100 dark:border-gray-700/50">
                        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-sm font-medium animate-pulse">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Processing workflow... {Math.round((message.progress || 0) * 100)}%</span>
                        </div>
                        <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Active</span>
                    </div>
                )}
                
                {isCompleted && (
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-4 text-sm font-medium">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Workflow completed</span>
                    </div>
                )}

                {isFailed && (
                    <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-4 text-sm font-medium">
                        <XCircle className="w-4 h-4" />
                        <span>Workflow failed</span>
                    </div>
                )}

                {/* Content */}
                <div className="markdown-body prose prose-sm md:prose-base dark:prose-invert max-w-none text-gray-800 dark:text-gray-200 font-normal leading-relaxed">
                    <ReactMarkdown>
                        {message.content}
                    </ReactMarkdown>
                </div>
            </div>
        </div>
    </div>
  );
};

const UserMessage: React.FC<{ message: IChatMessage }> = ({ message }) => {
  return (
    <div className="flex justify-end mb-8 animate-slide-up">
        <div className="max-w-2xl">
            <div className="flex justify-end items-center gap-2 mb-2 mr-1">
                 <span className="text-[10px] text-gray-400 font-mono">
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">You</span>
                <div className="w-6 h-6 rounded-md bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500">
                    <User className="w-3.5 h-3.5" />
                </div>
            </div>

            <div className="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-2xl rounded-tr-sm px-5 py-4 shadow-sm border border-gray-200 dark:border-gray-700/50">
                <div className="text-sm md:text-base whitespace-pre-wrap leading-relaxed">{message.content}</div>
            </div>
        </div>
    </div>
  );
};

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  if (message.sender === 'user') return <UserMessage message={message} />;
  return <AgentMessage message={message} />;
};

export default ChatMessage;