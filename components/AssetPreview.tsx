import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF, useFBX, Stage, Center, Html } from '@react-three/drei';
import { GameAsset } from '../types';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Volume2, 
  Maximize2, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Settings2, 
  MessageSquare, 
  Loader2, 
  Grid, 
  Activity, 
  Eye, 
  Sliders, 
  Compass, 
  Zap, 
  SlidersHorizontal
} from 'lucide-react';

interface AssetPreviewProps {
  asset: GameAsset;
  onClose: () => void;
}

const LoadingOverlay = () => (
  <Html center>
    <div className="flex flex-col items-center justify-center bg-white/90 border border-slate-200 backdrop-blur-md p-8 rounded-3xl shadow-2xl min-w-[200px]">
      <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-600 whitespace-nowrap">Initializing Engine</span>
    </div>
  </Html>
);

class ModelErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ModelViewer error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Html center>
          <div className="flex flex-col items-center justify-center bg-white/90 border border-red-200 backdrop-blur-md p-8 rounded-3xl shadow-2xl min-w-[260px] text-center">
            <div className="w-12 h-12 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-center mb-4 text-red-500">
              <X className="w-6 h-6" />
            </div>
            <span className="text-xs font-black uppercase tracking-[0.2em] text-red-600 mb-2 block">Loading Failed</span>
            <p className="text-[10px] font-bold text-slate-500 max-w-[220px]">
              {this.state.error?.message || "Ensure this is a valid 3D/Motion file."}
            </p>
          </div>
        </Html>
      );
    }

    return this.props.children;
  }
}

const GLTFModel: React.FC<{
  url: string;
  showAnimation: boolean;
  activeAnimIndex: number;
  onAnimationsLoaded: (names: string[]) => void;
  wireframe: boolean;
  showSkeleton: boolean;
  showGrid: boolean;
  playbackSpeed: number;
}> = ({ url, showAnimation, activeAnimIndex, onAnimationsLoaded, wireframe, showSkeleton, showGrid, playbackSpeed }) => {
  const { scene, animations } = useGLTF(url, 'https://www.gstatic.com/draco/versioned/decoders/1.5.5/');
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);

  // Notify parent of loaded animations
  useEffect(() => {
    if (scene && animations && animations.length > 0) {
      onAnimationsLoaded(animations.map((clip, idx) => clip.name || `Animation ${idx + 1}`));
    } else {
      onAnimationsLoaded([]);
    }
  }, [scene, animations, onAnimationsLoaded]);

  // Handle animation playback
  useEffect(() => {
    if (!scene || !showAnimation) return;
    const mixer = new THREE.AnimationMixer(scene);
    mixer.timeScale = playbackSpeed;
    mixerRef.current = mixer;

    if (animations && animations.length > 0) {
      const clip = animations[activeAnimIndex] || animations[0];
      const action = mixer.clipAction(clip);
      action.play();
    }

    return () => {
      mixer.stopAllAction();
    };
  }, [scene, animations, showAnimation, activeAnimIndex]);

  // Update speed dynamically
  useEffect(() => {
    if (mixerRef.current) {
      mixerRef.current.timeScale = playbackSpeed;
    }
  }, [playbackSpeed]);

  useFrame((state, delta) => {
    if (showAnimation && mixerRef.current) {
      mixerRef.current.update(delta);
    }
  });

  // Handle wireframe toggling
  useEffect(() => {
    if (!scene) return;
    scene.traverse((child) => {
      if ((child as any).isMesh) {
        const mesh = child as THREE.Mesh;
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((mat: any) => {
            mat.wireframe = wireframe;
          });
        } else if (mesh.material) {
          (mesh.material as any).wireframe = wireframe;
        }
      }
    });
  }, [scene, wireframe]);

  return (
    <group>
      <primitive object={scene} />
      {showAnimation && showSkeleton && <skeletonHelper args={[scene]} />}
      {showAnimation && showGrid && <gridHelper args={[10, 10, 0x4f46e5, 0xcbd5e1]} position={[0, -1, 0]} />}
    </group>
  );
};

const FBXModel: React.FC<{
  url: string;
  showAnimation: boolean;
  activeAnimIndex: number;
  onAnimationsLoaded: (names: string[]) => void;
  wireframe: boolean;
  showSkeleton: boolean;
  showGrid: boolean;
  playbackSpeed: number;
}> = ({ url, showAnimation, activeAnimIndex, onAnimationsLoaded, wireframe, showSkeleton, showGrid, playbackSpeed }) => {
  const fbx = useFBX(url);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);

  // Notify parent of loaded animations
  useEffect(() => {
    if (fbx && fbx.animations && fbx.animations.length > 0) {
      onAnimationsLoaded(fbx.animations.map((clip, idx) => clip.name || `Animation ${idx + 1}`));
    } else {
      onAnimationsLoaded([]);
    }
  }, [fbx, onAnimationsLoaded]);

  // Handle animation playback
  useEffect(() => {
    if (!fbx || !showAnimation) return;
    const mixer = new THREE.AnimationMixer(fbx);
    mixer.timeScale = playbackSpeed;
    mixerRef.current = mixer;

    if (fbx.animations && fbx.animations.length > 0) {
      const clip = fbx.animations[activeAnimIndex] || fbx.animations[0];
      const action = mixer.clipAction(clip);
      action.play();
    }

    return () => {
      mixer.stopAllAction();
    };
  }, [fbx, showAnimation, activeAnimIndex]);

  // Update speed dynamically
  useEffect(() => {
    if (mixerRef.current) {
      mixerRef.current.timeScale = playbackSpeed;
    }
  }, [playbackSpeed]);

  useFrame((state, delta) => {
    if (showAnimation && mixerRef.current) {
      mixerRef.current.update(delta);
    }
  });

  // Handle wireframe toggling
  useEffect(() => {
    if (!fbx) return;
    fbx.traverse((child) => {
      if ((child as any).isMesh) {
        const mesh = child as THREE.Mesh;
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((mat: any) => {
            mat.wireframe = wireframe;
          });
        } else if (mesh.material) {
          (mesh.material as any).wireframe = wireframe;
        }
      }
    });
  }, [fbx, wireframe]);

  return (
    <group>
      <primitive object={fbx} />
      {showAnimation && showSkeleton && <skeletonHelper args={[fbx]} />}
      {showAnimation && showGrid && <gridHelper args={[10, 10, 0x4f46e5, 0xcbd5e1]} position={[0, -1, 0]} />}
    </group>
  );
};

const ModelViewer: React.FC<{
  url: string;
  name: string;
  showAnimation: boolean;
  activeAnimIndex: number;
  onAnimationsLoaded: (names: string[]) => void;
  wireframe: boolean;
  showSkeleton: boolean;
  showGrid: boolean;
  playbackSpeed: number;
}> = ({ url, name, showAnimation, activeAnimIndex, onAnimationsLoaded, wireframe, showSkeleton, showGrid, playbackSpeed }) => {
  const [previewUrl, setPreviewUrl] = useState(url);
  const isFBX = name.toLowerCase().endsWith('.fbx');

  useEffect(() => {
    // Convert base64 to Blob URL to avoid length limits and improve performance
    if (url.startsWith('data:')) {
      try {
        const parts = url.split(',');
        if (parts.length < 2) return;
        
        const mimeMatch = parts[0].match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
        const bstr = atob(parts[1]);
        const u8arr = new Uint8Array(bstr.length);
        for (let i = 0; i < bstr.length; i++) {
          u8arr[i] = bstr.charCodeAt(i);
        }
        const blob = new Blob([u8arr], { type: mime });
        const newUrl = URL.createObjectURL(blob);
        setPreviewUrl(newUrl);
        return () => URL.revokeObjectURL(newUrl);
      } catch (e) {
        console.error('Failed to create preview blob:', e);
      }
    }
  }, [url]);

  return (
    <Stage environment="city" intensity={0.6} adjustCamera={true}>
      <Center>
        {isFBX ? (
          <FBXModel
            url={previewUrl}
            showAnimation={showAnimation}
            activeAnimIndex={activeAnimIndex}
            onAnimationsLoaded={onAnimationsLoaded}
            wireframe={wireframe}
            showSkeleton={showSkeleton}
            showGrid={showGrid}
            playbackSpeed={playbackSpeed}
          />
        ) : (
          <GLTFModel
            url={previewUrl}
            showAnimation={showAnimation}
            activeAnimIndex={activeAnimIndex}
            onAnimationsLoaded={onAnimationsLoaded}
            wireframe={wireframe}
            showSkeleton={showSkeleton}
            showGrid={showGrid}
            playbackSpeed={playbackSpeed}
          />
        )}
      </Center>
    </Stage>
  );
};

const SpritePreview: React.FC<{ url: string }> = ({ url }) => {
  const [frameWidth, setFrameWidth] = useState(64);
  const [frameHeight, setFrameHeight] = useState(64);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [fps, setFps] = useState(12);
  const [imageSize, setImageSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImageSize({ w: img.width, h: img.height });
      if (img.width === img.height) {
        setFrameWidth(img.width);
        setFrameHeight(img.height);
      } else if (img.width > img.height) {
        setFrameWidth(img.height);
        setFrameHeight(img.height);
      }
    };
    img.src = url;
  }, [url]);

  useEffect(() => {
    if (!isPlaying) return;
    const cols = Math.floor(imageSize.w / frameWidth) || 1;
    const rows = Math.floor(imageSize.h / frameHeight) || 1;
    const totalFrames = cols * rows;

    const interval = setInterval(() => {
      setCurrentFrame((f) => (f + 1) % totalFrames);
    }, 1000 / fps);
    return () => clearInterval(interval);
  }, [isPlaying, fps, imageSize, frameWidth, frameHeight]);

  const cols = Math.floor(imageSize.w / frameWidth) || 1;
  const x = (currentFrame % cols) * frameWidth;
  const y = Math.floor(currentFrame / cols) * frameHeight;

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="flex-1 flex items-center justify-center bg-slate-50 overflow-hidden rounded-3xl border border-slate-200 relative p-8">
        <div 
          className="relative border-4 border-white shadow-2xl bg-white"
          style={{ 
            width: frameWidth, 
            height: frameHeight,
            backgroundImage: `url(${url})`,
            backgroundPosition: `-${x}px -${y}px`,
            backgroundRepeat: 'no-repeat',
            imageRendering: 'pixelated'
          }}
        />
      </div>
      
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-4 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-100"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
            <button 
              onClick={() => setCurrentFrame(0)}
              className="p-4 bg-slate-150 text-slate-600 rounded-2xl hover:bg-slate-200 transition-all active:scale-95 border border-slate-200"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-200">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">FPS</span>
            <input 
              type="number" 
              value={fps} 
              onChange={(e) => setFps(Number(e.target.value))}
              className="w-12 bg-transparent text-sm font-black text-slate-700 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Frame Width</label>
            <input 
              type="range" 
              min="8" 
              max={imageSize.w || 512} 
              step="8"
              value={frameWidth} 
              onChange={(e) => setFrameWidth(Number(e.target.value))}
              className="w-full accent-indigo-500"
            />
            <div className="text-[10px] font-bold text-slate-600">{frameWidth}px</div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Frame Height</label>
            <input 
              type="range" 
              min="8" 
              max={imageSize.h || 512} 
              step="8"
              value={frameHeight} 
              onChange={(e) => setFrameHeight(Number(e.target.value))}
              className="w-full accent-indigo-500"
            />
            <div className="text-[10px] font-bold text-slate-600">{frameHeight}px</div>
          </div>
        </div>
      </div>
    </div>
  );
};

const AudioPreview: React.FC<{ url: string }> = ({ url }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) audioRef.current.pause();
      else audioRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-[40px] p-10 shadow-2xl space-y-10">
        <div className="flex flex-col items-center gap-6">
          <div className="w-32 h-32 bg-indigo-50 border border-indigo-100 rounded-[32px] flex items-center justify-center shadow-inner">
            <Volume2 className="w-16 h-16 text-indigo-600" />
          </div>
          <div className="text-center">
            <h4 className="text-xl font-black text-slate-800 tracking-tight">Audio Stream</h4>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Acoustic Data Preview</p>
          </div>
        </div>

        <audio 
          ref={audioRef} 
          src={url} 
          onTimeUpdate={handleTimeUpdate} 
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => setIsPlaying(false)}
        />

        <div className="space-y-4">
          <div className="relative w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="absolute top-0 left-0 h-full bg-indigo-600 transition-all duration-100"
              style={{ width: `${(currentTime / duration) * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] font-black text-slate-400 tracking-widest uppercase">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="flex justify-center">
          <button 
            onClick={togglePlay}
            className="w-20 h-20 bg-indigo-600 text-white rounded-full flex items-center justify-center hover:bg-indigo-700 transition-all active:scale-95 shadow-2xl shadow-indigo-100"
          >
            {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export const AssetPreview: React.FC<AssetPreviewProps> = ({ asset, onClose }) => {
  const is3D = asset.mimeType.includes('model') || asset.name.endsWith('.glb') || asset.name.endsWith('.gltf') || asset.name.endsWith('.fbx');
  const isImage = asset.mimeType.includes('image');
  const isAudio = asset.mimeType.includes('audio');
  const isText = asset.type === 'dialogue' || asset.mimeType.includes('text');

  // Workstation States for 3D Assets
  const [animationsList, setAnimationsList] = useState<string[]>([]);
  const [activeAnimIndex, setActiveAnimIndex] = useState<number>(0);
  const showAnimation = asset.type === 'motion1' || asset.type === 'motion2';

  // Toggle States
  const [showGrid, setShowGrid] = useState(true);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [wireframe, setWireframe] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);

  // OrbitControls Camera Control
  const controlsRef = useRef<any>(null);
  const handleResetCamera = () => {
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  };

  return (
    <div className="fixed inset-0 z-[250] bg-[#F8FAFC] flex flex-col md:flex-row text-slate-800 overflow-hidden font-sans select-none animate-in fade-in duration-300">
      
      {/* LEFT SIDEBAR: Workstation Info & Controls */}
      <aside className="md:w-80 w-full shrink-0 bg-white border-b md:border-b-0 md:border-r border-slate-200 flex flex-col h-full z-10 shadow-sm">
        
        {/* Workstation Header / Close */}
        <button 
          onClick={onClose}
          className="w-full py-5 px-6 border-b border-slate-200 flex items-center justify-between text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-all font-black text-[10px] uppercase tracking-[0.2em]"
        >
          <span>Exit Workstation</span>
          <X className="w-4 h-4" />
        </button>

        {/* Workstation Controls */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
          
          {/* Asset Info card */}
          <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 shrink-0 shadow-sm">
              {is3D ? <Compass className="w-6 h-6" /> : isAudio ? <Volume2 className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-black text-slate-800 truncate tracking-tight">{asset.name}</h4>
              <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest mt-1">{asset.type}</p>
            </div>
          </div>

          {is3D && (
            <>
              {/* Visual Toggles */}
              <div className="space-y-4">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block border-b border-slate-200 pb-2">Visual Shaders</span>
                
                <div className="space-y-2">
                  {showAnimation && (
                    <>
                      <button 
                        onClick={() => setShowGrid(!showGrid)}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all ${
                          showGrid 
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-600 shadow-sm' 
                            : 'bg-white border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span>Show Grid Floor</span>
                        <Grid className="w-4 h-4" />
                      </button>

                      <button 
                        onClick={() => setShowSkeleton(!showSkeleton)}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all ${
                          showSkeleton 
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-600 shadow-sm' 
                            : 'bg-white border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span>Show Bones / Skeleton</span>
                        <Activity className="w-4 h-4" />
                      </button>
                    </>
                  )}

                  <button 
                    onClick={() => setWireframe(!wireframe)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all ${
                      wireframe 
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-600 shadow-sm' 
                        : 'bg-white border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>Wireframe Mode</span>
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Playback Speed (Only if animation is active) */}
              {showAnimation && (
                <div className="space-y-4">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block border-b border-slate-200 pb-2">Neural Clock Rate</span>
                  <div className="grid grid-cols-5 gap-1 bg-slate-150/85 p-1 rounded-xl border border-slate-200">
                    {[0.25, 0.5, 1.0, 1.5, 2.0].map((speed) => (
                      <button
                        key={speed}
                        onClick={() => setPlaybackSpeed(speed)}
                        className={`py-2 rounded-lg text-[9px] font-black uppercase tracking-tighter transition-all ${
                          playbackSpeed === speed 
                            ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' 
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Asset details / metadata */}
          <div className="space-y-3">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block border-b border-slate-200 pb-2">Properties</span>
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                <span className="text-slate-400">Mime-Type</span>
                <span className="text-slate-600 truncate max-w-[140px]">{asset.mimeType}</span>
              </div>
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                <span className="text-slate-400">Category</span>
                <span className="text-slate-600">{asset.category || 'N/A'}</span>
              </div>
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                <span className="text-slate-400">Optimized</span>
                <span className={`font-black ${asset.isOptimized ? 'text-emerald-600' : 'text-amber-500'}`}>{asset.isOptimized ? 'YES' : 'NO'}</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* CENTER VIEWPORT: The Canvas / Interactive Preview */}
      <main className="flex-grow relative flex items-center justify-center bg-white">
        
        {/* Subtle radial background glow */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(79,70,229,0.03),transparent_70%)] pointer-events-none" />

        {is3D ? (
          <div className="w-full h-full relative">
            <Canvas shadows camera={{ position: [0, 1, 5], fov: 45 }}>
              <ambientLight intensity={0.8} />
              <pointLight position={[10, 10, 10]} intensity={1} />
              <spotLight position={[-10, 10, 10]} angle={0.15} penumbra={1} intensity={1} />
              <React.Suspense fallback={<LoadingOverlay />}>
                <ModelErrorBoundary>
                  <ModelViewer
                    url={asset.content}
                    name={asset.name}
                    showAnimation={showAnimation}
                    activeAnimIndex={activeAnimIndex}
                    onAnimationsLoaded={setAnimationsList}
                    wireframe={wireframe}
                    showSkeleton={showSkeleton}
                    showGrid={showGrid}
                    playbackSpeed={playbackSpeed}
                  />
                </ModelErrorBoundary>
              </React.Suspense>
              <OrbitControls 
                ref={controlsRef}
                makeDefault 
                minPolarAngle={0} 
                maxPolarAngle={Math.PI / 1.75} 
              />
            </Canvas>

            {/* Camera Reset floating button */}
            <button
              onClick={handleResetCamera}
              title="Reset Camera Viewport"
              className="absolute bottom-6 left-6 p-4 bg-white/90 hover:bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-2xl shadow-lg transition-all active:scale-95 flex items-center gap-2 text-[9px] font-black uppercase tracking-widest z-10"
            >
              <Compass className="w-4 h-4 text-indigo-500" />
              <span>Reset Camera</span>
            </button>
          </div>
        ) : (
          <div className="w-full h-full p-6 md:p-12 overflow-auto">
            {isImage && <SpritePreview url={asset.content} />}
            {isAudio && <AudioPreview url={asset.content} />}
            {isText && (
              <div className="flex flex-col items-center justify-center h-full">
                <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-[40px] p-12 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-2 bg-indigo-600" />
                  <div className="flex items-center gap-4 mb-8">
                    <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-2xl">
                      <MessageSquare className="w-6 h-6 text-indigo-600" />
                    </div>
                    <h4 className="text-xl font-black text-slate-800 tracking-tight">Logic Node Content</h4>
                  </div>
                  <div className="bg-slate-50 rounded-3xl p-8 border border-slate-200">
                    <p className="text-lg font-medium text-slate-700 leading-relaxed italic">
                      "{asset.content}"
                    </p>
                  </div>
                  <div className="mt-8 flex justify-end">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Behavioral Data Node</span>
                  </div>
                </div>
              </div>
            )}
            {!isImage && !isAudio && !isText && (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4">
                <div className="w-20 h-20 bg-slate-50 border border-slate-200 rounded-[24px] flex items-center justify-center">
                  <Settings2 className="w-10 h-10" />
                </div>
                <p className="text-sm font-black uppercase tracking-[0.2em]">No Preview Available</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* RIGHT SIDEBAR: Animation Track List (Only if animation is active) */}
      {is3D && showAnimation && (
        <aside className="md:w-72 w-full shrink-0 bg-white border-t md:border-t-0 md:border-l border-slate-200 flex flex-col h-full z-10 shadow-sm">
          <div className="py-5 px-6 border-b border-slate-200 flex items-center gap-3">
            <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-700">Animation Tracks</span>
          </div>
          
          <div className="flex-grow overflow-y-auto p-6 space-y-2 no-scrollbar">
            {animationsList.length > 0 ? (
              animationsList.map((name, index) => (
                <button
                  key={name}
                  onClick={() => setActiveAnimIndex(index)}
                  className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl border text-[10px] font-black uppercase tracking-wider text-left transition-all relative overflow-hidden group ${
                    activeAnimIndex === index
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-100'
                      : 'bg-white border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <Play className={`w-3.5 h-3.5 shrink-0 ${activeAnimIndex === index ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}`} />
                  <span className="truncate">{name}</span>
                  
                  {activeAnimIndex === index && (
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-200 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-100"></span>
                    </span>
                  )}
                </button>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-40 text-center text-slate-400 gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
                <span className="text-[9px] font-black uppercase tracking-widest">Scanning Tracks...</span>
              </div>
            )}
          </div>
        </aside>
      )}

    </div>
  );
};
