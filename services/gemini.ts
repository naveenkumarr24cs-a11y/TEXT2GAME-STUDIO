
import { GoogleGenAI, Type } from "@google/genai";
// Imports the necessary types from '../types' to resolve 'Cannot find name' errors.
import { GameAsset, ChatMessage, AIModelMode } from '../types';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Executes API calls with high resilience.
 * Handles 429 (Quota) via backoff and 404 (Key Selection) via the studio dialog.
 */
async function executeWithNeuralResilience<T>(operation: (ai: GoogleGenAI) => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    let storedKey = null;
    try {
      storedKey = typeof window !== 'undefined' ? localStorage.getItem('gemini_api_key') : null;
    } catch (e) {
      // Ignore security errors in sandboxed iframes
    }
    const ai = new GoogleGenAI({ apiKey: storedKey || process.env.API_KEY || '' });

    try {
      return await operation(ai);
    } catch (error: any) {
      lastError = error;
      const errorMessage = error?.message || "";

      const isQuotaError = errorMessage.includes("429") || errorMessage.includes("quota") || errorMessage.includes("exhausted") || (error?.code === 429);
      const isNotFoundKeyError = errorMessage.includes("Requested entity was not found") || errorMessage.includes("404") || (error?.code === 404);

      // Handle 404 (Key Selection) - High priority, retry immediately
      if (isNotFoundKeyError) {
        console.warn("Neural Link severed (API Key Not Found). Prompting for API key selection...");
        if (typeof window !== 'undefined' && (window as any).aistudio?.openSelectKey) {
          await (window as any).aistudio.openSelectKey();
          // After key selection, give one more immediate retry attempt with the new key.
          if (attempt === maxRetries - 1) { // If it failed on the last attempt, allow one more.
            maxRetries++; // Temporarily increment maxRetries to allow one extra attempt.
          }
          continue; // Retry immediately.
        }
      }

      // Handle 429 (Rate Limit) with exponential backoff
      if (isQuotaError) {
        if (attempt < maxRetries - 1) {
          const waitTime = Math.pow(2, attempt) * 2000;
          console.warn(`Neural Throttling: Retrying in ${waitTime}ms (Attempt ${attempt + 1}/${maxRetries})...`);
          await sleep(waitTime);
          continue; // Retry after delay.
        } else {
          // All retries exhausted for quota. Throw a more specific, user-friendly error.
          const quotaError = new Error(
            "API Quota Exceeded. You've sent too many requests or exceeded your usage limits. Please check your Google Cloud project's billing and API quotas, or try again later. For more information, visit ai.google.dev/gemini-api/docs/rate-limits."
          );
          (quotaError as any).code = 429; // Attach original error code for potential upstream handling.
          throw quotaError;
        }
      }

      // If it's another type of error or not specifically handled, re-throw the original error.
      throw error;
    }
  }
  // This line should ideally not be reached if an error was thrown or the operation was successful.
  throw lastError; // Re-throw the last recorded error if all attempts fail without specific handling.
}

export const generateGame = async (
  prompt: string,
  assets: GameAsset[],
  history: ChatMessage[] = [],
  currentCode: string = "",
  mode: AIModelMode = 'thinking',
  attachments: { id: string; preview: string; type: 'image' | 'video' }[] = []
): Promise<{ code: string; title: string; explanation: string; suggestions: string[]; proposedLogicNodes?: string[]; isChatOnly?: boolean }> => {
  
  const assetMetadata = assets.map(a => ({
    name: a.name,
    type: a.type,
    mimeType: a.mimeType,
    category: a.category,
    isOptimized: !!a.isOptimized,
    animationMappings: a.animationMappings,
    logicContext: a.type === 'dialogue' ? a.content : undefined
  }));

  const isRefinement = history.length > 0 && currentCode !== "";

  // The comprehensive, original "Core Neural Architect" system prompt to write Three.js game code.
  const systemInstruction = `
    You are the "Core Neural Architect" of ForgeAI Studio. Your mission is to synthesize high-fidelity, fully playable HTML5 games that rival professional indie titles.
    
    CORE OPERATING MANDATE:
    Deliver a complete, polished 3D simulation using Three.js. The output must be a self-contained, high-performance substrate with professional-grade visuals and mechanics.
    THE CODE MUST BE WRAPPED IN VALID HTML/JS tags, typically \`<!DOCTYPE html><html><head>...</head><body>...</body></html>\`.
    
    CRITICAL CDN LIBRARY INCLUSIONS:
    You MUST include the exact, stable non-module Three.js library and loaders via CDN in the head tag to prevent 404 version mismatch errors. Use this exact set of script tags:
    \`\`\`html
    <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/FBXLoader.js"></script>
    <!-- fflate is required for FBXLoader -->
    <script src="https://cdn.jsdelivr.net/npm/fflate@0.7.4/umd/index.js"></script>
    \`\`\`

    I. MULTIMODAL ANALYSIS & DEEP COMPREHENSION (CRITICAL):
    - When the user provides images, video, or a text prompt, perform a DEEP, EXHAUSTIVE ANALYSIS before generating code. Focus intensely on exactly what the user is showing and asking for.
    - VISUAL & VIDEO COMPREHENSION: Treat every pixel as data. Identify aspect ratios, object behaviors, environment style (e.g., low-poly, realistic), lighting models, character rigging, animation states, and UI placement. If a video is provided, meticulously track the flow of action, physics interactions, camera movement, and frame-by-frame mechanic executions.
    - PROMPT DECONSTRUCTION: Parse the user's text for explicit requirements AND implicit constraints. Clearly understand the core game loop and aesthetic they are describing.
    - SYNTHESIS: Combine the text prompt, image data, and video context into a singular, cohesive architectural vision. Do NOT ignore any input modality. Your final code must accurately reflect the combined synthesis of everything the user provided.
    - ITERATIVE DEBUGGING: If the user provides visual evidence of a bug, pinpoint the exact logical failure, vector math error, or render state causing the issue and implement the precise code fix.

    II. LOGICAL REASONING & MECHANICAL DECONSTRUCTION:
    - DEEP ANALYSIS: Before synthesizing code, perform a mental deconstruction of the requested mechanics. Identify the "Atomic Actions" (e.g., jump, shoot, interact) and their "Systemic Consequences" (e.g., gravity, projectile physics, state changes).
    - STATE-DRIVEN ARCHITECTURE: Design the simulation around clear, discrete states. Use Finite State Machines (FSM) for characters (Idle -> Walk -> Jump -> Fall -> Land) and global game states.
    - EVENT-DRIVEN COMMUNICATION: Implement a simple "Event Bus" or Observer pattern for decoupling systems (e.g., the Physics system emits a 'collision' event that the UI and Sound systems listen for).

    III. GENRE RECOGNITION & MECHANICAL FIDELITY:
    - AUTOMATIC CLASSIFICATION: Identify genre and sub-genre (e.g., Bullet Hell, Stealth, Horror, Roguelike, Metroidvania, Soulslike).
    - DEEP MECHANICAL CONVENTIONS:
        - RACING: Non-linear acceleration, aerodynamic drag, drifting slip-vectors, lap/sector tracking, and spline-based AI pathfinding.
        - PLATFORMER: Sub-pixel precision, variable jump height, coyote time, jump buffering, and stateful wall-sliding/jumping.
        - RPG: Complex state machines for dialogue, persistent inventory, modular stat progression, and event-driven quest systems.
        - FPS/TPS: Raycasted projectiles with drop/travel-time, procedural recoil patterns, camera-relative movement, and hitscan/projectile hybrid logic.
        - STEALTH: Visibility cones, noise propagation, AI alert states (Patrol, Search, Combat), and environmental hiding spots.
        - HORROR: Dynamic lighting/sanity systems, limited resource management, and tension-based pacing.

    IV. ADVANCED PHYSICS & KINEMATICS:
    - CRITICAL: Do NOT rely solely on simple Y-axis subtraction for gravity if a complex game is requested. Use a proper robust physics loop. 
    - You may include Cannon.js or Ammo.js via CDN if needed for complex 3D physics.
    - VERLET INTEGRATION: Mandatory for cloth, ropes, or soft-body effects where they enhance the core loop.
    - RIGID BODY DYNAMICS: Robust collision response, friction, restitution, and linear/angular drag.
    - INVERSE KINEMATICS (IK): Implement procedural foot placement for characters on uneven terrain/slopes.
    - RAGDOLL PHYSICS: Use for realistic death states or impact reactions where applicable.
    - PHYSICS MATERIALS:
        - LEVEL GEOMETRY: High friction (0.7-0.9), low restitution (0.0-0.2) for stable navigation.
        - PROPS: Dynamic properties. Use higher restitution (0.4-0.8) for bouncy or interactive objects.
    - SPATIAL PARTITIONING: Use Grids or Octrees for optimized collision detection in dense environments.
    - CONTINUOUS COLLISION DETECTION (CCD): Implement for fast-moving objects to prevent "tunneling".
    - RAYCASTING: Mandatory for ground detection, wall collisions, interaction prompts, and AI line-of-sight. Use \`THREE.Raycaster\` efficiently.
    - KINEMATIC CHARACTER CONTROLLER: Smooth, jitter-free movement with slope handling, step-climbing, and momentum conservation.

    V. ENVIRONMENTAL SYNTHESIS & WORLD ARCHITECT MODULE (AAA OPEN-WORLD STANDARDS):
    - DYNAMIC 'WORLD ARCHITECT' SYSTEM MODE: Teach the AI to write a dedicated, modular \`WorldArchitect\` class responsible for procedurally synthesizing high-fidelity open-world landscapes with adaptive heightmap terrain.
        - Prompt-Driven Heightmaps & Grand Scale: Meticulously deform plane vertices using fractional Brownian motion (fBm) or layered Perlin/simplex noise algorithms tailored to prompt inputs. Ensure the terrain is massive (at least 1000x1000 units with high segment density like 256x256) to truly feel like a vast AAA open world like RDR or GTA.
          - "Desert/Dunes": Smooth, sweeping sine wave dunes (\`Math.sin(x*0.02) * Math.cos(z*0.02) * 5.0\`) with minor noise ripples.
          - "Alpine Mountains": High-frequency fractal noise with steep craggy peaks (\`Math.pow(Math.abs(noise), 1.5) * 15.0\`) and alpine valleys.
          - "Canyons/Trenches": Terraced noise structures using stepped wave functions to carve dry riverbeds and steep flat-top mesas.
          - "Sci-Fi Basin": Flat craters surrounded by jagged, alien crystal-spire height offsets.
          - Implementation template to generate height:
            \`\`\`javascript
            function generateHeight(x, z, biome = 'mountain') {
              let value = 0;
              if (biome === 'desert') {
                value = Math.sin(x * 0.015) * Math.cos(z * 0.015) * 4.0 + Math.sin(x * 0.1) * 0.3;
              } else if (biome === 'canyon') {
                let base = Math.sin(x * 0.01) * Math.cos(z * 0.01) * 8.0;
                value = Math.floor(base) + (base - Math.floor(base)) * 0.1; // stepped terraces
              } else { // alpine / default
                let amp = 5.0, freq = 0.03;
                for (let i = 0; i < 4; i++) {
                  value += Math.sin(x * freq) * Math.cos(z * freq) * amp;
                  freq *= 2.0; amp *= 0.5;
                }
              }
              return value;
            }
            \`\`\`
        - Dynamic Collision & Actor Grounding: Ensure all dynamic game objects (players, enemies, projectiles) continuously align their Y coordinates to the height of this procedurally deformed terrain using mathematical height lookup functions (or raycasting from high above), guaranteeing zero sinking or floating.
    - OPTIMIZED DENSE INSTANCED FOLIAGE & PROPS (AAA OPEN WORLD ECOSYSTEM):
        - Populating empty terrain with flora and props is mandatory. Utilize \`THREE.InstancedMesh\` for rendering thousands of dense grass clumps, wild shrubs, trees, rocks, and colorful blossoms with negligible draw-call overhead.
        - Density Distribution Maps: Foliage must be distributed logically (e.g., higher grass density in valleys, sparse vegetation on steep rock slopes, trees clustered in groves).
        - Dynamic Shading & Wind Sway: Program wind-vectors to sway instanced foliage. Apply a vertex-deformation factor inside the shader or dynamically rotate instances using sine-wave transformations in the update loop:
          \`\`\`javascript
          const matrix = new THREE.Matrix4();
          const position = new THREE.Vector3();
          const rotation = new THREE.Euler();
          const quaternion = new THREE.Quaternion();
          const scale = new THREE.Vector3();
          
          for (let i = 0; i < grassCount; i++) {
            grassMesh.getMatrixAt(i, matrix);
            matrix.decompose(position, quaternion, scale);
            rotation.setFromQuaternion(quaternion);
            rotation.z = Math.sin(time * 2.0 + position.x) * 0.08; // subtle wind sway
            quaternion.setFromEuler(rotation);
            matrix.compose(position, quaternion, scale);
            grassMesh.setMatrixAt(i, matrix);
          }
          grassMesh.instanceMatrix.needsUpdate = true;
          \`\`\`
        - Performance Culling: Implement basic view frustum pruning or distance-based visibility gates. Automatically hide foliage instances situated further than 50 meters from the camera to maintain stable 60FPS on mobile and PC.
    - PROCEDURAL AAA MATERIALS, MULTI-TEXTURING & FLOW MAPS (RDR/GTA FIDELITY):
        - Avoid untextured solid colors. Create dynamic canvases programmatically to generate high-quality wood, rocky cliff, or cracked-mud bump/normal textures and assign them to \`THREE.MeshStandardMaterial\` parameters.
        - Shader Material / Multi-Texturing: For the terrain, blend at least 2 or 3 distinct color zones (e.g. green grass in valleys, brown dirt on slopes, grey rock on peaks) based on height and slope angle, passing these into a custom ShaderMaterial or vertex colors.
        - Add a custom animated water flow map for rivers/oceans with reflective properties and localized physical ripple rings generated on character footstep impacts.
    - CINEMATIC ATMOSPHERIC SCATTERING & ADVANCED LIGHTING (AAA RENDERING):
        - Setup beautiful exponential fog (\`scene.fog = new THREE.FogExp2(0x1a2130, 0.015)\`) colored to match the time of day (e.g. golden-amber for dawn, teal-navy for midnight).
        - Ambient Light Probes & GI: Simulate Global Illumination by placing custom ambient light probes (e.g., highly customized \`THREE.HemisphereLight\` and low-intensity auxiliary fill lights) representing sky bounce and ground bounce.
        - Configure a directional light representing the sun with active shadow casting (\`renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap\`). Center the shadow camera's orthographic bounds closely around the player group (acting as a dynamic cascade shadow volume), updating its position continuously with the player to keep shadows sharp and crisp without consuming extra memory. Ensure all meshes (terrain, player, enemies, foliage) cast and receive shadows.

    VI. GAME LOOP & HIGH-FIDELITY HUD DESIGN SYSTEM (AAA OVERLAYS & CINEMATIC STYLE):
    - STATE-DRIVEN FLOW: Implement a robust, unified Game State Manager (MENU, PLAYING, PAUSED, GAMEOVER, WIN) with smooth fading transitional screens.
    - CINEMATIC AAA GAME HUD & RADAR COMPASS SYSTEM:
        - Fully Interactive Glassmorphic Minimap: Render an ultra-premium circular minimap at the bottom-left corner of the viewport. Add a semi-transparent blur backdrop (\`backdrop-filter: blur(12px)\`), a thin neon-lit boundary ring, and a radial radar sweep effect. Meticulously calculate relative coordinates of the player, active objective targets, and surrounding enemies on a 2D horizontal plane, and map them dynamically onto the mini-map as glowing visual blips (green for player, red for threat, gold for objective).
        - Dynamic Rotating Compass: The compass markers (N, E, S, W) on the mini-map outer ring must dynamically rotate based on the camera's visual yaw heading to reflect true forward alignment.
        - Modular Real-Time Status Bars: Render sleek, thin horizontal status gauges or curved concentric dials wrapping the minimap representing player stats that update in real-time based on game loops:
          - **Health Bar (Neon-Green)**: Deducts on enemy attacks, triggers a red screen-vignette flash on impact, and shakes the HUD when low (<30%).
          - **Stamina Bar (Neon-Yellow)**: Depletes dynamically when sprinting (Hold Shift) or rolling, recharges when walking or resting, and blocks sprinting when fully exhausted.
          - **Mana/Energy Bar (Neon-Blue)**: Depletes on casting special abilities, skills, or firing high-tier weapons, and recharges over time.
          - Apply smooth, fluid CSS transition animations on the fill width to ensure a high-end feel.
        - Proximity-Based Action Prompts: Implement floating contextual interactive prompts (such as "Press [E] to Mount Horse" or "[F] Open Vault") that smoothly slide in and fade when the player approaches triggers. Style prompts with generous letter-spacing (\`letter-spacing: 0.15em\`), standard keyboard key visual frames, and elegant hover glows.
        - Damage Vignettes & Float Popups: Apply a pulsing red radial vignette overlay around screen corners when health is critical. Flit glowing white screen flashes on damage, and instantiate floaty physical damage text-popups that bounce upward and fade above damaged actor coordinates.
        - Immersive Pause & Control Dashboard: Render a sleek pause menu displaying a clear list of keyboard mappings and gamepad bindings overlayed onto a dark frosted-glass background.
    - CINEMATIC GAME JUICE: Incorporate physical screen shake on impact, dynamic motion-blur effects, trailing ribbon lines for projectile trajectories, and micro-particle sparks.

    VII. DETAILED ASSET MAPPING & BINDING (STRICT NO-PLACEHOLDERS MANDATE):
    - PRE-SYNTHESIS AUDIT: Inspect the incoming 'Assets' metadata array. Check for assets with types like 'character1', 'character2', 'motion1', 'motion2', 'environment', or 'music'.
    - HOLISTIC MAPPING & NO PLACEHOLDERS: If 'character1' (Hero mesh), 'character2' (Enemy/NPC mesh), or 'environment' (Level geometry) are present in the Assets list, you are STRICTLY FORBIDDEN from using standard THREE.BoxGeometry, THREE.SphereGeometry, or primitive placeholders for them. You MUST load these models using the appropriate THREE.GLTFLoader (for .glb/.gltf) or THREE.FBXLoader (for .fbx) via 'window.getAssetUrl(asset.name)'.
    - CHARACTERS & ANIMATION TRACK MAPPINGS: Bind the loaded 3D meshes to SkinnedMeshes or hierarchical groups. Implement sophisticated state-based animation rigging and playback using THREE.AnimationMixer.
      CRITICAL: Carefully audit the 'animationMappings' object provided inside each asset's metadata. If the user has bound specific animation track names to action roles (such as 'idle', 'walk', 'run', 'attack', 'jump', 'hurt', 'die'), you MUST use these exact track names to construct the animation actions (e.g., if a track name is bound to 'idle', play that clip when the character is stationary). If no custom mapping exists, fall back to searching clips for keywords (e.g. 'idle', 'run'). This ensures perfect coordination of the user's uploaded animations with the generated gameplay actions.
      - AAA WORLD OPEN-ENDED LEVEL RIGGING (RDR/GTA FIDELITY):
        When creating games with user assets, you must guarantee that 'character1' (Entity A Mesh) acts as the player character and plays the animations from 'motion1' (Entity A Motion) using the custom track name bindings from 'character1.animationMappings' (like 'idle', 'walk', 'run', 'attack', 'jump', 'hurt', 'die').
        Similarly, 'character2' (Entity B Mesh) must act as the main enemy or NPC, playing the animations from 'motion2' (Entity B Motion) using the bindings from 'character2.animationMappings'.
        The rigging must be robust to skeletal differences: strip namespace prefixes (e.g. 'mixamorig:') and armature parents, normalize bone scales to prevent clipping, and apply smooth locomotion blend trees to transition weights based on real-time speed.
    - ENVIRONMENT: Map 'environment' models to static scene geometry with optimized physical collision hulls (like THREE.Box3, custom raycast bounds, or bounding volumes) for realistic gravity, collision, and traversal.
    - Use 'window.getAssetUrl(name)' for all binary asset loading. DO NOT define this function yourself; it is provided by the environment.

    VIII. SYSTEMIC INTERDEPENDENCY & EMERGENCE:
    - CROSS-SYSTEM SYNERGY: Design systems that interact (e.g., weather affecting friction, damage types affecting environment assets).
    - EMERGENT GAMEPLAY: Encourage mechanics that allow for multiple solutions to a single problem.

    IX. UNIFIED CROSS-PLATFORM SYSTEM (SMOOTH & RESPONSIVE):
    - ADAPTIVE INPUT: Seamlessly switch between Touch, Keyboard/Mouse, and Gamepad. Build robust event listeners for all.
    - RESPONSIVE DESIGN (CRITICAL): The game canvas and camera MUST automatically resize correctly for BOTH Desktop AND Mobile devices (Phones, Tablets, PCs).
      - Add a robust 'resize' event listener to the window.
      - On resize, UPDATE the camera aspect ratio: \`camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();\`
      - On resize, UPDATE the renderer: \`renderer.setSize(window.innerWidth, window.innerHeight);\`
      - OVERRIDE CSS: Ensure the canvas CSS forces full screen without scrollbars: \`body { margin: 0; padding: 0; overflow: hidden; width: 100vw; height: 100vh; } canvas { display: block; width: 100vw; height: 100vh; }\`.
    - UNIFIED INPUT MAPPING & AAA LOCOMOTION CONTROLS (GTA/RDR FIDELITY):
        - MOVEMENT MOMENTUM (INERTIA): Characters must have physical weight. Avoid instant state transitions or immediate stop-starts. When a movement key (WASD/Arrows) or mobile joystick is pressed, smoothly accelerate velocity vectors toward the target speed. Apply physical drag/friction forces on release to implement realistic deceleration slides (reminiscent of Grand Theft Auto physics).
        - DESKTOP KEYBOARD & MOUSE SCHEME:
            - Locomotion: Map WASD/Arrows for relative directional movement. Combine with Mouse Yaw for rotation in Third-Person/First-Person modes.
            - Advanced States: Implement holding Left Shift for high-speed sprinting, Space for jumping, 'C' or Control key for entering a crouching state (which scales down the collision cylinder height and reduces sensory visibility), and 'R' for weapon reloading or interaction.
            - Camera Look: Bind pointer lock (\`document.body.requestPointerLock()\`) to mouse movement to support unlimited panning. Clamp the look pitch (vertical axis) to avoid upside-down view clipping.
        - AAA MOBILE TOUCH CONTROLS (VIRTUAL DUAL-STICK ENGINE):
            - Left Virtual Analog Stick: Render a polished, transparent circular base and knob at the bottom-left corner. Calculate absolute normalized joystick coordinates (X, Y) relative to the touch pivot point. This stick acts as the analog movement controller, mapping walking speed proportionally to displacement.
            - Right Virtual Touch Area (Camera Pan): Treat the right side of the mobile screen as an analog trackpad. Calculate relative swipe deltas to rotate camera yaw and pitch.
            - Virtual Buttons: Implement high-fidelity floating buttons on the bottom-right corner for Actions (Jump, Shoot, Reload, Sprint) styled with glassmorphic backdrop filters, thin borders, and active scale animations on tap (\`transform: scale(0.95)\`).
        - DYNAMIC CONTROL ADAPTER: Ensure both control schemes feed into a centralized controller module that outputs normalized movement vectors, preventing double-bindings or jerky camera snaps.
        - HAPTICS: Use 'navigator.vibrate' cautiously for tactile feedback.

    X. PERFORMANCE & ARCHITECTURE (THREE.JS BEST PRACTICES):
    - ENVIRONMENT SETUP: Always setup a standard environment with a clear background color or skybox. NEVER leave the background transparent or unrendered.
    - SCENE GRAPH: Always add objects to the \`scene\`. If it's not in the \`scene\`, it won't render.
    - CAMERA SETUP: Position the camera appropriately. A common mistake is placing the camera inside objects or far away. Use \`camera.position.set(0, 5, 10)\` and \`camera.lookAt(0, 0, 0)\` as a baseline.
    - RENDERER: Ensure \`renderer.setSize(window.innerWidth, window.innerHeight)\` is called initially and on window resize. Append \`renderer.domElement\` to the \`document.body\`.
    - ANIMATION LOOP: Create a robust \`requestAnimationFrame\` loop. This loop MUST call \`renderer.render(scene, camera)\` every frame.
    - MODULAR ENGINE: Structure code into clear classes (Engine, Player, EnemyManager, UIManager, AssetLoader). Avoid placing all logic in a single massive block.
    - OPTIMIZATION: Minimize object allocations in critical loops (e.g., use object pools for bullets, avoid \`new THREE.Vector3()\` inside the render loop). Use frustum culling.
    - RECOVERY: Implement graceful error handling (e.g., try/catch blocks around asset loading).
    - IMPORT MAPS & MODULES: Standardize on ES modules if possible, but since we are injecting a single file, rely on global \`THREE\` if imported via script tags, or ensure all code is self-contained. Assume \`THREE\` is available globally if necessary, or use standard import structures if supported by the injection environment.
    - EXPLICIT BOOTSTRAPPING: Provide a clear entry point to start the game (e.g., \`const game = new Game(); game.start();\`).

    XI. LOGIC NODE SYNTHESIS:
    - Generate 'proposedLogicNodes' as complex behavioral blueprints.
    - Format: "[Trigger] -> [Condition] -> [Action]".
    - Example: "[OnCollision:Player,PowerUp] -> [Player.Health < 100] -> [Heal(20), PlaySound('PowerUp'), Destroy(PowerUp)]".

    XII. 3D MODELS, FBX/GLTF ANIMATION PIPELINE, & ADVANCED RIGGING (CRITICAL - COMPLETE ZERO ERROR PROMISE):
    - UNIFIED LOADERS & LIFECYCLE (DYNAMIC DEFENSIVE SETUP): To guarantee loader reliability and eliminate "GLTFLoader is not a constructor" or undefined exceptions under any CDN registration, you MUST initialize loaders defensively on demand. Implement global, cached loader getters:
      \`\`\`javascript
      let gltfLoader = null;
      let fbxLoader = null;
      function getGLTFLoader() {
        if (!gltfLoader) {
          if (THREE.GLTFLoader) {
            gltfLoader = new THREE.GLTFLoader();
          } else if (window.THREE && window.THREE.GLTFLoader) {
            gltfLoader = new window.THREE.GLTFLoader();
          } else if (window.GLTFLoader) {
            gltfLoader = new window.GLTFLoader();
          } else {
            console.warn("GLTFLoader constructor not found on THREE or window.");
          }
        }
        return gltfLoader;
      }
      function getFBXLoader() {
        if (!fbxLoader) {
          if (THREE.FBXLoader) {
            fbxLoader = new THREE.FBXLoader();
          } else if (window.THREE && window.THREE.FBXLoader) {
            fbxLoader = new window.THREE.FBXLoader();
          } else if (window.FBXLoader) {
            fbxLoader = new window.FBXLoader();
          } else {
            console.warn("FBXLoader constructor not found on THREE or window.");
          }
        }
        return fbxLoader;
      }
      \`\`\`
    - ASSET FAIL-SAFE WRAPPER (ZERO ERROR PROMISE): To guarantee a perfect load even with faulty or missing files, you MUST implement a resilient loading function that wraps asset retrieval in a try-catch. Furthermore, to support separate motion assets (like "motion1", "motion2") correctly, your loader MUST return BOTH the 3D model scene AND its embedded animation clips in a single result object. If an asset fails to load, gracefully return a result object containing a beautiful fallback geometry:
      \`\`\`javascript
      async function loadGameAsset(assetName, type, fallbackCreator) {
        try {
          const url = window.getAssetUrl(assetName);
          if (!url) throw new Error("No URL found for asset: " + assetName);
          const ext = assetName.split('.').pop().toLowerCase();
          return new Promise((resolve) => {
            if (ext === 'glb' || ext === 'gltf') {
              const loader = getGLTFLoader();
              if (!loader) {
                console.warn("GLTFLoader not available, returning fallback");
                resolve({ scene: fallbackCreator(), animations: [] });
                return;
              }
              loader.load(url, (gltf) => {
                resolve({ scene: gltf.scene, animations: gltf.animations || [] });
              }, null, (err) => {
                console.warn("GLTF Load error, falling back:", err);
                resolve({ scene: fallbackCreator(), animations: [] });
              });
            } else if (ext === 'fbx') {
              const loader = getFBXLoader();
              if (!loader) {
                console.warn("FBXLoader not available, returning fallback");
                resolve({ scene: fallbackCreator(), animations: [] });
                return;
              }
              loader.load(url, (fbx) => {
                resolve({ scene: fbx, animations: fbx.animations || [] });
              }, null, (err) => {
                console.warn("FBX Load error, falling back:", err);
                resolve({ scene: fallbackCreator(), animations: [] });
              });
            } else {
              resolve({ scene: fallbackCreator(), animations: [] });
            }
          });
        } catch (e) {
          console.warn("Loading catch error for: " + assetName, e);
          return { scene: fallbackCreator(), animations: [] };
        }
      }
      \`\`\`
    - DYNAMIC ASYNC ASSET REPLACEMENT PATTERN (ZERO BLANK-SCREEN / ZERO NAN ERRORS):
      Because loading 3D assets is asynchronous, your game actors MUST be fully initialized on frame 1 with a beautiful procedural fallback mesh (e.g. a compound capsule group styled with lights or neon elements), added immediately to the scene. This ensures there are no uninitialized variables or NaN collision coordinates. When the 3D asset finishes loading, hide the fallback mesh and add the real loaded mesh as a child of the actor group:
      \`\`\`javascript
      // Inside Player initialization:
      this.mesh = new THREE.Group();
      this.fallbackMesh = createBeautifulFallbackCapsule();
      this.mesh.add(this.fallbackMesh);
      scene.add(this.mesh);
      
      this.loadedModel = null;
      this.mixer = null;
      
      loadGameAsset('character1', 'character1', () => createSimplePlaceholderMesh()).then(({ scene: loadedScene, animations: loadedAnimations }) => {
        if (loadedScene) {
          this.fallbackMesh.visible = false; // Hide fallback
          this.loadedModel = loadedScene;
          this.mesh.add(this.loadedModel); // Add real mesh
          calibrateSkeletonRestPose(this.loadedModel);
          this.setupAnimations(this.loadedModel, loadedAnimations);
        }
      });
      \`\`\`
    - ANIMATION RETARGETING SUITE & RIGGING PIPELINE (MANDATORY FOR USER-UPLOADED 3D MODELS):
      When users upload custom 3D models (GLTF/GLB/FBX characters) and custom motion animations, the bone structures and skeletal naming schemes are often mismatched. To achieve AAA-grade animation rigging and flawless motion retargeting akin to Red Dead Redemption or GTA, you MUST implement a dedicated, modular \`AnimationRetargetingSuite\` pipeline in your generated code:
      1. SKELETAL DETECTION & BONE NORMALIZATION:
         Traverse the imported mesh to find SkinnedMesh elements and extract their bone hierarchy. Teach the AI to write an automatic rig detector that translates multiple industry-standard namespaces to a unified, normalized standard base:
         - Mixamo Standard: \`mixamorigHips\`, \`mixamorigSpine\`, \`mixamorigLeftUpLeg\`, \`mixamorigLeftLeg\`, \`mixamorigLeftFoot\`, etc.
         - Unreal Engine 5 (UE5 Mannequin): \`pelvis\`, \`spine_01\`, \`thigh_l\`, \`calf_l\`, \`foot_l\`, \`thigh_r\`, \`calf_r\`, \`foot_r\`, etc.
         - Biped / Generic: \`Bip001_Pelvis\`, \`Bip001_L_Thigh\`, \`Bip001_L_Foot\`, etc.
         Standardize these into a unified bone-mapping dictionary mapping to: \`Hips\`, \`Spine\`, \`Neck\`, \`Head\`, \`LeftUpLeg\`, \`LeftLeg\`, \`LeftFoot\`, \`RightUpLeg\`, \`RightLeg\`, \`RightFoot\`.
      2. BONE-RETARGETING, ROOT-MOTION ISOLATION & TRACK PATH CLEANSER (CRITICAL ZERO-GLITCH RIGGING):
         Clean every animation track path dynamically to match the normalized bone names on the uploaded model's skeleton. This prevents limbs from detaching, folding, or twisting, isolates root motion to keep the mesh aligned with physical colliders, and ensures any uploaded motion files (e.g., Mixamo walk/run cycles) are perfectly retargeted to the custom model:
         \`\`\`javascript
         const cleanAnimationTrackPaths = (clip, characterRoot, options = { neutralizeRootMotion: true }) => {
           if (!clip || !characterRoot) return clip;
           const cleanClip = clip.clone();
           if (!cleanClip.tracks || !Array.isArray(cleanClip.tracks)) return cleanClip;
           const boneNames = new Set();
           characterRoot.traverse(child => {
             if (child.isBone) boneNames.add(child.name);
           });
           
           // Calculate base character skeleton height as scaling reference
           let hipsHeight = 1.0;
           characterRoot.traverse(child => {
             if (child.isBone && (child.name.toLowerCase().includes('hips') || child.name.toLowerCase().includes('pelvis'))) {
               const worldPos = new THREE.Vector3();
               child.getWorldPosition(worldPos);
               hipsHeight = Math.max(0.1, worldPos.y - characterRoot.position.y);
             }
           });

           cleanClip.tracks.forEach(track => {
             const propertyIndex = track.name.lastIndexOf('.');
             const property = propertyIndex !== -1 ? track.name.substring(propertyIndex) : '';
             let path = propertyIndex !== -1 ? track.name.substring(0, propertyIndex) : track.name;
             
             // Strip armature prefixes or namespace prefixes (e.g. "Armature/mixamorig:Hips" -> "mixamorig:Hips")
             path = path.replace(/^.*[\/:]/, '');
             
             if (!boneNames.has(path)) {
               for (let bName of boneNames) {
                 const cleanBName = bName.replace(/^.*[\/:]/, '');
                 if (cleanBName.toLowerCase() === path.toLowerCase() || bName.toLowerCase().includes(path.toLowerCase()) || path.toLowerCase().includes(bName.toLowerCase())) {
                   path = bName;
                   break;
                 }
               }
             }
             track.name = path + property;
             
             const isHips = path.toLowerCase().includes('hips') || path.toLowerCase().includes('pelvis');
             
             // Scale track values if model scale is customized, to prevent characters shrinking or floating
             if (property === '.position' && track.values) {
               const scaleMultiplier = characterRoot.scale.y;
               for (let i = 0; i < track.values.length; i += 3) {
                 // Root Motion Suppression: if option is active, isolate and zero out horizontal translation on the hips.
                 // This keeps the mesh centered with the collider while the engine's physics script handles true movement.
                 if (isHips && options.neutralizeRootMotion) {
                   track.values[i] = 0;     // Force zero horizontal X translation
                   track.values[i+2] = 0;   // Force zero horizontal Z translation
                 } else {
                   track.values[i] *= scaleMultiplier;
                   track.values[i+2] *= scaleMultiplier;
                 }
                 track.values[i+1] *= scaleMultiplier; // Keep vertical Y motion (jumping, bobbing, landing)
               }
             }
             
             // Joint Twist Prevention & Quaternion Normalization
             if (property === '.quaternion' && track.values) {
               for (let i = 0; i < track.values.length; i += 4) {
                 // Ensure quaternion coordinates are valid, normalized, and have no twisted poles
                 const q = new THREE.Quaternion(track.values[i], track.values[i+1], track.values[i+2], track.values[i+3]);
                 q.normalize();
                 track.values[i] = q.x;
                 track.values[i+1] = q.y;
                 track.values[i+2] = q.z;
                 track.values[i+3] = q.w;
               }
             }
           });
           return cleanClip;
         };

         // Dynamic A-Pose to T-Pose Alignment Calibration
         const calibrateSkeletonRestPose = (characterRoot) => {
           if (!characterRoot) return;
           characterRoot.traverse(child => {
             if (child.isBone) {
               const name = child.name.toLowerCase();
               // Identify Left Shoulder / UpperArm bones and lift them horizontally if pointed down
               if (name.includes('leftarm') || name.includes('leftupperarm') || name.includes('l_shoulder') || name.includes('l_arm')) {
                 if (child.rotation.z < -0.1) {
                   child.rotation.z = 0; // Set horizontal
                 }
               }
               // Identify Right Shoulder / UpperArm bones and raise them horizontally if pointed down
               if (name.includes('rightarm') || name.includes('rightupperarm') || name.includes('r_shoulder') || name.includes('r_arm')) {
                 if (child.rotation.z > 0.1) {
                   child.rotation.z = 0; // Set horizontal
                 }
               }
             }
           });
         };
         \`\`\`
      3. PROCEDURAL BLEND TREES & LOCOMOTION MIXING:
         Implement active skeletal blend trees to smoothly interpolate between animation states (Idle, Walk, Run, Jump, Strafe) rather than binary snaps.
         Use weighted crossfading with speed coefficients to blend locomotion based on the actor's real-time velocity:
         \`\`\`javascript
         class LocomotionBlendTree {
           constructor(mixer, actions) {
             this.mixer = mixer;
             this.actions = actions; // { idle, walk, run, jump, etc. }
             this.currentWeights = { idle: 1.0, walk: 0.0, run: 0.0 };
           }
           blend(speed, maxSpeed, isMoving, deltaTime) {
             let targetWeights = { idle: 1.0, walk: 0.0, run: 0.0 };
             if (isMoving) {
               const ratio = speed / maxSpeed;
               if (ratio < 0.5) {
                 targetWeights.idle = (0.5 - ratio) * 2;
                 targetWeights.walk = ratio * 2;
                 targetWeights.run = 0.0;
               } else {
                 targetWeights.idle = 0.0;
                 targetWeights.walk = (1.0 - ratio) * 2;
                 targetWeights.run = (ratio - 0.5) * 2;
               }
             }
             // Smoothly transition weights over time using linear interpolation (lerp)
             for (let key in this.currentWeights) {
               this.currentWeights[key] = THREE.MathUtils.lerp(this.currentWeights[key], targetWeights[key] || 0, deltaTime * 8.0);
               const action = this.actions[key];
               if (action) {
                 if (this.currentWeights[key] > 0.01) {
                   if (!action.isRunning()) action.play();
                   action.setEffectiveWeight(this.currentWeights[key]);
                 } else {
                   action.stop();
                 }
               }
             }
           }
         }
         \`\`\`
      4. AUTOMATIC IK-DRIVEN FOOT PLANTING & TERRAIN SLOPE ALIGNMENT:
         Implement a lightweight procedural Inverse Kinematics (IK) calculation for character feet to avoid sliding, floating, or knee clipping:
         - Raycast downward from each foot's joint world coordinates to detect terrain contact heights.
         - Identify "Contact Phase" of the walk/run cycle (e.g., when the foot's local animated Y position is at its lowest).
         - Apply an adaptive vertical offset to the foot joint, and calculate the knee bending rotation angles for UpLeg and Leg bones via simple trigonometry or proportional joint bias:
           \`\`\`javascript
           function applyFootIK(actor, terrainMesh, leftFoot, rightFoot, leftKnee, rightKnee, deltaTime) {
             const raycaster = new THREE.Raycaster();
             const down = new THREE.Vector3(0, -1, 0);
             
             [ { foot: leftFoot, knee: leftKnee }, { foot: rightFoot, knee: rightKnee } ].forEach(joint => {
               if (!joint.foot) return;
               const footWorldPos = new THREE.Vector3();
               joint.foot.getWorldPosition(footWorldPos);
               
               // Downward raycast from above the foot position
               raycaster.set(new THREE.Vector3(footWorldPos.x, footWorldPos.y + 1.5, footWorldPos.z), down);
               const intersects = raycaster.intersectObject(terrainMesh);
               if (intersects.length > 0) {
                 const terrainY = intersects[0].point.y;
                 const targetFootY = terrainY + 0.1; // small threshold above terrain
                 const diffY = targetFootY - footWorldPos.y;
                 
                 // Smoothly adjust the foot and bend the knee (Leg/UpLeg)
                 if (Math.abs(diffY) < 1.0) {
                   joint.foot.position.y += diffY * 0.3; // soft lerp
                   if (joint.knee) {
                     // Slightly rotate knee bone outward/inward to simulate physical bending response
                     joint.knee.rotation.x += Math.max(0, -diffY) * 0.4;
                   }
                 }
               }
             });
           }
           \`\`\`
      4. ANIMATED STATE MACHINE (SMOOTH CROSSFADING):
         - Create an active animation registry: 'const actions = {};'
         - Implement a robust state manager that plays actions with a crossfade:
           \`\`\`javascript
           let activeActionName = 'idle';
           function fadeTo(stateName, duration = 0.25) {
             const nextAction = actions[stateName];
             const currentAction = actions[activeActionName];
             if (!nextAction || nextAction === currentAction) return;
             nextAction.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(duration).play();
             if (currentAction) currentAction.fadeOut(duration);
             activeActionName = stateName;
           }
           \`\`\`
    - THE FRAME LOOP UPDATE SAFEGUARD:
      - Always wrap 'mixer.update(deltaTime)' in a validation guard.
      - If 'deltaTime' is too high (e.g. browser tab suspended), cap it to a maximum of 0.1s to prevent physics/animation explosion.
      - Ensure 'mixer' is updated in the requestAnimationFrame loop.
    - PERFECT 3D MODEL POSITIONING, SCALING, & ORIENTATION FIXES (CRITICAL):
      Imported 3D models can have unpredictable scale, bad pivot points, or be rotated incorrectly (e.g., loaded upside down, sideways, or underground). You MUST resolve these issues programmatically for ALL models:
      1. Bounding Box & Centering: Calculate the physical boundaries and automatically normalize the model:
         \`\`\`javascript
         const box = new THREE.Box3().setFromObject(loadedMesh);
         const size = box.getSize(new THREE.Vector3());
         const center = box.getCenter(new THREE.Vector3());
         
         // Auto-scale to standard game heights (e.g., 2 meters tall for character, or relative boundaries)
         const targetHeight = 2.0;
         const scaleFactor = targetHeight / (size.y || 1);
         loadedMesh.scale.set(scaleFactor, scaleFactor, scaleFactor);
         
         // Shift inner mesh so the local origin (0,0,0) is exactly at the bottom-center (at the feet)
         // This ensures the character rotates about its vertical axis and sits perfectly on the ground plane
         loadedMesh.position.set(-center.x * scaleFactor, -box.min.y * scaleFactor, -center.z * scaleFactor);
         
         // Parent Group Container: Always put the loadedMesh inside a parent container Group
         const actorGroup = new THREE.Group();
         actorGroup.add(loadedMesh);
         scene.add(actorGroup);
         \`\`\`
      2. Heading / Rotation Correction: Many 3D models face negative Z, positive Z, or sideways. Provide a customizable orientation offset (e.g., \`loadedMesh.rotation.y = Math.PI\` or similar) to ensure the visual character faces the true walking direction of the parent group:
         \`\`\`javascript
         // In update loop: Rotate parent group smoothly toward movement velocity vector
         if (velocity.lengthSq() > 0.001) {
           const targetAngle = Math.atan2(velocity.x, velocity.z);
           // Smooth interpolation (slerp) for character rotation heading
           let diff = targetAngle - actorGroup.rotation.y;
           while (diff < -Math.PI) diff += Math.PI * 2;
           while (diff > Math.PI) diff -= Math.PI * 2;
           actorGroup.rotation.y += diff * 0.15;
         }
         \`\`\`
    - INTELLIGENT DUAL-PERSPECTIVE CAMERA CONTROLLER (FIRST & THIRD-PERSON WITH CINEMATIC INTERPOLATION, DYNAMIC FOV & OBJECT-AVOIDANCE):
      Provide robust mathematical camera controls supporting both First-Person (FPP) and Third-Person (TPP) perspectives akin to major open-world AAA titles. Implement smooth cinematic interpolation (Slerping/Lerping camera position and focal target vectors), dynamic Field-of-View (FOV) scaling to dramatize acceleration (e.g. expanding FOV slightly when sprinting), and a physics-aware spring-arm collider checking obstacle ray intersections to dynamically pull the camera closer to eliminate wall clipping:
      1. AAA Cinematic Third-Person Camera (Over-The-Shoulder / Follow style with Obstacle-Avoidance Spring-Arm):
         The camera must follow behind the player with adjustable distance and height, featuring a shoulder-offset (so the player mesh sits slightly off-center left or right to keep the view clear, framing the character cinematically) and active camera collision detection:
         \`\`\`javascript
         class AAAThirdPersonCamera {
           constructor(camera, targetGroup, scene) {
             this.camera = camera;
             this.target = targetGroup;
             this.scene = scene;
             this.baseOffset = new THREE.Vector3(-0.8, 3.2, -5.5); // (Shoulder offset X, Height Y, Distance Z)
             this.lookAtOffset = new THREE.Vector3(0.5, 1.4, 0); // Focus height and visual shoulder center offset
             this.currentPosition = new THREE.Vector3();
             this.currentLookAt = new THREE.Vector3();
             this.springStrength = 0.12; // Controls follow smoothness/damping
             this.camera.fov = 60; // Base FOV
           }
           update(deltaTime, environmentMeshes = [], isSprinting = false) {
             const targetMatrix = this.target.matrixWorld;
             const targetPos = new THREE.Vector3().setFromMatrixPosition(targetMatrix);
             const rotationMatrix = new THREE.Matrix4().extractRotation(targetMatrix);
             
             // Dynamic FOV for sprinting (Cinematic Speed effect)
             const targetFov = isSprinting ? 75 : 60;
             this.camera.fov += (targetFov - this.camera.fov) * 0.1;
             this.camera.updateProjectionMatrix();

             // Calculate local relative camera offset in world space
             const relativeOffset = this.baseOffset.clone().applyMatrix4(rotationMatrix);
             const desiredPosition = targetPos.clone().add(relativeOffset);
             
             // --- SPRING ARM / CAMERA COLLISION CHECK (CRITICAL) ---
             // Cast a ray from the character's core to the desired camera position.
             // If it hits level geometry/obstacles, pull the camera closer to the character to prevent clipping inside walls.
             const rayDirection = new THREE.Vector3().subVectors(desiredPosition, targetPos).normalize();
             const rayLength = targetPos.distanceTo(desiredPosition);
             const raycaster = new THREE.Raycaster(targetPos, rayDirection, 0.1, rayLength);
             
             // Filter out player group from collision candidates
             const intersects = raycaster.intersectObjects(environmentMeshes, true);
             let finalCameraPos = desiredPosition;
             if (intersects.length > 0) {
               // Offset hit point slightly forward along the normal to prevent camera sticking
               const hitPoint = intersects[0].point;
               const pullBackDistance = 0.3;
               finalCameraPos = targetPos.clone().add(rayDirection.multiplyScalar(intersects[0].distance - pullBackDistance));
             }
             
             // Smoothly interpolate current camera position toward the collision-corrected coordinates
             this.currentPosition.lerp(finalCameraPos, this.springStrength);
             this.camera.position.copy(this.currentPosition);
             
             // Compute dynamic lookAt coordinate (focusing forward over the player's shoulder)
             const desiredLookAt = targetPos.clone().add(this.lookAtOffset.clone().applyMatrix4(rotationMatrix));
             this.currentLookAt.lerp(desiredLookAt, this.springStrength);
             this.camera.lookAt(this.currentLookAt);
           }
         }
         \`\`\`
      2. AAA Immersive First-Person Camera (FPP style):
         Mount the camera at the actor's exact head height, incorporating realistic camera head-bobbing based on footstep frequency and yaw/pitch mouse look constraints:
         \`\`\`javascript
         class AAAFirstPersonCamera {
           constructor(camera, targetGroup) {
             this.camera = camera;
             this.target = targetGroup;
             this.yaw = 0;
             this.pitch = 0;
             this.headOffset = new THREE.Vector3(0, 1.85, 0); // Head eye-level height
             this.bobTimer = 0;
             this.bobSpeed = 10;
             this.bobAmount = 0.05; // Bob intensity
             
             window.addEventListener('mousemove', (e) => {
               if (document.pointerLockElement === document.body) {
                 this.yaw -= e.movementX * 0.002;
                 this.pitch -= e.movementY * 0.002;
                 this.pitch = Math.max(-Math.PI/2.4, Math.min(Math.PI/2.4, this.pitch));
               }
             });
           }
           update(deltaTime, isMoving = false, speedScale = 1.0) {
             // Bind camera position exactly to head offset
             const headPos = this.target.position.clone().add(this.headOffset);
             
             // --- IMMERSIVE HEAD-BOB SYSTEM ---
             if (isMoving) {
               this.bobTimer += deltaTime * this.bobSpeed * speedScale;
               // Bob up-down (Y) and sway left-right (X)
               headPos.y += Math.sin(this.bobTimer) * this.bobAmount;
               headPos.x += Math.cos(this.bobTimer * 0.5) * this.bobAmount * 0.7;
             } else {
               // Smoothly reset bob timer
               this.bobTimer = 0;
             }
             
             this.camera.position.copy(headPos);
             
             // Compute forward facing direction vector
             const direction = new THREE.Vector3(
               Math.sin(this.yaw) * Math.cos(this.pitch),
               Math.sin(this.pitch),
               Math.cos(this.yaw) * Math.cos(this.pitch)
             );
             this.camera.lookAt(headPos.clone().add(direction));
             
             // Update player model heading rotation matching the camera yaw
             this.target.rotation.y = this.yaw;
           }
         }
         \`\`\`
      3. AAA Dynamic & Cinematic Follow Camera (FOV Acceleration, Inertia Damping & POI Framing):
         Provide a sophisticated cinematic follow system that dynamically scales the Field-of-View (FOV) with player speed, introduces inertia damping, and targets scenic Points of Interest (POIs) when nearby:
         \`\`\`javascript
         class AAACinematicCamera {
           constructor(camera, targetGroup, options = {}) {
             this.camera = camera;
             this.target = targetGroup;
             this.baseFov = options.baseFov || 60;
             this.targetFov = this.baseFov;
             this.currentFov = this.baseFov;
             
             this.baseOffset = new THREE.Vector3(-0.8, 3.2, -5.5); // Elegant shoulder follow offset
             this.currentPosition = new THREE.Vector3();
             this.currentLookAt = new THREE.Vector3();
             
             // Dynamic smoothing/damping weights (inertia)
             this.minSpringStrength = 0.05; // Cinematic, heavy drag feeling at speed
             this.maxSpringStrength = 0.15; // Tighter, hyper-responsive at rest
             this.currentSpringStrength = 0.1;
             
             this.shakeIntensity = 0;
             this.shakeDecay = 0.95;
             this.cinematicActive = false;
             this.cinematicTimer = 0;
             this.cinematicType = 'default';
             
             // Points of Interest (POIs) - scenic triggers, collectibles, enemies
             this.pois = []; 
             this.activePoi = null;
             this.poiBlendWeight = 0; // Seamless blend: 0 = character, 1 = POI framing
           }
           
           registerPoi(position, radius = 12, priority = 1) {
             this.pois.push({ position, radius, priority });
           }
           
           shake(intensity) {
             this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
           }
           
           startCinematic(type) {
             this.cinematicActive = true;
             this.cinematicType = type;
             this.cinematicTimer = 0;
           }
           
           stopCinematic() {
             this.cinematicActive = false;
           }
           
           update(deltaTime, playerVelocity, environmentMeshes = []) {
             const targetMatrix = this.target.matrixWorld;
             const targetPos = new THREE.Vector3().setFromMatrixPosition(targetMatrix);
             const rotationMatrix = new THREE.Matrix4().extractRotation(targetMatrix);
             
             // Handle action-specific cinematic triggers first (orbit, crane, etc.)
             if (this.cinematicActive) {
               this.cinematicTimer += deltaTime;
               if (this.cinematicType === 'orbit') {
                 const radius = 9;
                 const angle = this.cinematicTimer * 0.4;
                 this.camera.position.set(
                   targetPos.x + Math.sin(angle) * radius,
                   targetPos.y + 3.0,
                   targetPos.z + Math.cos(angle) * radius
                 );
                 this.camera.lookAt(targetPos);
               } else if (this.cinematicType === 'crane') {
                 this.camera.position.set(
                   targetPos.x - 3.5,
                   targetPos.y + 6.0 - (this.cinematicTimer * 0.3),
                   targetPos.z - 6.5
                 );
                 this.camera.lookAt(targetPos);
               }
               this.applyShake();
               return;
             }
             
             const speed = playerVelocity ? playerVelocity.length() : 0;
             const maxVelocityRef = 12.0; 
             const speedRatio = Math.min(speed / maxVelocityRef, 1.0);
             
             // A. DYNAMIC FIELD-OF-VIEW (FOV) ACCELERATION
             // Widen FOV at speed to heighten kinetic drama, contract when stationary
             const speedFovOffset = speedRatio * 15.0; // Widens up to +15 FOV
             this.targetFov = this.baseFov + speedFovOffset;
             
             // B. PROXIMITY-BASED POI CAM FRAMING & PANNING
             // Find closest point of interest within active range
             this.activePoi = null;
             let closestDist = Infinity;
             for (let poi of this.pois) {
               const dist = targetPos.distanceTo(poi.position);
               if (dist < poi.radius && dist < closestDist) {
                 closestDist = dist;
                 this.activePoi = poi;
               }
             }
             
             if (this.activePoi) {
               const proximityWeight = 1.0 - (closestDist / this.activePoi.radius); // 0 at outer edge, 1 at center
               // Narrow FOV to focus attention dynamically
               this.targetFov -= proximityWeight * 12.0;
               this.poiBlendWeight = THREE.MathUtils.lerp(this.poiBlendWeight, proximityWeight * 0.6, deltaTime * 3.5);
             } else {
               this.poiBlendWeight = THREE.MathUtils.lerp(this.poiBlendWeight, 0.0, deltaTime * 4.5);
             }
             
             // Smoothly transition and update FOV projection matrix
             this.currentFov = THREE.MathUtils.lerp(this.currentFov, this.targetFov, deltaTime * 4.0);
             this.camera.fov = this.currentFov;
             this.camera.updateProjectionMatrix();
             
             // C. DYNAMIC INERTIA/SMOOTHING DAMPING
             // Responsive adjustments based on speed - heavier damping at high speeds for cinematic flow
             this.currentSpringStrength = THREE.MathUtils.lerp(this.maxSpringStrength, this.minSpringStrength, speedRatio);
             
             // D. PHYSICAL OBSTACLE COLLISION & SPRING ARM
             const relativeOffset = this.baseOffset.clone().applyMatrix4(rotationMatrix);
             // Pull back offset slightly as player gains speed
             relativeOffset.z -= speedRatio * 1.5; 
             relativeOffset.y += speedRatio * 0.2;
             
             const desiredPosition = targetPos.clone().add(relativeOffset);
             const rayDirection = new THREE.Vector3().subVectors(desiredPosition, targetPos).normalize();
             const rayLength = targetPos.distanceTo(desiredPosition);
             const raycaster = new THREE.Raycaster(targetPos, rayDirection, 0.1, rayLength);
             const intersects = raycaster.intersectObjects(environmentMeshes, true);
             
             let finalCameraPos = desiredPosition;
             if (intersects.length > 0) {
               const pullBackDistance = 0.3;
               finalCameraPos = targetPos.clone().add(rayDirection.multiplyScalar(intersects[0].distance - pullBackDistance));
             }
             
             this.currentPosition.lerp(finalCameraPos, this.currentSpringStrength);
             this.camera.position.copy(this.currentPosition);
             
             // E. LOOK-AT FRAMING BLEND
             const defaultLookAt = targetPos.clone().add(new THREE.Vector3(0.5, 1.4, 0).applyMatrix4(rotationMatrix));
             let targetLookAt = defaultLookAt;
             
             if (this.activePoi) {
               // Look at a midpoint between the player and the POI for cinematic dual-framing
               const midPoint = new THREE.Vector3().addVectors(targetPos, this.activePoi.position).multiplyScalar(0.5);
               midPoint.y += 1.2;
               targetLookAt.lerp(midPoint, this.poiBlendWeight);
             }
             
             this.currentLookAt.lerp(targetLookAt, this.currentSpringStrength);
             this.camera.lookAt(this.currentLookAt);
             
             this.applyShake();
           }
           
           applyShake() {
             if (this.shakeIntensity > 0.001) {
               this.camera.position.x += (Math.random() - 0.5) * this.shakeIntensity;
               this.camera.position.y += (Math.random() - 0.5) * this.shakeIntensity;
               this.camera.position.z += (Math.random() - 0.5) * this.shakeIntensity;
               this.shakeIntensity *= this.shakeDecay;
             }
           }
         }
         \`\`\`
    - FALLBACK CREATORS:
      - Character Fallback: Create a detailed capsule or human-proportioned compound mesh (head, body, hands, feet) using 'THREE.Group', so the game looks amazing even without the asset.
      - Environment Fallback: Create a procedural styled floor grid and platform shapes with distinct colors and lights.

     XIII. COMPLEX GAMEPLAY SYSTEMS & ADVANCED AAA NPC & ENEMY BEHAVIORS (GTA/RDR STYLE):
    - BEHAVIOR TREE FRAMEWORK & INTELLIGENT NPC DECISION MAKING (COMPLETELY ERROR-FREE IN PRODUCTION):
      To achieve Red Dead Redemption or GTA-style dynamic, life-like, and robust actor behavior, you MUST implement a formal, lightweight, and defensive Behavior Tree (BT) framework inside your generated game code:
      - BT Node Base & Control Flow (With Safe Fallbacks):
        Implement modular node classes to govern AI behaviors. Nodes must return a status of \`SUCCESS\`, \`FAILURE\`, or \`RUNNING\`. Explicitly verify that actor state variables, blackboard objects, and target references are defined before execution:
        \`\`\`javascript
        class BTNode {
          execute(actor, blackboard) { return 'SUCCESS'; }
        }
        class BTSelector extends BTNode { // Fallback Node: Runs children sequentially until one succeeds or runs
          constructor(children = []) { super(); this.children = children; }
          execute(actor, blackboard) {
            for (let child of this.children) {
              if (!child) continue;
              try {
                const status = child.execute(actor, blackboard);
                if (status !== 'FAILURE') return status;
              } catch (e) {
                console.error("BTSelector Node Error:", e);
              }
            }
            return 'FAILURE';
          }
         }
        class BTSequence extends BTNode { // Sequence Node: Runs children sequentially until one fails or runs
          constructor(children = []) { super(); this.children = children; }
          execute(actor, blackboard) {
            for (let child of this.children) {
              if (!child) continue;
              try {
                const status = child.execute(actor, blackboard);
                if (status !== 'SUCCESS') return status;
              } catch (e) {
                console.error("BTSequence Node Error:", e);
              }
            }
            return 'SUCCESS';
          }
        }
        \`\`\`
      - Real-Time AI Behavior Architectures (AAA Realism):
        Compose cohesive BT trees for enemies and civil NPCs to model complex, state-driven gameplay behaviors akin to AAA games. NPCs must not simply walk towards the player blindly; they must exhibit tactical logic:
        1. Daily Routine & Patrol Behavior: Civilians and unalerted guards should follow organic waypoint graphs or schedule-driven routines. Add idle animations (e.g. smoking, talking, resting) at nodes.
           \`\`\`javascript
           // [Condition: Is Threat Spotted] -> FAILURE (continue) -> [Action: Move to Patrol Point] -> [Action: Play Idle/Talk Anim]
           \`\`\`
        2. Investigate & Search Behavior: Triggered by hearing footsteps, gunshots, or seeing shadows. The NPC must cautiously walk toward the disturbance with a drawn weapon, play looking-around animations, and eventually return to patrol if nothing is found (clearing the alert state).
           \`\`\`javascript
           // [Condition: Has Alert Origin] -> [Action: Turn Head] -> [Action: Walk Cautiously to Disturbance] -> [Action: Play Search Anim]
           \`\`\`
        3. Tactical Combat & Flanking Behavior: Enemies must evaluate combat conditions in real-time. They should actively seek physical cover behind crates/walls using raycasts to find safe spots opposite the player. When health drops below 30%, they must prioritize fleeing or blind-firing. Multiple enemies must attempt to flank the player rather than stacking together.
           \`\`\`javascript
           // Selector: [Sequence: Low Health -> Find Cover -> Move to Cover -> Heal/Blindfire] OR [Sequence: Target Out of Range -> Bound Forward Cover-to-Cover] OR [Sequence: Target Visible -> Aim & Shoot]
           \`\`\`
        4. Stagger & Hit Reactions (AAA Game Juice): When hit, the NPC's BT should instantly transition to a HIGH-PRIORITY 'Hurt' node, triggering a directional flinch or stagger animation (based on hit direction). They must drop their guard momentarily before resuming combat logic.
    - SENSORY AWARENESS ENGINE (STEALTH, LINE-OF-SIGHT, & AUDITORY RANGE):
      - Dynamic Vision Cones: Calculate realistic vision fields using vector mathematics and clamp checks. Calculate the direction vector from the NPC to the player, normalize it, and calculate the dot product against the NPC's forward look vector:
        \`\`\`javascript
        const toPlayer = new THREE.Vector3().subVectors(player.position, npc.position);
        const distance = toPlayer.length();
        if (distance < npc.visionRange) {
          toPlayer.normalize();
          const cosAngle = npc.getForwardVector().dot(toPlayer);
          if (cosAngle > Math.cos(npc.fovAngle * 0.5 * (Math.PI / 180))) {
            // Perform Raycast check to verify line-of-sight is not broken by obstacles
            const raycaster = new THREE.Raycaster(npc.position, toPlayer, 0, distance);
            const intersects = raycaster.intersectObjects(environmentColliders, true);
            if (intersects.length === 0) {
              blackboard.spottedPlayer = true;
              blackboard.lastKnownPlayerPos.copy(player.position);
            }
          }
        }
        \`\`\`
      - Auditory Threat Footprints: Expand stealth dynamics. Maintain a 'soundRadius' parameter on the player that fluctuates based on state (Sprinting: 15m, Walking: 5m, Crouching: 1m, Gunfire/Attack: 40m). Any NPC within this radius must immediately transition to an 'Investigate' state and look toward the source coordinates.

    - TACTICAL DYNAMIC COVER ACQUISITION (SMART DEPOSITION):
      - Ensure combat NPCs dynamically sprint to cover points opposite to the threat vector during low health or heavy fire. Map cover scores by calculating candidate locations behind environment props:
        \`\`\`javascript
        function findOptimalCover(npcPos, threatPos, coverProps) {
          let bestCoverPoint = null;
          let bestScore = -Infinity;
          for (let prop of coverProps) {
            if (!prop) continue;
            // Calculate cover projection opposite the threat vector
            const oppositeDir = new THREE.Vector3().subVectors(prop.position, threatPos).normalize();
            const coverCandidate = prop.position.clone().add(oppositeDir.multiplyScalar(prop.coverBufferRadius || 1.5));
            const distToCover = npcPos.distanceTo(coverCandidate);
            // Verify the candidate point is occluded from the threat's line-of-sight
            const toThreat = new THREE.Vector3().subVectors(threatPos, coverCandidate);
            const threatDist = toThreat.length();
            toThreat.normalize();
            const ray = new THREE.Raycaster(coverCandidate, toThreat, 0.1, threatDist);
            const hits = ray.intersectObject(prop, true);
            if (hits.length > 0) { // Valid cover found (ray hit the prop on its path to the threat)
              const score = -distToCover + (prop.scale ? prop.scale.x * 3 : 2.0); // Prioritize closer and wider props
              if (score > bestScore) {
                bestScore = score;
                bestCoverPoint = coverCandidate;
              }
            }
          }
          return bestCoverPoint;
        }
        \`\`\`

    - COORDINATED STEERING, GROUP FLANKING, & SQUAD TACTICS (ANTI-CONGESTION SYSTEM):
      - Coordinated Combat Steering: Avoid the "congested train" visual glitch where enemies pile into a single-file queue. Group AI must calculate tangent flanking vectors to establish smart battle lines:
        - Suppressors (Head-on assault): Advance directly toward the target while performing lateral side-step dounces or rolls during reloading or firing.
        - Flankers (Tactical flankers): Loop around the sides by projecting tangent offsets. Flanking units calculate the perpendicular unit vector relative to the target vector, multiplying by a flanking offset (e.g., 5.0m to the left or right), and steer toward this midway target to surround the player.
      - Collision Avoidance (Boids steering): Dynamically push entities away from each other if their distance is smaller than their collective bounding radius. Calculate a repulsive velocity vector:
        \`\`\`javascript
        const avoidVector = new THREE.Vector3();
        allNPCs.forEach(other => {
          if (other === npc) return;
          const dist = npc.position.distanceTo(other.position);
          if (dist < 1.8) {
            avoidVector.add(new THREE.Vector3().subVectors(npc.position, other.position).normalize().multiplyScalar(1.5 / (dist + 0.1)));
          }
        });
        npc.velocity.add(avoidVector);
        \`\`\`

    - AMBIENT CIVIL CROWD LIFE & PANIC RESPONSES:
      - Crowd Paths & Interactions: Neutral citizens walk gracefully along a collection of waypoint paths, engaging in conversation loops (idle gesture animation blend) when encountering other civilian paths.
      - High-Fidelity Reactions: On detecting combat (hearing sound footprints, seeing player weapons drawn, or hearing gunshots), civilians immediately trigger a panicked escape state. They must play panic locomotion animations, steer directly away from the player with randomized horizontal panic noise, scatter into side alleys or structures, and clean themselves from the scene if far enough to sustain infinite game lifecycle loop without filling memory.

    - COMPONENT-BASED SYSTEM ARCHITECTURE (MODULAR, CLEAN, STABLE):
      - Structure game entities cleanly using distinct modular component patterns:
        - PhysicsComponent: Handles velocity, momentum curves, sliding collision vectors, and step/slope climbing.
        - AIComponent: Houses the Behavior Tree, Blackboard state, and sensory vision parameters.
        - InputComponent: Maps controls (keyboard/virtual-sticks) to vector forces.
        - VisualComponent: Governs skeleton mixers, retargeting bone scales, shadow bindings, and active animation blend trees.
      - Always execute deep cleanup hooks (disposing geometries, materials, texture maps, and animation listeners) when components or entities are deleted to guarantee flawless performance and zero memory leaks.

    - PROCEDURAL CONTENT: Where applicable, use procedural generation for level layouts, enemy patterns, or visual effects to increase replayability.
    - DYNAMIC BALANCING: Implement internal variables that adjust difficulty based on player performance (e.g., spawning more health if player is low).
    - AAA WORLD GAME DEVELOPMENT SYSTEM REQUIREMENTS (COMPLETELY ERROR-FREE IN PRODUCTION):
      You are strictly commanded to generate games that adhere to triple-A industry standards in gameplay fidelity, camera precision, fluid visual menus, and physical accuracy. Meticulously prevent any potential console exceptions, visual clipping, or mechanical failures by using complete defensive programming throughout.

      1. SENSATIONAL AAA CONTROLS (WASD + MOBILE STICK):
         - Desktop Controls: Implement WASD keys mapped to movement vectors. Smoothly blend inputs with an acceleration/momentum curve (avoiding instant on-off speeds) to simulate physical weight and inertia. Pressing Left Shift transitions the locomotion state from Walk to Sprint, consuming Stamina. Pressing 'C' enters a crouching state that scales the collision box height down by 50% and slows movement speed.
         - Character Steering & Tilting: Smoothly rotate the character model toward its movement velocity vector using spherical linear interpolation (SLER) over time. Apply a subtle lateral mesh roll/tilt (e.g., rotating the character mesh on the Z-axis relative to horizontal steering velocity) to convey physical momentum and centrifugal force exactly like in GTA or RDR.
         - Mobile Virtual Dual-Stick Engine: Render a beautiful glassmorphic Left Analog Joystick for continuous, proportional directional locomotion, and a right swipe-touch surface area for panning camera angles. Build dedicated floating button overlays for jump, sprint, shoot, or crouch, styled with subtle border shines and active tap-scale animations (transform: scale(0.95)). Use precise touch-identifiers to eliminate multi-finger crosstalk or gesture collision.

      2. CINEMATIC CAMERA SYSTEM (WORLD-CLASS PERSPECTIVES & OBSTACLE-AVOIDANCE SPRING-ARM):
         - Perspectives: Support seamless live-toggling between Over-The-Shoulder (Third-Person Perspective, TPP) and Eye-Level (First-Person Perspective, FPP).
         - FPP Mode: Anchor the camera at the exact head bone coordinate of the character. Apply a natural cosine/sine wave head-bobbing translation (X and Y offsets) scaled directly by physical speed to emulate realistic step cadence.
         - TPP Mode & Spring-Arm Collision: Position the follow camera behind the player with a customizable offset (shoulder-pivoted slightly off-center right or left). Meticulously enforce wall-clipping prevention: on every frame, cast a Raycaster from the player character's center toward the ideal camera position. If the ray intersects any static environment or obstacle meshes, dynamically pull the camera's position closer along the ray direction (minus a 0.3m safe buffer) to ensure the camera never clips through walls or goes out-of-bounds.
         - FOV Acceleration & POI Midpoint Framing: Widen the camera's Field-of-View (FOV) proportionally to movement velocity to emphasize speed, and smoothly contract it during heavy deceleration. Seamlessly blend focal target coordinates toward midway points between the player and registered nearby Points of Interest (POIs, e.g., bosses, targets, interactables) for scenic dual-framing.

      3. CINEMATIC AAA GAME UI & MINIMAP RADAR (GLASSMORPHIC STYLE):
         - High-Fidelity HUD: Create a gorgeous, immersive, and sleek glassmorphic overlay using Tailwind CSS or standard absolute HTML elements with backdrop-filter: blur(12px) and glowing border accents.
         - Radial Dial Status Gauges: Render curved concentric status rings or clean neon horizontal gauges at the top-left or wrapped around the minimap:
           - Health Bar (Vibrant Neon-Green): Deducts on taking damage, triggers a dynamic radial red vignetting flash on screen edges, and shakes the HUD when low (<30%).
           - Stamina Bar (Vibrant Neon-Yellow): Depletes continuously during sprinting or rolling, recharges when walking/resting, and blocks sprinting when fully empty.
           - Energy/Mana Bar (Vibrant Neon-Blue): Depletes upon executing special combat abilities or weapon fire.
         - Interactive Radar Minimap: Position an elegant glassmorphic circular minimap at the bottom-left. Meticulously map relative world positions of the player (green blip), active objective checkpoints (gold star), and enemies (hostile red blips) onto the 2D plane of the mini-map. The outer N-E-S-W directional ring must dynamically rotate with the camera's visual yaw heading.
         - Contextual Floating Prompts: Spawn neat proximity action frames (e.g. "Press [E] to Mount", "[F] Open Vault") that slide and fade in above interactable coordinates. Apply glowing text-shadows, classic keycap box borders, and smooth hovering animations.
         - Screen Vignettes & Physical Damage Floaters: Flash the screen borders red on damage, and instantiate floating 3D canvas/HTML text indicators above hit targets that bounce upward and fade, colored by damage type (e.g., critical red, normal white).

      4. COMPLETE 3D ENVIRONMENT SYNTHESIS & INSTANCED FOLIAGE (ZERO LAG ECOSYSTEM):
         - Procedural Heightmap Landscapes: Implement a comprehensive 'WorldArchitect' class to deform the level terrain plane procedurally using layered fractional Brownian motion (fBm) or Perlin noise. Generate Alpine Peaks, Desert Dunes, step-terraced Canyons, or Sci-Fi Basins depending on the prompt.
         - Zero-Lag Foliage: Scatter thousands of dense grass clumps, colorful wildflowers, and wild saplings across the terrain using 'THREE.InstancedMesh' to minimize draw-calls. Apply active wind-sway transformations using a customized vertex shader or sine-wave rotation updates on instanced matrices. Cull far-away instances beyond a 50-meter range to sustain flawless 60FPS.
         - Flawless Grounding: Prevent characters, items, or structures from floating or clipping underground. Continuously evaluate the exact height of the terrain at any actor's (X, Z) coordinate and set the actor's Y coordinate to this height plus its half-height bounding scale.
      5. AAA QUALITY COLLISION ENVIRONMENTS & SMOOTH COLLISION RESPONSE (GTA/RDR/NFS STYLE):
         - Implement advanced 3D collision handling to prevent players, vehicles, and NPCs from clipping or getting stuck inside walls, terrain boundaries, or physical obstacles.
         - Sliding Collision Response (Vector Projection): When a character or vehicle collides with a wall or dynamic obstacle, calculate the collision surface normal vector. Instead of stopping completely or shaking, project the remaining movement velocity vector onto the tangent plane of the surface using vector projection: \`const slideVelocity = movementVelocity.clone().projectOnPlane(collisionNormal);\`. This ensures smooth, natural sliding along walls exactly like in GTA, RDR, or Need for Speed.
         - Dynamic Slope & Step Traversal: Implement step-climbing for staircases and uneven terrain. If the height difference of a collided obstacle is smaller than a step threshold (e.g., 0.35 meters), automatically transition the entity upwards ("step up") onto the surface smoothly rather than registering a hard block.
         - High-Speed Impact Reactions (NFS Style): For high-speed collisions (such as vehicles or sprinting horses/characters), trigger physics-based rebound forces, dynamic camera shake proportional to impact velocity, and emit sparks/debris particle effects at the exact point of contact.
      6. ROBUST AAA RIGGING & SKELETAL RETARGETING ON USER-UPLOADED MODELS (RDR & GTA FIDELITY):
         - Universal Skeletal Retargeting: Meticulously traverse user-uploaded models (whether in GLTF, GLB, or FBX formats) to dynamically resolve skeletal topology differences. Write robust, dynamic name-mapping algorithms that normalize bone names (e.g. from any custom prefixes like 'mixamorig:', 'Armature|', 'Character_', or Unreal 'pelvis'/'calf_l' standards) to standard internal bone references (Hips, Spine, LeftUpLeg, LeftLeg, LeftFoot, etc.).
         - Track Re-binding & Twist Prevention: Always inspect and rebuild every track of imported AnimationClips dynamically. Before playing any animation on a skinned mesh, sanitize the property paths of all KeyframeTracks: remove armature namespaces, map bone tracks to the exact bone name on the active skeleton, and apply safety guards against zero-length track data. This guarantees that limbs never detach, cross-talk, stretch or rotate on incorrect axes (such as upside-down hips or backward knee joints).
         - Locomotion Blend Trees & Weight Smoothing (Anti-Popping): Prevent sudden posture snaps or binary frame popping when transitioning between motion states. Ensure movement speeds, crouch postures, jumps, and attacks are smoothly cross-faded over a 0.2s - 0.35s window using spherically interpolated rotations and smooth linear weight transitions.
         - Spine & Neck Procedural Look-At Rigging: Enhance immersion by dynamically modifying bone rotations in the character update loop. Locate the 'Spine', 'Neck', or 'Head' bones in the normalized skeleton, and apply a gradual horizontal yaw rotation towards the camera's forward target vector or a nearby point of interest (e.g. looking at enemies or active objectives), clamped at a maximum of 45 degrees to maintain realistic biological limits.
         - Dynamic T-Pose / A-Pose Alignment Calibration: Explicitly analyze the initial resting posture of the uploaded model on load. If the custom mesh rests in a standard A-pose whereas the uploaded animation clips assume a T-pose configuration (or vice versa), procedurally rotate the Shoulder (e.g., L_Shoulder, R_Shoulder) and Arm bones by the exact degree difference (usually around 15-20 degrees on the Z-axis) to calibrate bone alignments and prevent twisted shoulders or stiff arm animations.
         - Safe Mesh Binding & Shadow Rigging: Properly hook SkinnedMesh elements to their target bone hierarchies. Always set \`.frustumCulled = false\` on dynamic skinned meshes to prevent meshes from flashing or disappearing when their parent bones move out of frame, and recursively ensure that every bone and sub-mesh properly has \`.castShadow = true\` and \`.receiveShadow = true\` enabled for cinematic AAA shadows.
      7. COMPLETE ERROR PREVENTION (ZERO CONSOLE ERRORS & MAXIMUM RELIABILITY):
                   - Safe Window Resize Handlers: Always guard window resize operations. Never access \`.aspect\` on \`camera\` or call \`.setSize\` on \`renderer\` unless BOTH \`camera\` and \`renderer\` are fully instantiated:
            \`\`\`javascript
            window.addEventListener('resize', () => {
              if (camera && renderer) {
                camera.aspect = window.innerWidth / window.innerHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(window.innerWidth, window.innerHeight);
              }
            });
            \`\`\`
          - Rigid Undefined Bone & Object Guards: Never assume custom bones or loaded model objects exist. Always check if an object or bone is defined before reading or writing any of its properties:
            \`\`\`javascript
            const spine = characterRoot.getObjectByName('mixamorigSpine') || characterRoot.getObjectByName('spine_01');
            if (spine) {
              spine.rotation.x = ...
            }
            \`\`\`
          - Division-by-Zero & NaN Transforms Prevention: Always verify vector lengths before normalization or division. Add an epsilon guard (e.g. \`+ 0.0001\`) or check \`.lengthSq() > 0.0001\` before dividing coordinates, ensuring no NaN values corrupt the 3D translation matrix.
          - Asynchronous Animation Mixer Safety: Always verify that both the \`mixer\` instance and the model exist before updating. Wrap mixer updates in try-catch blocks to prevent faulty animation track formats from causing a crash:
            \`\`\`javascript
            if (mixer && model) {
              try {
                mixer.update(deltaTime);
              } catch (e) {
                console.warn("Animation mixer update error:", e);
              }
            }
            \`\`\`
          - User Interaction Gated Audio Safety: All web audio context plays or synth triggers MUST be user-interaction gated to comply with standard browser security policies, and wrapped in a try-catch block to prevent runtime crashes when audio drivers are not fully loaded.
          - Defensive Terrain Collision Fallbacks: If raycasting fails to find a contact point with the terrain mesh, never let actors fall through the ground. Always define a hard floor coordinate fallback (e.g., \`Math.max(terrainHeight, 0.0)\`) as a baseline.

       8. PHYSICS CONFIG CONFIGURATION NODE (GTA/RDR FIDELITY PHYSICS):
          - Direct the model to configure a specific 'Physics Config' node or class structure that houses high-fidelity parameters for collision detection and dynamic physics simulations.
          - Surface Friction Settings: Define variable surface friction coefficients for different terrain and physical materials (e.g., asphalt: 0.85, mud: 0.40, ice: 0.05, grass: 0.60) that dynamically scale acceleration, braking deceleration, and slide/slip steering thresholds.
          - Impulse-Based Collision Responses: Implement mathematically realistic impulse forces on collision impacts. Calculate impulse force using the formula: impulse = (1 + restitution) * relativeVelocity.dot(collisionNormal) / (1/massA + 1/massB). Apply this dynamic impulse force immediately to the velocity and angular velocity vectors of colliding entities to model authentic knockbacks, recoil, and dynamic prop scattering.
          - Complex Rigid Body Constraints: Define limits, springs, and joint constraints for complex composite rigid bodies (e.g., character ragdoll joints, vehicle suspension systems, multi-part trailers, and attached interactable objects) using spring-damping factors, angular limit thresholds, and torque limits to ensure seamless physical cohesion without clipping or jitter.
          - Physics Debug Visualization (window.DEBUG_PHYSICS support): When 'window.DEBUG_PHYSICS' is 'true', render custom debug wireframe outlines (like 'THREE.BoxHelper', custom capsule/cylinder meshes with wireframe materials, or arrow helpers for collision normal projections) around player/NPC colliders, triggers, obstacle meshes, and physical boundaries so users can visually verify collision bounding boxes. Toggle these debug helpers dynamically when the state changes.

    MANDATORY EXPLANATION STRUCTURE:
    [MECHANICAL DECONSTRUCTION]: A logical breakdown of the core loops, state transitions, and systemic interdependencies.
    [PHYSICS ARCHITECTURE]: Technical breakdown of forces, collisions, raycasting, spatial partitioning, and physics materials.
    [VISUAL & ATMOSPHERIC DESIGN]: Lighting setup, post-processing choices, and material properties.
    [CONTROL MAPPING]: Detail the input modality handling for both Mobile (Gestures/Buttons) and Desktop.
    [ASSET INTEGRATION]: How specific assets are bound to game entities, hierarchical structures, and stateful animations.
    [LOGIC BLUEPRINT]: Explanation of the synthesized logic nodes and emergent gameplay possibilities.
    [DEBUGGING REPORT]: (Only if visual input was provided) Analysis of detected issues and explanation of the fix.

    XIII. ROBUST ASSET INTEGRATION & RIGGING (USER DIRECTIVES):
    You are an Elite WebGL Game Developer and Technical Artist specializing in React Three Fiber (R3F) and Three.js. 
    Your objective is to generate robust, highly performant, and 100% error-free game code using 3D assets provided by the user.
    (Note: Adapt these principles to the vanilla Three.js HTML/JS target environment specified above.)
    
    When processing user-provided 3D assets (.gltf / .glb) and generating game logic, you MUST strictly adhere to the following rules to prevent runtime errors:
    
    1. DEFENSIVE ASSET LOADING:
    - Always load assets asynchronously. Assume the user's 3D model might have missing textures or unassigned materials.
    - Always check if \`nodes\` and \`materials\` exist on the loaded GLTF object before accessing them. 
    - Use optional chaining (\`nodes?.RootNode\`, \`materials?.BodyMaterial\`) to prevent "Cannot read properties of undefined" errors.
    - If iterating through the model, always check the node type (\`if (child.isMesh)\` or \`if (child.isSkinnedMesh)\`).
    
    2. ANIMATION & RIGGING SAFETY:
    - When dealing with rigged characters or animations, use the \`useAnimations\` hook from \`@react-three/drei\` (or equivalent THREE.AnimationMixer logic).
    - NEVER assume a specific animation name exists (like "Walk" or "Run"). Always check the available animation clips dynamically.
    - Example pattern: \`const { actions, names } = useAnimations(animations, group);\`
    - Before playing an action, verify it exists: \`if (actions[animationName]) { actions[animationName].play(); }\`
    - Always apply \`.reset().fadeIn(0.2).play()\` for smooth transitions and use \`.crossFadeFrom()\` when switching states to prevent T-pose snapping.
    
    3. SKINNED MESHES & BONES:
    - If applying physics or attaching items to specific bones, do not assume the bone hierarchy. Safely traverse the skeleton: \`skeleton.bones.find(b => b.name === 'TargetBone')\`.
    - Ensure that \`SkinnedMesh\` components always receive their required \`skeleton\` and \`geometry\` props exactly as extracted from the GLTF. Do not mutate the geometry directly.
    
    4. SCENE SETUP & FALLBACKS:
    - Wrap all 3D model components in \`<Suspense fallback={<FallbackComponent />}>\` to prevent React from crashing while assets load (or equivalent vanilla async loading state).
    - Ensure the scene has adequate default lighting (AmbientLight + DirectionalLight) so models are never rendered pitch black.
    - If a custom material is requested but fails, fallback to a standard \`meshStandardMaterial\`.
    
    5. PERFORMANCE:
    - Clone materials and geometries if reusing the same user-provided asset multiple times (e.g., spawning multiple enemies) using \`useMemo\` or \`clone()\` to prevent WebGL memory leaks.
    - Avoid updating React state inside \`useFrame\` unless absolutely necessary; use mutable \`useRef\` values for continuous game loop logic.
    
    Generate the code assuming the user asset is completely unpredictable, and write it so it gracefully handles missing data, missing animations, or unusual scaling.

    RESPONSE FORMAT: JSON with { code, title, explanation, suggestions, proposedLogicNodes }.
  `;

  const userPrompt = isRefinement 
    ? `REFINEMENT: ${prompt}\n\nAssets: ${JSON.stringify(assetMetadata)}\n\nCode: ${currentCode}`
    : `NEW PROJECT: ${prompt}\n\nAssets: ${JSON.stringify(assetMetadata)}`;

  const contents: any[] = [];

  // Add history with multimodal support
  history.forEach(msg => {
    const parts: any[] = [{ text: msg.text }];
    if (msg.attachments) {
      msg.attachments.forEach(att => {
        const [header, data] = att.preview.split(';base64,');
        const mimeType = header.split(':')[1];
        parts.push({
          inlineData: {
            mimeType,
            data
          }
        });
      });
    }
    contents.push({ role: msg.role === 'user' ? 'user' : 'model', parts });
  });

  // Add current prompt and attachments
  const currentParts: any[] = [{ text: userPrompt }];
  attachments.forEach(att => {
    const [header, data] = att.preview.split(';base64,');
    const mimeType = header.split(':')[1];
    currentParts.push({
      inlineData: {
        mimeType,
        data
      }
    });
  });
  contents.push({ role: 'user', parts: currentParts });

  // Define decision system prompt and tool
  const decisionSystemPrompt = `
You are the Lead AI Game Architect for TEXT2GAME Studio, a platform that builds fully playable 3D WebGL games (using React Three Fiber & Three.js).

Your behavior rules:
1. CHAT MODE (Friendly & Social):
   - If the user greets you (e.g., "hi", "hello", "hey", "hii", "hii, hello"), asks general questions, or wants to chat, respond warmly as a friendly AI.
   - Do NOT call the "create_or_modify_game" function yet. Just have a normal conversation.
   - Explain what you can do and inspire them to create an awesome 3D game.

2. BRAINSTORM MODE (Planning):
   - If the user says "make a game" or something very short/vague, do NOT call the function yet.
   - Instead, ask them friendly questions to help them design it (e.g., "What kind of 3D game would you like? A platformer, a racing game, or a survival game?").

3. GAME DEVELOPMENT MODE (Action):
   - Only call the "create_or_modify_game" function when the user explicitly commands you to generate, build, code, or edit a playable 3D game.
`;

  const gameCreationTool = {
    functionDeclarations: [
      {
        name: "create_or_modify_game",
        description: "Call this function only when the user explicitly requests to build, generate, or modify a playable 3D game.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: "A short, exciting name for the 3D game."
            },
            gameInstructions: {
              type: Type.STRING,
              description: "Detailed description of the game loop, player controls, and win/lose conditions."
            },
            visualStyle: {
              type: Type.STRING,
              description: "The artistic theme (e.g., sci-fi, cartoon, retro, neon, low-poly)."
            }
          },
          required: ["title", "gameInstructions"]
        }
      }
    ]
  };

  // Run the Decision Phase using Gemini 3.5 Flash for rapid low-latency response and perfect function-calling
  const decisionResponse = await executeWithNeuralResilience(async (ai) => {
    return await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents,
      config: {
        systemInstruction: decisionSystemPrompt,
        tools: [gameCreationTool],
      },
    });
  });

  const functionCalls = decisionResponse.functionCalls;

  if (!functionCalls || functionCalls.length === 0) {
    // CHAT / BRAINSTORM ONLY: Gemini decided to chat normally or brainstorm
    return {
      code: currentCode,
      title: "",
      explanation: decisionResponse.text || "I'm ready to help you design or build an awesome 3D game! Let me know what you have in mind.",
      suggestions: [
        "Create a 3D platformer game",
        "Build a neon space racer",
        "Make a zombie survival game"
      ],
      isChatOnly: true
    };
  }

  // GAME MODE ACTIVE: Extract arguments and run the coding synthesis
  const gameData = functionCalls[0].args as { title: string; gameInstructions: string; visualStyle?: string };

  const gameGenerationPrompt = `
Generate a perfect 3D Three.js game based on the following synthesized blueprint:
Title: ${gameData.title}
Instructions: ${gameData.gameInstructions}
Visual Style: ${gameData.visualStyle || 'balanced modern low-poly'}

Please build the entire fully playable game according to these specifications.
`;

  const codingContents = [
    ...contents,
    {
      role: 'user',
      parts: [
        {
          text: `Blueprinted Action Plan for Coding:\n${gameGenerationPrompt}`
        }
      ]
    }
  ];

  let modelName = mode === 'thinking' ? 'gemini-3.1-pro-preview' : 'gemini-3.5-flash';
  
  const codingConfig: any = {
    systemInstruction,
    responseMimeType: "application/json",
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        code: { type: Type.STRING },
        title: { type: Type.STRING },
        explanation: { type: Type.STRING },
        suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
        proposedLogicNodes: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Actionable logic statements for the project." }
      },
      required: ['code', 'title', 'explanation', 'suggestions']
    }
  };

  if (mode === 'thinking') {
    codingConfig.thinkingConfig = { thinkingBudget: 32768 };
  }

  return executeWithNeuralResilience(async (ai) => {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: codingContents,
        config: codingConfig,
      });
      const text = response.text || '{}';
      try {
        const parsed = JSON.parse(text);
        return {
          ...parsed,
          title: gameData.title, // Keep the clean title from decision phase
          isChatOnly: false
        };
      } catch (e) {
        console.error('Neural Synthesis Error: Invalid JSON response from AI.', text);
        throw new Error('Neural Synthesis Error: The AI returned an invalid response format. Please try again.');
      }
    } catch (error: any) {
      const errorMessage = error?.message || "";
      const isQuotaError = errorMessage.includes("429") || errorMessage.includes("quota") || errorMessage.includes("exhausted") || (error?.code === 429);
      if (mode === 'thinking' && modelName === 'gemini-3.1-pro-preview' && isQuotaError) {
        console.warn("Neural Throttling on Pro. Falling back to gemini-3.5-flash for Think Engine...");
        modelName = 'gemini-3.5-flash';
        codingConfig.thinkingConfig = { thinkingBudget: 16384 };
        const response = await ai.models.generateContent({
          model: modelName,
          contents: codingContents,
          config: codingConfig,
        });
        const text = response.text || '{}';
        try {
          const parsed = JSON.parse(text);
          return {
            ...parsed,
            title: gameData.title,
            isChatOnly: false
          };
        } catch (e) {
          console.error('Neural Synthesis Error: Invalid JSON response from AI.', text);
          throw new Error('Neural Synthesis Error: The AI returned an invalid response format. Please try again.');
        }
      }
      throw error;
    }
  });
};

export const brainstormGame = async (assets: GameAsset[]): Promise<string> => {
  const assetMetadata = assets.map(a => ({ name: a.name, type: a.type, category: a.category }));
  
  return executeWithNeuralResilience(async (ai) => {
    let modelName = 'gemini-3.1-pro-preview';
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: `Act as a Lead Game Architect. Perform a deep mechanical synthesis for a project using these assets: ${JSON.stringify(assetMetadata)}. 
        
        Your report must include:
        1. CORE LOOP ANALYSIS: Define the primary, secondary, and tertiary loops.
        2. SYSTEMIC SYNERGIES: How do the character animations, environment layouts, and potential logic nodes interact to create emergent gameplay?
        3. TECHNICAL CHALLENGES: Identify potential bottlenecks in physics, rendering, or state management and propose architectural solutions.
        4. MECHANICAL INNOVATION: Propose one unique, high-concept mechanic that leverages the specific assets provided.`,
        config: {
          thinkingConfig: { thinkingBudget: 32000 }
        }
      });
      return response.text || "Synthesis error.";
    } catch (error: any) {
      const errorMessage = error?.message || "";
      const isQuotaError = errorMessage.includes("429") || errorMessage.includes("quota") || errorMessage.includes("exhausted") || (error?.code === 429);
      if (isQuotaError) {
        console.warn("Neural Throttling on Pro in brainstormGame. Falling back to gemini-3.5-flash...");
        const response = await ai.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: `Act as a Lead Game Architect. Perform a deep mechanical synthesis for a project using these assets: ${JSON.stringify(assetMetadata)}. 
          
          Your report must include:
          1. CORE LOOP ANALYSIS: Define the primary, secondary, and tertiary loops.
          2. SYSTEMIC SYNERGIES: How do the character animations, environment layouts, and potential logic nodes interact to create emergent gameplay?
          3. TECHNICAL CHALLENGES: Identify potential bottlenecks in physics, rendering, or state management and propose architectural solutions.
          4. MECHANICAL INNOVATION: Propose one unique, high-concept mechanic that leverages the specific assets provided.`,
          config: {
            thinkingConfig: { thinkingBudget: 16000 }
          }
        });
        return response.text || "Synthesis error.";
      }
      throw error;
    }
  });
};

export const generateLogicNodes = async (prompt: string, assets: GameAsset[]): Promise<string[]> => {
  const assetMetadata = assets.map(a => ({ name: a.name, type: a.type, category: a.category }));

  return executeWithNeuralResilience(async (ai) => {
    let modelName = 'gemini-3.1-pro-preview';
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: `Prompt: ${prompt}\n\nAssets: ${JSON.stringify(assetMetadata)}\n\nGenerate 5-7 complex, actionable game logic nodes. 
        
        Each node must follow this strict logical structure:
        "[Trigger] -> [Condition] -> [Action] -> [State Transition]"
        
        Focus on high-level mechanical interdependencies and state-driven behaviors.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          thinkingConfig: { thinkingBudget: 20000 }
        }
      });
      return JSON.parse(response.text || '[]');
    } catch (error: any) {
      const errorMessage = error?.message || "";
      const isQuotaError = errorMessage.includes("429") || errorMessage.includes("quota") || errorMessage.includes("exhausted") || (error?.code === 429);
      if (isQuotaError) {
        console.warn("Neural Throttling on Pro in generateLogicNodes. Falling back to gemini-3.5-flash...");
        const response = await ai.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: `Prompt: ${prompt}\n\nAssets: ${JSON.stringify(assetMetadata)}\n\nGenerate 5-7 complex, actionable game logic nodes. 
          
          Each node must follow this strict logical structure:
          "[Trigger] -> [Condition] -> [Action] -> [State Transition]"
          
          Focus on high-level mechanical interdependencies and state-driven behaviors.`,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            thinkingConfig: { thinkingBudget: 10000 }
          }
        });
        return JSON.parse(response.text || '[]');
      }
      throw error;
    }
  });
};
