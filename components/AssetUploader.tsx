
import React, { useState } from 'react';
import { AssetType, GameAsset } from '../types';
import { X, Box, Music, MessageSquare, Plus, Globe, Activity, Users, Zap, Loader2, CheckCircle2, Timer, Cpu, Tag, ChevronDown, Eye } from 'lucide-react';
import { AssetPreview } from './AssetPreview';

interface AssetUploaderProps {
  assets: GameAsset[];
  onAssetsChange: (assets: GameAsset[]) => void;
  onPreviewAsset: (asset: GameAsset) => void;
}

const LIMITS: Record<AssetType, number | null> = {
  character1: 4,
  motion1: 10,
  character2: 4,
  motion2: 10,
  environment: null,
  music: null,
  dialogue: null
};

const CATEGORIES = [
  'Hero', 'Enemy', 'NPC', 'Prop', 'Level Geometry', 'Loot', 'Trigger', 'Hazard', 'Decal', 'VFX'
];

const DEFAULT_CATEGORIES: Record<AssetType, string> = {
  character1: 'Hero',
  motion1: 'Hero',
  character2: 'Enemy',
  motion2: 'Enemy',
  environment: 'Level Geometry',
  music: 'BGM',
  dialogue: 'Logic'
};

const OPTIMIZATION_STAGES = [
  { threshold: 0, label: "Scanning Geometry" },
  { threshold: 20, label: "Refining Mesh" },
  { threshold: 45, label: "Compressing Map" },
  { threshold: 75, label: "UV Optimization" },
  { threshold: 90, label: "Final Synthesis" }
];

export const AssetUploader: React.FC<AssetUploaderProps> = ({ assets, onAssetsChange, onPreviewAsset }) => {
  const [dialogueInput, setDialogueInput] = useState('');
  const [optimizingId, setOptimizingId] = useState<string | null>(null);
  const [optimizingProgress, setOptimizingProgress] = useState(0);
  const [optimizingStatus, setOptimizingStatus] = useState("");
  const [activeCategoryPicker, setActiveCategoryPicker] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: AssetType) => {
    const files = e.target.files;
    if (!files) return;
    const currentCount = assets.filter(a => a.type === type).length;
    const limit = LIMITS[type];
    const filesToUpload = Array.from(files);
    
    if (limit !== null && currentCount + filesToUpload.length > limit) {
      alert(`Capacity Warning: ${type} slot is limited to ${limit} assets.`);
      e.target.value = '';
      return;
    }

    const newAssetsPromises = filesToUpload.map((file: File) => {
      return new Promise<GameAsset>((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          resolve({
            id: Math.random().toString(36).substr(2, 9),
            name: file.name,
            type,
            content: event.target?.result as string,
            mimeType: file.type || 'application/octet-stream',
            isOptimized: false,
            category: DEFAULT_CATEGORIES[type]
          });
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(newAssetsPromises).then((newlyCreatedAssets) => {
      onAssetsChange([...assets, ...newlyCreatedAssets]);
    });
    e.target.value = '';
  };

  const updateAssetCategory = (id: string, category: string) => {
    onAssetsChange(assets.map(a => a.id === id ? { ...a, category } : a));
    setActiveCategoryPicker(null);
  };

  const removeAsset = (id: string) => {
    onAssetsChange(assets.filter(a => a.id !== id));
  };

  const optimizeAsset = async (asset: GameAsset) => {
    setOptimizingId(asset.id);
    setOptimizingProgress(0);
    const totalDuration = 3500;
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(Math.round((elapsed / totalDuration) * 100), 100);
      const stage = [...OPTIMIZATION_STAGES].reverse().find(s => progress >= s.threshold);
      setOptimizingProgress(progress);
      setOptimizingStatus(stage?.label || "Processing");
      if (progress >= 100) {
        clearInterval(interval);
        onAssetsChange(assets.map(a => a.id === asset.id ? { ...a, isOptimized: true } : a));
        setOptimizingId(null);
      }
    }, 50);
  };

  const AssetSection = ({ type, icon: Icon, label, accept = ".glb,.gltf,.fbx" }: { type: AssetType, icon: any, label: string, accept?: string }) => {
    const currentAssets = assets.filter(a => a.type === type);
    const limit = LIMITS[type];
    const isFull = limit !== null && currentAssets.length >= limit;

    return (
      <div className="flex flex-col gap-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-100 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white border border-slate-200 shadow-sm shrink-0">
              <Icon className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] md:text-[11px] font-black uppercase tracking-widest text-slate-900 truncate">{label}</span>
              <span className="text-[8px] md:text-[9px] text-slate-400 font-bold uppercase tracking-tight">{limit ? `${currentAssets.length}/${limit}` : 'Flex'}</span>
            </div>
          </div>
          <label className={`cursor-pointer px-4 md:px-5 py-2.5 md:py-3 rounded-xl border text-[10px] md:text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-sm ${
            isFull ? 'bg-white border-slate-100 text-slate-200 cursor-not-allowed' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-600 hover:text-indigo-600 active:scale-95'
          }`}>
            <Plus className="w-4 h-4" />
            Add
            {!isFull && <input type="file" multiple className="hidden" onChange={(e) => handleFileUpload(e, type)} accept={accept} />}
          </label>
        </div>
        
        <div className="space-y-2.5">
          {currentAssets.map(asset => (
            <div key={asset.id} className="bg-white px-3 py-3 rounded-xl border border-slate-100 hover:border-indigo-100 transition-all shadow-sm group">
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="truncate text-[10px] text-slate-900 font-bold tracking-tight">{asset.name}</span>
                  <div className="relative">
                    <button 
                      onClick={() => setActiveCategoryPicker(activeCategoryPicker === asset.id ? null : asset.id)} 
                      className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-colors"
                    >
                      <Tag className="w-2.5 h-2.5" />
                      <span className="truncate max-w-[100px]">{asset.category || 'Default'}</span>
                      <ChevronDown className={`w-2.5 h-2.5 transition-transform duration-200 ${activeCategoryPicker === asset.id ? 'rotate-180' : ''}`} />
                    </button>
                    {activeCategoryPicker === asset.id && (
                      <div className="absolute top-full left-0 z-[120] mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden py-1.5 w-40 animate-in fade-in slide-in-from-top-1">
                        {CATEGORIES.map(cat => (
                          <button 
                            key={cat} 
                            onClick={() => updateAssetCategory(asset.id, cat)} 
                            className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest text-left w-full transition-colors ${asset.category === cat ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-50'}`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button 
                    onClick={() => onPreviewAsset(asset)} 
                    className="p-3 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all active:scale-90"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  {asset.isOptimized ? (
                    <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-100">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    </div>
                  ) : (
                    (type.includes('character') || type === 'environment') && (
                      <button 
                        onClick={() => optimizeAsset(asset)} 
                        disabled={optimizingId !== null} 
                        className={`p-3 rounded-lg border transition-colors active:scale-90 ${optimizingId === asset.id ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-slate-50 border-slate-100 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                      >
                        {optimizingId === asset.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                      </button>
                    )
                  )}
                  <button 
                    onClick={() => removeAsset(asset.id)} 
                    className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all active:scale-90"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              {optimizingId === asset.id && (
                <div className="mt-3 pt-3 border-t border-slate-50 space-y-2 animate-in fade-in slide-in-from-top-1">
                  <div className="flex justify-between text-[8px] font-black uppercase tracking-[0.2em] text-indigo-600">
                    <span>{optimizingStatus}</span>
                    <span>{optimizingProgress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                    <div className="h-full bg-indigo-600 transition-all duration-300 rounded-full shadow-[0_0_8px_rgba(79,70,229,0.5)]" style={{ width: `${optimizingProgress}%` }} />
                  </div>
                </div>
              )}
            </div>
          ))}
          {currentAssets.length === 0 && (
            <div className="flex items-center justify-center py-4 border-2 border-dashed border-slate-100 rounded-xl">
              <span className="text-[9px] text-slate-300 font-black uppercase tracking-[0.2em] italic">Stream Empty</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex items-center gap-3 mb-4 px-1">
        <Users className="w-4 h-4 text-slate-400" />
        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Actor Profiles</h3>
      </div>
      
      <AssetSection type="character1" icon={Box} label="Entity A: Mesh" />
      <AssetSection type="motion1" icon={Activity} label="Entity A: Motion" />
      
      <div className="h-px bg-slate-100 my-8" />
      
      <AssetSection type="character2" icon={Box} label="Entity B: Mesh" />
      <AssetSection type="motion2" icon={Activity} label="Entity B: Motion" />

      <div className="h-px bg-slate-100 my-8" />

      <div className="flex items-center gap-3 mb-4 px-1">
        <Globe className="w-4 h-4 text-slate-400" />
        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Environment</h3>
      </div>
      <AssetSection type="environment" icon={Globe} label="Spatial Substrate" accept=".glb,.gltf,.fbx" />
      <AssetSection type="music" icon={Music} label="Acoustic Data" accept="audio/*" />

      <div className="h-px bg-slate-100 my-8" />

      <div className="flex items-center gap-3 mb-4 px-1">
        <MessageSquare className="w-4 h-4 text-indigo-400" />
        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">Logic Cells</h3>
      </div>
      
      <div className="relative group mb-4">
        <input 
          type="text" 
          value={dialogueInput} 
          onChange={(e) => setDialogueInput(e.target.value)} 
          placeholder="New behavioral node..." 
          className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-xs font-bold focus:outline-none focus:border-indigo-600 text-slate-900 placeholder:text-slate-300 shadow-sm transition-all pr-12"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && dialogueInput.trim()) {
              onAssetsChange([...assets, { id: Math.random().toString(36).substr(2, 9), name: `Node_${assets.filter(a => a.type === 'dialogue').length + 1}`, type: 'dialogue', content: dialogueInput, mimeType: 'text/plain', category: 'Logic' }]);
              setDialogueInput('');
            }
          }}
        />
        <button 
          onClick={() => {
            if (dialogueInput.trim()) {
              onAssetsChange([...assets, { id: Math.random().toString(36).substr(2, 9), name: `Node_${assets.filter(a => a.type === 'dialogue').length + 1}`, type: 'dialogue', content: dialogueInput, mimeType: 'text/plain', category: 'Logic' }]);
              setDialogueInput('');
            }
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
      
      <div className="space-y-2.5">
        {assets.filter(a => a.type === 'dialogue').map(asset => (
          <div key={asset.id} className="flex items-center justify-between bg-white px-4 py-4 rounded-2xl border border-slate-100 text-[11px] font-bold text-slate-600 shadow-sm transition-all hover:border-indigo-100 animate-in fade-in slide-in-from-bottom-2">
            <span className="truncate pr-4 italic">"{asset.content}"</span>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => onPreviewAsset(asset)} 
                className="p-1.5 text-slate-200 hover:text-indigo-600 transition-colors shrink-0"
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => removeAsset(asset.id)} className="p-1.5 text-slate-200 hover:text-red-500 transition-colors shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
