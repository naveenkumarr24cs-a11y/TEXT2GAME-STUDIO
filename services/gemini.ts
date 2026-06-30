
import { GoogleGenAI } from "@google/genai";
// Imports the necessary types from '../types' to resolve 'Cannot find name' errors.
import { GameAsset, ChatMessage, AIModelMode } from '../types';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Executes API calls with high resilience.
 * Handles 429 (Quota) via backoff and 404 (Key Selection) via the studio dialog.
 */
async function executeWithNeuralResilience<T>(operation: (ai: GoogleGenAI) => Promise<T>, maxRetries = 5): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const apiKey = (typeof window !== 'undefined' ? localStorage.getItem('GEMINI_API_KEY') : null) || process.env.API_KEY;
    if (!apiKey) {
      throw new Error("An API Key must be set when running in a browser. Click the 'Config Key' button at the top right to configure your Gemini API key.");
    }
    const ai = new GoogleGenAI({ apiKey });

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

      // Handle 429 (Rate Limit) or 503 (Overloaded) with exponential backoff
      const isOverloadError = errorMessage.includes("503") || errorMessage.includes("UNAVAILABLE") || errorMessage.includes("overloaded") || errorMessage.includes("high demand") || (error?.code === 503);
      if (isQuotaError || isOverloadError) {
        if (attempt < maxRetries - 1) {
          const waitTime = Math.pow(2, attempt) * 2000;
          console.warn(`Neural Throttling: Retrying in ${waitTime}ms (Attempt ${attempt + 1}/${maxRetries})...`);
          await sleep(waitTime);
          continue; // Retry after delay.
        } else {
          const quotaError = new Error(
            isOverloadError
              ? "The AI model is experiencing high demand. Please wait a few seconds and try again."
              : "API Quota Exceeded. You've sent too many requests. Please wait and try again, or check your API limits."
          );
          (quotaError as any).code = error?.code;
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
): Promise<{ code: string; title: string; explanation: string; suggestions: string[]; proposedLogicNodes?: string[] }> => {
  
  const assetMetadata = assets.map(a => ({
    name: a.name,
    type: a.type,
    mimeType: a.mimeType,
    category: a.category,
    isOptimized: !!a.isOptimized,
    logicContext: a.type === 'dialogue' ? a.content : undefined
  }));

  const isRefinement = history.length > 0 && currentCode !== "";

  const systemInstruction = `
    You are the "Core Neural Architect" of ForgeAI Studio. Your mission is to synthesize high-fidelity, fully playable HTML5 games that rival professional indie titles.
    
    CORE OPERATING MANDATE:
    Deliver a complete, polished 3D simulation using Three.js. The output must be a self-contained, high-performance substrate with professional-grade visuals and mechanics.
    THE CODE MUST BE WRAPPED IN VALID HTML/JS tags, typically \`<!DOCTYPE html><html><head>...</head><body>...</body></html>\`.
    
    CRITICAL CODE SIZE & INTEGRITY LIMITATION:
    - The generated code must be extremely concise, clean, and efficient.
    - Avoid verbose comments, redundant helper functions, or oversized assets.
    - Keep the entire HTML/JS payload under 6,000 tokens (or ~25,000 characters) so it never gets truncated.
    - Focus on a solid, working implementation of the core mechanics instead of writing complex custom physics or AI systems from scratch.
    - Always ensure all tags, brackets, and parentheses are closed. Never leave code unfinished.
    CRITICAL: You MUST include the Three.js library via CDN in the head tag. Do NOT assume it is injected. Example:
    \`<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>\`
    If you need extensions (like OrbitControls or GLTFLoader), include them appropriately, ensuring they match the Three.js version.
    
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

    V. VISUAL FIDELITY & ATMOSPHERE:
    - LIGHTING & SHADOWS: Use high-quality shadows (THREE.PCFSoftShadowMap). Implement dynamic lighting (PointLights, SpotLights) for atmosphere.
    - POST-PROCESSING: Implement a basic post-processing stack (Bloom, ToneMapping, Color Correction) if it fits the genre.
    - MATERIALS: Use THREE.MeshStandardMaterial with high-quality roughness/metalness settings. Implement environment mapping (CubeTexture or Equirectangular) for reflections.
    - PARTICLES: Create custom GPU or CPU particle systems for explosions, dust, magic, or weather effects.

    VI. GAME LOOP & UI ARCHITECTURE:
    - STATE MANAGEMENT: Implement a robust Game State Manager (MENU, PLAYING, PAUSED, GAMEOVER, WIN).
    - PROFESSIONAL UI: Create a stylized, responsive HUD using HTML/CSS overlays. Include health bars, score counters, and context-sensitive prompts.
    - GAME JUICE: Implement screen shake, hit-stop effects, and smooth tweening (using TWEEN.js or simple lerping) for all UI and mechanical transitions.

    VII. DETAILED ASSET MAPPING & BINDING:
    - PRE-SYNTHESIS AUDIT: Analyze the 'assets' list semantically. If a 'Sword' is present, implement a combat system. If a 'Key' is present, implement a locking mechanism.
    - HOLISTIC MAPPING: Every asset MUST be mapped to a functional game entity with a clear role.
    - CHARACTERS: Bind to SkinnedMeshes or hierarchical groups. Implement sophisticated state-based animations (Idle, Walk, Run, Jump, Fall, Land, Attack, Hit, Die) using THREE.AnimationMixer.
    - ENVIRONMENT: Map to static geometry with optimized collision hulls (Box, Sphere, or Convex Polyhedron).
    - Use 'window.getAssetUrl(name)' for all binary loading. DO NOT define this function yourself; it is provided by the environment.

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
    - UNIFIED INPUT MAPPING:
        - MOVEMENT: Use 'window.joystickState' (x, y, active) for all movement. On Desktop, the engine should map WASD/Arrows to this state. On Mobile, the virtual joystick handles it.
        - ACTIONS: Use 'window.actionState.primary' for the main action (Jump/Shoot/Interact). Map Space/Left-Click (Desktop) and the virtual Action Button (Mobile) to this state.
        - GESTURES: Use 'window.gestureState' (swipe, tap) for secondary mechanics.
    - MOBILE (TOUCH) & PC (DESKTOP) ROBUSTNESS:
        - Check \`navigator.userAgent\` or touches to handle specific UI/input overlays.
        - Mobile mode should support both landscape and portrait depending on standard game norms, adjusting camera FoV if needed.
        - VIRTUAL CONTROLS: A virtual joystick (left) and action button (right) are automatically provided in 'mobile' mode, or implement your own resilient onscreen controls overlay (HTML) if needed.
        - DESKTOP: Pointer lock (\`requestPointerLock\`) for 3D first-person/third-person cameras. Keyboard events should be buffered.
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

    XII. FBX & ANIMATION PIPELINE & ADVANCED RIGGING (CRITICAL):
    - If assets are .fbx, use THREE.FBXLoader.
    - ANIMATION EXTRACTION: FBX animations are often stored in separate files. Load the animation file, take the first clip from 'result.animations[0]', and play it on the main character's mixer.
    - THE T-POSE PREVENTER: You MUST call 'mixer.update(deltaTime)' in every frame of the game loop. If you don't, the character will never move from its initial T-pose.
    - MIXER BINDING: Ensure the mixer is bound to the top-level Group of the loaded character.
    - SKELETAL CONTROL & IK: Direct manipulation of THREE.Skeleton bones for procedural look-at targets (head tracking), IK foot placement on uneven terrain, or dynamic weapon aiming.
    - BLEND SPACES & LAYERING: When combining animations, use multi-dimensional blend spaces (e.g., blending Idle to Walk to Run based on speed magnitude), and overlay upper-body actions (like shooting) using Animation Layers or isolated bone mixers.
    - PROCEDURAL ANIMATION: Implement sine/cosine waves for procedural breathing, hovering, or organic recoil to augment baked animations.

    XIII. COMPLEX GAMEPLAY SYSTEMS & ADVANCED NPC AI (ADVANCED):
    - COMPONENT-BASED ACTORS: Structure game entities using a "Component" approach (e.g., an Actor has a 'PhysicsComponent', 'InputComponent', and 'VisualComponent').
    - BEHAVIORAL ARCHITECTURE: Move beyond simple if/else logic for NPCs. Design Hierarchical State Machines (HSM), Goal-Oriented Action Planning (GOAP), or Utility Systems for emergent, intelligent behavior.
    - SENSORY SYSTEMS: Implement sophisticated 'Vision Cones' (using dot products and raycast occlusion) and 'Hearing' (distance-based sound propagation events) for stealth and aggro mechanics.
    - PATHFINDING & GROUP DYNAMICS: Outline A* grid logic, NavMesh-based movement vectors, steering behaviors, and simple flocking (Boids) algorithms for coordinated enemy formations.
    - PROCEDURAL CONTENT: Where applicable, use procedural generation for level layouts, enemy patterns, or visual effects to increase replayability.
    - DYNAMIC BALANCING: Implement internal variables that adjust difficulty based on player performance (e.g., spawning more health if player is low).

    XIV. LOGICAL ROBUSTNESS, DOM INITIALIZATION & GAMEPLAY DEPTH (CRITICAL):
    - DOM SAFEGUARDS: Always wrap all DOM queries, element styling, and game initialization code inside a \`window.addEventListener('load', ...)\` or \`document.addEventListener('DOMContentLoaded', ...)\` block. Alternatively, place all script blocks at the bottom of the HTML \`<body>\` tag.
    - NULL CHECKS: Never access properties of DOM elements (such as \`.style\`, \`.appendChild\`, etc.) without performing a null check first (e.g., \`const container = document.getElementById('container'); if (container) { ... }\`). This prevents "Cannot read properties of null (reading 'style')" runtime crashes.
    - GAMEPLAY DEPTH: Avoid trivial, empty, or static simulations. Always include a complete game loop, win/loss states, player scoring or progress trackers, responsive controls, and active gameplay elements (like moving enemies or obstacles).
    - FULL FUNCTIONALITY: Write complete, operational code. Never leave stub methods, placeholder comments (like "// implement physics here"), or empty event handlers.

    MANDATORY EXPLANATION STRUCTURE:
    Write a natural, friendly, and conversational response (like a helpful AI assistant) explaining what you just built or changed in the game. 
    Do NOT use robotic headers like [MECHANICAL DECONSTRUCTION] or [LOGIC BLUEPRINT]. 
    Talk directly to the user, enthusiastically describing the game mechanics, the assets you used, and how to play the game. Keep it engaging, helpful, and concise!

    RESPONSE FORMAT: JSON with { code, title, explanation, suggestions, proposedLogicNodes }.
  `;

  const jsonInstruction = `\n\nCRITICAL: Your response MUST be valid JSON only. No markdown, no code fences, no explanation outside the JSON. Return ONLY a raw JSON object with these exact keys: { "code": "...", "title": "...", "explanation": "...", "suggestions": [...], "proposedLogicNodes": [...] }`;

  const userPrompt = isRefinement 
    ? `REFINEMENT: ${prompt}\n\nAssets: ${JSON.stringify(assetMetadata)}\n\nCurrent Code: ${currentCode}${jsonInstruction}`
    : `NEW PROJECT: ${prompt}\n\nAssets: ${JSON.stringify(assetMetadata)}${jsonInstruction}`;

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

  const modelName = 'gemini-2.5-flash';
  
  const config: any = {
    systemInstruction,
    responseMimeType: "application/json",
    maxOutputTokens: 8192
  };

  return executeWithNeuralResilience(async (ai) => {
    const response = await ai.models.generateContent({
      model: modelName,
      contents,
      config,
    });
    const text = (response.text || '').trim();
    try {
      // First attempt: direct parse
      return JSON.parse(text);
    } catch {
      // Second attempt: extract JSON from markdown code fence
      const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenceMatch) {
        try { return JSON.parse(fenceMatch[1].trim()); } catch {}
      }
      // Third attempt: find first { ... } block
      const braceStart = text.indexOf('{');
      const braceEnd = text.lastIndexOf('}');
      if (braceStart !== -1 && braceEnd > braceStart) {
        try { return JSON.parse(text.slice(braceStart, braceEnd + 1)); } catch {}
      }
      console.error('Neural Synthesis Error: Could not parse AI response.', text.substring(0, 500));
      throw new Error('Neural Synthesis Error: The AI returned an invalid response format. Please try again or simplify your prompt.');
    }
  });
};

export const brainstormGame = async (assets: GameAsset[]): Promise<string> => {
  const assetMetadata = assets.map(a => ({ name: a.name, type: a.type, category: a.category }));
  
  return executeWithNeuralResilience(async (ai) => {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Act as a Lead Game Architect. Perform a deep mechanical synthesis for a project using these assets: ${JSON.stringify(assetMetadata)}. 
      
      Your report must include:
      1. CORE LOOP ANALYSIS: Define the primary, secondary, and tertiary loops.
      2. SYSTEMIC SYNERGIES: How do the character animations, environment layouts, and potential logic nodes interact to create emergent gameplay?
      3. TECHNICAL CHALLENGES: Identify potential bottlenecks in physics, rendering, or state management and propose architectural solutions.
      4. MECHANICAL INNOVATION: Propose one unique, high-concept mechanic that leverages the specific assets provided.`,
      config: {
        thinkingConfig: { thinkingBudget: 4096 }
      }
    });
    return response.text || "Synthesis error.";
  });
};

export const generateLogicNodes = async (prompt: string, assets: GameAsset[]): Promise<string[]> => {
  const assetMetadata = assets.map(a => ({ name: a.name, type: a.type, category: a.category }));

  return executeWithNeuralResilience(async (ai) => {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Prompt: ${prompt}\n\nAssets: ${JSON.stringify(assetMetadata)}\n\nGenerate 5-7 complex, actionable game logic nodes. 
      
      Each node must follow this strict logical structure:
      "[Trigger] -> [Condition] -> [Action] -> [State Transition]"
      
      Focus on high-level mechanical interdependencies and state-driven behaviors.
      
      IMPORTANT: Respond ONLY with a valid JSON array of strings. No markdown, no explanation, just the raw JSON array.`,
      config: {
        responseMimeType: "application/json",
        maxOutputTokens: 2048
      }
    });
    const text = (response.text || '').trim();
    try {
      return JSON.parse(text);
    } catch {
      // Try extracting from a code fence
      const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenceMatch) {
        try { return JSON.parse(fenceMatch[1].trim()); } catch {}
      }
      // Try extracting [...] block
      const arrayStart = text.indexOf('[');
      const arrayEnd = text.lastIndexOf(']');
      if (arrayStart !== -1 && arrayEnd > arrayStart) {
        try { return JSON.parse(text.slice(arrayStart, arrayEnd + 1)); } catch {}
      }
      return [];
    }
  });
};

export const classifyIntent = async (prompt: string): Promise<'chat' | 'game'> => {
  try {
    return await executeWithNeuralResilience(async (ai) => {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `You are an intent classifier for a game engine AI. 
        Classify the following user message as either "chat" or "game".
        
        Rules:
        - "game": The default intent. If the user asks to create, build, make, generate, add, change, fix, or mentions a game, mechanics, characters, or 3D assets, it is ALWAYS "game". Even simple phrases like "create a game" or "make a car game" must be "game".
        - "chat": ONLY use this for simple greetings (hi, hello), small talk, saying thanks, or asking "what can you do?". If there is ANY mention of creating or modifying a game, do NOT use "chat".
        
        Respond ONLY with the exact word "chat" or "game". Do not include any other text, markdown, or punctuation.
        
        User message: "${prompt}"`,
        config: {
          maxOutputTokens: 10,
          temperature: 0.1
        }
      });
      
      const text = (response.text || '').trim().toLowerCase();
      return text.includes('chat') && !text.includes('game') ? 'chat' : 'game';
    });
  } catch (error) {
    console.warn("Intent classification failed, defaulting to 'game':", error);
    return 'game'; // Default to game if network fails, to allow game generation to try
  }
};

export const chatWithAI = async (prompt: string, history: ChatMessage[] = []): Promise<string> => {
  return executeWithNeuralResilience(async (ai) => {
    const contents: any[] = [];
    
    history.forEach(msg => {
      contents.push({ role: msg.role === 'user' ? 'user' : 'model', parts: [{ text: msg.text }] });
    });
    
    contents.push({ role: 'user', parts: [{ text: prompt }] });
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
      config: {
        systemInstruction: "You are a helpful, friendly AI assistant built into TEXT2GAME STUDIO. You can build 3D games from scratch using text prompts. Respond to the user naturally, keep it brief and conversational.",
        maxOutputTokens: 1024
      }
    });
    
    return (response.text || '').trim() || "I'm here to help!";
  });
};
