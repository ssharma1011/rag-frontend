import React, { useEffect, useState } from 'react';
import { X, BarChart2, CheckCircle2, AlertTriangle, DollarSign } from './Icons';
import { workflowService } from '../services/workflowService';

interface MetricsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const MetricsModal: React.FC<MetricsModalProps> = ({ isOpen, onClose }) => {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      workflowService.getDashboardMetrics()
        .then(data => {
            setMetrics(data);
            setLoading(false);
        })
        .catch(err => {
            setError('Failed to load metrics');
            setLoading(false);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-2xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden animate-slide-up">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <BarChart2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">System Metrics</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
            {loading ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                    <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mb-3" />
                    <span className="text-sm">Loading dashboard...</span>
                </div>
            ) : error ? (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5" />
                    {error}
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Key Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-100 dark:border-blue-800/50">
                            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-2">
                                <DollarSign className="w-4 h-4" />
                                <span className="text-sm font-semibold uppercase tracking-wider">Cost (24h)</span>
                            </div>
                            <div className="text-3xl font-bold text-gray-900 dark:text-white">
                                ${metrics?.cost_last_24h?.toFixed(4) || '0.0000'}
                            </div>
                        </div>

                        <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                            <div className="flex items-center gap-2 text-gray-500 mb-2">
                                <CheckCircle2 className="w-4 h-4" />
                                <span className="text-sm font-semibold uppercase tracking-wider">Status</span>
                            </div>
                            <div className="text-lg font-medium text-green-600 dark:text-green-400 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                System Operational
                            </div>
                            <div className="text-xs text-gray-400 mt-1">
                                Last updated: {new Date(metrics?.timestamp).toLocaleTimeString()}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default MetricsModal;