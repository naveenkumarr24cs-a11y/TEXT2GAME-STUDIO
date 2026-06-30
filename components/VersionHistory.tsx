
import React from 'react';
import { ProjectVersion } from '../types';
import { History, Clock, RefreshCw } from 'lucide-react';

interface VersionHistoryProps {
  versions: ProjectVersion[];
  onRestoreVersion: (versionId: string) => void;
  currentProjectStateCompressed: string; // The compressed string of the current state for comparison
}

export const VersionHistory: React.FC<VersionHistoryProps> = ({ versions, onRestoreVersion, currentProjectStateCompressed }) => {
  if (versions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center text-slate-400">
        <History className="w-8 h-8 mb-4 opacity-50" />
        <p className="text-[10px] font-black uppercase tracking-widest">No versions yet.</p>
        <p className="text-[9px] font-medium mt-1">Save your project to create a version snapshot.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-indigo-600 px-2">
        <History className="w-4 h-4" />
        <h3 className="text-[10px] font-black uppercase tracking-widest">Version History</h3>
      </div>
      <div className="space-y-2 max-h-[400px] overflow-y-auto no-scrollbar pb-2">
        {versions.map((version, index) => {
          // Compare compressed states to determine if this version is currently active
          const isCurrent = version.state === currentProjectStateCompressed;
          return (
            <div
              key={version.id}
              className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-all ${
                isCurrent ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-100 hover:border-slate-200'
              }`}
            >
              <div className="flex flex-col gap-0.5">
                <span className={`text-[10px] font-bold ${isCurrent ? 'text-indigo-700' : 'text-slate-700'}`}>
                  Version {versions.length - index}
                </span>
                <div className="flex items-center gap-1 text-[9px] text-slate-500 font-medium">
                  <Clock className="w-3 h-3" />
                  {new Date(version.timestamp).toLocaleString()}
                </div>
              </div>
              <button
                onClick={() => onRestoreVersion(version.id)}
                disabled={isCurrent}
                title={isCurrent ? 'This is the current version' : 'Restore this version'}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                  isCurrent
                    ? 'bg-transparent text-indigo-400 cursor-default'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95'
                }`}
              >
                <RefreshCw className="w-3.5 h-3.5" /> {isCurrent ? 'Active' : 'Restore'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};