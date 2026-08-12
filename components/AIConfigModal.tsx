import React, { useState, useEffect } from 'react';
import { X, Key, CheckCircle2, AlertCircle, ExternalLink, RefreshCw, Wifi, WifiOff, Cpu } from 'lucide-react';
import { isOllamaRunning, listOllamaModels } from '../services/ollama';

interface AIConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Tab = 'gemini' | 'grok' | 'huggingface' | 'ollama';

interface TabConfig {
  id: Tab;
  label: string;
  icon: string;
  storageKey: string;
  placeholder: string;
  docsUrl: string;
  description: string;
  keyPrefix: string;
}

const TABS: TabConfig[] = [
  {
    id: 'gemini',
    label: 'Gemini',
    icon: '✦',
    storageKey: 'gemini_api_key',
    placeholder: 'AIzaSy...',
    docsUrl: 'https://aistudio.google.com/app/apikey',
    description: 'Powers Gemini 3.1 Pro and Gemini 3.5 Flash models.',
    keyPrefix: 'AIza',
  },
  {
    id: 'grok',
    label: 'Grok',
    icon: '🚀',
    storageKey: 'grok_api_key',
    placeholder: 'xai-...',
    docsUrl: 'https://console.x.ai',
    description: 'Powers Grok 4.5 from xAI. Available at console.x.ai.',
    keyPrefix: 'xai-',
  },
  {
    id: 'huggingface',
    label: 'Hugging Face',
    icon: '🤗',
    storageKey: 'hf_api_key',
    placeholder: 'hf_...',
    docsUrl: 'https://huggingface.co/settings/tokens',
    description: 'Powers Qwen 2.5 Coder 32B — best open-source coding model.',
    keyPrefix: 'hf_',
  },
  {
    id: 'ollama',
    label: 'Ollama',
    icon: '🖥️',
    storageKey: '',
    placeholder: '',
    docsUrl: 'https://ollama.com',
    description: 'Runs AI locally on your computer. No API key needed — 100% free & private.',
    keyPrefix: '',
  },
];

export const AIConfigModal: React.FC<AIConfigModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<Tab>('gemini');
  const [keys, setKeys] = useState<Record<string, string>>({
    gemini_api_key: '',
    grok_api_key: '',
    hf_api_key: '',
  });
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [ollamaModels, setOllamaModels] = useState<{ name: string; size: number }[]>([]);
  const [ollamaRefreshing, setOllamaRefreshing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setKeys({
        gemini_api_key: localStorage.getItem('gemini_api_key') || '',
        grok_api_key: localStorage.getItem('grok_api_key') || '',
        hf_api_key: localStorage.getItem('hf_api_key') || '',
      });
      setSaved({});
      checkOllama();
    }
  }, [isOpen]);

  const checkOllama = async () => {
    setOllamaStatus('checking');
    const running = await isOllamaRunning();
    setOllamaStatus(running ? 'online' : 'offline');
    if (running) {
      const models = await listOllamaModels();
      setOllamaModels(models as any);
    }
  };

  const handleRefreshOllama = async () => {
    setOllamaRefreshing(true);
    await checkOllama();
    setOllamaRefreshing(false);
  };

  const handleSaveKey = (storageKey: string) => {
    const value = keys[storageKey]?.trim();
    if (value) {
      localStorage.setItem(storageKey, value);
    } else {
      localStorage.removeItem(storageKey);
    }
    setSaved(prev => ({ ...prev, [storageKey]: true }));
    setTimeout(() => setSaved(prev => ({ ...prev, [storageKey]: false })), 2000);
  };

  const formatBytes = (bytes: number) => {
    if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
    if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(0)} MB`;
    return `${bytes} B`;
  };

  if (!isOpen) return null;

  const activeTabConfig = TABS.find(t => t.id === activeTab)!;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-7 py-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center">
              <Key className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight">AI Config</h3>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Configure Neural Providers</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-3 bg-slate-50 border-b border-slate-100">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-indigo-700 shadow-sm border border-slate-100'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <span className="text-sm">{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-7">
          <p className="text-xs text-slate-500 font-medium mb-5 leading-relaxed">
            {activeTabConfig.description}
          </p>

          {activeTab !== 'ollama' ? (
            /* API Key Input */
            <div className="space-y-4">
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                  {activeTabConfig.label} API Key
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={keys[activeTabConfig.storageKey] || ''}
                    onChange={e => setKeys(prev => ({ ...prev, [activeTabConfig.storageKey]: e.target.value }))}
                    placeholder={activeTabConfig.placeholder}
                    className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                  <button
                    onClick={() => handleSaveKey(activeTabConfig.storageKey)}
                    className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all ${
                      saved[activeTabConfig.storageKey]
                        ? 'bg-emerald-500 text-white'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-100'
                    }`}
                  >
                    {saved[activeTabConfig.storageKey] ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      'Save'
                    )}
                  </button>
                </div>

                {/* Key status indicator */}
                {keys[activeTabConfig.storageKey] && (
                  <div className={`mt-2 flex items-center gap-1.5 text-[10px] font-bold ${
                    keys[activeTabConfig.storageKey].startsWith(activeTabConfig.keyPrefix)
                      ? 'text-emerald-600'
                      : 'text-amber-600'
                  }`}>
                    {keys[activeTabConfig.storageKey].startsWith(activeTabConfig.keyPrefix) ? (
                      <><CheckCircle2 className="w-3 h-3" /> Key format looks correct</>
                    ) : (
                      <><AlertCircle className="w-3 h-3" /> Key should start with "{activeTabConfig.keyPrefix}"</>
                    )}
                  </div>
                )}
              </div>

              <a
                href={activeTabConfig.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-wider text-indigo-600 transition-all"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Get {activeTabConfig.label} API Key
              </a>

              <p className="text-[9px] text-slate-400 font-medium text-center leading-relaxed">
                🔐 Keys are stored only in your browser's localStorage — never sent to any server.
              </p>
            </div>
          ) : (
            /* Ollama Panel */
            <div className="space-y-4">
              {/* Connection Status */}
              <div className={`flex items-center justify-between p-4 rounded-2xl border ${
                ollamaStatus === 'online'
                  ? 'bg-emerald-50 border-emerald-200'
                  : ollamaStatus === 'offline'
                  ? 'bg-red-50 border-red-200'
                  : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center gap-3">
                  {ollamaStatus === 'online'
                    ? <Wifi className="w-5 h-5 text-emerald-600" />
                    : ollamaStatus === 'offline'
                    ? <WifiOff className="w-5 h-5 text-red-500" />
                    : <RefreshCw className="w-5 h-5 text-slate-400 animate-spin" />
                  }
                  <div>
                    <p className={`text-xs font-black ${
                      ollamaStatus === 'online' ? 'text-emerald-700'
                      : ollamaStatus === 'offline' ? 'text-red-600'
                      : 'text-slate-500'
                    }`}>
                      Ollama {ollamaStatus === 'online' ? 'Connected' : ollamaStatus === 'offline' ? 'Not Running' : 'Checking...'}
                    </p>
                    <p className="text-[9px] text-slate-500 font-medium">
                      {ollamaStatus === 'online'
                        ? `${ollamaModels.length} model${ollamaModels.length !== 1 ? 's' : ''} installed`
                        : 'Start the Ollama app on your computer'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleRefreshOllama}
                  disabled={ollamaRefreshing}
                  className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 transition-all"
                >
                  <RefreshCw className={`w-4 h-4 ${ollamaRefreshing ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* Installed Models */}
              {ollamaStatus === 'online' && ollamaModels.length > 0 && (
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">
                    Installed Models
                  </p>
                  <div className="space-y-2 max-h-48 overflow-y-auto no-scrollbar">
                    {ollamaModels.map((model: any) => (
                      <div key={model.name} className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                        <div className="flex items-center gap-2">
                          <Cpu className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-xs font-bold text-slate-700">{model.name}</span>
                        </div>
                        <span className="text-[9px] font-black text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">
                          {formatBytes(model.size)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Offline instructions */}
              {ollamaStatus === 'offline' && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">How to start Ollama</p>
                  <ol className="space-y-1">
                    {['Download from ollama.com', 'Install and open Ollama app', 'It runs automatically in the background', 'Click Refresh above to reconnect'].map((step, i) => (
                      <li key={i} className="flex items-start gap-2 text-[10px] text-amber-800 font-medium">
                        <span className="shrink-0 w-4 h-4 bg-amber-200 rounded-full flex items-center justify-center text-[8px] font-black">{i + 1}</span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              <a
                href="https://ollama.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-wider text-indigo-600 transition-all"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Visit ollama.com
              </a>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-7 pb-6">
          <button
            onClick={onClose}
            className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
