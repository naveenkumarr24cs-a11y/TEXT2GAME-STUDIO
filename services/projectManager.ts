
import {
  Project,
  ProjectMetadata,
  ProjectState,
  ProjectTemplate,
  ProjectVersion,
  GameAsset,
  AIModelMode,
} from '../types';
import {
  saveAllProjectMetadata,
  loadAllProjectMetadata,
  saveProjectState,
  loadProjectState,
  deleteProjectData,
  saveProjectVersions,
  loadProjectVersions,
  compress,
  decompress,
  getNextProjectId,
} from './storage';

/**
 * Default empty project state
 */
const DEFAULT_PROJECT_STATE: ProjectState = {
  assets: [],
  game: null,
  chatHistory: [],
  aiMode: 'thinking',
};

/**
 * Pre-built Project Templates
 */
export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'template_platformer',
    name: '3D Platformer',
    description: 'A classic 3D platforming adventure with jumping and collecting.',
    initialPrompt: 'Create a simple 3D platformer game where the player jumps between platforms to collect coins.',
    initialAssets: [
      { type: 'character1', name: 'PlayerCharacter', mimeType: 'model/gltf+json', category: 'Hero' },
      { type: 'motion1', name: 'JumpAnimation', mimeType: 'application/octet-stream', category: 'Hero' },
      { type: 'environment', name: 'PlatformMesh', mimeType: 'model/gltf+json', category: 'Level Geometry' },
      { type: 'music', name: 'BackgroundMusic', mimeType: 'audio/mpeg', category: 'BGM' },
    ],
    initialAiMode: 'thinking',
  },
  {
    id: 'template_shooter',
    name: 'Top-Down Shooter',
    description: 'Fast-paced action from a top-down perspective.',
    initialPrompt: 'Design a top-down shooter game where the player moves around shooting at incoming enemies. Enemies should have basic AI.',
    initialAssets: [
      { type: 'character1', name: 'PlayerShip', mimeType: 'model/gltf+json', category: 'Hero' },
      { type: 'character2', name: 'EnemyShip', mimeType: 'model/gltf+json', category: 'Enemy' },
      { type: 'environment', name: 'SpaceBackground', mimeType: 'model/gltf+json', category: 'Level Geometry' },
      { type: 'music', name: 'ActionTheme', mimeType: 'audio/mpeg', category: 'BGM' },
    ],
    initialAiMode: 'thinking',
  },
  {
    id: 'template_puzzle',
    name: 'Puzzle Game',
    description: 'Solve intricate puzzles with logic and wit.',
    initialPrompt: 'Build a puzzle game where the player needs to push blocks to activate switches and open a door.',
    initialAssets: [
      { type: 'character1', name: 'PusherBot', mimeType: 'model/gltf+json', category: 'Hero' },
      { type: 'environment', name: 'PuzzleRoom', mimeType: 'model/gltf+json', category: 'Level Geometry' },
      { type: 'music', name: 'PuzzleAmbient', mimeType: 'audio/mpeg', category: 'BGM' },
    ],
    initialAiMode: 'thinking',
  },
  {
    id: 'template_racing',
    name: 'Racing Game',
    description: 'Race against opponents on a dynamic track.',
    initialPrompt: 'Create a simple racing game where the player controls a car on a track, trying to beat a timer or another AI car.',
    initialAssets: [
      { type: 'character1', name: 'PlayerCar', mimeType: 'model/gltf+json', category: 'Hero' },
      { type: 'environment', name: 'RaceTrack', mimeType: 'model/gltf+json', category: 'Level Geometry' },
      { type: 'music', name: 'RaceMusic', mimeType: 'audio/mpeg', category: 'BGM' },
    ],
    initialAiMode: 'thinking',
  },
];

/**
 * Retrieves all project metadata from storage.
 */
export const getAllProjectMetadata = (): ProjectMetadata[] => {
  return loadAllProjectMetadata();
};

/**
 * Creates a new project with default or template-based state.
 * @param template An optional template to pre-fill the project state.
 */
export const createNewProject = (template?: ProjectTemplate): Project => {
  const now = Date.now();
  const projectId = getNextProjectId();

  const initialState: ProjectState = template
    ? {
        ...DEFAULT_PROJECT_STATE,
        assets: template.initialAssets.map(asset => ({ ...asset, id: Math.random().toString(36).substr(2, 9), content: '' })), // Content will be empty for template assets, AI generates it.
        chatHistory: template.initialPrompt
          ? [{ role: 'user', text: template.initialPrompt }]
          : [],
        aiMode: template.initialAiMode,
      }
    : DEFAULT_PROJECT_STATE;

  const newMetadata: ProjectMetadata = {
    id: projectId,
    name: template ? `New ${template.name}` : 'Untitled Project',
    createdAt: now,
    lastModified: now,
    versionCount: 0,
    isDirty: true,
  };

  saveProjectState(projectId, initialState);
  addProjectVersion(projectId, initialState, true); // Add initial version

  const allMetadata = loadAllProjectMetadata();
  saveAllProjectMetadata([...allMetadata, newMetadata]);

  return { metadata: newMetadata, state: initialState, versions: [] };
};

/**
 * Saves or updates an existing project.
 * @param projectId The ID of the project to save.
 * @param projectName The new name for the project.
 * @param state The current ProjectState to save.
 */
export const saveProject = (
  projectId: string,
  projectName: string,
  state: ProjectState
): ProjectMetadata => {
  const now = Date.now();
  let allMetadata = loadAllProjectMetadata();
  const index = allMetadata.findIndex((p) => p.id === projectId);

  let metadataToSave: ProjectMetadata;

  if (index !== -1) {
    // Update existing project
    metadataToSave = {
      ...allMetadata[index],
      name: projectName,
      lastModified: now,
      isDirty: false,
    };
    allMetadata[index] = metadataToSave;
  } else {
    // This case should ideally not happen if projectId is managed correctly,
    // but acts as a safeguard to create if not found.
    metadataToSave = {
      id: projectId,
      name: projectName,
      createdAt: now,
      lastModified: now,
      versionCount: 0, // Will be updated by addProjectVersion
      isDirty: false,
    };
    allMetadata.push(metadataToSave);
  }

  saveProjectState(projectId, state);
  addProjectVersion(projectId, state); // Add a new version on explicit save
  saveAllProjectMetadata(allMetadata);

  return metadataToSave;
};

/**
 * Loads a project by its ID.
 * @param projectId The ID of the project to load.
 */
export const loadProject = (projectId: string): Project | null => {
  const metadata = loadAllProjectMetadata().find((p) => p.id === projectId);
  if (!metadata) return null;

  const state = loadProjectState(projectId);
  if (!state) return null; // State could be missing or corrupted

  const versions = loadProjectVersions(projectId);

  return { metadata, state, versions };
};

/**
 * Deletes a project by its ID.
 * @param projectId The ID of the project to delete.
 */
export const deleteProject = (projectId: string): void => {
  let allMetadata = loadAllProjectMetadata();
  const updatedMetadata = allMetadata.filter((p) => p.id !== projectId);
  saveAllProjectMetadata(updatedMetadata);
  deleteProjectData(projectId); // Clear actual project data and versions
};

/**
 * Duplicates a project.
 * @param sourceProjectId The ID of the project to duplicate.
 * @param newName The name for the new duplicated project.
 */
export const duplicateProject = (
  sourceProjectId: string,
  newName: string
): Project | null => {
  const sourceProject = loadProject(sourceProjectId);
  if (!sourceProject) return null;

  const now = Date.now();
  const newProjectId = getNextProjectId();

  const newMetadata: ProjectMetadata = {
    ...sourceProject.metadata,
    id: newProjectId,
    name: newName,
    createdAt: now,
    lastModified: now,
    isDirty: true,
  };

  saveProjectState(newProjectId, sourceProject.state);
  // Duplicate versions as well
  const duplicatedVersions = sourceProject.versions.map((v) => ({
    ...v,
    id: Math.random().toString(36).substr(2, 9), // New ID for version
  }));
  saveProjectVersions(newProjectId, duplicatedVersions);
  newMetadata.versionCount = duplicatedVersions.length;

  let allMetadata = loadAllProjectMetadata();
  saveAllProjectMetadata([...allMetadata, newMetadata]);

  return { metadata: newMetadata, state: sourceProject.state, versions: duplicatedVersions };
};

/**
 * Exports a project to a JSON file.
 * @param project The Project object to export.
 */
export const exportProject = (project: Project): void => {
  const exportData = {
    metadata: project.metadata,
    state: project.state,
    versions: project.versions,
  };
  const filename = `${project.metadata.name.replace(/\s+/g, '_').toLowerCase()}.json`;
  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Imports a project from a JSON file.
 * @param file The JSON File object to import.
 */
export const importProject = async (file: File): Promise<Project | null> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const importedData = JSON.parse(event.target?.result as string);
        if (
          !importedData ||
          !importedData.metadata ||
          !importedData.state
        ) {
          throw new Error('Invalid project file format.');
        }

        const now = Date.now();
        const newProjectId = getNextProjectId();

        const newMetadata: ProjectMetadata = {
          ...importedData.metadata,
          id: newProjectId, // Assign a new ID to avoid conflicts
          name: `${importedData.metadata.name} (Imported)`,
          createdAt: now,
          lastModified: now,
          isDirty: true,
        };

        saveProjectState(newProjectId, importedData.state);

        // Re-save versions, potentially re-compressing them if necessary
        const importedVersions = importedData.versions || [];
        saveProjectVersions(newProjectId, importedVersions.map(v => ({
            ...v,
            id: Math.random().toString(36).substr(2, 9), // New ID for each version
            state: compress(JSON.stringify(v.state)) // Ensure state is compressed
        })));
        newMetadata.versionCount = importedVersions.length;


        let allMetadata = loadAllProjectMetadata();
        saveAllProjectMetadata([...allMetadata, newMetadata]);

        resolve({ metadata: newMetadata, state: importedData.state, versions: importedVersions });
      } catch (error) {
        console.error('Error importing project:', error);
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsText(file);
  });
};

/**
 * Version History Management
 */

const MAX_VERSIONS = 10;

/**
 * Adds a new version to a project's history.
 * @param projectId The ID of the project.
 * @param state The current ProjectState to snapshot.
 * @param isInitial A boolean to indicate if it is the initial version (no trimming).
 */
export const addProjectVersion = (
  projectId: string,
  state: ProjectState,
  isInitial: boolean = false
): void => {
  let versions = loadProjectVersions(projectId);
  const now = Date.now();

  const newVersion: ProjectVersion = {
    id: Math.random().toString(36).substr(2, 9),
    timestamp: now,
    state: compress(JSON.stringify(state)),
    // thumbnail: captureThumbnail(state), // Future enhancement
  };

  versions.unshift(newVersion); // Add to the beginning (most recent first)

  if (!isInitial && versions.length > MAX_VERSIONS) {
    versions = versions.slice(0, MAX_VERSIONS); // Trim old versions
  }

  saveProjectVersions(projectId, versions);

  // Update metadata with new version count
  let allMetadata = loadAllProjectMetadata();
  const index = allMetadata.findIndex((p) => p.id === projectId);
  if (index !== -1) {
    allMetadata[index].versionCount = versions.length;
    saveAllProjectMetadata(allMetadata);
  }
};

/**
 * Restores a project state from a specific version.
 * @param projectId The ID of the project.
 * @param versionId The ID of the version to restore.
 */
export const restoreProjectVersion = (
  projectId: string,
  versionId: string
): ProjectState | null => {
  const versions = loadProjectVersions(projectId);
  const version = versions.find((v) => v.id === versionId);
  if (!version) return null;

  try {
    return JSON.parse(decompress(version.state));
  } catch (e) {
    console.error(`Failed to decompress and parse version ${versionId}:`, e);
    return null;
  }
};

/**
 * Sharing & Collaboration Utilities
 */

const SHARE_LINK_PREFIX = '#/share/';

/**
 * Generates a shareable URL fragment by compressing project state.
 * @param project The project to share.
 */
export const generateShareLink = (project: Project): string => {
  const shareableState: ProjectState = {
    assets: project.state.assets,
    game: project.state.game,
    chatHistory: [], // Don't share full chat history, just initial prompt
    aiMode: project.state.aiMode,
  };
  if (project.state.chatHistory.length > 0) {
    shareableState.chatHistory = [project.state.chatHistory[0]]; // Share only the initial prompt
  }

  const compressedState = compress(JSON.stringify(shareableState));
  const encodedState = encodeURIComponent(compressedState);
  return `${window.location.origin}${window.location.pathname}${SHARE_LINK_PREFIX}${encodedState}`;
};

/**
 * Copies the project state as JSON to the clipboard.
 * @param project The project to copy.
 */
export const copyProjectToClipboard = async (
  project: Project
): Promise<void> => {
  try {
    const clipboardData = {
      metadata: project.metadata,
      state: project.state,
      versions: project.versions,
    };
    await navigator.clipboard.writeText(JSON.stringify(clipboardData, null, 2));
    // Provide user feedback (e.g., a toast notification)
    alert('Project data copied to clipboard!');
  } catch (err) {
    console.error('Failed to copy project to clipboard:', err);
    alert('Failed to copy project data. Please try again or check browser permissions.');
  }
};

/**
 * Function to initialize a project from a share link.
 * Returns a ProjectState if valid data is found in the URL.
 */
export const loadProjectFromShareLink = (): ProjectState | null => {
  const hash = window.location.hash;
  if (hash.startsWith(SHARE_LINK_PREFIX)) {
    try {
      const encodedCompressedState = hash.substring(SHARE_LINK_PREFIX.length);
      // First, URI-decode the string, then decompress it.
      const compressedState = decodeURIComponent(encodedCompressedState); 
      const decompressedState = decompress(compressedState);
      const state = JSON.parse(decompressedState);
      // Clean URL hash after loading
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
      return state;
    } catch (e) {
      console.error('Failed to load project from share link:', e);
      return null;
    }
  }
  return null;
};
