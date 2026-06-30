
import React, { useState, useEffect, useRef } from 'react';
import {
  ProjectMetadata,
  ProjectState,
  ProjectTemplate,
  ProjectVersion, // Not directly used here, but versions are passed
} from '../types';
import {
  getAllProjectMetadata,
  createNewProject as pmCreateNewProject,
  saveProject as pmSaveProject,
  loadProject as pmLoadProject,
  deleteProject as pmDeleteProject,
  duplicateProject as pmDuplicateProject,
  exportProject as pmExportProject,
  importProject as pmImportProject,
  restoreProjectVersion,
  PROJECT_TEMPLATES,
} from '../services/projectManager';
import { X, Plus, FolderOpen, Save, Copy, Trash2, Download, Upload, FlaskConical, History, Search, FileCog } from 'lucide-react';
import { VersionHistory } from './VersionHistory';
import { compress } from '../services/storage';

interface ProjectManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectLoaded: (projectState: ProjectState, metadata: ProjectMetadata) => void;
  onProjectCreated: (projectState: ProjectState, metadata: ProjectMetadata) => void;
  currentProjectId: string | null;
  currentProjectState: ProjectState;
  initialView?: ModalView;
}

type ModalView = 'list' | 'new' | 'saveAs' | 'versions' | 'import';

export const ProjectManagerModal: React.FC<ProjectManagerModalProps> = ({
  isOpen,
  onClose,
  onProjectLoaded,
  onProjectCreated,
  currentProjectId,
  currentProjectState,
  initialView = 'list',
}) => {
  const [allProjects, setAllProjects] = useState<ProjectMetadata[]>([]);
  const [modalView, setModalView] = useState<ModalView>(initialView);
  const [newProjectName, setNewProjectName] = useState('Untitled Project');
  const [saveAsName, setSaveAsName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Find current project metadata for display/default values
  const currentProjectMetadata = allProjects.find(p => p.id === currentProjectId);

  useEffect(() => {
    if (isOpen) {
      const projects = getAllProjectMetadata();
      setAllProjects(projects);
      setModalView(initialView);
      
      const metadata = projects.find(p => p.id === currentProjectId);
      // Set default name for "Save As" based on current project or a generic name
      setSaveAsName(metadata?.name || 'Untitled Project');
      setSelectedProjectId(currentProjectId); // Pre-select current project in list view
    }
  }, [isOpen, currentProjectId, initialView]);

  // Helper to re-fetch projects after any CUD operation
  const refreshProjects = () => {
    setAllProjects(getAllProjectMetadata());
  };

  const handleCreateNewProject = (template?: ProjectTemplate) => {
    const newProject = pmCreateNewProject(template);
    onProjectCreated(newProject.state, newProject.metadata);
    refreshProjects();
    onClose();
  };

  const handleLoadProject = (projectId: string) => {
    const project = pmLoadProject(projectId);
    if (project) {
      onProjectLoaded(project.state, project.metadata);
      onClose();
    } else {
      alert('Failed to load project. It might be corrupted or missing.');
      pmDeleteProject(projectId); // Clean up corrupted entry
      refreshProjects();
    }
  };

  const handleSaveAs = () => {
    if (!saveAsName.trim()) {
      alert('Project name cannot be empty.');
      return;
    }
    // If saving a new project (no currentProjectId yet), assign a temporary ID for saving
    const idToSave = currentProjectId || `temp_${Math.random().toString(36).substr(2, 9)}`;
    const savedMetadata = pmSaveProject(idToSave, saveAsName, currentProjectState);
    onProjectLoaded(currentProjectState, savedMetadata); // Update active project context with newly saved data
    refreshProjects();
    onClose();
  };

  const handleDuplicateProject = (projectId: string) => {
    const originalProjectName = allProjects.find(p => p.id === projectId)?.name || 'Untitled';
    const newName = window.prompt('Enter new name for duplicated project:', `Copy of ${originalProjectName}`);
    if (newName && newName.trim()) {
      const duplicatedProject = pmDuplicateProject(projectId, newName.trim());
      if (duplicatedProject) {
        refreshProjects();
        // Optionally load the duplicated project
        // onProjectLoaded(duplicatedProject.state, duplicatedProject.metadata);
        // onClose();
      } else {
        alert('Failed to duplicate project.');
      }
    }
  };

  const handleDeleteProject = (projectId: string) => {
    if (window.confirm('Are you sure you want to delete this project? This cannot be undone.')) {
      pmDeleteProject(projectId);
      refreshProjects();
      if (currentProjectId === projectId) {
        // If current project deleted, create a new blank one
        handleCreateNewProject(); // This will close the modal as well
      }
      setSelectedProjectId(null); // Clear selection after deletion
    }
  };

  const handleExportProject = (project: ProjectMetadata) => {
    const fullProject = pmLoadProject(project.id);
    if (fullProject) {
      pmExportProject(fullProject);
    } else {
      alert('Failed to load project data for export.');
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      try {
        const importedProject = await pmImportProject(event.target.files[0]);
        if (importedProject) {
          onProjectCreated(importedProject.state, importedProject.metadata);
          refreshProjects();
          onClose();
        }
      } catch (error) {
        alert(`Failed to import project: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    event.target.value = ''; // Clear input for re-import
  };

  const handleRestoreVersion = (versionId: string) => {
    if (!selectedProjectId) return;
    const restoredState = restoreProjectVersion(selectedProjectId, versionId);
    if (restoredState) {
      const metadata = allProjects.find(p => p.id === selectedProjectId);
      if (metadata) {
        onProjectLoaded(restoredState, { ...metadata, isDirty: true }); // Mark as dirty since it's a restored state
        onClose();
      }
    } else {
      alert('Failed to restore version.');
    }
  };

  const filteredProjects = allProjects.filter(project =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => b.lastModified - a.lastModified); // Sort by most recent first

  if (!isOpen) return null;

  const currentProjectFull = currentProjectId ? pmLoadProject(currentProjectId) : null;
  const currentCompressedState = compress(JSON.stringify(currentProjectState));

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 md:p-8 animate-in fade-in">
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col transition-all duration-300">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 md:p-6 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <FileCog className="w-6 h-6 text-indigo-600" />
            <h2 className="text-xl font-black tracking-tight text-slate-900">Project Manager</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Left Panel: Navigation/New Project */}
          <div className="w-full md:w-60 bg-slate-50 border-b md:border-b-0 md:border-r border-slate-100 p-4 md:p-5 flex flex-row md:flex-col shrink-0 overflow-x-auto no-scrollbar gap-2">
            <button
              onClick={() => setModalView('list')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap ${
                modalView === 'list' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <FolderOpen className="w-4 h-4" /> My Projects
            </button>
            <button
              onClick={() => setModalView('new')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap ${
                modalView === 'new' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Plus className="w-4 h-4" /> New Project
            </button>
            <button
              onClick={() => setModalView('saveAs')}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap ${
                modalView === 'saveAs' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Save className="w-4 h-4" /> Save As
            </button>
            <button
              onClick={() => {
                handleImportClick(); // Trigger file input immediately
              }}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap ${
                modalView === 'import' ? 'bg-yellow-600 text-white shadow-md' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Upload className="w-4 h-4" /> Import
            </button>
            
            {selectedProjectId && (
              <button
                onClick={() => setModalView('versions')}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap md:mt-auto ${
                  modalView === 'versions' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <History className="w-4 h-4" /> Versions
              </button>
            )}
          </div>

          {/* Right Panel: Content based on modalView */}
          <div className="flex-1 p-5 md:p-6 overflow-y-auto no-scrollbar">
            {/* Project List View */}
            {modalView === 'list' && (
              <>
                <div className="relative mb-6">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search projects..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-600 transition-all"
                  />
                </div>

                <div className="space-y-3">
                  {filteredProjects.length === 0 ? (
                    <div className="text-center p-8 text-slate-400">
                      <FolderOpen className="w-10 h-10 mx-auto mb-4 opacity-50" />
                      <p className="text-sm font-bold">No projects found.</p>
                      <p className="text-xs text-slate-500">Try creating a new one!</p>
                    </div>
                  ) : (
                    filteredProjects.map((project) => (
                      <div
                        key={project.id}
                        className={`group flex flex-col md:flex-row items-start md:items-center justify-between p-4 rounded-xl border transition-all ${
                          selectedProjectId === project.id ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-100 hover:border-slate-200'
                        }`}
                        onClick={() => setSelectedProjectId(project.id)}
                      >
                        <div className="flex-1 flex items-start gap-4 mb-3 md:mb-0 cursor-pointer">
                          {/* Thumbnail placeholder */}
                          <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center text-slate-300">
                            <FileCog className="w-6 h-6" />
                          </div>
                          <div className="flex flex-col">
                            <h4 className="text-sm font-bold text-slate-900">{project.name}</h4>
                            <p className="text-xs text-slate-500">
                              Modified: {new Date(project.lastModified).toLocaleDateString()}
                            </p>
                            <p className="text-[10px] text-slate-400">Versions: {project.versionCount}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap md:flex-nowrap gap-2 ml-auto">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleLoadProject(project.id); }}
                            className="px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-[10px] font-bold uppercase hover:bg-indigo-700 transition-colors active:scale-95 shadow-sm"
                          >
                            Load
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDuplicateProject(project.id); }}
                            className="p-2.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors active:scale-95"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleExportProject(project); }}
                            className="p-2.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors active:scale-95"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteProject(project.id); }}
                            className="p-2.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors active:scale-95"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}

            {/* New Project View */}
            {modalView === 'new' && (
              <div className="space-y-6">
                <h3 className="text-lg font-bold text-slate-900">Create New Project</h3>
                <div className="flex flex-col gap-2">
                  <label htmlFor="new-project-name" className="text-sm font-medium text-slate-700">Project Name</label>
                  <input
                    id="new-project-name"
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="My Awesome Game"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <button
                  onClick={() => handleCreateNewProject()}
                  className="w-full py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors active:scale-95"
                >
                  Create Blank Project
                </button>

                <div className="relative flex items-center py-4">
                  <div className="flex-grow border-t border-slate-200"></div>
                  <span className="flex-shrink mx-4 text-slate-400 text-xs uppercase font-bold tracking-widest">OR</span>
                  <div className="flex-grow border-t border-slate-200"></div>
                </div>

                <h3 className="text-lg font-bold text-slate-900 mb-4">Start from Template</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {PROJECT_TEMPLATES.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleCreateNewProject(template)}
                      className="flex flex-col items-start gap-2 p-4 border border-indigo-100 rounded-xl hover:bg-indigo-50 transition-colors text-left active:scale-95 shadow-sm"
                    >
                      <FlaskConical className="w-5 h-5 text-indigo-500" />
                      <h4 className="text-sm font-bold text-slate-900">{template.name}</h4>
                      <p className="text-xs text-slate-600 line-clamp-2">{template.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Save As View */}
            {modalView === 'saveAs' && (
              <div className="space-y-6">
                <h3 className="text-lg font-bold text-slate-900">Save Project As</h3>
                <div className="flex flex-col gap-2">
                  <label htmlFor="save-as-name" className="text-sm font-medium text-slate-700">Project Name</label>
                  <input
                    id="save-as-name"
                    type="text"
                    value={saveAsName}
                    onChange={(e) => setSaveAsName(e.target.value)}
                    placeholder="My New Game Name"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-purple-600"
                  />
                </div>
                <button
                  onClick={handleSaveAs}
                  className="w-full py-3 bg-purple-600 text-white rounded-xl text-sm font-bold hover:bg-purple-700 transition-colors active:scale-95"
                >
                  Save Current Project
                </button>
              </div>
            )}

            {/* Version History View */}
            {modalView === 'versions' && selectedProjectId && currentProjectFull && (
              <VersionHistory
                versions={currentProjectFull.versions || []}
                onRestoreVersion={handleRestoreVersion}
                currentProjectStateCompressed={currentCompressedState} // Pass compressed for comparison
              />
            )}
            
            {/* Import View - Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".json"
              className="hidden"
            />
          </div>
        </div>
      </div>
    </div>
  );
};