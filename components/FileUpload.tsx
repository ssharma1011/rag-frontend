import React, { useState, useRef } from 'react';
import { Upload, FileIcon, X } from './Icons';
import { isValidLogFile, formatFileSize } from '../utils/validation';

interface FileUploadProps {
  files: File[];
  disabled: boolean;
  maxFiles?: number;
  maxSize?: number; // bytes
  onFilesChange: (files: File[]) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ 
  files, 
  disabled, 
  maxFiles = 5, 
  maxSize = 10 * 1024 * 1024, 
  onFilesChange 
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const validateAndAddFiles = (newFiles: File[]) => {
    setErrorMessage('');
    const validFiles: File[] = [];

    for (const file of newFiles) {
      if (!isValidLogFile(file)) {
        setErrorMessage(`Invalid type: ${file.name}`);
        continue;
      }
      if (file.size > maxSize) {
        setErrorMessage(`Too large: ${file.name}`);
        continue;
      }
      if (files.some(f => f.name === file.name) || validFiles.some(f => f.name === file.name)) {
        continue;
      }
      if (files.length + validFiles.length >= maxFiles) {
        setErrorMessage(`Max ${maxFiles} files`);
        break;
      }
      validFiles.push(file);
    }

    if (validFiles.length > 0) {
      onFilesChange([...files, ...validFiles]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    validateAndAddFiles(droppedFiles);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      validateAndAddFiles(selectedFiles);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (fileToRemove: File) => {
    onFilesChange(files.filter(f => f !== fileToRemove));
  };

  return (
    <div className="space-y-2 animate-fade-in">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !disabled && fileInputRef.current?.click()}
        className={`
            border border-dashed rounded-xl p-4 text-center transition-all duration-200
            ${disabled
                ? 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 cursor-not-allowed opacity-60'
                : isDragging
                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 scale-[0.99]'
                : 'bg-white/50 dark:bg-gray-900/50 border-gray-300 dark:border-gray-700 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer'}
        `}
      >
        <Upload className={`w-6 h-6 mx-auto mb-2 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} />
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Drop .log files here or <span className="text-blue-500 font-medium">browse</span>
        </p>
        <input
          type="file"
          ref={fileInputRef}
          multiple
          accept=".log,.txt,.out,.err"
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled}
        />
      </div>

      {files.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {files.map((file, index) => (
            <div key={`${file.name}-${index}`} className="flex items-center justify-between bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 shadow-sm">
              <div className="flex items-center gap-2 flex-1 overflow-hidden">
                <FileIcon className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                <span className="text-xs text-gray-700 dark:text-gray-200 truncate">{file.name}</span>
              </div>
              {!disabled && (
                <button
                  onClick={(e) => { e.stopPropagation(); removeFile(file); }}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {errorMessage && (
        <p className="text-red-500 text-[10px] text-center">{errorMessage}</p>
      )}
    </div>
  );
};

export default FileUpload;