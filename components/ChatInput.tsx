
import React, { useState, useRef, useEffect } from 'react';
import { Send, Link, FileText, ChevronUp, ChevronDown, Upload, CheckCircle2 } from './Icons';
import { detectLogs, countLogLines, extractLogs, extractRequirement } from '../utils/logDetection';
import { isValidGitHubUrl } from '../utils/validation';
import FileUpload from './FileUpload';

interface ChatInputProps {
  disabled: boolean;
  placeholder?: string;
  initialRepoUrl?: string;
  isRepoLocked: boolean;
  onSend: (data: {
    content: string;
    repoUrl: string;
    logsPasted?: string;
    logFiles?: File[];
  }) => void;
}

const ChatInput: React.FC<ChatInputProps> = ({
  disabled,
  placeholder = 'Ask AutoFlow to analyze, fix, or build...',
  initialRepoUrl = '',
  isRepoLocked,
  onSend
}) => {
  const [input, setInput] = useState('');
  const [repoUrl, setRepoUrl] = useState(initialRepoUrl);
  const [repoError, setRepoError] = useState('');
  const [logFiles, setLogFiles] = useState<File[]>([]);
  const [detectedLogs, setDetectedLogs] = useState<string | null>(null);
  const [showDetectedLogs, setShowDetectedLogs] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (initialRepoUrl) setRepoUrl(initialRepoUrl);
  }, [initialRepoUrl]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    setInput(newVal);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }

    if (newVal.trim() && detectLogs(newVal)) {
      setDetectedLogs(extractLogs(newVal));
    } else {
      setDetectedLogs(null);
    }
  };

  const validateRepo = (url: string) => {
    if (!url.trim()) {
      setRepoError('');
      return false;
    }
    if (!isValidGitHubUrl(url)) {
      setRepoError('Invalid URL');
      return false;
    }
    setRepoError('');
    return true;
  };

  const handleSend = () => {
    if (!validateRepo(repoUrl) && !isRepoLocked) {
      setRepoError('Required');
      return;
    }
    if (!input.trim() && logFiles.length === 0) return;

    let requirement = input.trim();
    let logsPasted: string | undefined;

    if (detectedLogs) {
      requirement = extractRequirement(input);
      logsPasted = detectedLogs;
    }

    onSend({
      content: requirement || (logsPasted ? "Analyze these logs" : ""),
      repoUrl: repoUrl.trim(),
      logsPasted,
      logFiles: logFiles.length > 0 ? logFiles : undefined
    });

    setInput('');
    setLogFiles([]);
    setDetectedLogs(null);
    setShowDetectedLogs(false);
    setShowFileUpload(false);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = (input.trim().length > 0 || logFiles.length > 0) && (isRepoLocked || (!repoError && repoUrl.trim().length > 0)) && !disabled;

  return (
    <div className={`
        relative rounded-2xl transition-all duration-500 ease-out
        ${isFocused 
            ? 'shadow-[0_0_40px_-5px_rgba(14,165,233,0.15)] dark:shadow-[0_0_50px_-10px_rgba(14,165,233,0.2)] border-primary-200/50 dark:border-primary-500/30' 
            : 'shadow-2xl shadow-gray-200/50 dark:shadow-black/50 border-white/60 dark:border-white/10'}
        bg-white/80 dark:bg-[#1A1B26]/80 backdrop-blur-xl border ring-1 ring-black/5 dark:ring-white/5
    `}>
        
      {/* Top Bar: Repo & Tools */}
      <div className="flex items-center px-3 pt-3 pb-2 gap-2">
        
        {/* Repo Input Container */}
        <div className={`
            flex-1 flex items-center gap-2 min-w-0 rounded-xl px-3 py-2 border transition-all duration-300 group
            ${isRepoLocked 
                ? 'bg-primary-50/50 dark:bg-primary-900/10 border-primary-100 dark:border-primary-800/30' 
                : 'bg-gray-50/50 dark:bg-gray-900/30 border-transparent hover:border-gray-200 dark:hover:border-gray-700 focus-within:bg-white dark:focus-within:bg-gray-900 focus-within:border-primary-300 dark:focus-within:border-primary-600 focus-within:ring-2 focus-within:ring-primary-500/10'}
        `}>
            <Link className={`w-3.5 h-3.5 shrink-0 transition-colors ${isRepoLocked ? 'text-primary-500' : 'text-gray-400 group-focus-within:text-primary-500'}`} />
            
            <div className="flex-1 relative min-w-0">
                <input
                    type="text"
                    value={repoUrl}
                    onChange={(e) => { setRepoUrl(e.target.value); validateRepo(e.target.value); }}
                    placeholder="Link repository (github.com/...)"
                    disabled={isRepoLocked}
                    className={`
                        w-full bg-transparent border-none outline-none text-xs font-mono truncate
                        ${isRepoLocked 
                            ? 'text-primary-700 dark:text-primary-300 cursor-default font-semibold' 
                            : 'text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600'}
                    `}
                    spellCheck={false}
                />
            </div>

            {repoError && !isRepoLocked && (
                <span className="text-[10px] text-red-500 font-medium whitespace-nowrap px-1 animate-in fade-in slide-in-from-right-2">
                    {repoError}
                </span>
            )}
             
            {isRepoLocked && (
                 <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/50 dark:bg-white/5 shadow-sm">
                    <CheckCircle2 className="w-3 h-3 text-primary-600 dark:text-primary-400" />
                    <span className="text-[10px] text-primary-700 dark:text-primary-300 font-medium whitespace-nowrap">
                        Connected
                    </span>
                 </div>
            )}
        </div>

        {/* Tools Section */}
        <button 
            onClick={() => setShowFileUpload(!showFileUpload)}
            className={`
                shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all border
                ${logFiles.length > 0 
                    ? 'bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-800' 
                    : 'bg-gray-50/50 dark:bg-gray-900/30 border-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200'}
            `}
        >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
                {logFiles.length > 0 ? `${logFiles.length} Logs` : 'Upload'}
            </span>
             {/* Mobile counter */}
             <span className="sm:hidden">
                {logFiles.length > 0 ? logFiles.length : ''}
             </span>
        </button>
      </div>

      {/* Main Input Area */}
      <div className="px-4 py-3">
        {/* Detected Logs Badge */}
        {detectedLogs && (
          <div className="mb-3 bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 rounded-lg p-2 flex items-center justify-between animate-fade-in backdrop-blur-sm">
            <span className="text-indigo-600 dark:text-indigo-300 text-xs font-medium flex items-center gap-2">
              <FileText className="w-3.5 h-3.5" />
              Stack trace detected ({countLogLines(detectedLogs)} lines)
            </span>
            <div className="flex gap-2">
                <button 
                    onClick={() => setShowDetectedLogs(!showDetectedLogs)}
                    className="text-[10px] px-2 py-1 bg-white/50 dark:bg-gray-800/50 rounded shadow-sm text-gray-600 dark:text-gray-300 hover:text-indigo-600"
                >
                    {showDetectedLogs ? 'Hide' : 'View'}
                </button>
                <button 
                    onClick={() => { setDetectedLogs(null); setShowDetectedLogs(false); }}
                    className="text-[10px] px-2 py-1 text-gray-400 hover:text-red-500"
                >
                    Clear
                </button>
            </div>
          </div>
        )}

        {showDetectedLogs && detectedLogs && (
            <pre className="mb-3 p-3 bg-gray-50/80 dark:bg-gray-900/50 rounded-lg text-[10px] font-mono text-gray-600 dark:text-gray-400 overflow-x-auto max-h-32 border border-gray-100 dark:border-gray-800">
                {detectedLogs}
            </pre>
        )}

        {/* File Upload Zone */}
        {showFileUpload && (
            <div className="mb-4 animate-slide-up">
                <FileUpload 
                    files={logFiles} 
                    disabled={disabled} 
                    onFilesChange={setLogFiles} 
                />
            </div>
        )}

        <div className="flex items-end gap-3">
            <textarea
                ref={textareaRef}
                value={input}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={disabled ? "AI Agent is working..." : placeholder}
                rows={1}
                className="flex-1 bg-transparent resize-none outline-none text-sm sm:text-base text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 min-h-[44px] max-h-[200px] py-2.5 font-normal leading-relaxed"
            />
            
            <button
                onClick={handleSend}
                disabled={!canSend}
                className={`
                    w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300
                    ${canSend 
                        ? 'bg-gray-900 dark:bg-white text-white dark:text-black shadow-lg shadow-gray-900/20 dark:shadow-white/20 hover:scale-105 active:scale-95' 
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'}
                `}
            >
                {disabled ? (
                    <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin opacity-50" />
                ) : (
                    <Send className="w-5 h-5 ml-0.5" />
                )}
            </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInput;
