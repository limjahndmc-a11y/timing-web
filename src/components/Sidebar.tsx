import React, { useState } from "react";
import { format } from "date-fns";
import { TimeEntry, Project, Category, TrackerStatus } from "../types";
import { Activity, LayoutDashboard, Calendar, PieChart, Settings, Info, Edit2, Trash2 } from "lucide-react";
import { cn } from "../lib/utils";

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  projects: Project[];
  categories: Category[];
  onAddProject?: () => void;
  onEditProject?: (project: Project) => void;
  onDeleteProject?: (project: Project) => void;
  onDropEntry?: (entryId: string, projectId: string) => void;
  trackerStatus?: TrackerStatus;
}

export function Sidebar({ currentTab, setCurrentTab, projects, categories, onAddProject, onEditProject, onDeleteProject, onDropEntry, trackerStatus }: SidebarProps) {
  const [dragOverProjectId, setDragOverProjectId] = useState<string | null>(null);
  const statusState = trackerStatus?.state ?? "stopped";
  const statusColor = statusState === "running" ? "bg-green-500" : statusState === "permission_required" ? "bg-amber-500" : "bg-red-500";
  const statusText = statusState === "running" ? "Recording Active" : statusState === "permission_required" ? "Permission Required" : statusState === "error" ? "Tracker Error" : "Tracker Stopped";

  const tabs = [
    { id: "dashboard", label: "Overview", icon: LayoutDashboard },
    { id: "timeline", label: "Timeline", icon: Calendar },
    { id: "activities", label: "Activities", icon: Activity },
    { id: "reports", label: "Reports", icon: PieChart },
  ];

  return (
    <div className="w-[240px] bg-[#151921] border-r border-[#252A34] flex flex-col h-full flex-shrink-0">
      
      {/* Search / Header */}
      <div className="p-6 mb-4">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white shadow-sm">
            M
          </div>
          <span className="font-bold text-lg text-[#E2E8F0]">Time is Gold</span>
        </div>
        <div className="text-[10px] bg-[#252A34] px-2 py-0.5 rounded text-[#94A3B8] font-mono inline-block mt-2">
          by klwj
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-2 flex flex-col">
        
        {/* Main Nav */}
        <nav className="flex-1 mb-6">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 px-6">
            Main
          </div>
          <div className="flex flex-col">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setCurrentTab(tab.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-6 py-3 text-[14px] font-medium transition-colors border-l-[3px]",
                  currentTab === tab.id
                    ? "bg-[#1E2530] text-[#3B82F6] border-[#3B82F6]"
                    : "text-[#94A3B8] border-transparent hover:bg-[#1E2530]"
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Projects Nav */}
        <div className="mb-6">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 px-6 flex justify-between items-center group">
            <span>Projects</span>
            <button 
              onClick={onAddProject}
              className="text-slate-500 hover:text-[#E2E8F0] focus:outline-none transition-colors"
              title="Add Project"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
          </div>
          <div className="flex flex-col">
            {projects.map((project) => {
              const category = categories.find(c => c.id === project.categoryId);
              return (
                <button
                  key={project.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverProjectId(project.id);
                  }}
                  onDragLeave={() => setDragOverProjectId(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverProjectId(null);
                    const entryId = e.dataTransfer.getData("text/plain");
                    if (entryId && onDropEntry) {
                      onDropEntry(entryId, project.id);
                    }
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-6 py-2.5 text-[14px] font-medium transition-colors border-l-[3px] group/project",
                    dragOverProjectId === project.id 
                      ? "bg-[#1E2530] text-[#E2E8F0] border-blue-500" 
                      : "border-transparent text-[#94A3B8] hover:bg-[#1E2530]"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2 pointer-events-none">
                    <div 
                      className="w-2.5 h-2.5 rounded-sm shadow-sm flex-shrink-0"
                      style={{ backgroundColor: project.color }}
                    />
                    <span className="truncate">{project.name}</span>
                  </div>
                  
                  <div className="relative group/icon flex items-center gap-1.5 opacity-0 group-hover/project:opacity-100 transition-opacity">
                    <button 
                      onClick={(e) => { e.stopPropagation(); onEditProject?.(project); }}
                      className="text-slate-500 hover:text-[#E2E8F0] transition-colors"
                      title="Edit Project"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); onDeleteProject?.(project); }}
                      className="text-slate-500 hover:text-red-400 transition-colors"
                      title="Delete Project"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <div className="relative flex items-center">
                      <Info className="w-4 h-4 text-slate-500 hover:text-[#E2E8F0] transition-colors" />
                      
                      <div className="absolute right-0 top-full mt-2 px-2.5 py-1.5 bg-[#252A34] text-[#E2E8F0] text-[11px] font-bold rounded shadow-xl whitespace-nowrap opacity-0 pointer-events-none group-hover/icon:opacity-100 transition-opacity z-[60] border border-[#2D333E]">
                        {category?.name || "Uncategorized"}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer Nav */}
      <div className="p-6 border-t border-[#252A34] flex flex-col gap-4">
        <button
          onClick={() => setCurrentTab("settings")}
          className={cn(
            "w-full flex items-center gap-3 px-4 py-2.5 text-[14px] font-medium transition-colors rounded-md",
            currentTab === "settings"
              ? "bg-[#1E2530] text-[#3B82F6]"
              : "text-[#94A3B8] hover:bg-[#1E2530]"
          )}
        >
          <Settings className="w-4 h-4" />
          Settings
        </button>

        <div>
           <div className="text-xs text-slate-500 uppercase tracking-widest mb-3">Status</div>
           <div className="flex items-center gap-2 text-[#94A3B8]">
             <div className={`w-2 h-2 rounded-full ${statusColor} animate-pulse`}></div>
             <span className="text-sm font-medium">{statusText}</span>
           </div>
           {trackerStatus?.detail && (
             <div className="text-xs text-slate-500 mt-1">{trackerStatus.detail}</div>
           )}
        </div>
      </div>

    </div>
  );
}
