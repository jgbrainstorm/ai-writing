
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
    { icon: 'fa-rotate-left', label: 'Undo', action: 'undo' as const },
    { icon: 'fa-rotate-right', label: 'Redo', action: 'redo' as const },
    { icon: 'fa-copy', label: 'Copy', action: 'copy' as const },
    { icon: 'fa-scissors', label: 'Cut', action: 'cut' as const },
    { icon: 'fa-paste', label: 'Paste', action: 'paste' as const },
    { icon: 'fa-floppy-disk', label: 'Save', action: 'save' as const },
  ];

  return (
    <div className="flex flex-col h-full bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-slate-50 bg-slate-50/30">
        <div className="flex items-center gap-2">
          {toolbarButtons.map((btn) => (
            <button
              key={btn.action}
              onClick={(e) => handleToolbarClick(e, btn.action)}
              className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-white hover:shadow-sm text-slate-400 hover:text-indigo-600 transition-all"
              title={btn.label}
            >
              <i className={`fas ${btn.icon} text-sm`}></i>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-6">
           <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
             {content.trim() ? content.trim().split(/\s+/).length : 0} Words
           </div>
           <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
             {content.length} Chars
           </div>
        </div>
      </div>

      {/* Editing Area */}
      <div className="flex-1 p-10 relative">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Begin composing your essay here..."
          className="w-full h-full resize-none focus:outline-none text-slate-700 leading-[1.8] text-xl font-medium custom-scrollbar placeholder:text-slate-200"
        />
      </div>
    </div>
  );
};

export default Editor;
