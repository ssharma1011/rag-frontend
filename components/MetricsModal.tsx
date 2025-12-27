import React, { useEffect, useState } from 'react';
import { X, BarChart2, CheckCircle2, AlertTriangle, DollarSign, Activity, Terminal, Clock, Bot, AlertOctagon } from './Icons';
import { workflowService } from '../services/workflowService';
import { DashboardResponse, ConversationMetricsResponse, LLMCallMetrics } from '../types';

interface MetricsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentConversationId: string | null;
}

type TabType = 'overview' | 'conversation' | 'failures';

const MetricsModal: React.FC<MetricsModalProps> = ({ isOpen, onClose, currentConversationId }) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  
  // Data States
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [conversationMetrics, setConversationMetrics] = useState<ConversationMetricsResponse | null>(null);
  const [failures, setFailures] = useState<LLMCallMetrics[]>([]);
  
  // Loading States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Reset tab on open
  useEffect(() => {
    if (isOpen) {
      setActiveTab('overview');
      fetchDashboard();
    }
  }, [isOpen]);

  // Fetch data based on tab
  useEffect(() => {
    if (!isOpen) return;

    if (activeTab === 'overview') {
        fetchDashboard();
    } else if (activeTab === 'conversation') {
        if (currentConversationId) {
            fetchConversation(currentConversationId);
        }
    } else if (activeTab === 'failures') {
        fetchFailures();
    }
  }, [activeTab, isOpen, currentConversationId]);

  const fetchDashboard = async () => {
    setLoading(true);
    setError('');
    try {
        const data = await workflowService.getDashboardMetrics();
        setDashboard(data);
    } catch (err) {
        console.error(err);
        setError('Failed to load system metrics. Backend might be unreachable.');
    } finally {
        setLoading(false);
    }
  };

  const fetchConversation = async (id: string) => {
    setLoading(true);
    setError('');
    try {
        const data = await workflowService.getConversationMetrics(id);
        setConversationMetrics(data);
    } catch (err) {
        console.error(err);
        setError('Could not load metrics for this conversation. Data might not be available yet.');
    } finally {
        setLoading(false);
    }
  };

  const fetchFailures = async () => {
    setLoading(true);
    setError('');
    try {
        const data = await workflowService.getFailedCalls();
        setFailures(data);
    } catch (err) {
        console.error(err);
        setError('Failed to load error logs.');
    } finally {
        setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose} 
      />
      
      {/* Main Container */}
      <div className="relative w-full max-w-4xl h-[85vh] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col animate-slide-up">
        
        {/* Header */}
        <div className="shrink-0 px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50/80 dark:bg-gray-900/80 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/20">
                <BarChart2 className="w-5 h-5 text-white" />
            </div>
            <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">System Telemetry</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">LLM Operations & Cost Analysis</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors text-gray-500 dark:text-gray-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="shrink-0 flex items-center gap-1 px-6 py-2 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
            <TabButton 
                active={activeTab === 'overview'} 
                onClick={() => setActiveTab('overview')} 
                icon={<Activity className="w-4 h-4" />}
                label="Overview" 
            />
            <TabButton 
                active={activeTab === 'conversation'} 
                onClick={() => setActiveTab('conversation')} 
                icon={<Terminal className="w-4 h-4" />}
                label="Current Session"
                disabled={!currentConversationId} 
            />
            <TabButton 
                active={activeTab === 'failures'} 
                onClick={() => setActiveTab('failures')} 
                icon={<AlertOctagon className="w-4 h-4" />}
                label="Failures" 
            />
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-black/20 p-6 scroll-smooth">
            {loading ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-3">
                    <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm font-medium">Loading metrics...</span>
                </div>
            ) : error ? (
                <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 rounded-xl flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5" />
                    {error}
                </div>
            ) : (
                <div className="animate-fade-in">
                    {activeTab === 'overview' && dashboard && (
                        <OverviewView data={dashboard} />
                    )}
                    {activeTab === 'conversation' && conversationMetrics && (
                        <ConversationView data={conversationMetrics} />
                    )}
                    {activeTab === 'failures' && (
                        <FailuresView failures={failures} />
                    )}
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

// --- Sub-Components ---

const TabButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string; disabled?: boolean }> = ({ active, onClick, icon, label, disabled }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`
            flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
            ${disabled ? 'opacity-50 cursor-not-allowed text-gray-400' : 'cursor-pointer'}
            ${active 
                ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' 
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}
        `}
    >
        {icon}
        {label}
    </button>
);

const OverviewView: React.FC<{ data: DashboardResponse }> = ({ data }) => {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Cost Card */}
                <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-xl shadow-indigo-500/20">
                    <div className="flex items-center gap-2 text-indigo-100 mb-2">
                        <DollarSign className="w-5 h-5" />
                        <span className="text-sm font-semibold uppercase tracking-wider">Cost (24h)</span>
                    </div>
                    <div className="text-4xl font-bold tracking-tight">
                        ${data.cost_last_24h?.toFixed(4) || '0.0000'}
                    </div>
                    <div className="mt-4 text-xs text-indigo-100/80 bg-white/10 inline-block px-2 py-1 rounded">
                        Last Updated: {new Date(data.timestamp).toLocaleTimeString()}
                    </div>
                </div>

                {/* Health Card */}
                <div className="p-6 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm">
                     <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-4">
                        <Activity className="w-5 h-5" />
                        <span className="text-sm font-semibold uppercase tracking-wider">System Health</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                        </span>
                        <span className="text-xl font-medium text-gray-900 dark:text-white">Operational</span>
                    </div>
                    <div className="mt-2 text-sm text-gray-500">
                        All agents online and responsive.
                    </div>
                </div>
            </div>
        </div>
    );
};

const ConversationView: React.FC<{ data: ConversationMetricsResponse }> = ({ data }) => {
    return (
        <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Total Calls" value={data.totalCalls} icon={<Bot className="w-4 h-4" />} />
                <StatCard label="Total Tokens" value={data.totalTokens.toLocaleString()} icon={<Terminal className="w-4 h-4" />} />
                <StatCard label="Avg Latency" value={`${Math.round(data.averageLatencyMs)}ms`} icon={<Clock className="w-4 h-4" />} />
                <StatCard label="Total Cost" value={`$${data.totalCost.toFixed(4)}`} icon={<DollarSign className="w-4 h-4" />} color="text-green-600" />
            </div>

            {/* Detailed Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">LLM Call Trace</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs md:text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 uppercase tracking-wider text-[10px] font-semibold">
                            <tr>
                                <th className="px-4 py-3">Time</th>
                                <th className="px-4 py-3">Agent</th>
                                <th className="px-4 py-3">Model</th>
                                <th className="px-4 py-3 text-right">Tokens</th>
                                <th className="px-4 py-3 text-right">Latency</th>
                                <th className="px-4 py-3 text-right">Cost</th>
                                <th className="px-4 py-3 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                            {data.calls.map((call, idx) => (
                                <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                    <td className="px-4 py-3 text-gray-500 font-mono">
                                        {new Date(call.timestamp).toLocaleTimeString([], { hour: '2-digit', minute:'2-digit', second:'2-digit' })}
                                    </td>
                                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium 
                                            ${call.agentName.includes('Analyst') ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 
                                              call.agentName.includes('Coder') ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
                                              'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'}`}>
                                            {call.agentName}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-gray-500">{call.model}</td>
                                    <td className="px-4 py-3 text-right font-mono text-gray-600 dark:text-gray-300">{call.totalTokens}</td>
                                    <td className="px-4 py-3 text-right font-mono text-gray-600 dark:text-gray-300">{call.latencyMs}ms</td>
                                    <td className="px-4 py-3 text-right font-mono text-gray-600 dark:text-gray-300">${call.cost.toFixed(5)}</td>
                                    <td className="px-4 py-3 text-center">
                                        {call.status === 'SUCCESS' ? (
                                            <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />
                                        ) : (
                                            <X className="w-4 h-4 text-red-500 mx-auto" />
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

const FailuresView: React.FC<{ failures: LLMCallMetrics[] }> = ({ failures }) => {
    if (failures.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <CheckCircle2 className="w-12 h-12 text-green-500/50 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">No Failures Detected</h3>
                <p className="text-sm">System is running smoothly.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
             {failures.map((fail, idx) => (
                 <div key={idx} className="p-4 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10">
                    <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 text-xs font-bold rounded uppercase">
                                {fail.model}
                            </span>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">{fail.agentName}</span>
                        </div>
                        <span className="text-xs text-red-600 dark:text-red-400 font-mono">
                            {new Date(fail.timestamp).toLocaleString()}
                        </span>
                    </div>
                    <div className="text-sm text-red-800 dark:text-red-200 font-mono bg-red-100/50 dark:bg-black/20 p-3 rounded-lg border border-red-100 dark:border-red-900/30">
                        {fail.errorMessage || "Unknown error occurred during LLM execution."}
                    </div>
                 </div>
             ))}
        </div>
    );
};

const StatCard: React.FC<{ label: string; value: string | number; icon: React.ReactNode; color?: string }> = ({ label, value, icon, color }) => (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-2">
            {icon}
            <span className="text-xs font-semibold uppercase">{label}</span>
        </div>
        <div className={`text-2xl font-bold ${color || 'text-gray-900 dark:text-white'}`}>
            {value}
        </div>
    </div>
);

export default MetricsModal;