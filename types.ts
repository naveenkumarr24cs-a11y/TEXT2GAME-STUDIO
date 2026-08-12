
export type AssetType = 
  | 'character1' 
  | 'motion1' 
  | 'character2' 
  | 'motion2' 
  | 'environment' 
  | 'music' 
  | 'dialogue';

export type AIModelMode = 'fast' | 'thinking';

export type AIProvider = 'gemini' | 'grok' | 'huggingface' | 'ollama';

export interface AIModelConfig {
  id: string;
  provider: AIProvider;
  modelId: string;
  displayName: string;
  description: string;
  tag: 'Pro' | 'Fast' | 'Local' | 'Code' | 'Experimental';
  icon: string; // emoji icon
  requiresKey: boolean;
  localStorageKey?: string; // key name for the api key in localStorage
}

export interface GameAsset {
  id: string;
  name: string;
  type: AssetType;
  content: string; // Base64 for files, text for dialogue
  mimeType: string;
  isOptimized?: boolean;
  category?: string;
  animationMappings?: Record<string, string>; // Map of game action roles to actual track names
}

export interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
  isApplying?: boolean;
  suggestions?: string[];
  proposedLogicNodes?: string[];
  attachments?: {
    id: string;
    preview: string;
    type: 'image' | 'video';
  }[];
}

export interface GenerationStatus {
  step: 'idle' | 'analyzing' | 'coding' | 'compiling' | 'ready' | 'error';
  message: string;
}

export interface GeneratedGame {
  code: string; // HTML/JS combo
  title: string;
}

/**
 * Project Management System Types
 */

// The core state of the project that gets saved and versioned
export interface ProjectState {
  assets: GameAsset[];
  game: GeneratedGame | null;
  chatHistory: ChatMessage[];
  aiMode: AIModelMode;
}

// Metadata for a project, stored separately for quick listing
export interface ProjectMetadata {
  id: string;
  name: string;
  lastModified: number; // Unix timestamp
  createdAt: number; // Unix timestamp
  versionCount: number;
  isDirty: boolean; // Indicates if current state has unsaved changes to the last explicit save
  thumbnail?: string; // Base64 thumbnail for quick preview (optional for now)
}

// Full project object
export interface Project {
  metadata: ProjectMetadata;
  state: ProjectState;
  versions: ProjectVersion[];
}

// A single version in the project's history
export interface ProjectVersion {
  id: string;
  timestamp: number; // Unix timestamp
  state: string; // Compressed ProjectState string
  thumbnail?: string; // Base64 thumbnail (optional for now)
}

// Template for creating new projects
export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  initialPrompt: string;
  initialAssets: Omit<GameAsset, 'id' | 'content'>[]; // Simplified assets for templates
  initialAiMode: AIModelMode;
}

// Undo/Redo state structure
export interface UndoRedoState<T> {
  past: T[];
  present: T;
  future: T[];
}
