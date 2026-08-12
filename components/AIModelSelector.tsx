import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Cpu, Zap, Server, Cloud, Wifi, WifiOff } from 'lucide-react';
import { AIModelConfig, AIProvider } from '../types';
import { listOllamaModels, isOllamaRunning } from '../services/ollama';

// ─────────────────────────────────────────────────────────────────────────────
// All available AI models catalogue
// ─────────────────────────────────────────────────────────────────────────────
export const ALL_MODELS: AIModelConfig[] = [
  // Gemini
  {
    id: 'gemini-pro',
    provider: 'gemini',
    modelId: 'gemini-3.1-pro-preview',
    displayName: 'Gemini 3.1 Pro',
    description: 'Most powerful — deep reasoning & AAA game generation',
    tag: 'Pro',
    icon: '✦',
    requiresKey: true,
    localStorageKey: 'gemini_api_key',
  },
  {
    id: 'gemini-flash',
    provider: 'gemini',
    modelId: 'gemini-3.5-flash',
    displayName: 'Gemini 3.5 Flash',
    description: 'Fastest Gemini — great for quick builds & refinements',
    tag: 'Fast',
    icon: '⚡',
    requiresKey: true,
    localStorageKey: 'gemini_api_key',
  },
  // Grok
  {
    id: 'grok-4-5',
    provider: 'grok',
    modelId: 'grok-4-5',
    displayName: 'Grok 4.5',
    description: 'xAI\'s flagship model — advanced agentic coding & reasoning',
    tag: 'Pro',
    icon: '🚀',
    requiresKey: true,
    localStorageKey: 'grok_api_key',
  },
  // Hugging Face
  {
    id: 'qwen-coder',
    provider: 'huggingface',
    modelId: 'Qwen/Qwen2.5-Coder-32B-Instruct',
    displayName: 'Qwen 2.5 Coder 32B',
    description: 'World\'s best open-source coding model — expert at 3D game code',
    tag: 'Code',
    icon: '🤗',
    requiresKey: true,
    localStorageKey: 'hf_api_key',
  },
  // Ollama
  {
    id: 'ollama-llama32',
    provider: 'ollama',
    modelId: 'llama3.2',
    displayName: 'Llama 3.2 (Local)',
    description: '100% offline — runs on your computer, zero cost',
    tag: 'Local',
    icon: '🖥️',
    requiresKey: false,
  },
];

export const DEFAULT_MODEL = ALL_MODELS[0];

const PROVIDER_LABELS: Record<AIProvider, string> = {
  gemini: 'GOOGLE GEMINI',
  grok: 'XAI GROK',
  huggingface: 'HUGGING FACE',
  ollama: 'OLLAMA (LOCAL)',
};

const PROVIDER_ORDER: AIProvider[] = ['gemini', 'grok', 'huggingface', 'ollama'];

const TAG_COLORS: Record<string, string> = {
  Pro: 'bg-violet-100 text-violet-700 border-violet-200',
  Fast: 'bg-blue-100 text-blue-700 border-blue-200',
  Code: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Local: 'bg-amber-100 text-amber-700 border-amber-200',
  Experimental: 'bg-rose-100 text-rose-700 border-rose-200',
};

interface AIModelSelectorProps {
  selectedModel: AIModelConfig;
  onModelChange: (model: AIModelConfig) => void;
}

export const AIModelSelector: React.FC<AIModelSelectorProps> = ({ selectedModel, onModelChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [ollamaOnline, setOllamaOnline] = useState<boolean | null>(null);
  const [ollamaModels, setOllamaModels] = useState<{ name: string }[]>([]);
  const [allModels, setAllModels] = useState<AIModelConfig[]>(ALL_MODELS);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Check Ollama status when dropdown opens
  useEffect(() => {
    if (isOpen) {
      isOllamaRunning().then(running => {
        setOllamaOnline(running);
        if (running) {
          listOllamaModels().then(models => {
            setOllamaModels(models);
            // Dynamically add discovered Ollama models
            const existingOllamaIds = new Set(ALL_MODELS.filter(m => m.provider === 'ollama').map(m => m.modelId));
            const newOllamaModels: AIModelConfig[] = models
              .filter(m => !existingOllamaIds.has(m.name) && m.name !== 'llama3.2')
              .map(m => ({
                id: `ollama-${m.name.replace(/[^a-z0-9]/gi, '-')}`,
                provider: 'ollama' as AIProvider,
                modelId: m.name,
                displayName: `${m.name} (Local)`,
                description: 'Locally installed Ollama model',
                tag: 'Local' as const,
                icon: '🖥️',
                requiresKey: false,
              }));
            if (newOllamaModels.length > 0) {
              setAllModels([...ALL_MODELS, ...newOllamaModels]);
            }
          });
        }
      });
    }
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const grouped = PROVIDER_ORDER.reduce((acc, provider) => {
    acc[provider] = allModels.filter(m => m.provider === provider);
    return acc;
  }, {} as Record<AIProvider, AIModelConfig[]>);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm group"
        title="Switch AI Model"
      >
        <span className="text-base leading-none">{selectedModel.icon}</span>
        <div className="flex flex-col items-start">
          <span className="text-[11px] font-black text-slate-800 tracking-tight leading-none">
            {selectedModel.displayName}
          </span>
          <span className={`text-[8px] font-black uppercase tracking-widest px-1 py-0.5 rounded mt-0.5 border ${TAG_COLORS[selectedModel.tag]}`}>
            {selectedModel.tag}
          </span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-white rounded-2xl border border-slate-200 shadow-2xl shadow-slate-200/60 z-[500] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-3 border-b border-slate-100 bg-slate-50">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Select AI Model</p>
          </div>

          <div className="max-h-[70vh] overflow-y-auto no-scrollbar">
            {PROVIDER_ORDER.map(provider => {
              const models = grouped[provider];
              if (!models || models.length === 0) return null;

              return (
                <div key={provider}>
                  {/* Provider header */}
                  <div className="px-4 pt-4 pb-2 flex items-center gap-2">
                    {provider === 'gemini' && <Cloud className="w-3 h-3 text-blue-500" />}
                    {provider === 'grok' && <Cpu className="w-3 h-3 text-violet-500" />}
                    {provider === 'huggingface' && <Zap className="w-3 h-3 text-amber-500" />}
                    {provider === 'ollama' && (
                      ollamaOnline === true
                        ? <Wifi className="w-3 h-3 text-emerald-500" />
                        : <WifiOff className="w-3 h-3 text-slate-400" />
                    )}
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
                      {PROVIDER_LABELS[provider]}
                    </span>
                    {provider === 'ollama' && (
                      <span className={`text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full border ${
                        ollamaOnline === true
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                          : 'bg-slate-100 text-slate-400 border-slate-200'
                      }`}>
                        {ollamaOnline === true ? 'ONLINE' : ollamaOnline === false ? 'OFFLINE' : '...'}
                      </span>
                    )}
                  </div>

                  {/* Model cards */}
                  <div className="px-3 pb-3 space-y-1.5">
                    {models.map(model => {
                      const isSelected = model.id === selectedModel.id;
                      const isOllamaOffline = model.provider === 'ollama' && ollamaOnline === false;

                      return (
                        <button
                          key={model.id}
                          onClick={() => {
                            if (!isOllamaOffline) {
                              onModelChange(model);
                              setIsOpen(false);
                            }
                          }}
                          disabled={isOllamaOffline}
                          className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all group/model ${
                            isSelected
                              ? 'bg-indigo-50 border border-indigo-200 shadow-sm'
                              : isOllamaOffline
                              ? 'opacity-40 cursor-not-allowed bg-slate-50 border border-transparent'
                              : 'hover:bg-slate-50 border border-transparent hover:border-slate-200'
                          }`}
                        >
                          <span className="text-xl shrink-0">{model.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-black tracking-tight truncate ${
                                isSelected ? 'text-indigo-700' : 'text-slate-800'
                              }`}>
                                {model.displayName}
                              </span>
                              <span className={`shrink-0 text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${TAG_COLORS[model.tag]}`}>
                                {model.tag}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 font-medium mt-0.5 truncate">
                              {isOllamaOffline ? 'Start Ollama app to use' : model.description}
                            </p>
                          </div>
                          {isSelected && (
                            <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Divider between providers */}
                  {provider !== PROVIDER_ORDER[PROVIDER_ORDER.length - 1] && (
                    <div className="mx-4 border-t border-slate-100" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-100">
            <p className="text-[9px] text-slate-400 font-medium leading-relaxed">
              💡 Set API keys via <strong>AI Config</strong> in the header
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
