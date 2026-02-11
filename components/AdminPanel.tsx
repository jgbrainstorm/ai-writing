
import React, { useState, useEffect, useMemo } from 'react';
import { AppConfig, WritingEvent } from '../types';
import { getLogs, clearLogs, exportLogs } from '../db';
import AnalyticsPanel from './AnalyticsPanel';

interface AdminPanelProps {
  onClose: () => void;
  onConfigUpdate: (config: AppConfig) => void;
  onBackToLogin?: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ onClose, onConfigUpdate, onBackToLogin }) => {
  const [activeTab, setActiveTab] = useState<'settings' | 'logs' | 'analytics'>('settings');
  const [config, setConfig] = useState<AppConfig>(() => {
    const saved = localStorage.getItem('app_config');
    return saved ? JSON.parse(saved) : {
      provider: 'azure',
      azure: {
        endpoint: '',
        apiKey: '',
        deploymentName: '',
        apiVersion: '2024-02-01'
      },
      writingPrompt: "Write an essay about AI.",
      systemPrompt: "You are a helpful writing assistant.",
      timeLimit: 1800
    };
  });
  const [logs, setLogs] = useState<WritingEvent[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>('');
  const [logsSessionFilter, setLogsSessionFilter] = useState<string>('all');
  const [expandedResult, setExpandedResult] = useState<WritingEvent | null>(null);

  useEffect(() => {
    if (config.provider !== 'azure') {
      setConfig(prev => ensureAzureConfig({ ...prev, provider: 'azure' }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab === 'logs') {
      setLogs(getLogs().reverse());
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'analytics') {
      const all = getLogs();
      setLogs(all.reverse());
    }
  }, [activeTab]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const sessions = useMemo(() => {
    const ids = Array.from(new Set(logs.map((l) => l.session_id)));
    return ids;
  }, [logs]);

  const filteredLogs = useMemo(() => {
    if (logsSessionFilter === 'all') return logs;
    return logs.filter((l) => l.session_id === logsSessionFilter);
  }, [logs, logsSessionFilter]);

  useEffect(() => {
    if (activeTab === 'analytics' && sessions.length > 0 && !selectedSession) {
      setSelectedSession(sessions[0]);
    }
  }, [activeTab, sessions, selectedSession]);

  const ensureAzureConfig = (conf: AppConfig): AppConfig => {
    if (conf.azure) return conf;
    return {
      ...conf,
      azure: {
        endpoint: '',
        apiKey: '',
        deploymentName: '',
        apiVersion: '2024-02-01'
      }
    };
  };

  const handleSaveConfig = async () => {
    const savedConfig = JSON.parse(JSON.stringify(config));
    localStorage.setItem('app_config', JSON.stringify(savedConfig));
    onConfigUpdate(savedConfig);

    try {
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(savedConfig),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.details || data?.error || `HTTP ${response.status}`);
      }
      alert('Configuration saved and synced to backend.');
    } catch (error) {
      console.error('Config sync error:', error);
      alert('Configuration saved locally, but backend sync failed. Ensure backend is running.');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white w-full max-w-6xl h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Admin Dashboard</h2>
            <p className="text-slate-500 text-sm">Session analytics and global configuration</p>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors font-semibold text-sm"
          >
            Close
          </button>
        </div>

        <div className="flex border-b bg-white">
          <button 
            onClick={() => setActiveTab('settings')}
            className={`px-10 py-5 font-bold transition-all border-b-4 ${activeTab === 'settings' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/30' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            <i className="fas fa-cog mr-2"></i> Settings
          </button>
          <button 
            onClick={() => setActiveTab('logs')}
            className={`px-10 py-5 font-bold transition-all border-b-4 ${activeTab === 'logs' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/30' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            <i className="fas fa-database mr-2"></i> Event Logs
          </button>
          <button 
            onClick={() => setActiveTab('analytics')}
            className={`px-10 py-5 font-bold transition-all border-b-4 ${activeTab === 'analytics' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/30' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
          >
            <i className="fas fa-chart-line mr-2"></i> Analytics
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar bg-white">
          {activeTab === 'settings' ? (
            <div className="space-y-10 max-w-3xl">
              <section className="space-y-6">
                <h3 className="text-sm font-black text-indigo-500 uppercase tracking-widest border-l-4 border-indigo-500 pl-4">Assignment Controls</h3>
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">Timer Limit (Seconds)</label>
                    <input 
                      type="number" 
                      value={config.timeLimit} 
                      onChange={(e) => setConfig({...config, timeLimit: parseInt(e.target.value)})}
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">Student Writing Prompt</label>
                  <textarea 
                    value={config.writingPrompt} 
                    onChange={(e) => setConfig({...config, writingPrompt: e.target.value})}
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-500/10 outline-none h-32 resize-none transition-all"
                  />
                </div>
              </section>

              <section className="space-y-6">
                <h3 className="text-sm font-black text-emerald-500 uppercase tracking-widest border-l-4 border-emerald-500 pl-4">Intelligence & API</h3>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">System Instruction (AI Behavior)</label>
                  <textarea 
                    value={config.systemPrompt} 
                    onChange={(e) => setConfig({...config, systemPrompt: e.target.value})}
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-emerald-500/10 outline-none h-32 resize-none font-mono text-sm transition-all"
                  />
                </div>
                <div className="flex gap-4">
                  <div className="flex-1 p-6 rounded-2xl border-2 border-indigo-600 bg-indigo-50/30">
                    <div className="font-black text-lg capitalize mb-1">Azure OpenAI</div>
                    <div className="text-xs text-slate-500 uppercase tracking-wider font-bold">Required for this deployment</div>
                  </div>
                </div>

                {config.provider === 'azure' && (
                  <div className="space-y-4 p-8 bg-slate-50 rounded-3xl border border-slate-100">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Endpoint (e.g. https://YOUR-RESOURCE.openai.azure.com)</label>
                        <input 
                          value={config.azure?.endpoint || ''} 
                          onChange={(e) => setConfig(prev => ({...ensureAzureConfig(prev), azure: {...ensureAzureConfig(prev).azure!, endpoint: e.target.value}}))}
                          className="w-full p-3 border border-slate-200 rounded-lg bg-white"
                          placeholder="https://...azure.com"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Deployment Name</label>
                        <input 
                          value={config.azure?.deploymentName || ''} 
                          onChange={(e) => setConfig(prev => ({...ensureAzureConfig(prev), azure: {...ensureAzureConfig(prev).azure!, deploymentName: e.target.value}}))}
                          className="w-full p-3 border border-slate-200 rounded-lg bg-white"
                          placeholder="gpt-4o-mini"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">API Version</label>
                        <input 
                          value={config.azure?.apiVersion || ''} 
                          onChange={(e) => setConfig(prev => ({...ensureAzureConfig(prev), azure: {...ensureAzureConfig(prev).azure!, apiVersion: e.target.value}}))}
                          className="w-full p-3 border border-slate-200 rounded-lg bg-white"
                          placeholder="2024-02-01"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">API Key</label>
                        <input 
                          type="password"
                          value={config.azure?.apiKey || ''} 
                          onChange={(e) => setConfig(prev => ({...ensureAzureConfig(prev), azure: {...ensureAzureConfig(prev).azure!, apiKey: e.target.value}}))}
                          className="w-full p-3 border border-slate-200 rounded-lg bg-white"
                          placeholder="Paste key"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Keys are saved locally in your browser storage for this workstation only. Ensure the endpoint, deployment, and version match your Azure OpenAI resource.
                    </p>
                  </div>
                )}
              </section>

              <div className="pt-8 border-t flex justify-end">
                <button 
                  onClick={handleSaveConfig}
                  className="bg-indigo-600 text-white px-12 py-4 rounded-2xl font-black text-lg shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all transform active:scale-95"
                >
                  Confirm Configuration
                </button>
              </div>
            </div>
          ) : activeTab === 'logs' ? (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div className="flex gap-3 items-center">
                   <div className="space-y-1 w-72">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Filter By Session</label>
                    <select 
                      value={logsSessionFilter}
                      onChange={(e) => setLogsSessionFilter(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:ring-4 focus:ring-indigo-500/10 outline-none"
                    >
                      <option value="all">All Sessions</option>
                      {sessions.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                   </div>
                   <button onClick={exportLogs} className="bg-white border border-slate-200 px-6 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-all flex items-center">
                     <i className="fas fa-download mr-2"></i> Export Data
                   </button>
                   <button onClick={() => { if(confirm('Wipe all session data?')) { clearLogs(); setLogs([]); } }} className="bg-red-50 px-6 py-2.5 rounded-xl font-bold text-red-600 hover:bg-red-100 transition-all flex items-center">
                     <i className="fas fa-trash-alt mr-2"></i> Wipe Logs
                   </button>
                </div>
                <div className="bg-slate-100 px-4 py-2 rounded-full text-xs font-black text-slate-500 uppercase tracking-widest">
                  Events Shown: {filteredLogs.length}
                </div>
              </div>
              <div className="border border-slate-100 rounded-3xl overflow-hidden shadow-sm bg-white">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-100">
                      <th className="p-5 font-black text-slate-400 uppercase text-[10px] tracking-wider">Start Time</th>
                      <th className="p-5 font-black text-slate-400 uppercase text-[10px] tracking-wider">Session ID</th>
                      <th className="p-5 font-black text-slate-400 uppercase text-[10px] tracking-wider">User</th>
                      <th className="p-5 font-black text-slate-400 uppercase text-[10px] tracking-wider">Event Type</th>
                      <th className="p-5 font-black text-slate-400 uppercase text-[10px] tracking-wider">By</th>
                      <th className="p-5 font-black text-slate-400 uppercase text-[10px] tracking-wider w-1/3">Result Snippet</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.length === 0 ? (
                      <tr><td colSpan={6} className="p-20 text-center text-slate-400 font-medium italic">Database is empty.</td></tr>
                    ) : (
                      filteredLogs.map((log, i) => (
                        <tr key={i} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/30 transition-colors">
                          <td className="p-5 font-mono text-xs text-slate-400 whitespace-nowrap">
                            {new Date(log.event_start_time).toLocaleString()}
                          </td>
                          <td className="p-5 font-mono text-xs text-indigo-400">{log.session_id.slice(0, 8)}...</td>
                          <td className="p-5 font-bold text-slate-700">{log.user_name}</td>
                          <td className="p-5">
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${
                              log.event_name === 'essay_writing' ? 'bg-blue-100 text-blue-600' :
                              log.event_name === 'chat' ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {log.event_name}
                            </span>
                          </td>
                          <td className="p-5 text-slate-500 font-medium">{log.event_by}</td>
                          <td
                            onDoubleClick={() => setExpandedResult(log)}
                            className="p-5 text-slate-600 truncate max-w-[200px] cursor-zoom-in"
                            title="Double-click to view full text"
                          >
                            {log.event_result}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              <div className="flex items-center gap-4">
                <div className="space-y-1 w-72">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Session</label>
                  <select 
                    value={selectedSession}
                    onChange={(e) => setSelectedSession(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:ring-4 focus:ring-indigo-500/10 outline-none"
                  >
                    {sessions.length === 0 && <option value="">No sessions</option>}
                    {sessions.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <AnalyticsPanel logs={logs} sessionId={selectedSession} />
            </div>
          )}
        </div>
        {expandedResult && (
          <div className="fixed inset-0 z-[120] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setExpandedResult(null)}>
            <div className="bg-white w-full max-w-3xl rounded-2xl border border-slate-200 shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-black uppercase tracking-widest text-slate-600">Full Event Result</h4>
                  <p className="text-xs text-slate-400 mt-1">{expandedResult.event_name} · {expandedResult.event_by} · {new Date(expandedResult.event_start_time).toLocaleString()}</p>
                </div>
                <button onClick={() => setExpandedResult(null)} className="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold text-sm">Close</button>
              </div>
              <div className="p-6 max-h-[60vh] overflow-y-auto bg-slate-50">
                <pre className="whitespace-pre-wrap break-words text-sm text-slate-700 leading-relaxed font-sans">{expandedResult.event_result}</pre>
              </div>
            </div>
          </div>
        )}
        <div className="border-t bg-slate-50 p-4 flex items-center justify-between">
          <span className="text-xs text-slate-500">Press Esc or click outside to close.</span>
          <div className="flex items-center gap-3">
            {onBackToLogin && (
              <button
                onClick={onBackToLogin}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors font-semibold text-sm"
              >
                Back to Login
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
