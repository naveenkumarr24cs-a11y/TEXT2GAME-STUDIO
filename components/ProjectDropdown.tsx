
import React, { useState, useRef, useEffect } from 'react';
import {
  FolderOpen,
  Save,
  Plus,
  Copy,
  Trash2,
  Share2,
  Download,
  Upload,
  FlaskConical,
  ChevronDown,
} from 'lucide-react';
import { ProjectMetadata, ProjectTemplate } from '../types';
import { PROJECT_TEMPLATES } from '../services/projectManager';

interface ProjectDropdownProps {
  currentProjectName: string;
  isDirty: boolean;
  onNewProject: (template?: ProjectTemplate) => void;
  onNewProjectModal: () => void;
  onSaveProject: () => void;
  onSaveAs: () => void;
  onOpenProject: () => void; // Opens the ProjectManagerModal to load
  onDuplicateProject: () => void; // Placeholder for now, ProjectManagerModal handles details
  onDeleteProject: () => void;
  onExportProject: () => void;
  onImportProject: (file: File) => void;
  onShareProject: () => void;
  onCopyProject: () => void;
}

export const ProjectDropdown: React.FC<ProjectDropdownProps> = ({
  currentProjectName,
  isDirty,
  onNewProject,
  onNewProjectModal,
  onSaveProject,
  onSaveAs,
  onOpenProject,
  onDuplicateProject,
  onDeleteProject,
  onExportProject,
  onImportProject,
  onShareProject,
  onCopyProject,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowTemplates(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownRef]);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      onImportProject(event.target.files[0]);
    }
    event.target.value = ''; // Clear the input so same file can be imported again
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 text-[10px] md:text-xs font-bold uppercase hover:bg-slate-50 hover:border-slate-300 transition-all text-slate-600 relative"
      >
        <FolderOpen className="w-3.5 h-3.5 text-slate-500" />
        <span className="hidden lg:inline">{currentProjectName || 'Untitled'}</span>
        {isDirty && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full animate-pulse border-2 border-white" />
        )}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 animate-in fade-in slide-in-from-top-1 overflow-hidden py-1">
          <div className="px-4 py-2 text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100">
            Project Actions
          </div>
          <button
            onClick={() => {
              onNewProject();
              setIsOpen(false);
            }}
            className="flex items-center gap-3 px-4 py-3 w-full text-left text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Plus className="w-4 h-4 text-emerald-500" /> New Blank Project
          </button>
          <button
            onClick={() => {
              onNewProjectModal();
              setIsOpen(false);
            }}
            className="flex items-center gap-3 px-4 py-3 w-full text-left text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <FlaskConical className="w-4 h-4 text-indigo-500" /> New from Template...
          </button>
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className="flex items-center justify-between gap-3 px-4 py-3 w-full text-left text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3"><FlaskConical className="w-4 h-4 text-indigo-500" /> Templates</div>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showTemplates ? 'rotate-180' : ''}`} />
          </button>
          {showTemplates && (
            <div className="border-t border-slate-100 bg-slate-50 py-1">
              {PROJECT_TEMPLATES.map(template => (
                <button
                  key={template.id}
                  onClick={() => {
                    onNewProject(template);
                    setIsOpen(false);
                    setShowTemplates(false);
                  }}
                  className="flex items-center gap-3 px-6 py-2 w-full text-left text-[10px] text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <FlaskConical className="w-3.5 h-3.5 text-indigo-400 opacity-60" /> {template.name}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => {
              onOpenProject(); // This will open the modal where projects are listed
              setIsOpen(false);
            }}
            className="flex items-center gap-3 px-4 py-3 w-full text-left text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <FolderOpen className="w-4 h-4 text-blue-500" /> Open Project
          </button>
          <button
            onClick={() => {
              onSaveProject();
              setIsOpen(false);
            }}
            className="flex items-center gap-3 px-4 py-3 w-full text-left text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Save className="w-4 h-4 text-purple-500" /> Save Project
          </button>
          <button
            onClick={() => {
              onSaveAs();
              setIsOpen(false);
            }}
            className="flex items-center gap-3 px-4 py-3 w-full text-left text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Save className="w-4 h-4 text-indigo-500" /> Save As...
          </button>
          <div className="h-px bg-slate-100 my-1" />
          <button
            onClick={() => {
              onDuplicateProject();
              setIsOpen(false);
            }}
            className="flex items-center gap-3 px-4 py-3 w-full text-left text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Copy className="w-4 h-4 text-orange-500" /> Duplicate
          </button>
          <button
            onClick={() => {
              onExportProject();
              setIsOpen(false);
            }}
            className="flex items-center gap-3 px-4 py-3 w-full text-left text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Download className="w-4 h-4 text-green-500" /> Export JSON
          </button>
          <button
            onClick={handleImportClick}
            className="flex items-center gap-3 px-4 py-3 w-full text-left text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Upload className="w-4 h-4 text-yellow-500" /> Import JSON
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".json"
            className="hidden"
          />
          <div className="h-px bg-slate-100 my-1" />
          <button
            onClick={() => {
              onShareProject();
              setIsOpen(false);
            }}
            className="flex items-center gap-3 px-4 py-3 w-full text-left text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Share2 className="w-4 h-4 text-teal-500" /> Share Link
          </button>
          <button
            onClick={() => {
              onCopyProject();
              setIsOpen(false);
            }}
            className="flex items-center gap-3 px-4 py-3 w-full text-left text-[11px] font-bold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Copy className="w-4 h-4 text-cyan-500" /> Copy Data
          </button>
          <div className="h-px bg-slate-100 my-1" />
          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to delete this project? This cannot be undone.')) {
                onDeleteProject();
                setIsOpen(false);
              }
            }}
            className="flex items-center gap-3 px-4 py-3 w-full text-left text-[11px] font-bold text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-4 h-4 text-red-500" /> Delete Project
          </button>
        </div>
      )}
    </div>
  );
};