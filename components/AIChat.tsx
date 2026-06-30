
import { Bot, BrainCircuit, ChevronRight, Loader2, Send, Sparkles, Terminal, User, Zap, Lightbulb, Cpu, Bolt, Brain, RefreshCw, Workflow, Plus, Paperclip, X, Image as ImageIcon, Film } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { ChatMessage, AIModelMode } from '../types';

interface FileAttachment {
  id: string;
  file: File;
  preview: string;
  type: 'image' | 'video';
}

interface AIChatProps {
  history: ChatMessage[];
  onSendMessage: (msg: string, attachments?: FileAttachment[]) => void;
  onInspiration: () => void;
  onLogicWeave: () => void;
  onAddAsset: (content: string) => void;
  isProcessing: boolean;
  aiMode: AIModelMode;
  onModeChange: (mode: AIModelMode) => void;
}

export const AIChat: React.FC<AIChatProps> = ({ 
  history, 
  onSendMessage, 
  onInspiration, 
  onLogicWeave,
  onAddAsset,
  isProcessing, 
  aiMode, 
  onModeChange 
}) => {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, isProcessing]);

  const handleFiles = async (files: FileList | File[]) => {
    const newAttachments: FileAttachment[] = await Promise.all(Array.from(files).map(async file => {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      return {
        id: Math.random().toString(36).substr(2, 9),
        file,
        preview: base64,
        type: file.type.startsWith('video/') ? 'video' : 'image'
      };
    }));

    setAttachments(prev => [...prev, ...newAttachments]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    handleFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1 || items[i].type.indexOf('video') !== -1) {
        const file = items[i].getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length > 0) {
      handleFiles(files);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => {
      const filtered = prev.filter(a => a.id !== id);
      // Revoke object URL to avoid memory leaks
      const removed = prev.find(a => a.id === id);
      if (removed) URL.revokeObjectURL(removed.preview);
      return filtered;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((input.trim() || attachments.length > 0) && !isProcessing) {
      onSendMessage(input, attachments);
      setInput('');
      setAttachments([]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  const formatReport = (text: any) => {
    const safeText = typeof text === 'string' ? text : JSON.stringify(text, null, 2);
    return safeText.split('\n').map((line, i) => {
      if (line.startsWith('[') && line.includes(']')) {
        return (
          <div key={i} className="flex items-center gap-2 mt-5 mb-2.5 first:mt-0">
            <ChevronRight className="w-3.5 h-3.5 text-indigo-600" />
            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">
              {line.replace('[', '').replace(']', '')}
            </span>
          </div>
        );
      }
      return <p key={i} className="mb-2.5 leading-relaxed break-words font-medium text-slate-700">{line}</p>;
    });
  };

  return (
    <div className="flex flex-col h-full bg-white relative">
      {/* Assistant Header */}
      <div className="px-5 md:px-6 py-4 md:py-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white/80 backdrop-blur-md sticky top-0 z-[55]">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-100 shadow-sm shrink-0">
            <BrainCircuit className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="flex flex-col min-w-0">
            <h2 className="text-sm font-black tracking-tight text-slate-900 truncate">Neural Architect</h2>
            <div className="flex items-center gap-1.5">
               {aiMode === 'fast' ? (
                 <>
                   <Bolt className="w-2.5 h-2.5 text-indigo-600" />
                   <span className="text-[8px] text-indigo-600 font-black uppercase tracking-widest">Flash Engine</span>
                 </>
               ) : (
                 <>
                   <Cpu className="w-2.5 h-2.5 text-amber-500" />
                   <span className="text-[8px] text-amber-500 font-black uppercase tracking-widest">Think Engine</span>
                 </>
               )}
            </div>
          </div>
        </div>
        
        <div className="flex bg-slate-50 p-1.5 rounded-xl border border-slate-100">
          <button 
            onClick={() => onModeChange('fast')}
            title="Fast Mode"
            className={`p-2 rounded-lg transition-all ${aiMode === 'fast' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Bolt className="w-5 h-5" />
          </button>
          <button 
            onClick={() => onModeChange('thinking')}
            title="Reasoning Mode"
            className={`p-2 rounded-lg transition-all ${aiMode === 'thinking' ? 'bg-white text-amber-500 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Cpu className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Chat Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 md:p-8 space-y-8 no-scrollbar bg-slate-50/30">
        {history.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center px-8">
            <div className="w-16 h-16 bg-white border border-slate-100 rounded-[2rem] flex items-center justify-center mb-8 shadow-xl shadow-indigo-100/50">
              <Sparkles className="w-8 h-8 text-slate-200" />
            </div>
            <p className="text-[10px] md:text-xs font-black uppercase tracking-[0.3em] text-slate-300 leading-loose">
              Architect Offline.<br/>Buffers Required.
            </p>
          </div>
        )}
        
        {history.map((msg, i) => (
          <div key={i} className={`flex gap-4 md:gap-6 ${msg.role === 'user' ? 'flex-row-reverse' : ''} animate-in fade-in slide-in-from-bottom-4 duration-500`}>
            <div className={`shrink-0 w-9 h-9 md:w-11 md:h-11 rounded-2xl flex items-center justify-center border shadow-sm ${
              msg.role === 'user' ? 'bg-indigo-600 border-indigo-700 text-white' : 'bg-white border-slate-200 text-indigo-600'
            }`}>
              {msg.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
            </div>
            <div className={`flex flex-col gap-3 md:gap-4 max-w-[85%] md:max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`p-5 md:p-6 rounded-[1.75rem] text-xs md:text-sm shadow-xl shadow-slate-200/40 relative ${
                msg.role === 'user' 
                  ? 'bg-indigo-600 text-white rounded-tr-none' 
                  : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none border-l-[3px] border-l-amber-400'
              }`}>
                {msg.role === 'ai' && (
                  <div className="flex items-center justify-between mb-4 pb-2.5 border-b border-slate-50">
                    <div className="flex items-center gap-2 opacity-40">
                      <Terminal className="w-3.5 h-3.5" />
                      <span className="text-[8px] font-black uppercase tracking-widest">Substrate Analysis</span>
                    </div>
                    {msg.isApplying && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-100">
                        <Zap className="w-2.5 h-2.5 text-indigo-600 animate-pulse" />
                        <span className="text-[7px] font-black uppercase tracking-widest text-indigo-600">Active</span>
                      </div>
                    )}
                  </div>
                )}
                <div className="whitespace-pre-wrap">
                  {msg.role === 'ai' ? formatReport(msg.text) : msg.text}
                </div>

                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {msg.attachments.map((att) => (
                      <div key={att.id} className="w-24 h-24 md:w-32 md:h-32 rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-50">
                        {att.type === 'image' ? (
                          <img src={att.preview} alt="attachment" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Film className="w-8 h-8 text-slate-400" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {msg.role === 'ai' && msg.proposedLogicNodes && msg.proposedLogicNodes.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-slate-100 space-y-3">
                    <div className="flex items-center gap-2 mb-2 text-indigo-600">
                      <Workflow className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-[0.2em]">Logic Proposals</span>
                    </div>
                    {msg.proposedLogicNodes.map((node, nIdx) => (
                      <div key={nIdx} className="group/node bg-slate-50 border border-slate-100 p-4 rounded-xl flex items-center justify-between gap-3 hover:border-indigo-200 transition-all">
                        <span className="text-[10px] md:text-[11px] font-bold text-slate-600 line-clamp-2 italic">"{node}"</span>
                        <button 
                          onClick={() => onAddAsset(node)}
                          title="Add to Project"
                          className="shrink-0 p-2.5 bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-indigo-600 hover:border-indigo-200 hover:shadow-sm transition-all active:scale-90"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {msg.role === 'ai' && msg.suggestions && msg.suggestions.length > 0 && !isProcessing && (
                <div className="flex flex-wrap gap-2 animate-in fade-in slide-in-from-left-4 duration-700">
                  {msg.suggestions.map((suggestion, sIdx) => (
                    <button
                      key={sIdx}
                      onClick={() => onSendMessage(suggestion)}
                      className="group flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full hover:border-indigo-600 hover:shadow-lg transition-all active:scale-95"
                    >
                      <Lightbulb className="w-3.5 h-3.5 text-amber-500 group-hover:animate-pulse" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-indigo-600">{suggestion}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isProcessing && (
          <div className="flex gap-4 md:gap-6">
            <div className="shrink-0 w-9 h-9 md:w-11 md:h-11 rounded-2xl bg-white border border-amber-100 flex items-center justify-center shadow-md">
              <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
            </div>
            <div className="flex-1 flex flex-col gap-3">
               <div className="bg-white border border-slate-100 p-5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-3 shadow-sm">
                 <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                 Synthesizing logical substrate...
               </div>
            </div>
          </div>
        )}
      </div>

      {/* Chat Input Area */}
      <form 
        onSubmit={handleSubmit} 
        onPaste={handlePaste}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className="p-4 md:p-6 bg-white border-t border-slate-100 shrink-0 sticky bottom-0 z-50"
      >
        <div className="flex gap-2.5 mb-3 md:mb-4">
           <button 
             type="button"
             onClick={onInspiration}
             disabled={isProcessing}
             className="flex-1 group flex items-center justify-center gap-2 px-4 py-3.5 bg-amber-50 border border-amber-100 rounded-xl hover:bg-amber-100 hover:border-amber-200 transition-all active:scale-95 shadow-sm"
           >
              <Brain className="w-4 h-4 text-amber-600" />
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-700">Brainstorm</span>
           </button>
           <button 
             type="button"
             onClick={onLogicWeave}
             disabled={isProcessing}
             className="flex-1 group flex items-center justify-center gap-2 px-4 py-3.5 bg-indigo-50 border border-indigo-100 rounded-xl hover:bg-indigo-100 hover:border-indigo-200 transition-all active:scale-95 shadow-sm"
           >
              <Workflow className="w-4 h-4 text-indigo-600" />
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-700">Logic Weaver</span>
           </button>
        </div>

        {/* Attachment Previews */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3 animate-in fade-in slide-in-from-bottom-2">
            {attachments.map((att) => (
              <div key={att.id} className="relative group w-16 h-16 md:w-20 md:h-20 rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                {att.type === 'image' ? (
                  <img src={att.preview} alt="preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                    <Film className="w-6 h-6 text-slate-400" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removeAttachment(att.id)}
                  className="absolute top-1 right-1 p-1 bg-black/50 hover:bg-black/70 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        
        <div className="relative flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-2xl md:rounded-[1.75rem] p-2 focus-within:border-indigo-600 focus-within:bg-white transition-all shadow-inner">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            className="p-3 md:p-4 text-slate-400 hover:text-indigo-600 transition-colors"
          >
            <Paperclip className="w-5 h-5" />
          </button>
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            multiple
            accept="image/*,video/*"
            className="hidden"
          />

          <TextareaAutosize
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isProcessing}
            placeholder={isProcessing ? "Synthesizing..." : "Prompt Architect..."}
            maxRows={8}
            className="flex-1 bg-transparent border-none py-3 md:py-4 px-2 text-xs md:text-sm text-slate-900 font-bold focus:outline-none transition-all placeholder:text-slate-300 resize-none min-h-[44px]"
          />
          
          <button
            type="submit"
            disabled={isProcessing || (!input.trim() && attachments.length === 0)}
            className={`p-3 md:p-4 rounded-xl md:rounded-2xl text-white disabled:opacity-20 transition-all shadow-xl active:scale-90 shrink-0 ${aiMode === 'thinking' ? 'bg-amber-500 shadow-amber-200 hover:bg-amber-600' : 'bg-indigo-600 shadow-indigo-200 hover:bg-indigo-700'}`}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  );
};
