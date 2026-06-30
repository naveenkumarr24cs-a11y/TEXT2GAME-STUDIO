
import LZString from 'lz-string';
import { ProjectMetadata, ProjectState, ProjectVersion } from '../types';

const METADATA_KEY = 'text2game_projects_metadata';
// AUTOSAVE_KEY has been removed

const isLocalStorageAvailable = () => {
  try {
    const test = '__localStorageTest__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (e) {
    return false;
  }
};

export const compress = (data: string): string => {
  if (!isLocalStorageAvailable()) return data; // Fallback
  return LZString.compressToUTF16(data);
};

export const decompress = (data: string): string => {
  if (!isLocalStorageAvailable()) return data; // Fallback
  return LZString.decompressFromUTF16(data) || '';
};

// --- Project Metadata Operations ---
export const saveAllProjectMetadata = (metadata: ProjectMetadata[]): void => {
  if (!isLocalStorageAvailable()) {
    console.warn('localStorage is not available. Project metadata not saved.');
    return;
  }
  try {
    localStorage.setItem(METADATA_KEY, JSON.stringify(metadata));
  } catch (e) {
    console.error('Failed to save project metadata:', e);
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      alert('Local storage quota exceeded. Please clear some projects or browser data.');
    }
  }
};

export const loadAllProjectMetadata = (): ProjectMetadata[] => {
  if (!isLocalStorageAvailable()) {
    console.warn('localStorage is not available. Cannot load project metadata.');
    return [];
  }
  try {
    const data = localStorage.getItem(METADATA_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Failed to load project metadata, returning empty array:', e);
    return [];
  }
};

// --- Individual Project Data Operations ---
const getProjectDataKey = (projectId: string) => `text2game_project_data_${projectId}`;
const getProjectVersionsKey = (projectId: string) => `text2game_project_versions_${projectId}`;

export const saveProjectState = (projectId: string, state: ProjectState): void => {
  if (!isLocalStorageAvailable()) {
    console.warn('localStorage is not available. Project state not saved.');
    return;
  }
  try {
    const compressedState = compress(JSON.stringify(state));
    localStorage.setItem(getProjectDataKey(projectId), compressedState);
  } catch (e) {
    console.error(`Failed to save project state for ${projectId}:`, e);
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      alert(`Local storage quota exceeded when saving project "${projectId}". Please clear some projects or browser data.`);
    }
  }
};

export const loadProjectState = (projectId: string): ProjectState | null => {
  if (!isLocalStorageAvailable()) {
    console.warn('localStorage is not available. Cannot load project state.');
    return null;
  }
  try {
    const data = localStorage.getItem(getProjectDataKey(projectId));
    if (!data) return null;
    const decompressedState = decompress(data);
    return JSON.parse(decompressedState);
  } catch (e) {
    console.error(`Failed to load project state for ${projectId}, returning null:`, e);
    // Potentially corrupted data, clear it to prevent infinite loop
    localStorage.removeItem(getProjectDataKey(projectId));
    return null;
  }
};

export const deleteProjectData = (projectId: string): void => {
  if (!isLocalStorageAvailable()) return;
  localStorage.removeItem(getProjectDataKey(projectId));
  localStorage.removeItem(getProjectVersionsKey(projectId));
};

// --- Project Version Operations ---
export const saveProjectVersions = (projectId: string, versions: ProjectVersion[]): void => {
  if (!isLocalStorageAvailable()) return;
  try {
    localStorage.setItem(getProjectVersionsKey(projectId), JSON.stringify(versions));
  } catch (e) {
    console.error(`Failed to save project versions for ${projectId}:`, e);
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      alert(`Local storage quota exceeded when saving project versions for "${projectId}".`);
    }
  }
};

export const loadProjectVersions = (projectId: string): ProjectVersion[] => {
  if (!isLocalStorageAvailable()) return [];
  try {
    const data = localStorage.getItem(getProjectVersionsKey(projectId));
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error(`Failed to load project versions for ${projectId}, returning empty array:`, e);
    localStorage.removeItem(getProjectVersionsKey(projectId)); // Clear potentially corrupted versions
    return [];
  }
};

// Autosave operations have been removed.

// --- Global project ID counter (to ensure unique IDs) ---
const PROJECT_ID_COUNTER_KEY = 'text2game_project_id_counter';

export const getNextProjectId = (): string => {
  if (!isLocalStorageAvailable()) return Math.random().toString(36).substring(2, 11); // Fallback
  let counter = parseInt(localStorage.getItem(PROJECT_ID_COUNTER_KEY) || '0', 10);
  counter++;
  localStorage.setItem(PROJECT_ID_COUNTER_KEY, counter.toString());
  return `proj_${counter}`;
};