
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

  const contentRef = useRef('');
  const lastLoggedContentRef = useRef('');

  useEffect(() => {
    contentRef.current = essayContent;
  }, [essayContent]);

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
    if (!isTimerRunning || isSubmitted) return;

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
      const aiResponse = await getChatResponse(message, chatHistory, essayContent);
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
            onClose={() => setIsAdminPanelOpen(false)} 
            onConfigUpdate={(conf) => setAppConfig(conf)}
          />
        )}
      </div>
    );
  }

  // Screen 2: User/Admin Login
  if (!isLoggedIn) {
    return (
      <div className="h-screen w-screen bg-[#f8fafc] flex items-center justify-center relative p-6">
        <div className="w-full max-w-lg bg-white p-12 rounded-[3rem] shadow-2xl shadow-indigo-100/50 border border-white">
          <div className="text-center mb-12">
            <div className="w-20 h-20 bg-indigo-600 text-white rounded-[1.5rem] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-100">
              <i className="fas fa-feather-pointed text-3xl"></i>
            </div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">AI Writing</h1>
            <p className="text-slate-400 font-bold mt-2 uppercase text-[10px] tracking-widest">Secure Assessment Platform</p>
          </div>
          <div className="flex gap-2 mb-8">
            <button 
              onClick={() => setAuthMode('user')}
              className={`flex-1 py-3 rounded-2xl font-black uppercase text-sm tracking-widest ${authMode === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-500 border border-slate-100'}`}
            >
              User Login
            </button>
            <button 
              onClick={() => setAuthMode('admin')}
              className={`flex-1 py-3 rounded-2xl font-black uppercase text-sm tracking-widest ${authMode === 'admin' ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-500 border border-slate-100'}`}
            >
              Admin Login
            </button>
          </div>

          {authMode === 'user' ? (
            <form onSubmit={handleUserLogin} className="space-y-8">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Your Full Name</label>
                <input 
                  required
                  autoFocus
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Enter full name"
                  className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none font-bold text-slate-700 transition-all"
                />
              </div>
              <button className="w-full bg-slate-900 text-white p-5 rounded-2xl font-black text-lg hover:bg-indigo-600 transition-all shadow-xl shadow-slate-200">
                Begin Evaluation
              </button>
            </form>
          ) : (
            <form onSubmit={handleAdminAuth} className="space-y-8">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Admin Password</label>
                <input 
                  type="password"
                  autoFocus
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full p-5 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 outline-none font-bold text-slate-700 transition-all text-center"
                />
              </div>
              <button className="w-full bg-indigo-600 text-white p-5 rounded-2xl font-black text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200">
                Open Admin Dashboard
              </button>
            </form>
          )}
        </div>
        {isAdminPanelOpen && (
          <AdminPanel 
            onClose={() => setIsAdminPanelOpen(false)} 
            onConfigUpdate={(conf) => setAppConfig(conf)}
          />
        )}
      </div>
    );
  }

  // Screen 3: Main Workspace
  return (
    <div className="flex h-screen w-screen overflow-hidden text-slate-800 bg-[#f8fafc]">
      
      {/* Golden ratio layout: main area ~62%, chat ~38% */}
      <div className="flex-[1.618] flex flex-col h-full overflow-y-auto custom-scrollbar p-10 space-y-8">
        
        {/* Instruction */}
        <div className="bg-gradient-to-br from-[#f7f9fc] via-white to-[#eef2f8] p-10 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/30">
          <div className="inline-flex items-center gap-3 mb-6 px-4 py-2 rounded-2xl bg-white/80 border border-slate-100 shadow-sm">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 shadow-inner shadow-indigo-100">
               <i className="fas fa-file-invoice text-sm"></i>
            </div>
            <span className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.35em]">Instruction</span>
          </div>
          <p className="text-slate-800 leading-relaxed font-bold text-xl">
            {appConfig.writingPrompt}
          </p>
        </div>

        {/* Timer & Start centered */}
        <div className="flex flex-col items-center gap-4">
          <Timer seconds={timeLeft} isActive={isTimerRunning} onTick={handleTick} />
          {!isTimerRunning && (
            <button 
              onClick={handleStartWriting}
              className="bg-slate-900 text-white px-10 py-5 rounded-2xl font-black text-xl shadow-2xl shadow-slate-300 hover:bg-indigo-600 active:scale-95 transition-all flex items-center gap-3"
            >
              <i className="fas fa-play text-sm opacity-50"></i>
              Start Writing
            </button>
          )}
        </div>

        {/* Editor Box */}
        <div className="flex-1 flex flex-col min-h-[500px]">
          <div className={`flex-1 transition-all duration-700 ${!isTimerRunning ? 'opacity-20 grayscale blur-sm pointer-events-none' : 'opacity-100'}`}>
            <Editor 
              content={essayContent} 
              onChange={setEssayContent} 
              onAction={handleEditorAction} 
            />
          </div>
        </div>

        {/* Footer Navigation & Actions */}
        <div className="flex justify-between items-center bg-white px-10 py-6 rounded-[2.5rem] border border-white shadow-xl shadow-slate-200/20">
           <div className="flex items-center gap-10">
             <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 shadow-inner">
                  <i className="fas fa-user text-xs"></i>
                </div>
                <div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active User</div>
                  <div className="text-slate-700 font-black">{userName}</div>
                </div>
             </div>
             <div className="w-px h-8 bg-slate-100"></div>
             <button 
                onClick={openAdminPanel}
                className="flex items-center gap-2 text-slate-300 hover:text-indigo-600 transition-colors group"
             >
                <i className="fas fa-user-shield text-sm"></i>
                <span className="text-[10px] font-black uppercase tracking-widest">Admin Dashboard</span>
             </button>
           </div>
           <button 
            disabled={!isTimerRunning}
            onClick={() => { if(window.confirm("Submit final evaluation? This cannot be undone.")) handleFinalSubmission("USER_SUBMITTED"); }}
            className={`px-14 py-5 rounded-2xl font-black transition-all text-sm uppercase tracking-widest shadow-xl ${
              !isTimerRunning ? 'bg-slate-50 text-slate-200 cursor-not-allowed shadow-none' : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-100 active:scale-95'
            }`}
          >
            Submit Final Essay
          </button>
        </div>
      </div>

      {/* Chat Sidebar (golden ratio smaller side) */}
      <div className="flex-[1] min-w-[320px] max-w-[520px] h-full shadow-2xl z-10 bg-white shrink-0 border-l border-slate-100">
        <Chat history={chatHistory} onSendMessage={handleSendMessage} isTyping={isTyping} />
      </div>

      {/* Modals */}
      {isAdminPanelOpen && (
        <AdminPanel 
          onClose={() => setIsAdminPanelOpen(false)} 
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
