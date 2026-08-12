/**
 * Central AI Router — Text2Game Studio
 * Routes game generation requests to the correct AI provider.
 * Supports: Gemini, Grok (xAI), Hugging Face (Qwen 2.5 Coder 32B), Ollama (local)
 */

import { GoogleGenAI, Type } from '@google/genai';
import { GameAsset, ChatMessage, AIModelMode, AIProvider, AIModelConfig } from '../types';
import { callHuggingFace, HFMessage } from './huggingface';
import { callGrok, GrokMessage } from './grok';
import { callOllama, OllamaMessage } from './ollama';

// ─────────────────────────────────────────────────────────────────────────────
// MASTER NEURAL ARCHITECT SYSTEM PROMPT
// Shared across ALL providers for consistent, high-quality game output.
// ─────────────────────────────────────────────────────────────────────────────
export const NEURAL_ARCHITECT_SYSTEM_PROMPT = `
You are the "Core Neural Architect" of Text2Game Studio. Your mission is to synthesize high-fidelity, fully playable HTML5 games that rival professional indie titles.

CRITICAL OUTPUT FORMAT:
You MUST return a JSON object with this EXACT structure:
{
  "code": "<complete HTML game code here>",
  "title": "<short exciting game title>",
  "explanation": "<friendly explanation of what was built>",
  "suggestions": ["suggestion 1", "suggestion 2", "suggestion 3"]
}

CORE MANDATE:
- Deliver a complete, polished 3D simulation using Three.js.
- The code field must contain a self-contained HTML5 game: <!DOCTYPE html><html><head>...</head><body>...</body></html>
- ALL JavaScript must be inline inside the HTML. No external JS file imports except CDN libraries.

CRITICAL CDN LIBRARIES (always include exactly these):
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js"></script>
<script src="https://cdn.jsdelivr.net/npm/fflate@0.7.4/umd/index.js"></script>

ASSET LOADING:
- Use window.getAssetUrl(assetName) to load any user-uploaded 3D models, textures, or audio.
- This function is pre-defined in the environment — DO NOT redefine it.
- Example: loader.load(window.getAssetUrl('character1'), ...)

ANIMATION & RIGGING (CRITICAL):
- When user uploads character + skeleton assets, implement full AnimationRetargetingSuite.
- Strip bone name prefixes (mixamorig:, Armature/, etc.) from animation track paths.
- Use THREE.AnimationMixer for all animations.
- Implement smooth crossfade transitions between states (idle, walk, run, jump, attack).
- Apply Procedural IK for foot grounding on terrain.

GAME QUALITY STANDARDS:
- Implement proper physics with gravity, collision detection using raycasting.
- Add a minimap, health bar, stamina bar in a glassmorphic HUD.
- Generate procedural terrain using fractional Brownian motion if no environment asset provided.
- Add atmospheric fog, directional sunlight with shadows, and hemisphere ambient light.
- Implement mobile touch controls (virtual joystick + action buttons) if window.FORGE_DEVICE === 'mobile'.
- Add keyboard controls: WASD/Arrows for movement, Space for jump, Shift for sprint.

ERROR PREVENTION:
- Guard all null references: if (mixer && model) { try { mixer.update(dt); } catch(e) {} }
- Guard resize: window.addEventListener('resize', () => { if (camera && renderer) { ... } });
- Cap deltaTime to 0.1s to prevent physics explosions.
- Use fallback procedural meshes when 3D models are loading.
`;

// ─────────────────────────────────────────────────────────────────────────────
// CHAT-ONLY DECISION PROMPT
// ─────────────────────────────────────────────────────────────────────────────
const DECISION_PROMPT = `
You are a friendly AI game architect assistant for Text2Game Studio.

Rules:
1. If user greets you or asks general questions → respond warmly in plain text, DO NOT build a game.
2. If user says something vague like "make a game" → ask clarifying questions about game type.
3. If user gives clear game instructions → respond with JSON {"action":"build_game"}.
4. If user wants to chat → respond with JSON {"action":"chat","reply":"your response here"}.

ALWAYS respond with valid JSON: {"action":"build_game"} or {"action":"chat","reply":"..."}
`;

// ─────────────────────────────────────────────────────────────────────────────
// GEMINI-SPECIFIC GENERATION (keeps original 2-phase logic)
// ─────────────────────────────────────────────────────────────────────────────
async function generateWithGemini(
  prompt: string,
  assets: GameAsset[],
  history: ChatMessage[],
  currentCode: string,
  mode: AIModelMode,
  attachments: any[]
): Promise<{ code: string; title: string; explanation: string; suggestions: string[]; proposedLogicNodes?: string[]; isChatOnly?: boolean }> {
  // Import the original generateGame from gemini.ts
  const { generateGame } = await import('./gemini');
  return generateGame(prompt, assets, history, currentCode, mode, attachments);
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERIC GENERATION (Grok, HF, Ollama)
// ─────────────────────────────────────────────────────────────────────────────
async function generateWithGenericProvider(
  prompt: string,
  assets: GameAsset[],
  history: ChatMessage[],
  currentCode: string,
  config: AIModelConfig,
  callFn: (messages: any[], ...args: any[]) => Promise<string>,
  extraArg?: string
): Promise<{ code: string; title: string; explanation: string; suggestions: string[]; isChatOnly?: boolean }> {
  
  const assetMetadata = assets.map(a => ({
    name: a.name,
    type: a.type,
    mimeType: a.mimeType,
    category: a.category,
    isOptimized: !!a.isOptimized,
    animationMappings: a.animationMappings,
  }));

  const isRefinement = history.length > 0 && currentCode !== '';

  // Phase 1: Decision — is this a game build request or chat?
  const decisionMessages: any[] = [
    { role: 'system', content: DECISION_PROMPT },
    ...history.slice(-6).map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.text,
    })),
    { role: 'user', content: prompt },
  ];

  let decisionText = '';
  try {
    const args = extraArg ? [decisionMessages, extraArg] : [decisionMessages];
    decisionText = await callFn(...args as [any[]]);
  } catch (e: any) {
    throw e;
  }

  // Parse decision
  let decision: { action: string; reply?: string } = { action: 'build_game' };
  try {
    // Extract JSON from response
    const jsonMatch = decisionText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      decision = JSON.parse(jsonMatch[0]);
    }
  } catch {
    // If we can't parse decision, default to building the game if the prompt sounds like a game request
    const lowerPrompt = prompt.toLowerCase();
    const isGameRequest = lowerPrompt.includes('game') || lowerPrompt.includes('build') || 
                          lowerPrompt.includes('create') || lowerPrompt.includes('make') ||
                          lowerPrompt.includes('generate');
    decision.action = isGameRequest ? 'build_game' : 'chat';
    decision.reply = isGameRequest ? undefined : decisionText;
  }

  // CHAT ONLY response
  if (decision.action === 'chat') {
    return {
      code: currentCode,
      title: '',
      explanation: decision.reply || decisionText || "I'm ready to help you build an awesome 3D game! What would you like to create?",
      suggestions: ['Create a 3D platformer', 'Build a racing game', 'Make a survival shooter'],
      isChatOnly: true,
    };
  }

  // Phase 2: Full game generation
  const userContent = isRefinement
    ? `REFINEMENT REQUEST: ${prompt}\n\nAssets Available: ${JSON.stringify(assetMetadata)}\n\nExisting Game Code to Modify:\n${currentCode}`
    : `NEW GAME REQUEST: ${prompt}\n\nAssets Available: ${JSON.stringify(assetMetadata)}`;

  const gameMessages: any[] = [
    { role: 'system', content: NEURAL_ARCHITECT_SYSTEM_PROMPT },
    ...history.slice(-4).map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.text,
    })),
    {
      role: 'user',
      content: `${userContent}\n\nIMPORTANT: Return ONLY valid JSON with keys: code, title, explanation, suggestions. The code must be a complete, self-contained HTML5 game.`,
    },
  ];

  let rawResponse = '';
  try {
    const args = extraArg ? [gameMessages, extraArg] : [gameMessages];
    rawResponse = await callFn(...args as [any[]]);
  } catch (e: any) {
    throw e;
  }

  // Parse the JSON response
  try {
    // Try to find JSON in the response
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // If no JSON, check if the response looks like HTML (some models output raw HTML)
      if (rawResponse.includes('<!DOCTYPE') || rawResponse.includes('<html')) {
        return {
          code: rawResponse,
          title: 'Generated Game',
          explanation: `Game generated by ${config.displayName}!`,
          suggestions: ['Add more enemies', 'Improve the terrain', 'Add sound effects'],
          isChatOnly: false,
        };
      }
      throw new Error('No valid JSON or HTML found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    
    if (!parsed.code) {
      throw new Error('Response missing game code');
    }

    return {
      code: parsed.code,
      title: parsed.title || 'Generated Game',
      explanation: parsed.explanation || `Game built with ${config.displayName}!`,
      suggestions: parsed.suggestions || ['Enhance the gameplay', 'Add more features', 'Improve graphics'],
      isChatOnly: false,
    };
  } catch (parseError: any) {
    console.error('AI Router parse error:', parseError.message, '\nRaw response preview:', rawResponse.substring(0, 500));
    throw new Error(
      `${config.displayName} returned an unexpected response format. Please try again or switch to Gemini for more reliable output.`
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT: generateGameWithRouter
// ─────────────────────────────────────────────────────────────────────────────
export async function generateGameWithRouter(
  prompt: string,
  assets: GameAsset[],
  history: ChatMessage[],
  currentCode: string,
  mode: AIModelMode,
  selectedModel: AIModelConfig,
  attachments: any[] = []
): Promise<{ code: string; title: string; explanation: string; suggestions: string[]; proposedLogicNodes?: string[]; isChatOnly?: boolean }> {
  
  switch (selectedModel.provider) {
    case 'gemini':
      return generateWithGemini(prompt, assets, history, currentCode, mode, attachments);

    case 'grok':
      return generateWithGenericProvider(
        prompt, assets, history, currentCode, selectedModel,
        (msgs: GrokMessage[]) => callGrok(msgs, 16384)
      );

    case 'huggingface':
      return generateWithGenericProvider(
        prompt, assets, history, currentCode, selectedModel,
        (msgs: HFMessage[]) => callHuggingFace(msgs, 8192)
      );

    case 'ollama': {
      const ollamaModelId = selectedModel.modelId;
      return generateWithGenericProvider(
        prompt, assets, history, currentCode, selectedModel,
        (msgs: OllamaMessage[]) => callOllama(msgs, ollamaModelId)
      );
    }

    default:
      throw new Error(`Unknown AI provider: ${(selectedModel as any).provider}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BRAINSTORM with router
// ─────────────────────────────────────────────────────────────────────────────
export async function brainstormWithRouter(
  assets: GameAsset[],
  selectedModel: AIModelConfig
): Promise<string> {
  const assetMetadata = assets.map(a => ({ name: a.name, type: a.type, category: a.category }));

  if (selectedModel.provider === 'gemini') {
    const { brainstormGame } = await import('./gemini');
    return brainstormGame(assets);
  }

  const prompt = `Act as a Lead Game Architect. Perform a deep mechanical synthesis for a project with these assets: ${JSON.stringify(assetMetadata)}.

  Your report must include:
  1. CORE LOOP ANALYSIS: Primary, secondary, and tertiary game loops.
  2. SYSTEMIC SYNERGIES: How assets interact to create emergent gameplay.
  3. TECHNICAL CHALLENGES: Bottlenecks and architectural solutions.
  4. MECHANICAL INNOVATION: One unique high-concept mechanic using these assets.
  
  Return a detailed, friendly, markdown-formatted analysis.`;

  const messages: any[] = [
    { role: 'system', content: 'You are a senior game designer and architect. Be detailed, creative, and actionable.' },
    { role: 'user', content: prompt },
  ];

  switch (selectedModel.provider) {
    case 'grok': return callGrok(messages);
    case 'huggingface': return callHuggingFace(messages);
    case 'ollama': return callOllama(messages, selectedModel.modelId);
    default: return 'Brainstorm not available for this provider.';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGIC NODES with router
// ─────────────────────────────────────────────────────────────────────────────
export async function generateLogicNodesWithRouter(
  prompt: string,
  assets: GameAsset[],
  selectedModel: AIModelConfig
): Promise<string[]> {
  const assetMetadata = assets.map(a => ({ name: a.name, type: a.type, category: a.category }));

  if (selectedModel.provider === 'gemini') {
    const { generateLogicNodes } = await import('./gemini');
    return generateLogicNodes(prompt, assets);
  }

  const content = `Generate exactly 6 game logic behavior nodes for:
  Prompt: ${prompt}
  Assets: ${JSON.stringify(assetMetadata)}
  
  Each node must follow: "[Trigger] -> [Condition] -> [Action] -> [State Transition]"
  
  Return ONLY a JSON array of 6 strings. Example:
  ["[Player jumps] -> [Is airborne] -> [Play jump animation] -> [Jump state]", ...]`;

  const messages: any[] = [
    { role: 'system', content: 'You are a game logic architect. Return only valid JSON arrays.' },
    { role: 'user', content },
  ];

  let response = '';
  switch (selectedModel.provider) {
    case 'grok': response = await callGrok(messages); break;
    case 'huggingface': response = await callHuggingFace(messages); break;
    case 'ollama': response = await callOllama(messages, selectedModel.modelId); break;
    default: return [];
  }

  try {
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch { /* fall through */ }
  return [];
}
