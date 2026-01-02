
import React, { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
// @ts-ignore
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { User, Bot, Loader2, CheckCircle2, XCircle, Copy, Check as CheckIcon } from './Icons';
import { ChatMessage as IChatMessage, Theme } from '../types';

interface ChatMessageProps {
  message: IChatMessage;
  theme?: Theme;
}

interface CodeBlockProps {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
  theme?: Theme;
}

// --- Custom Code Block Component ---
const CodeBlock = ({ inline, className, children, theme, ...props }: CodeBlockProps) => {
  const [isCopied, setIsCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';
  const isDark = theme === 'dark';
  const content = String(children).replace(/\n$/, '');
  
  const isInline = inline || (!language && !content.includes('\n') && content.length < 100);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  if (isInline) {
    return (
      <code className="bg-gray-100 dark:bg-gray-800 text-pink-600 dark:text-pink-400 px-1.5 py-0.5 rounded text-[13px] font-mono border border-gray-200 dark:border-gray-700 break-words" {...props}>
        {children}
      </code>
    );
  }

  return (
    <div className={`relative group my-5 rounded-lg overflow-hidden border transition-colors duration-200 ${
      isDark ? 'border-gray-700 bg-[#1e1e1e]' : 'border-gray-200 bg-white shadow-sm'
    }`}>
      <div className={`flex items-center justify-between px-4 py-2 border-b ${
        isDark ? 'bg-[#252526] border-gray-700' : 'bg-gray-50/80 border-gray-100'
      }`}>
        <span className={`text-xs font-mono font-medium lowercase ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          {language || 'text'}
        </span>
        <button
          onClick={handleCopy}
          className={`flex items-center gap-1.5 text-xs transition-colors ${
            isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          {isCopied ? (
            <>
              <CheckIcon className="w-3.5 h-3.5 text-green-500" />
              <span className="text-green-500 font-medium">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <SyntaxHighlighter
        style={isDark ? vscDarkPlus : vs}
        language={language || 'text'}
        PreTag="div"
        wrapLongLines={true}
        customStyle={{
            margin: 0,
            borderRadius: 0,
            padding: '1.25rem',
            background: 'transparent',
            fontSize: '0.875rem',
            lineHeight: '1.6',
            maxWidth: '100%',
        }}
        codeTagProps={{
            style: {
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 'inherit',
                whiteSpace: 'pre-wrap', 
                wordBreak: 'break-word' 
            }
        }}
        {...props}
      >
        {content}
      </SyntaxHighlighter>
    </div>
  );
};

// --- Assistant Message Component ---
const AssistantMessage: React.FC<{ message: IChatMessage; theme?: Theme }> = ({ message, theme }) => {
  const isRunning = message.status === 'RUNNING';
  const isCompleted = message.status === 'COMPLETED';
  const isFailed = message.status === 'FAILED';

  const markdownComponents = useMemo(() => ({
    h1: ({children}: any) => <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mt-8 mb-4 pb-2 border-b border-gray-200 dark:border-gray-800 first:mt-0">{children}</h1>,
    h2: ({children}: any) => <h2 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-gray-100 mt-8 mb-3 first:mt-0">{children}</h2>,
    h3: ({children}: any) => <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mt-6 mb-2">{children}</h3>,
    p: ({children}: any) => <p className="text-base leading-7 md:leading-relaxed text-gray-700 dark:text-gray-300 mb-4 last:mb-0 break-words">{children}</p>,
    ul: ({children}: any) => <ul className="list-disc list-outside ml-5 mb-4 space-y-1.5 text-gray-700 dark:text-gray-300 marker:text-gray-400">{children}</ul>,
    ol: ({children}: any) => <ol className="list-decimal list-outside ml-5 mb-4 space-y-1.5 text-gray-700 dark:text-gray-300 marker:text-gray-400">{children}</ol>,
    li: ({children}: any) => <li className="pl-1">{children}</li>,
    blockquote: ({children}: any) => <blockquote className="border-l-4 border-blue-500 pl-4 py-1 my-5 bg-blue-50 dark:bg-blue-900/10 text-gray-700 dark:text-gray-300 italic rounded-r">{children}</blockquote>,
    a: ({href, children}: any) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline font-medium break-all">{children}</a>,
    table: ({children}: any) => <div className="overflow-x-auto my-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm"><table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">{children}</table></div>,
    thead: ({children}: any) => <thead className="bg-gray-50 dark:bg-gray-800">{children}</thead>,
    tbody: ({children}: any) => <tbody className="divide-y divide-gray-200 dark:divide-gray-800 bg-white dark:bg-gray-900/50">{children}</tbody>,
    tr: ({children}: any) => <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">{children}</tr>,
    th: ({children}: any) => <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{children}</th>,
    td: ({children}: any) => <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-normal">{children}</td>,
    code: ({ node, ...props }: any) => <CodeBlock theme={theme} {...props} />
  }), [theme]);

  return (
    <div className="flex flex-col mb-10 animate-slide-up w-full">
        <div className="flex items-center gap-2 mb-3 ml-1">
            <div className={`
                w-7 h-7 rounded-lg flex items-center justify-center transition-colors duration-300 shadow-sm
                ${isRunning ? 'bg-white border border-blue-100 text-blue-600' : 
                  isCompleted ? 'bg-white border border-green-100 text-green-600' :
                  isFailed ? 'bg-white border border-red-100 text-red-600' : 'bg-white border border-gray-200 text-gray-500'}
            `}>
                <Bot className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
                <span className="text-xs font-bold text-gray-700 dark:text-gray-200 leading-none">
                    {message.agentName || 'AutoFlow Agent'}
                </span>
                <span className="text-[10px] text-gray-400 font-medium mt-0.5">
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
            </div>
        </div>

        <div className={`
            relative overflow-hidden rounded-2xl border transition-all duration-500 w-full group
            ${isRunning 
                ? 'bg-white dark:bg-gray-800 border-blue-300 dark:border-blue-600 shadow-[0_4px_20px_-4px_rgba(59,130,246,0.15)]' 
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/60 shadow-sm hover:shadow-md'}
        `}>
            
            {isRunning && (
                 <div className="absolute top-0 left-0 right-0 h-1 bg-gray-100 dark:bg-gray-700 z-10 overflow-hidden">
                    <div className="h-full bg-blue-500 shadow-[0_0_10px_#3b82f6] animate-progress-indeterminate origin-left" />
                 </div>
            )}

            <div className="p-6 md:p-8 w-full">
                {isRunning && (
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100 dark:border-gray-700/50">
                        <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                        <span className="text-sm font-medium text-blue-600 dark:text-blue-400">Processing...</span>
                    </div>
                )}
                
                {isFailed && (
                    <div className="flex items-center gap-2 p-3 mb-6 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 text-red-700 dark:text-red-400 text-sm font-medium">
                        <XCircle className="w-4 h-4" />
                        <span>Workflow encountered an error</span>
                    </div>
                )}

                <div className="w-full text-gray-800 dark:text-gray-200 font-normal">
                    <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        components={markdownComponents}
                    >
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
    <div className="flex justify-end mb-10 animate-slide-up">
        <div className="max-w-3xl w-full flex flex-col items-end">
            <div className="flex items-center gap-2 mb-2 mr-1">
                 <span className="text-[10px] text-gray-400 font-medium">
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300">You</span>
                <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 shadow-sm">
                    <User className="w-4 h-4" />
                </div>
            </div>

            <div className="bg-gradient-to-br from-gray-50 to-white dark:from-gray-800 dark:to-gray-800/80 text-gray-900 dark:text-gray-100 rounded-2xl rounded-tr-sm px-6 py-4 shadow-sm border border-gray-200 dark:border-gray-700/50 w-fit">
                <div className="text-base whitespace-pre-wrap leading-relaxed">{message.content}</div>
            </div>
        </div>
    </div>
  );
};

const ChatMessage: React.FC<ChatMessageProps> = ({ message, theme }) => {
  if (message.role === 'user') return <UserMessage message={message} />;
  return <AssistantMessage message={message} theme={theme} />;
};

export default ChatMessage;
