
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Timer from './components/Timer';
import Editor from './components/Editor';
import Chat from './components/Chat';
import AdminPanel from './components/AdminPanel';
import { EventName, EventBy, ChatMessage, AppConfig } from './types';
import { logEvent } from './db';
import { getChatResponse } from './llmService';

const DEFAULT_CONFIG: AppConfig = {
  provider: 'azure',
  azure: {
    endpoint: '',
    apiKey: '',
    deploymentName: '',
    apiVersion: '2024-02-01'
  },
  writingPrompt: "Write an essay about the impact of artificial intelligence on modern education. Consider both benefits and drawbacks.",
  systemPrompt: "You are a helpful writing assistant. Assist the user with ideas, grammar, and tone for their essay.",
  timeLimit: 30 * 60
};

const App: React.FC = () => {
  const [sessionId] = useState(() => uuidv4());
  const [userName, setUserName] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [essayContent, setEssayContent] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_CONFIG.timeLimit);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'user' | 'admin'>('user');
  const [adminPassword, setAdminPassword] = useState('');
  const [appConfig, setAppConfig] = useState<AppConfig>(() => {
    const saved = localStorage.getItem('app_config');
    return saved ? JSON.parse(saved) : DEFAULT_CONFIG;
  });

  const syncConfigFromStorage = useCallback(() => {
    const saved = localStorage.getItem('app_config');
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      setAppConfig(parsed);
    } catch (error) {
      console.warn('Failed to parse app_config from storage:', error);
    }
  }, []);

  const contentRef = useRef('');
  const lastLoggedContentRef = useRef('');

  useEffect(() => {
    contentRef.current = essayContent;
  }, [essayContent]);

  useEffect(() => {
    // Keep backend runtime config aligned with admin dashboard settings.
    fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(appConfig),
    }).catch((error) => {
      console.warn('Unable to sync config to backend:', error);
    });
  }, [appConfig]);

  // Sync timer limit with config changes
  useEffect(() => {
    if (!isTimerRunning && !isSubmitted) {
      setTimeLeft(appConfig.timeLimit);
    }
  }, [appConfig, isTimerRunning, isSubmitted]);

  // Handle auto-submission when time runs out
  useEffect(() => {
    if (timeLeft === 0 && isTimerRunning && !isSubmitted) {
      handleFinalSubmission("TIME_LIMIT_EXPIRED");
    }
  }, [timeLeft, isTimerRunning, isSubmitted]);

  // 1-second interval logging for keystrokes
  useEffect(() => {
    const interval = setInterval(() => {
      if (isLoggedIn && isTimerRunning && !isSubmitted && contentRef.current !== lastLoggedContentRef.current) {
        logEvent({
          session_id: sessionId,
          user_name: userName,
          event_name: EventName.ESSAY_WRITING,
          event_by: EventBy.USER,
          event_result: contentRef.current,
        });
        lastLoggedContentRef.current = contentRef.current;
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionId, userName, isLoggedIn, isTimerRunning, isSubmitted]);

  const handleTick = useCallback(() => {
    setTimeLeft((prev) => Math.max(0, prev - 1));
  }, []);

  const handleStartWriting = () => {
    setIsTimerRunning(true);
    logEvent({
      session_id: sessionId,
      user_name: userName,
      event_name: EventName.SYSTEM,
      event_by: EventBy.SYSTEM,
      event_result: "SESSION_STARTED",
    });
  };

  const handleFinalSubmission = (reason: string) => {
    setIsTimerRunning(false);
    setIsSubmitted(true); // This should immediately trigger the Thank You screen
    logEvent({
      session_id: sessionId,
      user_name: userName,
      event_name: EventName.SYSTEM,
      event_by: EventBy.USER,
      event_result: `${reason}: ${contentRef.current}`,
    });
  };

  const handleSendMessage = async (message: string) => {
    if (isSubmitted) return;

    if (!isTimerRunning) {
      const userMsg: ChatMessage = { role: 'user', parts: [{ text: message }] };
      const botMsg: ChatMessage = {
        role: 'model',
        parts: [{ text: 'Please click the START WRITING button to start.' }],
      };
      setChatHistory((prev) => [...prev, userMsg, botMsg]);
      return;
    }

    logEvent({
      session_id: sessionId,
      user_name: userName,
      event_name: EventName.CHAT,
      event_by: EventBy.USER,
      event_result: message,
    });

    const userMsg: ChatMessage = { role: 'user', parts: [{ text: message }] };
    setChatHistory((prev) => [...prev, userMsg]);
    setIsTyping(true);

    try {
      const aiResponse = await getChatResponse(message, chatHistory, essayContent, appConfig);
      logEvent({
        session_id: sessionId,
        user_name: userName,
        event_name: EventName.CHAT,
        event_by: EventBy.AI,
        event_result: aiResponse,
      });
      const botMsg: ChatMessage = { role: 'model', parts: [{ text: aiResponse }] };
      setChatHistory((prev) => [...prev, botMsg]);
    } catch (error) {
      console.error("Chat Error:", error);
    } finally {
      setIsTyping(false);
    }
  };

  const handleEditorAction = (type: string) => {
    if (isSubmitted) return;
    logEvent({
      session_id: sessionId,
      user_name: userName,
      event_name: EventName.SYSTEM,
      event_by: EventBy.USER,
      event_result: `TOOLBAR_ACTION: ${type}`,
    });
  };

  const handleUserLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (userName.trim().length > 1) {
      setIsLoggedIn(true);
      logEvent({
        session_id: sessionId,
        user_name: userName,
        event_name: EventName.SYSTEM,
        event_by: EventBy.USER,
        event_result: `LOGIN: ${userName}`,
      });
    }
  };

  const handleAdminAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword === "admin123") {
      setIsAdminLoginOpen(false);
      setIsAdminPanelOpen(true);
      setAdminPassword('');
    } else {
      alert("Invalid password.");
      setAdminPassword('');
    }
  };

  const openAdminPanel = () => {
    setIsAdminLoginOpen(true);
  };

  // --- RENDER LOGIC ---

  // Screen 1: Submission Successful (HIGH PRIORITY)
  if (isSubmitted) {
    return (
      <div className="h-screen w-screen bg-[#f8fafc] flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
        <div className="w-24 h-24 bg-emerald-500 text-white rounded-[2rem] flex items-center justify-center mb-10 shadow-2xl shadow-emerald-200 animate-in zoom-in duration-700">
          <i className="fas fa-check-double text-4xl"></i>
        </div>
        <h1 className="text-5xl font-black text-slate-800 mb-6 tracking-tight">Thank You for Your Participation</h1>
        <p className="text-slate-500 text-xl font-medium max-w-2xl leading-relaxed mb-12">
          Hello <span className="text-indigo-600 font-bold">{userName}</span>, your writing evaluation has been securely saved and submitted to the administration.
        </p>
        <div className="bg-white p-10 rounded-[3rem] border border-white shadow-2xl shadow-slate-200/50 inline-block text-left mb-10">
          <div className="flex items-center gap-6 mb-6">
             <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-inner">
               <i className="fas fa-fingerprint text-xl"></i>
             </div>
             <div>
               <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Session Reference</div>
               <div className="font-mono text-sm text-slate-600 bg-slate-50 px-3 py-1 rounded-lg">{sessionId}</div>
             </div>
          </div>
          <div className="h-px bg-slate-50 w-full mb-6"></div>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest flex items-center gap-2">
            <i className="far fa-clock"></i>
            Submitted: {new Date().toLocaleString()}
          </p>
        </div>
        <button 
          onClick={() => window.location.reload()}
          className="bg-slate-900 text-white px-10 py-5 rounded-2xl font-black text-lg hover:bg-indigo-600 transition-all shadow-xl active:scale-95"
        >
          Return to Start
        </button>
        {isAdminPanelOpen && (
          <AdminPanel 
            onClose={() => { syncConfigFromStorage(); setIsAdminPanelOpen(false); }} 
            onBackToLogin={() => {
              syncConfigFromStorage();
              setIsAdminPanelOpen(false);
              setAuthMode('user');
              setAdminPassword('');
            }}
            onConfigUpdate={(conf) => setAppConfig(conf)}
          />
        )}
      </div>
    );
  }

  // Screen 2: User/Admin Login
  if (!isLoggedIn) {
    return (
      <div className="h-screen w-screen bg-gradient-to-br from-[#edf3ff] via-[#f7f9fc] to-[#e8eef8] flex items-center justify-center relative p-6 overflow-hidden">
        <div className="absolute -top-28 -left-20 w-80 h-80 rounded-full bg-blue-200/35 blur-3xl"></div>
        <div className="absolute -bottom-28 -right-16 w-96 h-96 rounded-full bg-cyan-200/35 blur-3xl"></div>

        <div className="w-full max-w-6xl bg-white/90 backdrop-blur rounded-[2rem] shadow-2xl shadow-slate-300/35 border border-slate-200 overflow-hidden">
          <div className="grid lg:grid-cols-[1.05fr_1fr]">
            <div className="relative p-10 lg:p-12 bg-gradient-to-br from-[#204b8f] via-[#2f5fa6] to-[#4a78be] text-white">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.25),transparent_45%)]"></div>
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-white/20 border border-white/35 flex items-center justify-center mb-8">
                  <i className="fas fa-feather-pointed text-2xl"></i>
                </div>
                <h1 className="text-4xl lg:text-5xl font-black tracking-tight leading-tight mb-4">Evaluating AI-assisted Writing</h1>
                <p className="text-blue-100/90 uppercase tracking-[0.22em] text-xs font-bold mb-8">Secure Assessment Platform</p>
                <div className="space-y-3 text-[15px] text-blue-50/95 font-semibold">
                  <div className="flex items-center gap-3"><span className="w-2.5 h-2.5 rounded-full bg-cyan-200"></span>Secure event logging</div>
                  <div className="flex items-center gap-3"><span className="w-2.5 h-2.5 rounded-full bg-cyan-200"></span>Timed writing evaluation</div>
                  <div className="flex items-center gap-3"><span className="w-2.5 h-2.5 rounded-full bg-cyan-200"></span>AI-assisted feedback workflow</div>
                </div>
              </div>
            </div>

            <div className="p-8 lg:p-10 bg-[#fbfdff]">
              <div className="mb-7">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500 font-bold mb-3">Access</div>
                <div className="bg-white border border-slate-200 rounded-2xl p-1.5 grid grid-cols-2 gap-2 shadow-sm">
                  <button
                    onClick={() => setAuthMode('user')}
                    className={`py-3 rounded-xl font-black uppercase text-sm tracking-widest transition-all ${
                      authMode === 'user'
                        ? 'bg-[#2f5fa6] text-white shadow-md'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    User Login
                  </button>
                  <button
                    onClick={() => setAuthMode('admin')}
                    className={`py-3 rounded-xl font-black uppercase text-sm tracking-widest transition-all ${
                      authMode === 'admin'
                        ? 'bg-[#2f5fa6] text-white shadow-md'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Admin Login
                  </button>
                </div>
              </div>

              {authMode === 'user' ? (
                <form onSubmit={handleUserLogin} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-600 uppercase tracking-widest ml-1">Your Full Name</label>
                    <input
                      required
                      autoFocus
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      placeholder="Enter full name"
                      className="w-full p-5 bg-white border-2 border-slate-300 rounded-2xl shadow-inner shadow-slate-100 focus:ring-4 focus:ring-blue-500/15 focus:border-[#2f5fa6] outline-none font-bold text-slate-700 placeholder:text-slate-400 transition-all"
                    />
                  </div>
                  <button className="w-full bg-[#132a4d] text-white p-5 rounded-2xl font-black text-lg hover:bg-[#1d3d6d] transition-all shadow-xl shadow-slate-300/30">
                    Begin Evaluation
                  </button>
                </form>
              ) : (
                <form onSubmit={handleAdminAuth} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-600 uppercase tracking-widest ml-1">Admin Password</label>
                    <input
                      type="password"
                      autoFocus
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="Enter password"
                      className="w-full p-5 bg-white border-2 border-slate-300 rounded-2xl shadow-inner shadow-slate-100 focus:ring-4 focus:ring-blue-500/15 focus:border-[#2f5fa6] outline-none font-bold text-slate-700 placeholder:text-slate-400 transition-all"
                    />
                  </div>
                  <button className="w-full bg-[#2f5fa6] text-white p-5 rounded-2xl font-black text-lg hover:bg-[#244e89] transition-all shadow-xl shadow-blue-200/40">
                    Open Admin Dashboard
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
        {isAdminPanelOpen && (
          <AdminPanel 
            onClose={() => { syncConfigFromStorage(); setIsAdminPanelOpen(false); }} 
            onConfigUpdate={(conf) => setAppConfig(conf)}
          />
        )}
      </div>
    );
  }

  // Screen 3: Main Workspace
  return (
    <div className="flex h-screen w-screen overflow-hidden text-slate-900 bg-gradient-to-br from-[#f3f4f6] to-[#e5e7eb]">
      
      {/* Golden ratio layout: main area ~62%, chat ~38% */}
      <div className="flex-[1.618] flex flex-col h-full overflow-y-auto custom-scrollbar p-6 space-y-5">
        {/* Session Header */}
        <div className="bg-[#2b4c7e] px-4 py-3 rounded-[1.25rem] border border-[#3b5f96] shadow-md">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-3 bg-[#355b8c] border border-[#4f75a4] rounded-2xl px-4 py-2">
                <div className="w-10 h-10 bg-[#406a9a] rounded-xl border border-[#6f90b6] flex items-center justify-center text-white shadow-sm">
                  <i className="fas fa-user text-sm"></i>
                </div>
                <div>
                  <div className="text-[10px] font-black text-[#dbe7f5] uppercase tracking-widest">Active User</div>
                  <div className="text-white font-black">{userName}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-[#0F766E] border border-[#14b8a6] rounded-2xl px-4 py-2">
                <div className="text-[10px] font-black text-[#ccfbf1] uppercase tracking-widest">Time Left</div>
                <Timer seconds={timeLeft} isActive={isTimerRunning} onTick={handleTick} />
              </div>
              <button 
                onClick={openAdminPanel}
                className="flex items-center gap-2 text-[#e6eef9] hover:text-white transition-colors px-4 py-2 rounded-2xl border border-[#6f90b6] bg-[#406a9a] hover:bg-[#4f79a8]"
             >
                <i className="fas fa-user-shield text-sm"></i>
                <span className="text-[10px] font-black uppercase tracking-widest">Admin Dashboard</span>
             </button>
            </div>

            {!isTimerRunning ? (
              <button 
                onClick={handleStartWriting}
                className="bg-white text-[#2b4c7e] px-8 py-3 rounded-2xl font-black text-sm shadow-md hover:bg-[#f4f8fc] active:scale-95 transition-all flex items-center gap-3 uppercase tracking-widest"
              >
                <i className="fas fa-play text-xs opacity-80"></i>
                Start Writing
              </button>
            ) : (
              <button 
                onClick={() => { if(window.confirm("Submit final evaluation? This cannot be undone.")) handleFinalSubmission("USER_SUBMITTED"); }}
                className="bg-[#7fb3d5] text-[#143a52] px-10 py-3 rounded-2xl font-black transition-all text-sm uppercase tracking-widest shadow-md hover:bg-[#6ea6cc] active:scale-95"
              >
                Submit Final Essay
              </button>
            )}
          </div>
        </div>
        
        {/* Instruction */}
        <div className="bg-[#fffdf7] p-8 rounded-[1.75rem] border-2 border-[#e5dccb] shadow-sm">
          <div className="mb-5 text-[12px] font-black text-[#9a3412] uppercase tracking-[0.32em]">Instruction</div>
          <p className="text-slate-900 leading-relaxed font-bold text-xl">
            {appConfig.writingPrompt}
          </p>
        </div>

        {/* Editor Box */}
        <div className="flex-1 flex flex-col min-h-[580px] bg-white border-2 border-slate-300 rounded-[1.75rem] p-3 shadow-md">
          <div className={`flex-1 transition-all duration-700 ${!isTimerRunning ? 'opacity-20 grayscale blur-sm pointer-events-none' : 'opacity-100'}`}>
            <Editor 
              content={essayContent} 
              onChange={setEssayContent} 
              onAction={handleEditorAction} 
            />
          </div>
        </div>
      </div>

      {/* Chat Sidebar (golden ratio smaller side) */}
      <div className="flex-[1] min-w-[320px] max-w-[520px] h-full shadow-xl z-10 bg-[#f8fafc] shrink-0 border-l-2 border-slate-300">
        <Chat history={chatHistory} onSendMessage={handleSendMessage} isTyping={isTyping} />
      </div>

      {/* Modals */}
      {isAdminPanelOpen && (
        <AdminPanel 
          onClose={() => { syncConfigFromStorage(); setIsAdminPanelOpen(false); }} 
          onConfigUpdate={(conf) => setAppConfig(conf)}
        />
      )}

      {/* Shared Admin Auth Triggered from Main Workspace */}
      {isAdminLoginOpen && !isAdminPanelOpen && isLoggedIn && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
            <form onSubmit={handleAdminAuth} className="bg-white p-10 rounded-[2.5rem] w-full max-w-xs text-center shadow-2xl">
              <h3 className="text-xl font-black mb-2">Admin Access</h3>
              <p className="text-slate-400 text-sm mb-8 font-medium">Authentication required</p>
              <input 
                type="password" 
                autoFocus
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Password"
                className="w-full p-4 bg-slate-50 border rounded-2xl mb-8 text-center font-mono outline-none focus:ring-4 focus:ring-indigo-500/10"
              />
              <div className="flex gap-4">
                <button type="button" onClick={() => {setIsAdminLoginOpen(false); setAdminPassword('');}} className="flex-1 text-slate-400 font-bold hover:bg-slate-50 py-3 rounded-xl transition-colors">Cancel</button>
                <button type="submit" className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-indigo-100">Unlock</button>
              </div>
            </form>
          </div>
        )}
    </div>
  );
};

export default App;
