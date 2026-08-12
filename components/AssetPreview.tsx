
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF, useFBX, Stage, Center, Html, useAnimations } from '@react-three/drei';
import { GameAsset, AssetType } from '../types';
import { Play, Pause, RotateCcw, Volume2, Maximize2, X, ChevronLeft, ChevronRight, Settings2, MessageSquare, Loader2, Compass, Activity, Eye, Grid, Sliders } from 'lucide-react';

interface AssetPreviewProps {
  asset: GameAsset;
  onClose: () => void;
  onUpdateAsset?: (asset: GameAsset) => void;
  allAssets?: GameAsset[];
}

const CompanionAnimationsLoader: React.FC<{
  url: string;
  name: string;
  onLoaded: (clips: THREE.AnimationClip[]) => void;
}> = ({ url, name, onLoaded }) => {
  const isFBX = name.toLowerCase().endsWith('.fbx');
  let clips: THREE.AnimationClip[] = [];
  if (isFBX) {
    const fbx = useFBX(url);
    clips = fbx.animations || [];
  } else {
    const { animations } = useGLTF(url, 'https://www.gstatic.com/draco/versioned/decoders/1.5.5/');
    clips = animations || [];
  }

  useEffect(() => {
    if (clips && clips.length > 0) {
      onLoaded(clips);
    }
  }, [clips, onLoaded]);

  return null;
};

const LoadingOverlay = () => (
  <Html center>
    <div className="flex flex-col items-center justify-center bg-white/80 backdrop-blur-md p-8 rounded-3xl border border-white shadow-2xl min-w-[200px]">
      <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-600 whitespace-nowrap">Initializing Engine</span>
    </div>
  </Html>
);

interface MaterialEditValue {
  color: string;
  roughness: number;
  metalness: number;
  map?: string | null;
  normalMap?: string | null;
  roughnessMap?: string | null;
}

interface ModelProps {
  url: string;
  isMotion: boolean;
  onAnimationsLoaded?: (animations: string[]) => void;
  onMaterialsLoaded?: (materials: { name: string; color: string; roughness: number; metalness: number }[]) => void;
  materialEdits?: Record<string, MaterialEditValue>;
  activeAnimation?: string | null;
  showBones?: boolean;
  wireframeMode?: boolean;
  modelScale?: number;
  animationSpeed?: number;
  companionAnimations?: THREE.AnimationClip[];
}

const extractMaterials = (object: THREE.Object3D) => {
  const mats: { name: string; material: THREE.Material }[] = [];
  let unnamedCount = 1;
  object.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      if (mesh.material) {
        const processMat = (m: THREE.Material) => {
          if (!m.name) {
            m.name = `Material ${unnamedCount++}`;
          }
          if (!mats.some(item => item.name === m.name)) {
            mats.push({ name: m.name, material: m });
          }
        };
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(processMat);
        } else {
          processMat(mesh.material);
        }
      }
    }
  });

  return mats.map(({ name, material }) => {
    let hexColor = '#ffffff';
    if ('color' in material && (material as any).color instanceof THREE.Color) {
      hexColor = '#' + (material as any).color.getHexString();
    }
    const roughness = 'roughness' in material ? (material as any).roughness : 0.5;
    const metalness = 'metalness' in material ? (material as any).metalness : 0.0;
    return {
      name,
      color: hexColor,
      roughness,
      metalness,
    };
  });
};

const GLTFModel: React.FC<ModelProps> = ({ 
  url, isMotion, onAnimationsLoaded, onMaterialsLoaded, materialEdits, activeAnimation, showBones = true, wireframeMode = false, modelScale = 1, animationSpeed = 1, companionAnimations 
}) => {
  const { scene, animations } = useGLTF(url, 'https://www.gstatic.com/draco/versioned/decoders/1.5.5/');
  const combinedAnimations = useMemo(() => {
    const all = [...(animations || [])];
    if (companionAnimations) {
      companionAnimations.forEach(clip => {
        if (!all.some(c => c.name === clip.name)) {
          all.push(clip);
        }
      });
    }
    return all;
  }, [animations, companionAnimations]);
  const { actions } = useAnimations(combinedAnimations, scene);
  const originalMaterials = useRef<Record<string, { 
    color: string; 
    roughness: number; 
    metalness: number;
    map?: THREE.Texture | null;
    normalMap?: THREE.Texture | null;
    roughnessMap?: THREE.Texture | null;
  }>>({});
  
  useEffect(() => {
    if (actions && Object.keys(actions).length > 0 && onAnimationsLoaded) {
      onAnimationsLoaded(Object.keys(actions));
    }
  }, [actions, onAnimationsLoaded]);

  useEffect(() => {
    if (actions && Object.keys(actions).length > 0) {
      // Stop all actions first
      Object.values(actions).forEach(action => action?.stop());
      
      const actionToPlay = activeAnimation ? actions[activeAnimation] : actions[Object.keys(actions)[0]];
      if (actionToPlay) {
        actionToPlay.play();
        actionToPlay.setEffectiveTimeScale(animationSpeed);
      }
    }
  }, [actions, activeAnimation, animationSpeed]);

  useEffect(() => {
    scene.scale.setScalar(modelScale);
    scene.updateMatrixWorld(true);
  }, [scene, modelScale]);

  useEffect(() => {
    if (!scene) return;
    const mats = extractMaterials(scene);
    mats.forEach(m => {
      if (!originalMaterials.current[m.name]) {
        let actualMat: THREE.Material | null = null;
        scene.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            if (mesh.material) {
              const findMat = (mat: THREE.Material) => {
                if (mat.name === m.name) {
                  actualMat = mat;
                }
              };
              if (Array.isArray(mesh.material)) {
                mesh.material.forEach(findMat);
              } else {
                findMat(mesh.material);
              }
            }
          }
        });

        originalMaterials.current[m.name] = {
          color: m.color,
          roughness: m.roughness,
          metalness: m.metalness,
          map: actualMat && 'map' in actualMat ? (actualMat as any).map : null,
          normalMap: actualMat && 'normalMap' in actualMat ? (actualMat as any).normalMap : null,
          roughnessMap: actualMat && 'roughnessMap' in actualMat ? (actualMat as any).roughnessMap : null,
        };
      }
    });

    if (onMaterialsLoaded) {
      onMaterialsLoaded(mats);
    }
  }, [scene, onMaterialsLoaded]);

  useEffect(() => {
    if (!scene) return;
    const textureLoader = new THREE.TextureLoader();

    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const meshChild = child as THREE.Mesh;
        const applyEdits = (mat: THREE.Material) => {
          if (!mat.name) return;
          const edit = materialEdits?.[mat.name] || materialEdits?.['all'];
          const original = originalMaterials.current[mat.name];

          if (edit) {
            if ('color' in mat && (mat as any).color instanceof THREE.Color) {
              (mat as any).color.set(edit.color);
            }
            if ('roughness' in mat) {
              (mat as any).roughness = edit.roughness;
            }
            if ('metalness' in mat) {
              (mat as any).metalness = edit.metalness;
            }

            // Apply Diffuse Map
            if ('map' in mat) {
              if (edit.map) {
                if (!(mat as any)._customMapUrl || (mat as any)._customMapUrl !== edit.map) {
                  (mat as any)._customMapUrl = edit.map;
                  textureLoader.load(edit.map, (tex) => {
                    tex.colorSpace = THREE.SRGBColorSpace;
                    tex.wrapS = THREE.RepeatWrapping;
                    tex.wrapT = THREE.RepeatWrapping;
                    (mat as any).map = tex;
                    mat.needsUpdate = true;
                  });
                }
              } else if (edit.map === null) {
                (mat as any).map = original?.map || null;
                (mat as any)._customMapUrl = null;
              }
            }

            // Apply Normal Map
            if ('normalMap' in mat) {
              if (edit.normalMap) {
                if (!(mat as any)._customNormalMapUrl || (mat as any)._customNormalMapUrl !== edit.normalMap) {
                  (mat as any)._customNormalMapUrl = edit.normalMap;
                  textureLoader.load(edit.normalMap, (tex) => {
                    tex.wrapS = THREE.RepeatWrapping;
                    tex.wrapT = THREE.RepeatWrapping;
                    (mat as any).normalMap = tex;
                    mat.needsUpdate = true;
                  });
                }
              } else if (edit.normalMap === null) {
                (mat as any).normalMap = original?.normalMap || null;
                (mat as any)._customNormalMapUrl = null;
              }
            }

            // Apply Roughness Map
            if ('roughnessMap' in mat) {
              if (edit.roughnessMap) {
                if (!(mat as any)._customRoughnessMapUrl || (mat as any)._customRoughnessMapUrl !== edit.roughnessMap) {
                  (mat as any)._customRoughnessMapUrl = edit.roughnessMap;
                  textureLoader.load(edit.roughnessMap, (tex) => {
                    tex.wrapS = THREE.RepeatWrapping;
                    tex.wrapT = THREE.RepeatWrapping;
                    (mat as any).roughnessMap = tex;
                    mat.needsUpdate = true;
                  });
                }
              } else if (edit.roughnessMap === null) {
                (mat as any).roughnessMap = original?.roughnessMap || null;
                (mat as any)._customRoughnessMapUrl = null;
              }
            }

            mat.needsUpdate = true;
          } else if (original) {
            if ('color' in mat && (mat as any).color instanceof THREE.Color) {
              (mat as any).color.set(original.color);
            }
            if ('roughness' in mat) {
              (mat as any).roughness = original.roughness;
            }
            if ('metalness' in mat) {
              (mat as any).metalness = original.metalness;
            }
            if ('map' in mat) {
              (mat as any).map = original.map || null;
              (mat as any)._customMapUrl = null;
            }
            if ('normalMap' in mat) {
              (mat as any).normalMap = original.normalMap || null;
              (mat as any)._customNormalMapUrl = null;
            }
            if ('roughnessMap' in mat) {
              (mat as any).roughnessMap = original.roughnessMap || null;
              (mat as any)._customRoughnessMapUrl = null;
            }
            mat.needsUpdate = true;
          }
        };
        if (meshChild.material) {
          if (Array.isArray(meshChild.material)) {
            meshChild.material.forEach(applyEdits);
          } else {
            applyEdits(meshChild.material);
          }
        }
      }
    });
  }, [scene, materialEdits]);

  const { skeletonHelper, hasMeshes } = React.useMemo(() => {
    let hasBones = false;
    let hasMeshes = false;
    scene.traverse((child) => {
      if ((child as THREE.Bone).isBone) hasBones = true;
      if ((child as THREE.Mesh).isMesh) {
        hasMeshes = true;
        const meshChild = child as THREE.Mesh;
        meshChild.visible = !isMotion; // Hide meshes if it's a motion asset
        if (meshChild.material) {
          if (Array.isArray(meshChild.material)) {
            meshChild.material.forEach(mat => {
               if ('wireframe' in mat) {
                 (mat as any).wireframe = wireframeMode;
                 (mat as any).needsUpdate = true;
               }
            });
          } else {
             if ('wireframe' in meshChild.material) {
               (meshChild.material as any).wireframe = wireframeMode;
               (meshChild.material as any).needsUpdate = true;
             }
          }
        }
      }
    });
    
    let helper = null;
    if (hasBones) { 
      helper = new THREE.SkeletonHelper(scene);
      helper.visible = showBones;
      // Force update matrices so Stage can compute bounding box before first render
      scene.updateMatrixWorld(true);
      helper.updateMatrixWorld(true);
    }
    return { skeletonHelper: helper, hasMeshes };
  }, [scene, isMotion, wireframeMode, showBones]);

  return (
    <group>
      <primitive object={scene} />
      {skeletonHelper && <primitive object={skeletonHelper} />}
      {!hasMeshes && (
        <mesh visible={false} scale={modelScale}>
          <boxGeometry args={[2, 2, 2]} />
        </mesh>
      )}
    </group>
  );
};

const FBXModel: React.FC<ModelProps> = ({ 
  url, isMotion, onAnimationsLoaded, onMaterialsLoaded, materialEdits, activeAnimation, showBones = true, wireframeMode = false, modelScale = 1, animationSpeed = 1, companionAnimations 
}) => {
  const fbx = useFBX(url);
  const combinedAnimations = useMemo(() => {
    const all = [...(fbx.animations || [])];
    if (companionAnimations) {
      companionAnimations.forEach(clip => {
        if (!all.some(c => c.name === clip.name)) {
          all.push(clip);
        }
      });
    }
    return all;
  }, [fbx.animations, companionAnimations]);
  const { actions } = useAnimations(combinedAnimations, fbx);
  const originalMaterials = useRef<Record<string, { 
    color: string; 
    roughness: number; 
    metalness: number;
    map?: THREE.Texture | null;
    normalMap?: THREE.Texture | null;
    roughnessMap?: THREE.Texture | null;
  }>>({});
  
  useEffect(() => {
    if (actions && Object.keys(actions).length > 0 && onAnimationsLoaded) {
      onAnimationsLoaded(Object.keys(actions));
    }
  }, [actions, onAnimationsLoaded]);

  useEffect(() => {
    if (actions && Object.keys(actions).length > 0) {
      // Stop all actions first
      Object.values(actions).forEach(action => action?.stop());
      
      const actionToPlay = activeAnimation ? actions[activeAnimation] : actions[Object.keys(actions)[0]];
      if (actionToPlay) {
        actionToPlay.play();
        actionToPlay.setEffectiveTimeScale(animationSpeed);
      }
    }
  }, [actions, activeAnimation, animationSpeed]);

  useEffect(() => {
    fbx.scale.setScalar(modelScale);
    fbx.updateMatrixWorld(true);
  }, [fbx, modelScale]);

  useEffect(() => {
    if (!fbx) return;
    const mats = extractMaterials(fbx);
    mats.forEach(m => {
      if (!originalMaterials.current[m.name]) {
        let actualMat: THREE.Material | null = null;
        fbx.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            if (mesh.material) {
              const findMat = (mat: THREE.Material) => {
                if (mat.name === m.name) {
                  actualMat = mat;
                }
              };
              if (Array.isArray(mesh.material)) {
                mesh.material.forEach(findMat);
              } else {
                findMat(mesh.material);
              }
            }
          }
        });

        originalMaterials.current[m.name] = {
          color: m.color,
          roughness: m.roughness,
          metalness: m.metalness,
          map: actualMat && 'map' in actualMat ? (actualMat as any).map : null,
          normalMap: actualMat && 'normalMap' in actualMat ? (actualMat as any).normalMap : null,
          roughnessMap: actualMat && 'roughnessMap' in actualMat ? (actualMat as any).roughnessMap : null,
        };
      }
    });

    if (onMaterialsLoaded) {
      onMaterialsLoaded(mats);
    }
  }, [fbx, onMaterialsLoaded]);

  useEffect(() => {
    if (!fbx) return;
    const textureLoader = new THREE.TextureLoader();

    fbx.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const meshChild = child as THREE.Mesh;
        const applyEdits = (mat: THREE.Material) => {
          if (!mat.name) return;
          const edit = materialEdits?.[mat.name] || materialEdits?.['all'];
          const original = originalMaterials.current[mat.name];

          if (edit) {
            if ('color' in mat && (mat as any).color instanceof THREE.Color) {
              (mat as any).color.set(edit.color);
            }
            if ('roughness' in mat) {
              (mat as any).roughness = edit.roughness;
            }
            if ('metalness' in mat) {
              (mat as any).metalness = edit.metalness;
            }

            // Apply Diffuse Map
            if ('map' in mat) {
              if (edit.map) {
                if (!(mat as any)._customMapUrl || (mat as any)._customMapUrl !== edit.map) {
                  (mat as any)._customMapUrl = edit.map;
                  textureLoader.load(edit.map, (tex) => {
                    tex.colorSpace = THREE.SRGBColorSpace;
                    tex.wrapS = THREE.RepeatWrapping;
                    tex.wrapT = THREE.RepeatWrapping;
                    (mat as any).map = tex;
                    mat.needsUpdate = true;
                  });
                }
              } else if (edit.map === null) {
                (mat as any).map = original?.map || null;
                (mat as any)._customMapUrl = null;
              }
            }

            // Apply Normal Map
            if ('normalMap' in mat) {
              if (edit.normalMap) {
                if (!(mat as any)._customNormalMapUrl || (mat as any)._customNormalMapUrl !== edit.normalMap) {
                  (mat as any)._customNormalMapUrl = edit.normalMap;
                  textureLoader.load(edit.normalMap, (tex) => {
                    tex.wrapS = THREE.RepeatWrapping;
                    tex.wrapT = THREE.RepeatWrapping;
                    (mat as any).normalMap = tex;
                    mat.needsUpdate = true;
                  });
                }
              } else if (edit.normalMap === null) {
                (mat as any).normalMap = original?.normalMap || null;
                (mat as any)._customNormalMapUrl = null;
              }
            }

            // Apply Roughness Map
            if ('roughnessMap' in mat) {
              if (edit.roughnessMap) {
                if (!(mat as any)._customRoughnessMapUrl || (mat as any)._customRoughnessMapUrl !== edit.roughnessMap) {
                  (mat as any)._customRoughnessMapUrl = edit.roughnessMap;
                  textureLoader.load(edit.roughnessMap, (tex) => {
                    tex.wrapS = THREE.RepeatWrapping;
                    tex.wrapT = THREE.RepeatWrapping;
                    (mat as any).roughnessMap = tex;
                    mat.needsUpdate = true;
                  });
                }
              } else if (edit.roughnessMap === null) {
                (mat as any).roughnessMap = original?.roughnessMap || null;
                (mat as any)._customRoughnessMapUrl = null;
              }
            }

            mat.needsUpdate = true;
          } else if (original) {
            if ('color' in mat && (mat as any).color instanceof THREE.Color) {
              (mat as any).color.set(original.color);
            }
            if ('roughness' in mat) {
              (mat as any).roughness = original.roughness;
            }
            if ('metalness' in mat) {
              (mat as any).metalness = original.metalness;
            }
            if ('map' in mat) {
              (mat as any).map = original.map || null;
              (mat as any)._customMapUrl = null;
            }
            if ('normalMap' in mat) {
              (mat as any).normalMap = original.normalMap || null;
              (mat as any)._customNormalMapUrl = null;
            }
            if ('roughnessMap' in mat) {
              (mat as any).roughnessMap = original.roughnessMap || null;
              (mat as any)._customRoughnessMapUrl = null;
            }
            mat.needsUpdate = true;
          }
        };
        if (meshChild.material) {
          if (Array.isArray(meshChild.material)) {
            meshChild.material.forEach(applyEdits);
          } else {
            applyEdits(meshChild.material);
          }
        }
      }
    });
  }, [fbx, materialEdits]);

  const { skeletonHelper, hasMeshes } = React.useMemo(() => {
    let hasBones = false;
    let hasMeshes = false;
    fbx.traverse((child) => {
      if ((child as THREE.Bone).isBone) hasBones = true;
      if ((child as THREE.Mesh).isMesh) {
        hasMeshes = true;
        const meshChild = child as THREE.Mesh;
        meshChild.visible = !isMotion; // Hide meshes if it's a motion asset
        if (meshChild.material) {
          if (Array.isArray(meshChild.material)) {
            meshChild.material.forEach(mat => {
               if ('wireframe' in mat) {
                 (mat as any).wireframe = wireframeMode;
                 (mat as any).needsUpdate = true;
               }
            });
          } else {
             if ('wireframe' in meshChild.material) {
               (meshChild.material as any).wireframe = wireframeMode;
               (meshChild.material as any).needsUpdate = true;
             }
          }
        }
      }
    });
    
    let helper = null;
    if (hasBones) { 
      helper = new THREE.SkeletonHelper(fbx);
      helper.visible = showBones;
      // Force update matrices so Stage can compute bounding box before first render
      fbx.updateMatrixWorld(true);
      helper.updateMatrixWorld(true);
    }
    return { skeletonHelper: helper, hasMeshes };
  }, [fbx, isMotion, wireframeMode, showBones]);

  return (
    <group>
      <primitive object={fbx} />
      {skeletonHelper && <primitive object={skeletonHelper} />}
      {!hasMeshes && (
        <mesh visible={false} scale={modelScale}>
          <boxGeometry args={[100, 100, 100]} />
        </mesh>
      )}
    </group>
  );
};

const ModelViewer: React.FC<{ 
  url: string; 
  name: string; 
  type: AssetType;
  companionMotionUrl?: string;
  companionMotionName?: string;
  onAnimationsLoaded?: (animations: string[]) => void;
  onMaterialsLoaded?: (materials: { name: string; color: string; roughness: number; metalness: number }[]) => void;
  materialEdits?: Record<string, MaterialEditValue>;
  activeAnimation?: string | null;
  showBones?: boolean;
  wireframeMode?: boolean;
  modelScale?: number;
  animationSpeed?: number;
  modelRotation?: number;
}> = ({ url, name, type, companionMotionUrl, companionMotionName, onAnimationsLoaded, onMaterialsLoaded, materialEdits, activeAnimation, showBones, wireframeMode, modelScale, animationSpeed, modelRotation = 0 }) => {
  const [previewUrl, setPreviewUrl] = useState(url);
  const isFBX = name.toLowerCase().endsWith('.fbx');
  const isMotion = type === 'motion1' || type === 'motion2';

  const [companionUrl, setCompanionUrl] = useState<string | null>(null);
  const [companionClips, setCompanionClips] = useState<THREE.AnimationClip[]>([]);

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
    } else {
      setPreviewUrl(url);
    }
  }, [url]);

  useEffect(() => {
    if (companionMotionUrl && companionMotionUrl.startsWith('data:')) {
      try {
        const parts = companionMotionUrl.split(',');
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
        setCompanionUrl(newUrl);
        return () => URL.revokeObjectURL(newUrl);
      } catch (e) {
        console.error('Failed to create companion blob:', e);
      }
    } else {
      setCompanionUrl(companionMotionUrl || null);
    }
  }, [companionMotionUrl]);

  return (
    <Stage environment="city" intensity={0.6} adjustCamera={true}>
      <Center>
        <group rotation={[0, modelRotation, 0]}>
          {companionUrl && companionMotionName && (
            <React.Suspense fallback={null}>
              <CompanionAnimationsLoader 
                url={companionUrl} 
                name={companionMotionName} 
                onLoaded={setCompanionClips} 
              />
            </React.Suspense>
          )}
          {isFBX ? (
            <FBXModel 
              url={previewUrl} 
              isMotion={isMotion} 
              onAnimationsLoaded={onAnimationsLoaded}
              onMaterialsLoaded={onMaterialsLoaded}
              materialEdits={materialEdits}
              activeAnimation={activeAnimation}
              showBones={showBones}
              wireframeMode={wireframeMode}
              modelScale={modelScale}
              animationSpeed={animationSpeed}
              companionAnimations={companionClips}
            />
          ) : (
            <GLTFModel 
              url={previewUrl} 
              isMotion={isMotion} 
              onAnimationsLoaded={onAnimationsLoaded}
              onMaterialsLoaded={onMaterialsLoaded}
              materialEdits={materialEdits}
              activeAnimation={activeAnimation}
              showBones={showBones}
              wireframeMode={wireframeMode}
              modelScale={modelScale}
              animationSpeed={animationSpeed}
              companionAnimations={companionClips}
            />
          )}
        </group>
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
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImageSize({ w: img.width, h: img.height });
      // Try to guess frame size if it's a common power of 2
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
    <div className="flex flex-col h-full">
      <div className="flex-1 flex items-center justify-center bg-slate-900/5 overflow-hidden rounded-2xl relative">
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
      
      <div className="mt-6 bg-white p-6 rounded-3xl border border-slate-100 shadow-xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-4 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-200"
            >
              {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
            </button>
            <button 
              onClick={() => setCurrentFrame(0)}
              className="p-4 bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 transition-all active:scale-95"
            >
              <RotateCcw className="w-6 h-6" />
            </button>
          </div>
          <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">FPS</span>
            <input 
              type="number" 
              value={fps} 
              onChange={(e) => setFps(Number(e.target.value))}
              className="w-12 bg-transparent text-sm font-black text-slate-900 focus:outline-none"
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
              className="w-full accent-indigo-600"
            />
            <div className="text-[10px] font-bold text-slate-900">{frameWidth}px</div>
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
              className="w-full accent-indigo-600"
            />
            <div className="text-[10px] font-bold text-slate-900">{frameHeight}px</div>
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
      <div className="w-full max-w-md bg-white rounded-[40px] p-10 shadow-2xl border border-slate-100 space-y-10">
        <div className="flex flex-col items-center gap-6">
          <div className="w-32 h-32 bg-indigo-50 rounded-[32px] flex items-center justify-center shadow-inner">
            <Volume2 className="w-16 h-16 text-indigo-600" />
          </div>
          <div className="text-center">
            <h4 className="text-xl font-black text-slate-900 tracking-tight">Audio Stream</h4>
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
            className="w-20 h-20 bg-indigo-600 text-white rounded-full flex items-center justify-center hover:bg-indigo-700 transition-all active:scale-95 shadow-2xl shadow-indigo-200"
          >
            {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
          </button>
        </div>
      </div>
    </div>
  );
};

const MATERIAL_PRESETS: Record<string, { color: string; roughness: number; metalness: number }> = {
  chrome: { color: '#e5e7eb', roughness: 0.05, metalness: 1.0 },
  rubber: { color: '#1e293b', roughness: 0.9, metalness: 0.0 },
  glass: { color: '#f1f5f9', roughness: 0.2, metalness: 0.1 },
  neon: { color: '#10b981', roughness: 0.3, metalness: 0.0 },
  gold: { color: '#fcd34d', roughness: 0.15, metalness: 0.9 },
  copper: { color: '#b45309', roughness: 0.2, metalness: 0.8 },
  plastic: { color: '#ef4444', roughness: 0.1, metalness: 0.0 },
  clay: { color: '#d97706', roughness: 0.95, metalness: 0.0 }
};



const GAME_ACTION_ROLES = ['idle', 'walk', 'run', 'attack', 'jump', 'hurt', 'die'];

export const AssetPreview: React.FC<AssetPreviewProps> = ({ asset, onClose, onUpdateAsset, allAssets = [] }) => {
  const is3D = asset.mimeType.includes('model') || asset.name.toLowerCase().endsWith('.glb') || asset.name.toLowerCase().endsWith('.gltf') || asset.name.toLowerCase().endsWith('.fbx');
  const isImage = asset.mimeType.includes('image');
  const isAudio = asset.mimeType.includes('audio');
  const isText = asset.type === 'dialogue' || asset.mimeType.includes('text');
  const isMotion = asset.type === 'motion1' || asset.type === 'motion2';

  const companionAsset = useMemo(() => {
    if (asset.type === 'character1') {
      return allAssets.find(a => a.type === 'motion1');
    }
    if (asset.type === 'character2') {
      return allAssets.find(a => a.type === 'motion2');
    }
    return undefined;
  }, [asset.type, allAssets]);

  const [animations, setAnimations] = useState<string[]>([]);
  const [animationMappings, setAnimationMappings] = useState<Record<string, string>>(
    asset.animationMappings || {}
  );

  const handleMapAnimation = (role: string, trackName: string) => {
    const updated = { ...animationMappings, [role]: trackName };
    setAnimationMappings(updated);
    if (onUpdateAsset) {
      onUpdateAsset({
        ...asset,
        animationMappings: updated
      });
    }
  };

  const handleUnmapAction = (role: string) => {
    const updated = { ...animationMappings };
    delete updated[role];
    setAnimationMappings(updated);
    if (onUpdateAsset) {
      onUpdateAsset({
        ...asset,
        animationMappings: updated
      });
    }
  };
  const [activeAnimation, setActiveAnimation] = useState<string | null>(null);
  const [showGridFloor, setShowGridFloor] = useState(true);
  const [showBones, setShowBones] = useState(isMotion);
  const [wireframeMode, setWireframeMode] = useState(false);
  const [modelScale, setModelScale] = useState(1);
  const [animationSpeed, setAnimationSpeed] = useState(1);
  const [modelRotation, setModelRotation] = useState(0);

  // Material property editing states
  const [materials, setMaterials] = useState<{ name: string; color: string; roughness: number; metalness: number }[]>([]);
  const [selectedMaterial, setSelectedMaterial] = useState<string>('all');
  const [materialEdits, setMaterialEdits] = useState<Record<string, MaterialEditValue>>({});

  const handleMaterialsLoaded = useCallback((loadedMaterials: { name: string; color: string; roughness: number; metalness: number }[]) => {
    setMaterials(loadedMaterials);
  }, []);

  const currentProperties = useMemo(() => {
    if (selectedMaterial === 'all') {
      return materialEdits['all'] || { color: '#ffffff', roughness: 0.5, metalness: 0.0, map: null, normalMap: null, roughnessMap: null };
    }
    const edit = materialEdits[selectedMaterial];
    if (edit) {
      return {
        color: edit.color,
        roughness: edit.roughness,
        metalness: edit.metalness,
        map: edit.map || null,
        normalMap: edit.normalMap || null,
        roughnessMap: edit.roughnessMap || null
      };
    }
    
    const original = materials.find(m => m.name === selectedMaterial);
    return {
      color: original?.color || '#ffffff',
      roughness: original?.roughness ?? 0.5,
      metalness: original?.metalness ?? 0.0,
      map: null,
      normalMap: null,
      roughnessMap: null
    };
  }, [selectedMaterial, materialEdits, materials]);

  const currentPresetKey = useMemo(() => {
    const cp = currentProperties;
    for (const [key, preset] of Object.entries(MATERIAL_PRESETS)) {
      if (
        cp.color.toLowerCase() === preset.color.toLowerCase() &&
        Math.abs(cp.roughness - preset.roughness) < 0.01 &&
        Math.abs(cp.metalness - preset.metalness) < 0.01
      ) {
        return key;
      }
    }
    return 'custom';
  }, [currentProperties]);

  const handleApplyPreset = (presetKey: string) => {
    if (presetKey === 'custom') return;
    const preset = MATERIAL_PRESETS[presetKey];
    if (preset) {
      setMaterialEdits(prev => {
        const current = currentProperties;
        const updated = {
          ...current,
          color: preset.color,
          roughness: preset.roughness,
          metalness: preset.metalness
        };
        return {
          ...prev,
          [selectedMaterial]: updated
        };
      });
    }
  };

  const handlePropertyChange = (property: keyof MaterialEditValue, value: any) => {
    setMaterialEdits(prev => {
      const current = currentProperties;
      const updated = { ...current, [property]: value };
      
      return {
        ...prev,
        [selectedMaterial]: updated
      };
    });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-white animate-in fade-in">
      {is3D ? (
        <div className="w-full h-full flex overflow-hidden">
          {/* Left Sidebar */}
          <div className="w-[320px] shrink-0 border-r border-slate-100 flex flex-col bg-white overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900">Exit Workstation</span>
              <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-full transition-colors text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-10">
              <div className="flex items-center gap-4 p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                <div className="w-12 h-12 bg-indigo-50/80 rounded-2xl flex items-center justify-center shrink-0 shadow-sm">
                  <Compass className="w-6 h-6 text-indigo-600" />
                </div>
                <div className="flex flex-col min-w-0">
                  <h3 className="text-xs font-black text-slate-900 tracking-tight truncate">{asset.name}</h3>
                  <p className="text-[9px] font-black uppercase tracking-widest text-indigo-600 mt-0.5">{asset.type.toUpperCase()}</p>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-400">Visual Shaders</h4>
                <div className="space-y-2">
                  <button 
                    onClick={() => setShowGridFloor(!showGridFloor)}
                    className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 ${showGridFloor ? 'bg-indigo-50 border-indigo-100 text-indigo-600 shadow-sm' : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200'}`}
                  >
                    <span>SHOW GRID FLOOR</span>
                    <Grid className="w-4 h-4 shrink-0" />
                  </button>
                  <button 
                    onClick={() => setShowBones(!showBones)}
                    className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 ${showBones ? 'bg-indigo-50 border-indigo-100 text-indigo-600 shadow-sm' : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200'}`}
                  >
                    <span>SHOW BONES / SKELETON</span>
                    <Activity className="w-4 h-4 shrink-0" />
                  </button>
                  <button 
                    onClick={() => setWireframeMode(!wireframeMode)}
                    className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 ${wireframeMode ? 'bg-indigo-50 border-indigo-100 text-indigo-600 shadow-sm' : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200'}`}
                  >
                    <span>WIREFRAME MODE</span>
                    <Eye className="w-4 h-4 shrink-0" />
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-400">Model Scale</h4>
                <div className="flex gap-1.5">
                  {[0.01, 0.1, 1, 5, 10].map(scale => (
                    <button
                      key={scale}
                      onClick={() => setModelScale(scale)}
                      className={`flex-1 py-2 rounded-xl border text-[9px] font-black uppercase tracking-tight transition-all active:scale-95 ${modelScale === scale ? 'bg-indigo-50 border-indigo-100 text-indigo-600 shadow-sm' : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200'}`}
                    >
                      {scale}X
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-400">Animation Speed</h4>
                <div className="flex gap-1.5">
                  {[0.25, 0.5, 1, 1.5, 2].map(speed => (
                    <button
                      key={speed}
                      onClick={() => setAnimationSpeed(speed)}
                      className={`flex-1 py-2 rounded-xl border text-[9px] font-black uppercase tracking-tight transition-all active:scale-95 ${animationSpeed === speed ? 'bg-indigo-50 border-indigo-100 text-indigo-600 shadow-sm' : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200'}`}
                    >
                      {speed}X
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-400">Manual Rotation</h4>
                  <span className="text-[10px] font-black tracking-wider text-indigo-600">{Math.round((modelRotation * 180) / Math.PI)}°</span>
                </div>
                <input 
                  type="range" 
                  min="-3.1415" 
                  max="3.1415" 
                  step="0.01"
                  value={modelRotation} 
                  onChange={(e) => setModelRotation(Number(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-slate-100 rounded-lg appearance-none"
                />
                <div className="flex justify-between text-[8px] font-black text-slate-400 tracking-wider uppercase">
                  <span>-180°</span>
                  <button 
                    onClick={() => setModelRotation(0)}
                    className="text-indigo-600 hover:underline transition-all"
                  >
                    RESET
                  </button>
                  <span>180°</span>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-[9px] font-black uppercase tracking-[0.25em] text-slate-400">Properties</h4>
                <div className="space-y-2 text-[10px] font-bold text-slate-600">
                  <div className="flex justify-between items-center py-1 border-b border-slate-50">
                    <span className="text-slate-400 text-[9px] font-black uppercase tracking-wider">MIME-TYPE</span>
                    <span className="uppercase text-[10px] font-extrabold text-slate-800 truncate max-w-[150px]" title={asset.mimeType}>{asset.mimeType}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-50">
                    <span className="text-slate-400 text-[9px] font-black uppercase tracking-wider">CATEGORY</span>
                    <span className="uppercase text-[10px] font-extrabold text-slate-800">{asset.category || 'NONE'}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-400 text-[9px] font-black uppercase tracking-wider">OPTIMIZED</span>
                    <span className={`uppercase text-[10px] font-extrabold ${asset.isOptimized ? 'text-emerald-600' : 'text-orange-500'}`}>{asset.isOptimized ? 'YES' : 'NO'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Center Canvas */}
          <div className="flex-1 relative" style={{ background: 'radial-gradient(circle, #f8fafc 0%, #edf2f7 100%)' }}>
            <Canvas shadows camera={{ position: [0, 2, 8], fov: 45 }}>
              <ambientLight intensity={0.8} />
              <pointLight position={[10, 10, 10]} intensity={1} />
              <spotLight position={[-10, 10, 10]} angle={0.15} penumbra={1} intensity={1} />
              {showGridFloor && (
                <gridHelper args={[20, 20, '#6366f1', '#e2e8f0']} />
              )}
              <React.Suspense fallback={<LoadingOverlay />}>
                <ModelViewer 
                  url={asset.content} 
                  name={asset.name} 
                  type={asset.type}
                  companionMotionUrl={companionAsset?.content}
                  companionMotionName={companionAsset?.name}
                  onAnimationsLoaded={setAnimations}
                  onMaterialsLoaded={handleMaterialsLoaded}
                  materialEdits={materialEdits}
                  activeAnimation={activeAnimation}
                  showBones={showBones}
                  wireframeMode={wireframeMode}
                  modelScale={modelScale}
                  animationSpeed={animationSpeed}
                  modelRotation={modelRotation}
                />
              </React.Suspense>
              <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 1.75} />
            </Canvas>
            <div className="absolute bottom-10 left-10">
              <button 
                onClick={() => {
                  setModelScale(1);
                  setAnimationSpeed(1);
                  setModelRotation(0);
                  setShowGridFloor(true);
                  setShowBones(isMotion);
                  setWireframeMode(false);
                  setMaterialEdits({});
                  setSelectedMaterial('all');
                }}
                className="flex items-center gap-2.5 px-6 py-3.5 bg-white border border-slate-100 rounded-2xl shadow-xl hover:bg-slate-50 active:scale-95 transition-all text-[11px] font-black uppercase tracking-[0.15em] text-slate-800"
              >
                <Compass className="w-4 h-4 text-indigo-600" />
                Reset Workstation
              </button>
            </div>
          </div>

          {/* Right Sidebar - Animation Tracks */}
          <div className="w-[320px] shrink-0 border-l border-slate-100 flex flex-col bg-white overflow-y-auto divide-y divide-slate-100">
            {/* Animation Tracks Section */}
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2.5">
                <Play className="w-4 h-4 text-indigo-600" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900">Animation Tracks</span>
              </div>
              <div className="space-y-2.5">
                {animations.length === 0 ? (
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-300 text-center py-12 italic">No animation tracks</div>
                ) : (
                  animations.map((anim) => {
                    const isActive = activeAnimation === anim || (activeAnimation === null && anim === animations[0]);
                    const isMesh = asset.type === 'character1' || asset.type === 'character2';
                    const mappedRoles = isMesh
                      ? Object.entries(animationMappings)
                          .filter(([_, track]) => track === anim)
                          .map(([role]) => role)
                      : [];
                    return (
                      <button
                        key={anim}
                        onClick={() => setActiveAnimation(anim)}
                        className={`w-full flex flex-col px-5 py-4 rounded-2xl border transition-all text-left active:scale-95 gap-2.5 ${isActive ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-200/50' : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200 hover:text-slate-700'}`}
                      >
                        <div className="w-full flex items-center justify-between min-w-0">
                          <div className="flex items-center gap-3 min-w-0">
                            <Play className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white fill-white' : 'text-slate-400'}`} />
                            <span className="text-[10px] font-black uppercase tracking-widest truncate">{anim}</span>
                          </div>
                          {isActive && (
                            <div className="w-2 h-2 rounded-full bg-white shrink-0 shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
                          )}
                        </div>
                        {mappedRoles.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {mappedRoles.map((role) => (
                              <span 
                                key={role} 
                                className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                                  isActive 
                                    ? 'bg-white/20 text-white border-white/25' 
                                    : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                }`}
                              >
                                {role}
                              </span>
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Map Active Track Section */}
            {activeAnimation && (asset.type === 'character1' || asset.type === 'character2') && (
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-2.5">
                  <Settings2 className="w-4 h-4 text-indigo-600" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900">Bind Game Action</span>
                </div>
                <p className="text-[10px] text-slate-400 font-bold leading-relaxed">
                  Assign "<span className="font-extrabold text-slate-700">{activeAnimation}</span>" to a specific role. The AI uses these precise tracks to rig and animate character behaviors in-game.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {GAME_ACTION_ROLES.map((role) => {
                    const isMappedToThisTrack = animationMappings[role] === activeAnimation;
                    const mappedTrack = animationMappings[role];
                    return (
                      <button
                        key={role}
                        onClick={() => {
                          if (isMappedToThisTrack) {
                            handleUnmapAction(role);
                          } else {
                            handleMapAnimation(role, activeAnimation);
                          }
                        }}
                        className={`px-3 py-2.5 rounded-xl border text-[10px] font-black uppercase tracking-wider text-left transition-all active:scale-95 flex flex-col justify-between h-[52px] ${
                          isMappedToThisTrack
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm'
                            : mappedTrack
                            ? 'bg-slate-50 border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-500'
                            : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200 hover:text-slate-700'
                        }`}
                      >
                        <span className="block font-black">{role}</span>
                        <span className="block text-[8px] font-extrabold truncate w-full mt-0.5">
                          {isMappedToThisTrack ? '✓ ACTIVE' : mappedTrack ? `Bound: ${mappedTrack}` : 'UNBOUND'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white w-full max-w-5xl h-full max-h-[90vh] md:max-h-[85vh] rounded-3xl md:rounded-[48px] shadow-2xl overflow-hidden flex flex-col border border-slate-100 animate-in zoom-in-95 duration-300">
          <div className="flex items-center justify-between px-6 py-4 md:px-10 md:py-8 bg-white shrink-0 border-b border-slate-50">
            <div className="flex items-center gap-3 md:gap-6 min-w-0">
              <div className="w-10 h-10 md:w-14 md:h-14 bg-indigo-50 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0">
                <Maximize2 className="w-5 h-5 md:w-7 md:h-7 text-indigo-600" />
              </div>
              <div className="flex flex-col min-w-0">
                <h3 className="text-lg md:text-2xl font-black text-slate-900 tracking-tight leading-none mb-1 md:mb-1.5 truncate">{asset.name}</h3>
                <p className="text-[10px] md:text-xs font-black uppercase tracking-widest text-slate-400 truncate">{asset.type} • {asset.mimeType}</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="w-10 h-10 md:w-14 md:h-14 bg-white border border-slate-200 text-slate-400 rounded-full flex items-center justify-center hover:bg-slate-50 hover:text-slate-900 transition-all active:scale-95 shadow-lg shrink-0 ml-4"
            >
              <X className="w-5 h-5 md:w-8 md:h-8" />
            </button>
          </div>

          <div className="flex-1 overflow-hidden relative bg-white">
            <div className="p-10 h-full overflow-auto">
              {isImage && <SpritePreview url={asset.content} />}
              {isAudio && <AudioPreview url={asset.content} />}
              {isText && (
                <div className="flex flex-col items-center justify-center h-full">
                  <div className="w-full max-w-2xl bg-white rounded-[40px] p-12 shadow-2xl border border-slate-100 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-indigo-600" />
                    <div className="flex items-center gap-4 mb-8">
                      <div className="p-3 bg-indigo-50 rounded-2xl">
                        <MessageSquare className="w-6 h-6 text-indigo-600" />
                      </div>
                      <h4 className="text-xl font-black text-slate-900 tracking-tight">Logic Node Content</h4>
                    </div>
                    <div className="bg-slate-50 rounded-3xl p-8 border border-slate-100">
                      <p className="text-lg font-medium text-slate-700 leading-relaxed italic">
                        "{asset.content}"
                      </p>
                    </div>
                    <div className="mt-8 flex justify-end">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">Behavioral Data Node</span>
                    </div>
                  </div>
                </div>
              )}
              {!isImage && !isAudio && !isText && (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4">
                  <div className="w-20 h-20 bg-slate-100 rounded-[24px] flex items-center justify-center">
                    <Settings2 className="w-10 h-10" />
                  </div>
                  <p className="text-sm font-black uppercase tracking-[0.2em]">No Preview Available</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
