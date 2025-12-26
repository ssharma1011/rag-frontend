import React, { useState, useRef, useEffect } from 'react';
import { Send, Github, FileText, ChevronUp, ChevronDown, Upload, CheckCircle2 } from './Icons';
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
        relative rounded-2xl transition-all duration-300 ease-out
        ${isFocused ? 'shadow-[0_20px_40px_-10px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.5)] scale-[1.01] -translate-y-1' : 'shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50'}
        bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border border-white/50 dark:border-gray-700/50 ring-1 ring-gray-200/50 dark:ring-gray-700/50
    `}>
        
      {/* Top Bar: Repo & Tools */}
      <div className="flex items-center px-3 pt-3 pb-2 border-b border-gray-200/30 dark:border-gray-700/30 gap-2">
        
        {/* Repo Input Container - Flex grow to take available space */}
        <div className={`
            flex-1 flex items-center gap-2 min-w-0 rounded-lg px-2.5 py-1.5 border transition-all group
            ${isRepoLocked 
                ? 'bg-gray-50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-700/50' 
                : 'bg-white/50 dark:bg-gray-900/30 border-gray-200/50 dark:border-gray-700/50 hover:border-blue-300 dark:hover:border-blue-700 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/10 focus-within:bg-white dark:focus-within:bg-gray-900'}
        `}>
            <Github className={`w-3.5 h-3.5 shrink-0 ${isRepoLocked ? 'text-green-500' : 'text-gray-400 group-focus-within:text-blue-500'}`} />
            
            <div className="flex-1 relative min-w-0">
                <input
                    type="text"
                    value={repoUrl}
                    onChange={(e) => { setRepoUrl(e.target.value); validateRepo(e.target.value); }}
                    placeholder="Paste GitHub repository URL..."
                    disabled={isRepoLocked}
                    className={`
                        w-full bg-transparent border-none outline-none text-xs font-mono truncate
                        ${isRepoLocked 
                            ? 'text-gray-600 dark:text-gray-400 cursor-default' 
                            : 'text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600'}
                    `}
                    spellCheck={false}
                />
            </div>

            {repoError && !isRepoLocked && (
                <span className="text-[10px] text-red-500 font-medium whitespace-nowrap px-1">
                    {repoError}
                </span>
            )}
             
            {isRepoLocked && (
                 <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-green-500/10 dark:bg-green-500/20">
                    <CheckCircle2 className="w-3 h-3 text-green-600 dark:text-green-400" />
                    <span className="text-[10px] text-green-700 dark:text-green-300 font-medium whitespace-nowrap">
                        Linked
                    </span>
                 </div>
            )}
        </div>

        {/* Tools Section */}
        <button 
            onClick={() => setShowFileUpload(!showFileUpload)}
            className={`
                shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border
                ${logFiles.length > 0 
                    ? 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800' 
                    : 'bg-white/50 dark:bg-gray-800/50 border-gray-200/50 dark:border-gray-700/50 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-white dark:hover:bg-gray-800'}
            `}
            title={showFileUpload ? "Hide Upload" : "Upload Log Files"}
        >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
                {logFiles.length > 0 ? `${logFiles.length} Logs` : 'Upload Logs'}
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
            <div className="mb-4 animate-fade-in">
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
                placeholder={disabled ? "AI is working..." : placeholder}
                rows={1}
                className="flex-1 bg-transparent resize-none outline-none text-sm sm:text-base text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 min-h-[44px] max-h-[200px] py-2.5"
            />
            
            <button
                onClick={handleSend}
                disabled={!canSend}
                className={`
                    w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200
                    ${canSend 
                        ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30 hover:scale-105 active:scale-95' 
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'}
                `}
            >
                {disabled ? (
                    <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
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