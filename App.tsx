
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { AssetUploader } from './components/AssetUploader';
import { GameRunner } from './components/GameRunner';
import { AssetPreview } from './components/AssetPreview';
import { AIChat } from './components/AIChat';
import { generateGameWithRouter, brainstormWithRouter, generateLogicNodesWithRouter } from './services/aiRouter';
import {
  GameAsset,
  GenerationStatus,
  GeneratedGame,
  ChatMessage,
  AIModelMode,
  AIModelConfig,
  ProjectState,
  ProjectMetadata,
  ProjectTemplate,
} from './types';
import {
  Box,
  Monitor,
  Sparkles,
  BoxSelect,
  Menu,
  X,
  MessageSquareCode,
  BrainCircuit,
  RefreshCw,
  Cpu,
  Zap,
  Maximize2,
  Smartphone,
  Bolt,
  Download,
  ShieldCheck,
  Undo2,
  Redo2,
  // CloudLightning has been removed
} from 'lucide-react';

import { useUndoRedo } from './hooks/useUndoRedo';
// useAutoSave has been removed
import { /* loadAutosavedProject, clearAutosavedProject, */ compress } from './services/storage';
import {
  getAllProjectMetadata,
  saveProject as pmSaveProject,
  loadProject as pmLoadProject, // Import loadProject to get full project data for export/copy
  loadProjectFromShareLink,
  generateShareLink,
  copyProjectToClipboard,
  deleteProject as pmDeleteProject,
  exportProject as pmExportProject,
  importProject as pmImportProject,
  createNewProject as pmCreateNewProject, // Also need this for the initial blank project
} from './services/projectManager';
import { ProjectManagerModal } from './components/ProjectManagerModal';
import { AIConfigModal } from './components/AIConfigModal';
import { AIModelSelector, ALL_MODELS, DEFAULT_MODEL } from './components/AIModelSelector';

type ViewMode = 'editor' | 'preview';
// Define mobile view types
type MobileView = 'staging' | 'chat';
type PreviewDevice = 'desktop' | 'mobile';

// Initial project state when no project is loaded
const DEFAULT_INITIAL_PROJECT_STATE: ProjectState = {
  assets: [],
  game: null,
  chatHistory: [],
  aiMode: 'thinking',
};

// Load persisted model from localStorage or use default
const loadPersistedModel = (): AIModelConfig => {
  try {
    const saved = localStorage.getItem('selected_ai_model_id');
    if (saved) {
      const found = ALL_MODELS.find(m => m.id === saved);
      if (found) return found;
    }
  } catch { /* ignore */ }
  return DEFAULT_MODEL;
};

const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('editor');
  const [status, setStatus] = useState<GenerationStatus>({ step: 'idle', message: '' });
  const [isLiveSyncing, setIsLiveSyncing] = useState(false);

  // State for responsive layout
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(false);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);
  const [activeMobileView, setActiveMobileView] = useState<MobileView>('staging');
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>('desktop');

  // Draggable Sidebar Widths
  const [leftWidth, setLeftWidth] = useState(320);
  const [rightWidth, setRightWidth] = useState(420);
  const isDraggingLeft = useRef(false);
  const isDraggingRight = useRef(false);

  const handleMouseDownLeft = (e: React.MouseEvent) => {
    isDraggingLeft.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
  };

  const handleMouseDownRight = (e: React.MouseEvent) => {
    isDraggingRight.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDraggingLeft.current) {
      const newWidth = Math.max(240, Math.min(600, e.clientX));
      setLeftWidth(newWidth);
    }
    if (isDraggingRight.current) {
      const newWidth = Math.max(300, Math.min(800, window.innerWidth - e.clientX));
      setRightWidth(newWidth);
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    isDraggingLeft.current = false;
    isDraggingRight.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'default';
  }, [handleMouseMove]);

  // Workstation state
  const [activeWorkstationAsset, setActiveWorkstationAsset] = useState<GameAsset | null>(null);

  // Project Management States
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeProjectName, setActiveProjectName] = useState('New Project');
  const [isDirty, setIsDirty] = useState(false); // Tracks unsaved changes to the current project
  // lastManualSaveTimestamp has been removed
  const [showProjectManager, setShowProjectManager] = useState(false);
  const [showGeminiConfig, setShowGeminiConfig] = useState(false);
  const [selectedModel, setSelectedModel] = useState<AIModelConfig>(loadPersistedModel);
  const [projectModalView, setProjectModalView] = useState<'list' | 'new' | 'saveAs' | 'versions' | 'import'>('list');
  // showAutosaveRecoveryPrompt has been removed

  // Undo/Redo State (manages the core project data)
  const [
    projectState,
    setProjectState,
    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory,
    initializeUndoRedoState,
  ] = useUndoRedo<ProjectState>(DEFAULT_INITIAL_PROJECT_STATE);

  const { assets, game, chatHistory, aiMode } = projectState;

  // useAutoSave hook has been removed.

  // Update dirty state when projectState changes (except on initial load/set)
  const isInitialProjectStateLoad = useRef(true);
  useEffect(() => {
    if (isInitialProjectStateLoad.current) {
      isInitialProjectStateLoad.current = false;
      return;
    }
    // Only set dirty if the project has been actively edited, not just loaded/initialized.
    // This is a simple heuristic; a more robust solution would track specific actions.
    setIsDirty(true); 
  }, [projectState]);

  // Handle initial load (share link or new project)
  useEffect(() => {
    const handleInitialLoad = () => {
      const shareLinkState = loadProjectFromShareLink();
      if (shareLinkState) {
        initializeUndoRedoState(shareLinkState);
        setActiveProjectId(null); // Share link is always an unsaved new project
        setActiveProjectName('Shared Project');
        setIsDirty(true);
        // clearAutosavedProject(); // clearAutosavedProject has been removed
        return;
      }

      // No autosave check anymore, always create a new project if no share link
      handleCreateNewProject(); 
    };
    handleInitialLoad();
  }, []); // Run only once on mount

  // handleRecoverAutosave and handleDiscardAutosave have been removed

  // Update specific parts of ProjectState
  const setAssets = useCallback(
    (newAssets: GameAsset[]) => setProjectState((prev) => ({ ...prev, assets: newAssets })),
    [setProjectState]
  );
  const setGame = useCallback(
    (newGame: GeneratedGame | null) => setProjectState((prev) => ({ ...prev, game: newGame })),
    [setProjectState]
  );
  const setChatHistory = useCallback(
    (newHistory: ChatMessage[]) => setProjectState((prev) => ({ ...prev, chatHistory: newHistory })),
    [setProjectState]
  );
  const setAiMode = useCallback(
    (newMode: AIModelMode) => setProjectState((prev) => ({ ...prev, aiMode: newMode })),
    [setProjectState]
  );

  const handleModelChange = useCallback((model: AIModelConfig) => {
    setSelectedModel(model);
    try { localStorage.setItem('selected_ai_model_id', model.id); } catch { /* ignore */ }
  }, []);

  const processGeneration = useCallback(
    async (instruction: string, isAutoSync: boolean = false, attachments?: any[]) => {
      const userMsg: ChatMessage = { 
        role: 'user', 
        text: instruction,
        attachments: attachments?.map(a => ({ id: a.id, preview: a.preview, type: a.type }))
      };

      const newUserHistory = isAutoSync ? chatHistory : [...chatHistory, userMsg];

      if (!isAutoSync) {
        setStatus({ step: 'analyzing', message: 'Architecting...' });
        setChatHistory(newUserHistory);
      } else {
        setIsLiveSyncing(true);
      }

      try {
        const result = await generateGameWithRouter(instruction, assets, newUserHistory, game?.code || '', aiMode, selectedModel, attachments);
        if (!result.isChatOnly) {
          setGame({ code: result.code, title: result.title });
        }
        if (!isAutoSync) {
          setChatHistory([
            ...newUserHistory,
            {
              role: 'ai',
              text: result.explanation,
              suggestions: result.suggestions,
              proposedLogicNodes: result.proposedLogicNodes,
            },
          ]);
        }
        setStatus({ step: 'ready', message: 'Ready.' });
        setIsLiveSyncing(false);
      } catch (error: any) {
        console.error(error);
        // Display the specific error message to the user
        setStatus({ step: 'error', message: error.message || 'An unknown error occurred during generation.' });
        setIsLiveSyncing(false);
      }
    },
    [assets, chatHistory, game, aiMode, selectedModel, setChatHistory, setGame]
  );

  const handleInspiration = async () => {
    if (status.step !== 'idle' && status.step !== 'ready') return;
    setStatus({ step: 'analyzing', message: 'Brainstorming...' });
    try {
      const report = await brainstormWithRouter(assets, selectedModel);
      setChatHistory([...chatHistory, { role: 'ai', text: report }]);
      setStatus({ step: 'ready', message: 'Report Ready' });
    } catch (e: any) {
      setStatus({ step: 'error', message: e.message || 'An unknown error occurred during brainstorming.' });
    }
  };

  const handleLogicWeave = async () => {
    if (status.step !== 'idle' && status.step !== 'ready') return;
    setStatus({ step: 'analyzing', message: 'Weaving Logic...' });
    try {
      const lastPrompt = chatHistory.filter((m) => m.role === 'user').pop()?.text || 'General Gameplay Logic';
      const nodes = await generateLogicNodesWithRouter(lastPrompt, assets, selectedModel);
      setChatHistory([
        ...chatHistory,
        {
          role: 'ai',
          text: 'I have synthesized a set of complex behavioral blueprints for your simulation. Review and integrate them below.',
          proposedLogicNodes: nodes,
        },
      ]);
      setStatus({ step: 'ready', message: 'Logic Synthesized' });
    } catch (e: any) {
      setStatus({ step: 'error', message: e.message || 'An unknown error occurred during logic weaving.' });
    }
  };

  const addAssetFromAI = (content: string) => {
    const newAsset: GameAsset = {
      id: Math.random().toString(36).substr(2, 9),
      name: `Logic_${assets.filter((a) => a.type === 'dialogue').length + 1}`,
      type: 'dialogue',
      content: content,
      mimeType: 'text/plain',
      category: 'Logic',
    };
    setAssets([...assets, newAsset]);
  };

  const handleDownload = () => {
    if (!game) return;

    const assetMap = assets.reduce((acc, asset) => {
      acc[asset.name] = asset.content;
      return acc;
    }, {} as Record<string, string>);

    const assetMapJson = JSON.stringify(assetMap).replace(/</g, '\\u003c');

    const portableHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${game.title}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <script id="forge-asset-map" type="application/json">${assetMapJson}</script>
  <script>
    (function() {
      const assetMap = JSON.parse(document.getElementById('forge-asset-map').textContent);
      const assetCache = new Map();

      if (!window.getAssetUrl) {
        Object.defineProperty(window, 'getAssetUrl', {
          value: (name) => {
            if (assetCache.has(name)) return assetCache.get(name);
            const data = assetMap[name];
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
            } catch(e) { return data; }
          },
          writable: false,
          configurable: false
        });
      }
    })();
  </script>
  <style>
    body { margin: 0; background: #000; overflow: hidden; height: 100vh; width: 100vw; }
    canvas { display: block; width: 100% !important; height: 100% !important; }
  </style>
</head>
<body>
  ${game.code}
</body>
</html>
    `;

    const blob = new Blob([portableHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${game.title.replace(/\s+/g, '_').toLowerCase()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleKeySelectionManual = async () => {
    setShowGeminiConfig(true);
  };

  const previewIframeRef = useRef<HTMLIFrameElement>(null);

  const integratedSrcDoc = useMemo(() => {
    if (!game) return '';
    const assetMap = assets.reduce((acc, asset) => {
      acc[asset.name] = asset.content;
      return acc;
    }, {} as Record<string, string>);

    const assetMapJson = JSON.stringify(assetMap).replace(/</g, '\\u003c');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          <script id="forge-asset-map" type="application/json">${assetMapJson}</script>
          <script>
            (function() {
              // THREE.CapsuleGeometry polyfill for older three.js versions
              let _three = window.THREE;
              const applyPolyfill = (obj) => {
                if (obj && !Object.prototype.hasOwnProperty.call(obj, 'CapsuleGeometry')) {
                  Object.defineProperty(obj, 'CapsuleGeometry', {
                    get() {
                      if (!this._CapsuleGeometry) {
                        const CylinderGeom = this.CylinderGeometry;
                        if (CylinderGeom) {
                          this._CapsuleGeometry = class CapsuleGeometry extends CylinderGeom {
                            constructor(radius = 1, length = 1, capSegments = 4, radialSegments = 8) {
                              super(radius, radius, length, radialSegments);
                            }
                          };
                        }
                      }
                      return this._CapsuleGeometry;
                    },
                    configurable: true,
                    enumerable: true
                  });
                }
              };
              const applyRendererWrapper = (obj) => {
                if (obj && obj.WebGLRenderer && !obj.WebGLRenderer.prototype._renderWrapped) {
                  const originalRender = obj.WebGLRenderer.prototype.render;
                  obj.WebGLRenderer.prototype.render = function(scene, camera) {
                    try {
                      if (window.updatePhysicsDebug) {
                        window.updatePhysicsDebug(scene);
                      }
                    } catch (e) {
                      console.error("Physics debug visualization error:", e);
                    }
                    return originalRender.apply(this, arguments);
                  };
                  obj.WebGLRenderer.prototype._renderWrapped = true;
                }
              };
              if (_three) {
                applyPolyfill(_three);
                applyRendererWrapper(_three);
              }
              Object.defineProperty(window, 'THREE', {
                get() { return _three; },
                set(val) {
                  _three = val;
                  applyPolyfill(_three);
                  applyRendererWrapper(_three);
                },
                configurable: true
              });

              // Automatic Physics Debug Visualizer
              let debugHelpers = new Map();
              window.updatePhysicsDebug = (scene) => {
                if (!window.THREE || !scene) return;
                const THREE = window.THREE;

                if (!window.DEBUG_PHYSICS) {
                  // Clean up all helpers
                  debugHelpers.forEach((helper, obj) => {
                    if (helper.parent) helper.parent.remove(helper);
                    if (helper.geometry) helper.geometry.dispose();
                    if (helper.material) {
                      if (Array.isArray(helper.material)) {
                        helper.material.forEach(m => m.dispose());
                      } else {
                        helper.material.dispose();
                      }
                    }
                  });
                  debugHelpers.clear();
                  return;
                }

                // Traverse scene and create/update helpers
                scene.traverse((obj) => {
                  if (obj.isHelper || obj.isLight || obj.isCamera || obj.name?.toLowerCase().includes('sky') || obj.name?.toLowerCase().includes('dome')) {
                    return;
                  }

                  const isPhysical = obj.name?.toLowerCase().includes('player') || 
                                     obj.name?.toLowerCase().includes('enemy') || 
                                     obj.name?.toLowerCase().includes('npc') || 
                                     obj.name?.toLowerCase().includes('obstacle') || 
                                     obj.name?.toLowerCase().includes('collider') || 
                                     obj.name?.toLowerCase().includes('prop') || 
                                     obj.velocity || obj.physics || obj.collider || obj.isCollider;

                  if (obj.isMesh && isPhysical) {
                    let helper = debugHelpers.get(obj);
                    if (!helper) {
                      let color = 0x00ff00; // green for player
                      if (obj.name?.toLowerCase().includes('enemy')) color = 0xff0000; // red for enemy
                      else if (obj.name?.toLowerCase().includes('obstacle') || obj.name?.toLowerCase().includes('collider')) color = 0xffff00; // yellow for obstacle
                      else if (obj.name?.toLowerCase().includes('prop')) color = 0x00ffff; // cyan for props

                      helper = new THREE.BoxHelper(obj, color);
                      helper.isHelper = true;
                      scene.add(helper);
                      debugHelpers.set(obj, helper);
                    } else {
                      helper.update();
                    }
                  }
                });

                // Clean up dead objects' helpers
                debugHelpers.forEach((helper, obj) => {
                  let parent = obj.parent;
                  let inScene = false;
                  while (parent) {
                    if (parent === scene) {
                      inScene = true;
                      break;
                    }
                    parent = parent.parent;
                  }
                  if (!inScene) {
                    if (helper.parent) helper.parent.remove(helper);
                    if (helper.geometry) helper.geometry.dispose();
                    if (helper.material) helper.material.dispose();
                    debugHelpers.delete(obj);
                  }
                });
              };

              const assetMap = JSON.parse(document.getElementById('forge-asset-map').textContent);
              const assetCache = new Map();

              if (!window.getAssetUrl) {
                Object.defineProperty(window, 'getAssetUrl', {
                  value: (name) => {
                    if (assetCache.has(name)) return assetCache.get(name);
                    const data = assetMap[name];
                    if (!data) {
                      console.warn('ForgeAI: Asset "' + name + '" not found in map.');
                      return "data:text/plain;base64,YXNzZXRfbm90X2ZvdW5k"; // "asset_not_found"
                    }
                    
                    // If it's already a URL or Blob URL, return it
                    if (data.startsWith('blob:') || data.startsWith('http')) return data;
                    
                    try {
                      const parts = data.split(',');
                      if (parts.length < 2) return data; // Not a data URI, return as is
                      
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
                    } catch(e) { 
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

            window.FORGE_PROJECT_ID = "${activeProjectId || 'unsaved'}";
            window.FORGE_DEVICE = "${previewDevice}";
            window.FORGE_ORIENTATION = "landscape";
            
            // Responsive Viewport System
            window.updateViewport = () => {
              const isMobile = window.FORGE_DEVICE === 'mobile';
              window.FORGE_ASPECT = isMobile ? 812 / 375 : window.innerWidth / window.innerHeight;
              
              if (document.body) {
                if (isMobile) {
                  document.body.style.display = 'flex';
                  document.body.style.flexDirection = 'column';
                  document.body.style.alignItems = 'center';
                  document.body.style.justifyContent = 'center';
                } else {
                  document.body.style.display = 'block';
                }
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

            if (document.body) {
              window.updateViewport();
            } else {
              window.addEventListener('DOMContentLoaded', () => window.updateViewport());
            }
            window.DEBUG_PHYSICS = false;
            window.joystick = null;
            window.joystickState = { x: 0, y: 0, active: false };
            window.gestureState = { swipe: null, tap: false, lastSwipeTime: 0 };
            window.actionButton = null;
            window.actionState = { primary: false };
            
            // Unified Input Mapping
            window.getMovement = () => {
              if (window.FORGE_DEVICE === 'mobile') return window.joystickState;
              // Keyboard fallback logic would be handled in game code, 
              // but we provide the state here.
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
            let _forgeTouchStartX = 0;
            let _forgeTouchStartY = 0;
            let _forgeTouchStartTime = 0;

            window.addEventListener('touchstart', (e) => {
              _forgeTouchStartX = e.touches[0].clientX;
              _forgeTouchStartY = e.touches[0].clientY;
              _forgeTouchStartTime = Date.now();
            }, { passive: true });

            window.addEventListener('touchend', (e) => {
              const dx = e.changedTouches[0].clientX - _forgeTouchStartX;
              const dy = e.changedTouches[0].clientY - _forgeTouchStartY;
              const dt = Date.now() - _forgeTouchStartTime;
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
              if (e.data.type === 'FORGE_TOGGLE_DEBUG') {
                window.DEBUG_PHYSICS = e.data.payload;
              }
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
          </script>
          <style>
            body { margin: 0; background: #000; overflow: hidden; height: 100vh; width: 100vw; }
            canvas { display: block; width: 100% !important; height: 100% !important; }
          </style>
        </head>
        <body>${game.code}</body>
      </html>
    `;
  }, [game, assets, activeProjectId]);

  // Handle device switching in preview
  useEffect(() => {
    const syncDevice = () => {
      if (previewIframeRef.current?.contentWindow) {
        previewIframeRef.current.contentWindow.postMessage({ type: 'FORGE_SET_DEVICE', payload: previewDevice }, '*');
      }
    };

    const handleMessage = (e: MessageEvent) => {
      if (e.data.type === 'FORGE_RUNTIME_READY') {
        syncDevice();
      }
    };

    window.addEventListener('message', handleMessage);
    syncDevice();

    return () => window.removeEventListener('message', handleMessage);
  }, [previewDevice, integratedSrcDoc]);

  // --- Project Management Handlers ---
  const handleCreateNewProject = useCallback(
    (template?: ProjectTemplate) => {
      if (isDirty && !window.confirm('You have unsaved changes. Are you sure you want to create a new project?')) {
        return;
      }
      const newProject = pmCreateNewProject(template);
      initializeUndoRedoState(newProject.state);
      setActiveProjectId(newProject.metadata.id);
      setActiveProjectName(newProject.metadata.name);
      setIsDirty(false); // New project is not dirty yet
      // setLastManualSaveTimestamp(newProject.metadata.lastModified); // lastManualSaveTimestamp has been removed
      clearHistory(); // Clear undo/redo history for the new project
    },
    [isDirty, initializeUndoRedoState, clearHistory]
  );

  const handleSaveProject = useCallback(() => {
    if (!activeProjectId) {
      // If no active project ID, it's a new unsaved project, so open modal to "Save As"
      setProjectModalView('saveAs');
      setShowProjectManager(true); 
      return;
    }
    const savedMetadata = pmSaveProject(activeProjectId, activeProjectName, projectState);
    setActiveProjectName(savedMetadata.name); // In case name was changed in modal
    setIsDirty(false);
    // setLastManualSaveTimestamp(savedMetadata.lastModified); // lastManualSaveTimestamp has been removed
    alert('Project saved successfully!');
  }, [activeProjectId, activeProjectName, projectState]);

  const handleProjectLoaded = useCallback(
    (loadedState: ProjectState, metadata: ProjectMetadata) => {
      initializeUndoRedoState(loadedState);
      setActiveProjectId(metadata.id);
      setActiveProjectName(metadata.name);
      setIsDirty(false); // Just loaded, so not dirty
      // setLastManualSaveTimestamp(metadata.lastModified); // lastManualSaveTimestamp has been removed
      clearHistory(); // Clear undo/redo history for the new project
      setShowProjectManager(false);
    },
    [initializeUndoRedoState, clearHistory]
  );

  const handleProjectCreated = useCallback(
    (createdState: ProjectState, metadata: ProjectMetadata) => {
      initializeUndoRedoState(createdState);
      setActiveProjectId(metadata.id);
      setActiveProjectName(metadata.name);
      setIsDirty(false); // Just created, so not dirty
      // setLastManualSaveTimestamp(metadata.lastModified); // lastManualSaveTimestamp has been removed
      clearHistory(); // Clear undo/redo history for the new project
      setShowProjectManager(false);
    },
    [initializeUndoRedoState, clearHistory]
  );

  const handleDuplicateProject = useCallback(() => {
    if (!activeProjectId) {
      alert('No active project to duplicate. Please save or create one first.');
      return;
    }
    // Logic for duplication is handled within ProjectManagerModal,
    // this simply opens the modal. The user will be prompted for a new name there.
    setProjectModalView('saveAs');
    setShowProjectManager(true); 
  }, [activeProjectId]);

  const handleDeleteProject = useCallback(() => {
    if (!activeProjectId) {
      alert('No active project to delete.');
      return;
    }
    if (window.confirm('Are you sure you want to delete the current project? This cannot be undone.')) {
      pmDeleteProject(activeProjectId);
      handleCreateNewProject(); // Automatically create a new project after deleting current
      alert('Project deleted.');
    }
  }, [activeProjectId, handleCreateNewProject]);


  const handleExportProject = useCallback(() => {
    if (!activeProjectId) {
      alert('No active project to export. Please save or create one first.');
      return;
    }
    const project = getAllProjectMetadata().find(p => p.id === activeProjectId);
    if (!project) {
        alert('Could not find current project metadata for export.');
        return;
    }
    const fullProject = pmLoadProject(activeProjectId);
    if (fullProject) {
        pmExportProject(fullProject);
    } else {
        alert('Failed to load full project data for export. It might be corrupted.');
    }
  }, [activeProjectId, projectState]); // projectState is here to ensure latest data is exported

  const handleImportProject = useCallback(async (file: File) => {
    try {
      if (isDirty && !window.confirm('You have unsaved changes. Import anyway?')) {
        return;
      }
      const importedProject = await pmImportProject(file);
      if (importedProject) {
        handleProjectCreated(importedProject.state, importedProject.metadata);
        alert('Project imported successfully!');
      }
    } catch (error) {
      alert(`Failed to import project: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [isDirty, handleProjectCreated]);

  const handleShareProject = useCallback(() => {
    if (!activeProjectId) {
      alert('Please save your project first to generate a shareable link.');
      return;
    }
    const project = getAllProjectMetadata().find(p => p.id === activeProjectId);
    if (!project) {
      alert('Could not find current project data for sharing.');
      return;
    }
    const fullProject = { metadata: project, state: projectState, versions: [] }; // Only current state is needed for sharing
    const shareLink = generateShareLink(fullProject);
    navigator.clipboard.writeText(shareLink);
    alert('Shareable link copied to clipboard!');
  }, [activeProjectId, projectState]);

  const handleCopyProject = useCallback(() => {
    if (!activeProjectId) {
      alert('No active project to copy. Please save or create one first.');
      return;
    }
    const project = getAllProjectMetadata().find(p => p.id === activeProjectId);
    if (!project) {
        alert('Could not find current project metadata for copy.');
        return;
    }
    const fullProject = pmLoadProject(activeProjectId); // Load full project for complete data copy
    if (fullProject) {
        copyProjectToClipboard(fullProject);
    } else {
        alert('Failed to load full project data for copy to clipboard. It might be corrupted.');
    }
  }, [activeProjectId, projectState]);

  const handleUpdateAsset = useCallback((updatedAsset: GameAsset) => {
    setAssets(assets.map(a => a.id === updatedAsset.id ? updatedAsset : a));
    setActiveWorkstationAsset(updatedAsset);
  }, [assets, setAssets]);

  if (activeWorkstationAsset) {
    return (
      <AssetPreview 
        asset={activeWorkstationAsset} 
        onClose={() => setActiveWorkstationAsset(null)} 
        onUpdateAsset={handleUpdateAsset}
        allAssets={assets}
      />
    );
  }

  if (viewMode === 'preview' && game) {
    return <GameRunner code={game.code} title={game.title} assets={assets} previewDevice={previewDevice} onExit={() => setViewMode('editor')} />;
  }

  return (
    <div className="flex flex-col h-screen bg-[#F8FAFC] overflow-hidden">
      <header className="h-14 md:h-16 border-b bg-white flex items-center justify-between px-4 md:px-6 shrink-0 z-[100]">
        <div className="flex items-center gap-2 md:gap-4">
          <button
            onClick={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)}
            className="md:hidden p-2 text-slate-500 hover:bg-slate-50 rounded-lg transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-1.5 rounded-lg shadow-sm shadow-indigo-100">
              <Box className="w-4 h-4 md:w-5 md:h-5 text-white" />
            </div>
            <span className="font-black text-xs md:text-sm tracking-tighter text-slate-900 hidden sm:inline uppercase">
              TEXT2GAME STUDIO
            </span>
            <span className="font-black text-xs tracking-tighter text-slate-900 sm:hidden uppercase">
              TEXT2GAME
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 md:gap-3">
          {/* Undo/Redo Buttons */}
          <div className="hidden md:flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-100">
            <button
              onClick={undo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
              aria-label="Undo last action"
              className="p-1.5 rounded-lg text-slate-400 hover:bg-white hover:text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              title="Redo (Ctrl+Y / Ctrl+Shift+Z)"
              aria-label="Redo last undone action"
              className="p-1.5 rounded-lg text-slate-400 hover:bg-white hover:text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>

          {/* AI Model Selector */}
          <AIModelSelector selectedModel={selectedModel} onModelChange={handleModelChange} />

          <button
            onClick={handleKeySelectionManual}
            className="flex items-center gap-2 px-2 md:px-4 py-1.5 md:py-2 rounded-xl border border-slate-200 text-[10px] md:text-xs font-bold uppercase hover:bg-slate-50 hover:border-slate-300 transition-all text-slate-600"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span className="hidden md:inline">AI Config</span>
          </button>

          {game && (
            <div className="flex items-center gap-1.5 md:gap-2">
              <button
                onClick={handleDownload}
                title="Download Source"
                className="p-2 md:px-4 md:py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-95 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span className="hidden xl:inline text-[10px] md:text-xs font-bold uppercase">Export</span>
              </button>

              <button
                onClick={() => setViewMode('preview')}
                className="bg-indigo-600 text-white px-2.5 md:px-5 py-1.5 md:py-2 rounded-xl text-[10px] md:text-xs font-bold uppercase shadow-lg shadow-indigo-100 hover:bg-indigo-700 hover:shadow-indigo-200 transition-all active:scale-95 flex items-center gap-2"
              >
                <Maximize2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                <span className="hidden md:inline">Preview</span>
              </button>
            </div>
          )}

          <button
            onClick={() => {
              setIsRightSidebarOpen(!isRightSidebarOpen);
              if (!isRightSidebarOpen) setActiveMobileView('chat');
            }}
            className="md:hidden p-2 text-slate-500 hover:bg-slate-50 rounded-lg transition-colors"
          >
            <MessageSquareCode className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden relative">
        <aside
          style={{ width: typeof window !== 'undefined' && window.innerWidth >= 768 ? `${leftWidth}px` : undefined }}
          className={`
          fixed md:static inset-y-0 left-0 bg-white border-r z-50 transition-transform duration-300 ease-in-out md:transition-none
          ${isLeftSidebarOpen ? 'translate-x-0 shadow-2xl md:shadow-none' : '-translate-x-full md:translate-x-0'}
        `}
        >
          <div className="p-4 h-full overflow-y-auto no-scrollbar scroll-smooth">
            <div className="md:hidden flex items-center justify-between mb-6 pb-2 border-b border-slate-100">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Asset Matrix</span>
              <button onClick={() => setIsLeftSidebarOpen(false)} className="p-1 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <AssetUploader assets={assets} onAssetsChange={setAssets} onPreviewAsset={setActiveWorkstationAsset} />
          </div>
        </aside>

        {/* Left Resizer */}
        <div 
          onMouseDown={handleMouseDownLeft}
          className="hidden md:block w-1 hover:w-1.5 bg-transparent hover:bg-indigo-400/30 cursor-col-resize z-[60] transition-all duration-200 active:bg-indigo-500/50"
        />

        <div className="flex-1 flex flex-col bg-[#F1F5F9] relative overflow-hidden transition-all duration-300">
          <div className={`flex-1 relative bg-[#0F172A] ${activeMobileView === 'staging' ? 'flex' : 'hidden md:flex'} items-center justify-center overflow-hidden p-0 md:p-8`}>
            {game ? (
              <div className={`relative group transition-all duration-500 ease-in-out ${previewDevice === 'mobile' ? 'w-full h-full md:w-[812px] md:h-[375px] md:aspect-[19.5/9] md:rounded-[3rem] md:border-[12px] md:border-slate-800 shadow-2xl overflow-hidden' : 'w-full h-full'}`}>
                <iframe
                  ref={previewIframeRef}
                  srcDoc={integratedSrcDoc}
                  className="w-full h-full border-none"
                  sandbox="allow-scripts allow-modals allow-pointer-lock"
                />
                
                {/* Device Toggle - Desktop Only */}
                <div className="hidden md:flex absolute top-6 left-6 flex-col gap-2 bg-black/40 backdrop-blur-md p-2 rounded-2xl border border-white/5 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                  <span className="text-[8px] font-black text-white/30 uppercase tracking-widest px-1">Platform</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setPreviewDevice('desktop')}
                      title="Desktop Preview"
                      className={`p-3 rounded-xl transition-all ${previewDevice === 'desktop' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-white/40 hover:text-white/60'}`}
                    >
                      <Monitor className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setPreviewDevice('mobile')}
                      title="Mobile Preview"
                      className={`p-3 rounded-xl transition-all ${previewDevice === 'mobile' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-white/40 hover:text-white/60'}`}
                    >
                      <Smartphone className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="absolute bottom-6 right-6 flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                  <button
                    onClick={handleDownload}
                    className="p-4 bg-white/10 backdrop-blur-md border border-white/20 text-white rounded-2xl hover:bg-white/20 transition-all active:scale-90 shadow-lg"
                  >
                    <Download className="w-6 h-6" />
                  </button>
                  <button
                    onClick={() => setViewMode('preview')}
                    className="p-4 bg-white/10 backdrop-blur-md border border-white/20 text-white rounded-2xl hover:bg-white/20 transition-all active:scale-90 shadow-lg"
                  >
                    <Maximize2 className="w-6 h-6" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <div className="w-20 h-20 md:w-24 md:h-24 bg-white/5 border border-white/10 rounded-[2rem] flex items-center justify-center mb-6 animate-pulse">
                  <BoxSelect className="w-8 h-8 md:w-10 md:h-10 text-white/10" />
                </div>
                <h3 className="text-white/20 font-black uppercase tracking-[0.4em] text-[10px] md:text-xs mb-2">
                  Awaiting Neural Link
                </h3>
                <p className="text-white/10 text-[9px] font-bold uppercase tracking-widest max-w-[200px] leading-relaxed">
                  Synthesis occurs once buffers are architected
                </p>
              </div>
            )}

            <div className="absolute bottom-6 left-6 flex flex-col gap-1.5 pointer-events-none">
              <span className="text-[8px] font-black text-white/20 uppercase tracking-[0.2em]">Substrate Pulse</span>
              <div className="flex items-center gap-2.5 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/5">
                <div
                  className={`w-2 h-2 rounded-full ${
                    status.step === 'ready'
                      ? 'bg-[#4F46E5] shadow-[0_0_12px_rgba(79,70,229,0.8)]'
                      : status.step === 'idle'
                      ? 'bg-white/10'
                      : 'bg-[#C9A24D] animate-pulse'
                  }`}
                />
                <span className="text-[9px] font-black text-white/60 uppercase tracking-widest">
                  {status.message || 'Standby'}
                </span>
              </div>
            </div>

            {isLiveSyncing && (
              <div className="absolute top-6 right-6 flex items-center gap-2.5 px-4 py-2 bg-indigo-600/20 backdrop-blur-md border border-indigo-500/30 rounded-2xl animate-in fade-in slide-in-from-top-4 duration-500">
                <RefreshCw className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                <span className="text-[9px] font-black text-indigo-100 uppercase tracking-widest">Neural Sync</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Resizer */}
        <div 
          onMouseDown={handleMouseDownRight}
          className="hidden md:block w-1 hover:w-1.5 bg-transparent hover:bg-indigo-400/30 cursor-col-resize z-[60] transition-all duration-200 active:bg-indigo-500/50"
        />

        <aside
          style={{ width: typeof window !== 'undefined' && window.innerWidth >= 768 ? `${rightWidth}px` : undefined }}
          className={`
          fixed md:static inset-y-0 right-0 bg-white border-l z-[110] transition-transform duration-300 ease-in-out md:transition-none
          ${isRightSidebarOpen || activeMobileView === 'chat' ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
          w-full md:w-auto
        `}
        >
          <div className="h-full relative flex flex-col">
            <div className="md:hidden flex items-center justify-between p-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-200">
                  <BrainCircuit className="w-4 h-4 text-white" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-900">Neural Architect</span>
              </div>
              <button 
                onClick={() => {
                  setIsRightSidebarOpen(false);
                  setActiveMobileView('staging');
                }} 
                className="p-2 text-slate-400 active:scale-90"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <AIChat
                history={chatHistory}
                onSendMessage={(msg, att) => processGeneration(msg, false, att)}
                onInspiration={handleInspiration}
                onLogicWeave={handleLogicWeave}
                onAddAsset={addAssetFromAI}
                isProcessing={status.step !== 'idle' && status.step !== 'ready' && status.step !== 'error'}
                aiMode={aiMode}
                onModeChange={setAiMode}
              />
            </div>
          </div>
        </aside>

        {(isLeftSidebarOpen || (isRightSidebarOpen && activeMobileView !== 'chat')) && (
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 md:hidden"
            onClick={() => {
              setIsLeftSidebarOpen(false);
              setIsRightSidebarOpen(false);
            }}
          />
        )}
      </main>

      <footer className="h-20 border-t bg-white flex items-center justify-around md:hidden shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-[120] px-6">
        <button
          onClick={() => setActiveMobileView('staging')}
          className={`flex flex-col items-center gap-1.5 transition-all active:scale-90 p-2 ${
            activeMobileView === 'staging' ? 'text-indigo-600' : 'text-slate-400'
          }`}
        >
          <div className={`p-2.5 rounded-2xl transition-all ${activeMobileView === 'staging' ? 'bg-indigo-50 shadow-sm' : ''}`}>
            <Monitor className="w-6 h-6" />
          </div>
          <span className="text-[9px] font-black uppercase tracking-widest">Staging</span>
        </button>
        <button
          onClick={() => setActiveMobileView('chat')}
          className={`flex flex-col items-center gap-1.5 transition-all active:scale-90 p-2 ${
            activeMobileView === 'chat' ? 'text-indigo-600' : 'text-slate-400'
          }`}
        >
          <div className={`p-2.5 rounded-2xl transition-all ${activeMobileView === 'chat' ? 'bg-indigo-50 shadow-sm' : ''}`}>
            <div className="relative">
              <MessageSquareCode className="w-6 h-6" />
              {isLiveSyncing && (
                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-indigo-600 rounded-full animate-pulse border-2 border-white" />
              )}
            </div>
          </div>
          <span className="text-[9px] font-black uppercase tracking-widest">Architect</span>
        </button>
      </footer>

      {/* Project Manager Modal */}
      <ProjectManagerModal
        isOpen={showProjectManager}
        onClose={() => setShowProjectManager(false)}
        onProjectLoaded={handleProjectLoaded}
        onProjectCreated={handleProjectCreated}
        currentProjectId={activeProjectId}
        currentProjectState={projectState}
        initialView={projectModalView}
      />

      {/* AI Config Modal */}
      <AIConfigModal
        isOpen={showGeminiConfig}
        onClose={() => setShowGeminiConfig(false)}
      />

      {/* Autosave Recovery Prompt (removed)
      {showAutosaveRecoveryPrompt && (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl p-8 shadow-2xl max-w-sm text-center">
            <h3 className="text-xl font-bold mb-4 text-slate-900">Recover Autosave?</h3>
            <p className="text-slate-700 mb-6">
              It looks like you have an unsaved project from your last session. Would you like to restore it?
            </p>
            <div className="flex gap-4">
              <button
                onClick={handleRecoverAutosave}
                className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors active:scale-95"
              >
                Restore
              </button>
              <button
                onClick={handleDiscardAutosave}
                className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors active:scale-95"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
      */}
    </div>
  );
};

export default App;