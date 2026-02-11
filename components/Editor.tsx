
import React, { useRef } from 'react';

interface EditorProps {
  content: string;
  onChange: (value: string) => void;
  onAction: (type: 'copy' | 'paste' | 'cut' | 'undo' | 'redo' | 'save') => void;
}

const Editor: React.FC<EditorProps> = ({ content, onChange, onAction }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleToolbarClick = async (e: React.MouseEvent, type: 'copy' | 'paste' | 'cut' | 'undo' | 'redo' | 'save') => {
    e.preventDefault();
    onAction(type);

    if (textareaRef.current) {
      textareaRef.current.focus();
      try {
        if (type === 'copy') {
          // Native copy of selected text
          document.execCommand('copy');
        } else if (type === 'cut') {
          document.execCommand('cut');
        } else if (type === 'undo') {
          document.execCommand('undo');
        } else if (type === 'redo') {
          document.execCommand('redo');
        } else if (type === 'save') {
          alert('Session progress logged.');
        } else if (type === 'paste') {
          // Modern Clipboard API
          try {
            const text = await navigator.clipboard.readText();
            const start = textareaRef.current.selectionStart;
            const end = textareaRef.current.selectionEnd;
            const val = textareaRef.current.value;
            const newVal = val.substring(0, start) + text + val.substring(end);
            onChange(newVal);
            
            // Set cursor position after update (approximated as React update is async)
            setTimeout(() => {
              if (textareaRef.current) {
                const newPos = start + text.length;
                textareaRef.current.setSelectionRange(newPos, newPos);
              }
            }, 0);
          } catch (clipErr) {
            console.warn('Clipboard read failed, falling back to alert', clipErr);
            alert("To paste, please use keyboard shortcut: Ctrl+V (or Cmd+V on Mac).");
          }
        }
      } catch (err) {
        console.warn('Command execution failed', type, err);
      }
    }
  };

  const toolbarButtons = [
    { symbol: '↶', label: 'Back', action: 'undo' as const },
    { symbol: '↷', label: 'Forward', action: 'redo' as const },
    { symbol: '⎘', label: 'Copy', action: 'copy' as const },
    { symbol: '📋', label: 'Paste', action: 'paste' as const },
    { symbol: '✂', label: 'Cut', action: 'cut' as const },
    { symbol: '💾', label: 'Save', action: 'save' as const },
  ];

  return (
    <div className="flex flex-col h-full bg-white rounded-[2rem] shadow-md border-2 border-slate-300 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-4 border-b-2 border-slate-300 bg-[#e5e7eb]">
        <div className="flex items-center gap-2 flex-wrap">
          {toolbarButtons.map((btn) => (
            <button
              key={btn.action}
              onClick={(e) => handleToolbarClick(e, btn.action)}
              className="w-10 h-10 rounded-xl flex items-center justify-center bg-white border-2 border-slate-300 hover:border-[#0f766e] hover:bg-[#ecfdf5] text-slate-700 hover:text-[#0f766e] transition-all"
              title={btn.label}
            >
              <span aria-hidden="true" className="text-lg leading-none">{btn.symbol}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-6">
           <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
             {content.trim() ? content.trim().split(/\s+/).length : 0} Words
           </div>
           <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
             {content.length} Chars
           </div>
        </div>
      </div>

      {/* Editing Area */}
      <div className="flex-1 p-8 relative bg-[#fffefb]">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Begin composing your essay here..."
          className="w-full h-full resize-none focus:outline-none text-slate-800 leading-[1.8] text-xl font-medium custom-scrollbar placeholder:text-slate-400"
        />
      </div>
    </div>
  );
};

export default Editor;
