
import React, { useMemo, useRef, useState, useEffect } from 'react';
import { GameAsset } from '../types';
import { Power, Loader2, Save, Bug, BugOff, AlertTriangle, RefreshCcw, Home, Smartphone, Monitor, Maximize2 } from 'lucide-react';

interface GameRunnerProps {
  code: string;
  title: string;
  assets: GameAsset[];
  previewDevice?: 'desktop' | 'mobile';
  onExit: () => void;
}

export const GameRunner: React.FC<GameRunnerProps> = ({ code, title, assets, previewDevice: initialPreviewDevice = 'desktop', onExit }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isMounting, setIsMounting] = useState(true);
  const [showSaveIndicator, setShowSaveIndicator] = useState(false);
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [runtimeError, setRuntimeError] = useState<{ message: string; type: string } | null>(null);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>(initialPreviewDevice);

  const persistenceKey = useMemo(() => `forge_studio_state_${btoa(title).substring(0, 16)}`, [title]);

  useEffect(() => {
    const timer = setTimeout(() => setIsMounting(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  const toggleDebug = () => {
    const newState = !debugEnabled;
    setDebugEnabled(newState);
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: 'FORGE_TOGGLE_DEBUG', payload: newState }, '*');
    }
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data) {
        if (event.data.type === 'FORGE_SAVE_STATE') {
          localStorage.setItem(persistenceKey, JSON.stringify(event.data.payload));
          setShowSaveIndicator(true);
          setTimeout(() => setShowSaveIndicator(false), 1500);
        }
        if (event.data.type === 'FORGE_RUNTIME_READY') {
          if (iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage({ type: 'FORGE_TOGGLE_DEBUG', payload: debugEnabled }, '*');
          }
        }
        if (event.data.type === 'FORGE_RUNTIME_ERROR') {
          setRuntimeError(event.data.payload);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: 'FORGE_SET_DEVICE', payload: previewDevice }, '*');
    }

    return () => window.removeEventListener('message', handleMessage);
  }, [persistenceKey, debugEnabled, previewDevice]);

  const combinedSrcDoc = useMemo(() => {
    const assetMap = assets.reduce((acc, asset) => { acc[asset.name] = asset.content; return acc; }, {} as Record<string, string>);
    const assetMapJson = JSON.stringify(assetMap).replace(/</g, '\\u003c');
    const savedStateStr = localStorage.getItem(persistenceKey);
    const savedState = savedStateStr ? JSON.parse(savedStateStr) : null;

    const bootstrapScript = `
      <script id="forge-asset-map" type="application/json">${assetMapJson}</script>
      <script>
        (function() {
          window.onerror = (message) => { 
            window.parent.postMessage({ type: 'FORGE_RUNTIME_ERROR', payload: { message: message, type: 'Kernel Collision' } }, '*'); 
            return true; 
          };
          
          const rawAssets = JSON.parse(document.getElementById('forge-asset-map').textContent);
          const assetCache = new Map();
          let lastTime = performance.now();
          
          window.getDeltaTime = () => {
            const now = performance.now();
            let dt = (now - lastTime) / 1000;
            lastTime = now;
            return Math.min(dt, 0.1);
          };
          
          window.PHYSICS_MATERIALS = { 
            'Level Geometry': { friction: 0.9, restitution: 0.1 }, 
            'Prop': { friction: 0.5, restitution: 0.6 }, 
            'Hero': { friction: 0.8, restitution: 0.0 } 
          };
          
          window.PERSISTED_STATE = ${JSON.stringify(savedState)};
          window.FORGE_DEVICE = "${previewDevice}";
          window.FORGE_ORIENTATION = "landscape";
          
          // Responsive Viewport System
          window.updateViewport = () => {
            const isMobile = window.FORGE_DEVICE === 'mobile';
            window.FORGE_ASPECT = isMobile ? 812 / 375 : window.innerWidth / window.innerHeight;
            
            if (isMobile) {
              document.body.style.display = 'flex';
              document.body.style.flexDirection = 'column';
              document.body.style.alignItems = 'center';
              document.body.style.justifyContent = 'center';
            } else {
              document.body.style.display = 'block';
            }
            
            // Dispatch event for game code to react
            window.dispatchEvent(new CustomEvent('forge-viewport-update', { 
              detail: { 
                device: window.FORGE_DEVICE, 
                orientation: window.FORGE_ORIENTATION,
                aspect: window.FORGE_ASPECT
              } 
            }));
          };

          window.updateViewport(); // Initial call
          window.DEBUG_PHYSICS = false;
          
          window.saveState = (data) => window.parent.postMessage({ type: 'FORGE_SAVE_STATE', payload: data }, '*');
          
          window.joystick = null;
          window.joystickState = { x: 0, y: 0, active: false };
          window.gestureState = { swipe: null, tap: false, lastSwipeTime: 0 };
          window.actionButton = null;
          window.actionState = { primary: false };

          // Unified Input Mapping
          window.getMovement = () => {
            if (window.FORGE_DEVICE === 'mobile') return window.joystickState;
            return window.joystickState; 
          };

          window.createJoystick = () => {
            const container = document.createElement('div');
            const base = document.createElement('div');
            const stick = document.createElement('div');
            const size = 120;
            const stickSize = 50;

            Object.assign(container.style, {
              position: 'fixed', bottom: '12%', left: '12%',
              width: size + 'px', height: size + 'px', zIndex: '10000',
              userSelect: 'none', touchAction: 'none'
            });

            Object.assign(base.style, {
              width: '100%', height: '100%', borderRadius: '50%',
              background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)',
              border: '2px solid rgba(255,255,255,0.2)', position: 'relative'
            });

            Object.assign(stick.style, {
              width: stickSize + 'px', height: stickSize + 'px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.4)', position: 'absolute',
              top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              transition: 'transform 0.1s ease-out', boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
            });

            base.appendChild(stick);
            container.appendChild(base);

            const handleMove = (e) => {
              const touch = e.touches ? e.touches[0] : e;
              const rect = base.getBoundingClientRect();
              const centerX = rect.left + size / 2;
              const centerY = rect.top + size / 2;
              let dx = touch.clientX - centerX;
              let dy = touch.clientY - centerY;
              const dist = Math.sqrt(dx*dx + dy*dy);
              const maxDist = size / 2;

              if (dist > maxDist) {
                dx *= maxDist / dist;
                dy *= maxDist / dist;
              }

              stick.style.transform = 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px))';
              window.joystickState.x = dx / maxDist;
              window.joystickState.y = dy / maxDist;
              window.joystickState.active = true;
            };

            const handleEnd = () => {
              stick.style.transform = 'translate(-50%, -50%)';
              window.joystickState.x = 0;
              window.joystickState.y = 0;
              window.joystickState.active = false;
            };

            container.addEventListener('touchstart', (e) => { e.preventDefault(); handleMove(e); });
            container.addEventListener('touchmove', (e) => { e.preventDefault(); handleMove(e); });
            container.addEventListener('touchend', handleEnd);
            container.addEventListener('mousedown', (e) => {
              const move = (me) => handleMove(me);
              const up = () => {
                handleEnd();
                window.removeEventListener('mousemove', move);
                window.removeEventListener('mouseup', up);
              };
              window.addEventListener('mousemove', move);
              window.addEventListener('mouseup', up);
              handleMove(e);
            });

            document.body.appendChild(container);
            return { destroy: () => container.remove() };
          };

          // Gesture Detection
          let touchStartX = 0;
          let touchStartY = 0;
          let touchStartTime = 0;

          window.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            touchStartTime = Date.now();
          }, { passive: true });

          window.addEventListener('touchend', (e) => {
            const dx = e.changedTouches[0].clientX - touchStartX;
            const dy = e.changedTouches[0].clientY - touchStartY;
            const dt = Date.now() - touchStartTime;
            const dist = Math.sqrt(dx*dx + dy*dy);

            if (dist < 10 && dt < 200) {
              window.gestureState.tap = true;
              setTimeout(() => window.gestureState.tap = false, 50);
            } else if (dist > 50 && dt < 300) {
              const angle = Math.atan2(dy, dx);
              let direction = 'right';
              if (angle > Math.PI/4 && angle <= 3*Math.PI/4) direction = 'down';
              else if (angle > -3*Math.PI/4 && angle <= -Math.PI/4) direction = 'up';
              else if (angle > 3*Math.PI/4 || angle <= -3*Math.PI/4) direction = 'left';
              
              window.gestureState.swipe = direction;
              window.gestureState.lastSwipeTime = Date.now();
              setTimeout(() => window.gestureState.swipe = null, 100);
            }
          }, { passive: true });

          window.addEventListener('message', (e) => { 
            if (e.data.type === 'FORGE_TOGGLE_DEBUG') window.DEBUG_PHYSICS = e.data.payload; 
            if (e.data.type === 'FORGE_SET_DEVICE') {
              window.FORGE_DEVICE = e.data.payload;
              window.updateViewport();
              if (e.data.payload === 'mobile') {
                if (!window.actionButton) window.actionButton = window.createActionButton();
                if (!window.joystick) window.joystick = window.createJoystick();
              } else {
                if (window.actionButton) {
                  window.actionButton.destroy();
                  window.actionButton = null;
                }
                if (window.joystick) {
                  window.joystick.destroy();
                  window.joystick = null;
                }
              }
            }
          });
          
          window.parent.postMessage({ type: 'FORGE_RUNTIME_READY' }, '*');
          
          // Auto-detect touch device on load
          if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
            setTimeout(() => {
              if (!window.actionButton) window.actionButton = window.createActionButton();
              if (!window.joystick) window.joystick = window.createJoystick();
            }, 500);
          }

          window.createActionButton = () => {
            const btn = document.createElement('div');
            const size = 64;
            Object.assign(btn.style, {
              position: 'fixed', bottom: '12%', right: '12%',
              width: size + 'px', height: size + 'px', zIndex: '10000',
              borderRadius: '50%', background: 'rgba(255,255,255,0.2)',
              backdropFilter: 'blur(12px)', border: '2px solid rgba(255,255,255,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: 'bold', fontSize: '12px',
              userSelect: 'none', touchAction: 'none',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
            });
            btn.innerText = 'ACTION';
            
            const handleStart = (e) => {
              e.preventDefault();
              window.actionState.primary = true;
              btn.style.transform = 'scale(0.9)';
              btn.style.background = 'rgba(255,255,255,0.4)';
            };
            const handleEnd = () => {
              window.actionState.primary = false;
              btn.style.transform = 'scale(1)';
              btn.style.background = 'rgba(255,255,255,0.2)';
            };
            
            btn.addEventListener('touchstart', handleStart);
            btn.addEventListener('mousedown', handleStart);
            btn.addEventListener('touchend', handleEnd);
            btn.addEventListener('mouseup', handleEnd);
            
            document.body.appendChild(btn);
            return { destroy: () => btn.remove() };
          };

          if (!window.getAssetUrl) {
            Object.defineProperty(window, 'getAssetUrl', {
              value: (name) => {
                if (assetCache.has(name)) return assetCache.get(name);
                const data = rawAssets[name];
                if (!data) {
                  console.warn('ForgeAI: Asset "' + name + '" not found in map.');
                  return "data:text/plain;base64,YXNzZXRfbm90X2ZvdW5k";
                }
                if (data.startsWith('blob:') || data.startsWith('http')) return data;
                
                try {
                  const parts = data.split(',');
                  if (parts.length < 2) return data;
                  
                  const mimeMatch = parts[0].match(/:(.*?);/);
                  const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
                  const bstr = atob(parts[1]);
                  const u8arr = new Uint8Array(bstr.length);
                  for (let i = 0; i < bstr.length; i++) {
                    u8arr[i] = bstr.charCodeAt(i);
                  }
                  const blob = new Blob([u8arr], { type: mime });
                  const url = URL.createObjectURL(blob);
                  assetCache.set(name, url);
                  return url;
                } catch (e) { 
                  console.error('getAssetUrl error for ' + name + ':', e);
                  return data; 
                }
              },
              writable: false,
              configurable: false
            });
          }

          window.addEventListener('pagehide', () => {
            assetCache.forEach(url => URL.revokeObjectURL(url));
            assetCache.clear();
          });
        })();
      </script>
      <style>
        body { margin: 0; background: #000; overflow: hidden; width: 100vw; height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; touch-action: none; -webkit-overflow-scrolling: none; }
        canvas { display: block; width: 100% !important; height: 100% !important; }
        #orientation-hint { display: none; position: fixed; inset: 0; background: #0F172A; color: #fff; z-index: 9999; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 2rem; font-family: sans-serif; }
        @media screen and (orientation: portrait) and (max-width: 768px) {
           #orientation-hint { display: flex; }
        }
      </style>
      <div id="orientation-hint">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
        <p style="margin-top: 2rem; font-weight: 900; text-transform: uppercase; letter-spacing: 0.3em; font-size: 12px; color: #94A3B8;">Landscape Required</p>
      </div>
    `;
    // Inject bootstrapScript and auto-wrap game inline scripts for DOM safety
    const processedCode = (() => {
      // 1) Wrap all inline <script> blocks (excluding src= external scripts) in DOMContentLoaded
      const wrapped = code.replace(
        /<script(?![^>]*\bsrc\s*=)([^>]*)>([\s\S]*?)<\/script>/gi,
        (match, attrs, body) => {
          if (!body.trim()) return match;
          return `<script${attrs}>
(function() {
  function __forgeInit() {
    try {
${body}
    } catch(e) {
      window.parent && window.parent.postMessage({ type: 'FORGE_RUNTIME_ERROR', payload: { message: e.message, type: 'Kernel Collision' } }, '*');
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', __forgeInit);
  } else {
    __forgeInit();
  }
})();
</script>`;
        }
      );
      return wrapped.includes('<head>') ? wrapped.replace('<head>', `<head>${bootstrapScript}`) : bootstrapScript + wrapped;
    })();
    return processedCode;
  }, [code, assets, persistenceKey]);

  return (
    <div className="fixed inset-0 w-full h-full bg-[#020617] flex flex-col z-[1000] overflow-hidden select-none">
      
      {/* Loading Overlay */}
      {isMounting && !runtimeError && (
        <div className="absolute inset-0 z-[1100] bg-[#020617] flex flex-col items-center justify-center p-8 transition-opacity duration-1000">
          <div className="relative mb-12">
            <div className="w-16 h-16 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin" />
            <div className="absolute inset-0 bg-indigo-600/20 blur-3xl rounded-full animate-pulse" />
          </div>
          <div className="text-center space-y-4">
             <h2 className="text-white font-black uppercase tracking-[0.6em] text-[10px] md:text-xs">Initialising Substrate</h2>
             <p className="text-white/30 text-[9px] font-bold uppercase tracking-widest truncate max-w-[200px] mx-auto">{title}</p>
          </div>
        </div>
      )}

      {/* Runtime Error Display */}
      {runtimeError && (
        <div className="absolute inset-0 z-[1200] bg-[#020617] flex flex-col items-center justify-center p-6 md:p-12 text-center">
          <div className="w-20 h-20 bg-red-500/10 border border-red-500/20 rounded-[2.5rem] flex items-center justify-center mb-8 shadow-[0_0_60px_rgba(239,68,68,0.1)]">
            <AlertTriangle className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-white font-black uppercase tracking-[0.4em] text-sm md:text-base mb-6">Simulation Collapse</h2>
          <div className="w-full max-w-lg bg-black/40 border border-white/5 rounded-3xl p-6 font-mono text-[10px] text-zinc-400 text-left mb-10 overflow-auto">
            <div className="text-red-500/80 font-black mb-3 text-[9px] uppercase tracking-widest">CRITICAL_EXCEPTION // {runtimeError.type}</div>
            <p className="leading-relaxed opacity-60 break-words">{runtimeError.message}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm sm:max-w-none justify-center px-4">
            <button 
              onClick={() => window.location.reload()} 
              className="px-8 py-4 bg-white/5 border border-white/10 text-white rounded-2xl hover:bg-white/10 transition-all font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 active:scale-95"
            >
              <RefreshCcw className="w-4 h-4" /> Reset Runtime
            </button>
            <button 
              onClick={onExit} 
              className="px-10 py-4 bg-red-600 text-white rounded-2xl hover:bg-red-500 transition-all font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 shadow-2xl shadow-red-600/20 active:scale-95"
            >
              <Home className="w-4 h-4" /> Terminal Exit
            </button>
          </div>
        </div>
      )}

      {/* Control Overlays */}
      {!runtimeError && (
        <>
          <div className="absolute top-4 md:top-8 left-4 md:left-8 right-4 md:right-8 z-[1050] flex justify-between items-center pointer-events-none">
            <div className="flex items-center gap-3 bg-black/60 backdrop-blur-xl border border-white/10 px-4 py-2.5 rounded-2xl shadow-2xl">
               <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)] animate-pulse" />
               <span className="text-[9px] font-black text-white/80 uppercase tracking-widest truncate max-w-[120px] md:max-w-none">{title}</span>
               <div className="h-3 w-px bg-white/10 mx-1 hidden md:block" />
               <div className="hidden md:flex items-center gap-2 pointer-events-auto">
                 <button 
                   onClick={() => setPreviewDevice('desktop')}
                   className={`p-1.5 rounded-lg transition-all ${previewDevice === 'desktop' ? 'bg-indigo-600 text-white' : 'text-white/40 hover:text-white/60'}`}
                 >
                   <Monitor className="w-3.5 h-3.5" />
                 </button>
                 <button 
                   onClick={() => setPreviewDevice('mobile')}
                   className={`p-1.5 rounded-lg transition-all ${previewDevice === 'mobile' ? 'bg-indigo-600 text-white' : 'text-white/40 hover:text-white/60'}`}
                 >
                   <Smartphone className="w-3.5 h-3.5" />
                 </button>
                 <span className="text-[8px] font-black text-white/30 uppercase tracking-tighter">Substrate Mode</span>
               </div>
            </div>
            <button 
              onClick={onExit} 
              className="pointer-events-auto flex items-center gap-2.5 bg-white text-[#020617] px-5 py-3 rounded-2xl hover:bg-slate-100 transition-all active:scale-95 font-black text-[10px] uppercase tracking-widest shadow-2xl"
            >
              <Power className="w-4 h-4 text-indigo-600" />
              <span className="hidden sm:inline">Terminate</span>
              <span className="sm:hidden">Exit</span>
            </button>
          </div>

          <div className="absolute bottom-6 md:bottom-8 left-1/2 -translate-x-1/2 z-[1050] flex flex-col md:flex-row items-center gap-4 pointer-events-none w-full px-8">
            <div className={`bg-black/60 backdrop-blur-xl border border-white/10 px-6 py-3 rounded-full transition-all duration-700 mx-auto ${showSaveIndicator ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-8 scale-90'}`}>
              <div className="flex items-center gap-3">
                <Save className="w-4 h-4 text-indigo-400" />
                <span className="text-[10px] font-black uppercase tracking-widest text-white">State Persisted</span>
              </div>
            </div>
            
            <button 
              onClick={toggleDebug} 
              className={`pointer-events-auto px-6 py-3.5 rounded-full border transition-all flex items-center gap-3 shadow-2xl group active:scale-95 ${debugEnabled ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-black/60 border-white/10 text-white/40 hover:border-white/20'}`}
            >
               <Bug className={`w-4 h-4 ${debugEnabled ? 'animate-bounce' : ''}`} />
               <span className="text-[10px] font-black uppercase tracking-widest">Debug Mode</span>
            </button>
          </div>
        </>
      )}

      {/* Frame Container */}
      <div className="flex-1 w-full h-full relative flex items-center justify-center p-8">
        <div className={`relative transition-all duration-500 ease-in-out ${previewDevice === 'mobile' ? 'w-[812px] h-[375px] rounded-[3rem] border-[12px] border-slate-800 shadow-2xl overflow-hidden' : 'w-full h-full'}`}>
          <iframe 
            ref={iframeRef} 
            srcDoc={combinedSrcDoc} 
            title="Game Substrate" 
            className={`w-full h-full border-none transition-opacity duration-1000 ${isMounting || runtimeError ? 'opacity-0' : 'opacity-100'}`} 
            sandbox="allow-scripts allow-modals allow-pointer-lock" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          />
        </div>
      </div>
    </div>
  );
};
