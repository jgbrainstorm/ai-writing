
import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';

interface ChatProps {
  history: ChatMessage[];
  onSendMessage: (message: string) => void;
  isTyping: boolean;
}

const Chat: React.FC<ChatProps> = ({ history, onSendMessage, isTyping }) => {
  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, isTyping]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;
    onSendMessage(input);
    setInput('');
  };

  const handleCopyMessage = (text: string, index: number) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(index);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  // Helper to render markdown safely
  const renderMarkdown = (text: string) => {
    if (typeof (window as any).marked === 'undefined') return text;
    // Ensure marked is available and render
    return (window as any).marked.parse(text);
  };

  return (
    <div className="flex flex-col h-full bg-white select-text">
      <div className="p-6 border-b border-slate-50 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
            <i className="fas fa-robot"></i>
          </div>
          <div>
            <h2 className="font-black text-slate-800 text-sm uppercase tracking-wider">Assistant</h2>
            <div className="flex items-center gap-1.5">
               <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
               <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Online</span>
            </div>
          </div>
        </div>
      </div>
      
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-50/30">
        {history.length === 0 && (
          <div className="text-center py-10 opacity-30 px-10">
            <i className="fas fa-comments text-4xl mb-4 text-slate-300"></i>
            <p className="text-xs font-bold uppercase tracking-widest leading-relaxed">Discuss your writing goals, brainstorm ideas, or ask for feedback.</p>
          </div>
        )}
        {history.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`relative group max-w-[92%] rounded-2xl px-5 py-4 shadow-sm transition-all selection:bg-indigo-200 selection:text-indigo-900 ${
              msg.role === 'user' 
                ? 'bg-indigo-600 text-white rounded-tr-none' 
                : 'bg-white text-slate-700 rounded-tl-none border border-slate-100'
            }`}>
              {/* Copy Button - Made more robust and less intrusive to selection */}
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopyMessage(msg.parts[0].text, idx);
                }}
                className={`absolute -top-2 ${msg.role === 'user' ? '-left-2' : '-right-2'} p-2 rounded-xl border border-white shadow-lg transition-all opacity-0 group-hover:opacity-100 z-10 ${
                  msg.role === 'user' ? 'bg-indigo-700 text-indigo-100' : 'bg-white text-slate-400'
                } hover:scale-110 active:scale-95`}
                title="Copy full message"
              >
                <i className={`fas ${copiedId === idx ? 'fa-check text-emerald-400' : 'fa-copy'} text-[10px]`}></i>
              </button>

              {msg.role === 'user' ? (
                <div className="text-sm font-medium leading-relaxed whitespace-pre-wrap">
                  {msg.parts[0].text}
                </div>
              ) : (
                <div 
                  className="text-sm leading-relaxed markdown-content prose prose-sm max-w-none prose-slate"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.parts[0].text) }}
                />
              )}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-100 rounded-2xl px-5 py-3 rounded-tl-none flex items-center gap-1">
              <span className="w-1 h-1 bg-slate-300 rounded-full animate-bounce"></span>
              <span className="w-1 h-1 bg-slate-300 rounded-full animate-bounce [animation-delay:0.2s]"></span>
              <span className="w-1 h-1 bg-slate-300 rounded-full animate-bounce [animation-delay:0.4s]"></span>
            </div>
          </div>
        )}
      </div>

      <div className="p-6 border-t border-slate-50 shrink-0">
        <form onSubmit={handleSubmit} className="relative group">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isTyping}
            placeholder="Type your question..."
            className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-5 pr-14 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white focus:border-indigo-400 transition-all font-medium"
          />
          <button
            type="submit"
            disabled={isTyping || !input.trim()}
            className="absolute right-2 top-2 bottom-2 w-10 bg-slate-900 text-white rounded-xl hover:bg-indigo-600 disabled:bg-slate-200 transition-all flex items-center justify-center shadow-lg"
          >
            <i className="fas fa-arrow-up text-xs"></i>
          </button>
        </form>
      </div>
    </div>
  );
};

export default Chat;
