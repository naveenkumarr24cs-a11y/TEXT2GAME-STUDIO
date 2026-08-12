import React, { useState, useEffect } from 'react';
import { Cpu, Sparkles, X } from 'lucide-react';

interface GeminiConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GeminiConfigModal: React.FC<GeminiConfigModalProps> = ({ isOpen, onClose }) => {
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    if (isOpen) {
      const storedKey = localStorage.getItem('gemini_api_key') || '';
      setApiKey(storedKey);
    }
  }, [isOpen]);

  const handleSave = () => {
    localStorage.setItem('gemini_api_key', apiKey.trim());
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-[2rem] p-8 shadow-2xl max-w-sm w-full border border-slate-100 relative flex flex-col gap-6 animate-in zoom-in-95 duration-200">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header section with Icon */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-violet-50 text-violet-600 rounded-[1.2rem] flex items-center justify-center shrink-0">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-extrabold text-slate-900 tracking-tight leading-none">
              Gemini API Config
            </h3>
            <span className="text-[9px] font-black tracking-widest text-slate-400 uppercase mt-1 block">
              CONFIGURE NEURAL LINK
            </span>
          </div>
        </div>

        {/* Subtitle/Text */}
        <p className="text-slate-500 text-xs md:text-[13px] leading-relaxed font-medium">
          To build games directly in your browser, a Gemini API Key is required. Your key is stored securely in your browser's local storage.
        </p>

        {/* Input Form */}
        <div className="space-y-2">
          <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block">
            GEMINI API KEY
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="AIzaSy..."
            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-medium text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-mono"
          />
        </div>

        {/* Link Button */}
        <a
          href="https://aistudio.google.com/app/apikey"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-3 px-4 bg-slate-50 hover:bg-slate-100/80 border border-slate-100/50 rounded-2xl text-[10px] md:text-xs font-black uppercase tracking-wider text-indigo-600 flex items-center justify-center gap-2 transition-all"
        >
          <Sparkles className="w-4 h-4 text-indigo-500" />
          GET API KEY FROM GOOGLE AI STUDIO
        </a>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            className="flex-1 py-3.5 bg-[#4F46E5] hover:bg-indigo-700 text-white rounded-2xl text-[10px] md:text-xs font-black uppercase tracking-wider transition-all hover:shadow-lg hover:shadow-indigo-100"
          >
            SAVE
          </button>
          <button
            onClick={handleCancel}
            className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-[10px] md:text-xs font-black uppercase tracking-wider transition-all"
          >
            CANCEL
          </button>
        </div>

      </div>
    </div>
  );
};
