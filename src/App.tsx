import React, { useState, useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { Dashboard } from "./components/Dashboard";
import { Timeline } from "./components/Timeline";
import { Activities } from "./components/Activities";
import { Reports } from "./components/Reports";
import { Search, Plus, Play, Square, X } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { differenceInSeconds } from "date-fns";
import { TimeEntry, Project, Category, TrackerStatus } from "./types";
import { Settings } from "./components/Settings";
import { createEntry, createProject, deleteProject, getBootstrapData, getDashboardStats, getTrend7Days, onTrackerActivityUpdated, updateEntry, updateProject, type DashboardStats, type TrendPoint } from "./lib/tauriApi";

export default function App() {
  const [currentTab, setCurrentTab] = useState("dashboard");
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [trackerStatus, setTrackerStatus] = useState<TrackerStatus>({ state: "stopped" });
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [timezone, setTimezone] = useState<string>(() => Intl.DateTimeFormat().resolvedOptions().timeZone);

  // Timer State
  const [activeTimer, setActiveTimer] = useState<{ title: string; projectId: string; start: Date } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [timerTitle, setTimerTitle] = useState("");
  const [timerProjectId, setTimerProjectId] = useState(projects[0]?.id || "");
  const [elapsed, setElapsed] = useState(0);

  // Project Modal State (Create & Edit)
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectCategoryId, setNewProjectCategoryId] = useState("");
  const [newProjectColor, setNewProjectColor] = useState("#3B82F6");
  const [newProjectRate, setNewProjectRate] = useState<number>(0);

  const handleOpenEditProject = (project: Project) => {
    setEditingProjectId(project.id);
    setNewProjectName(project.name);
    setNewProjectCategoryId(project.categoryId);
    setNewProjectColor(project.color);
    setNewProjectRate(project.hourlyRate || 0);
    setIsProjectModalOpen(true);
  };

  const handleOpenCreateProject = () => {
    setEditingProjectId(null);
    setNewProjectName("");
    setNewProjectCategoryId(categories[0]?.id || "");
    setNewProjectColor("#3B82F6");
    setNewProjectRate(0);
    setIsProjectModalOpen(true);
  };

  const handleSaveProject = () => {
    if (!newProjectName.trim() || !newProjectCategoryId) return;
    
    if (editingProjectId) {
      updateProject({ id: editingProjectId, name: newProjectName.trim(), categoryId: newProjectCategoryId, color: newProjectColor, hourlyRate: newProjectRate }).then(refreshData);
    } else {
      createProject({ name: newProjectName.trim(), categoryId: newProjectCategoryId, color: newProjectColor, hourlyRate: newProjectRate }).then(refreshData);
    }
    
    setIsProjectModalOpen(false);
  };

  // Delete Project State
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);

  const handleOpenDeleteProject = (project: Project) => {
    setDeletingProject(project);
  };

  const handleConfirmDeleteProject = () => {
    if (!deletingProject) return;
    deleteProject(deletingProject.id).then(refreshData);
    setDeletingProject(null);
  };

  const handleDropEntryOnProject = (entryId: string, projectId: string) => {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) return;
    updateEntry({
      id: entry.id,
      title: entry.title,
      projectId,
      start: entry.start,
      end: entry.end,
    }).then(refreshData);
  };

  // Manual Entry State
  const [isManualEntryModalOpen, setIsManualEntryModalOpen] = useState(false);
  const [manualEntryTitle, setManualEntryTitle] = useState("");
  const [manualEntryProjectId, setManualEntryProjectId] = useState(projects[0]?.id || "");
  const [manualEntryStart, setManualEntryStart] = useState("");
  const [manualEntryEnd, setManualEntryEnd] = useState("");

  useEffect(() => {
    if (!timerProjectId && projects.length > 0) setTimerProjectId(projects[0].id);
    if (!manualEntryProjectId && projects.length > 0) setManualEntryProjectId(projects[0].id);
    if (!newProjectCategoryId && categories.length > 0) setNewProjectCategoryId(categories[0].id);
  }, [projects, categories, timerProjectId, manualEntryProjectId, newProjectCategoryId]);

  // Edit Entry State
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editEntryTitle, setEditEntryTitle] = useState("");
  const [editEntryProjectId, setEditEntryProjectId] = useState("");
  const [editEntryStart, setEditEntryStart] = useState("");
  const [editEntryEnd, setEditEntryEnd] = useState("");

  const handleOpenEditEntry = (entry: TimeEntry) => {
    setEditingEntryId(entry.id);
    setEditEntryTitle(entry.title);
    setEditEntryProjectId(entry.projectId);
    setEditEntryStart(formatInTimeZone(entry.start, timezone, "yyyy-MM-dd'T'HH:mm"));
    setEditEntryEnd(formatInTimeZone(entry.end, timezone, "yyyy-MM-dd'T'HH:mm"));
  };

  const handleConfirmEditEntry = () => {
    if (!editEntryTitle.trim() || !editEntryProjectId || !editEntryStart || !editEntryEnd || !editingEntryId) return;
    
    const startDate = new Date(editEntryStart);
    const endDate = new Date(editEntryEnd);

    if (endDate <= startDate) {
      alert("End time must be after start time");
      return;
    }

    updateEntry({
      id: editingEntryId,
      title: editEntryTitle.trim(),
      projectId: editEntryProjectId,
      start: startDate,
      end: endDate,
    }).then(refreshData);

    setEditingEntryId(null);
  };

  const handleOpenManualEntry = () => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    setManualEntryStart(formatInTimeZone(oneHourAgo, timezone, "yyyy-MM-dd'T'HH:mm"));
    setManualEntryEnd(formatInTimeZone(now, timezone, "yyyy-MM-dd'T'HH:mm"));
    if (projects.length > 0 && !manualEntryProjectId) {
      setManualEntryProjectId(projects[0].id);
    }
    setIsManualEntryModalOpen(true);
  };

  const handleConfirmManualEntry = () => {
    if (!manualEntryTitle.trim() || !manualEntryProjectId || !manualEntryStart || !manualEntryEnd) return;
    
    const startDate = new Date(manualEntryStart);
    const endDate = new Date(manualEntryEnd);

    if (endDate <= startDate) {
      alert("End time must be after start time");
      return;
    }

    createEntry({
      title: manualEntryTitle.trim(),
      projectId: manualEntryProjectId,
      start: startDate,
      end: endDate,
    }).then(refreshData);
    setIsManualEntryModalOpen(false);
    setManualEntryTitle("");
  };

  useEffect(() => {
    let interval: any;
    if (activeTimer) {
      interval = setInterval(() => {
        setElapsed(differenceInSeconds(new Date(), activeTimer.start));
      }, 1000);
    } else {
      setElapsed(0);
    }
    return () => clearInterval(interval);
  }, [activeTimer]);

  const handleStartTimer = () => {
    if (projects.length > 0 && !timerProjectId) {
      setTimerProjectId(projects[0].id);
    }
    setIsModalOpen(true);
  };

  const confirmStartTimer = () => {
    if (!timerTitle.trim() || !timerProjectId) return;
    setActiveTimer({
      title: timerTitle,
      projectId: timerProjectId,
      start: new Date()
    });
    setIsModalOpen(false);
    setTimerTitle("");
  };

  // Stop Confirmation State
  const [isConfirmStopModalOpen, setIsConfirmStopModalOpen] = useState(false);

  const handleOpenConfirmStop = () => {
    setIsConfirmStopModalOpen(true);
  };

  const handleConfirmStopTimer = () => {
    if (!activeTimer) return;
    
    const end = new Date();
    createEntry({
      title: activeTimer.title,
      projectId: activeTimer.projectId,
      start: activeTimer.start,
      end,
    }).then(refreshData);
    setActiveTimer(null);
    setIsConfirmStopModalOpen(false);
  };

  const handleStopTimer = () => { // DEPRECATED - KEEP FOR SAFETY BUT USE CONFIRM FLOW
    if (!activeTimer) return;
    
    const end = new Date();
    createEntry({
      title: activeTimer.title,
      projectId: activeTimer.projectId,
      start: activeTimer.start,
      end,
    }).then(refreshData);
    setActiveTimer(null);
  };

  const refreshData = async () => {
    try {
      const data = await getBootstrapData();
      setEntries(data.entries);
      setProjects(data.projects);
      setCategories(data.categories);
      setTrackerStatus(data.trackerStatus);
      setDashboardStats(await getDashboardStats());
      setTrend(await getTrend7Days());
    } catch (err) {
      console.error(err);
      setTrackerStatus({
        state: "error",
        detail: err instanceof Error ? err.message : "Failed to load data",
      });
    }
  };

  useEffect(() => {
    refreshData();
    let unlisten: (() => void) | undefined;
    onTrackerActivityUpdated(() => {
      refreshData();
    })
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => {});
    return () => {
      if (unlisten) unlisten();
    };
  }, []);



  return (
    <div className="flex h-screen overflow-hidden bg-[#0B0E14] font-['Helvetica_Neue',Arial,sans-serif] text-[#E2E8F0]">
        <Sidebar 
        currentTab={currentTab} 
        setCurrentTab={setCurrentTab} 
        projects={projects}
        categories={categories}
        onAddProject={handleOpenCreateProject}
        onEditProject={handleOpenEditProject}
        onDeleteProject={handleOpenDeleteProject}
        onDropEntry={handleDropEntryOnProject}
        trackerStatus={trackerStatus}
      />

      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top App Bar - macOS style clean header */}
        <header className="h-[64px] border-b border-[#252A34] flex items-center justify-between px-6 flex-shrink-0 bg-[#0B0E14] z-10">
          <div className="flex items-center gap-4 text-sm font-medium">
            <span className="text-slate-400">Timing Web</span>
            <span className="text-slate-600">/</span>
            <span>{formatInTimeZone(new Date(), timezone, "MMM dd, yyyy")}</span>
            <button className="hidden sm:flex text-xs font-bold text-blue-400 bg-blue-600/10 px-4 py-1.5 rounded-full border border-blue-600/20 items-center gap-1">
              Current Session
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative group">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
              <input 
                type="text" 
                placeholder="Search events..." 
                className="pl-9 pr-4 py-1.5 text-sm bg-[#151921] border border-[#252A34] focus:border-blue-500/50 outline-none rounded-md w-48 focus:w-64 transition-all duration-200"
              />
            </div>
            
            <button 
              onClick={handleOpenManualEntry}
              className="flex items-center gap-1.5 bg-[#151921] hover:bg-[#1E2530] border border-[#252A34] text-[#E2E8F0] px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4 text-slate-400" />
              <span className="hidden sm:inline">Add Entry</span>
            </button>

            {!activeTimer ? (
              <button 
                onClick={handleStartTimer}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
              >
                <Play className="w-4 h-4" />
                <span className="hidden sm:inline">Start Timer</span>
              </button>
            ) : (
              <button 
                onClick={handleOpenConfirmStop}
                className="flex items-center gap-1.5 bg-red-600/20 text-red-500 hover:bg-red-600/30 border border-red-600/30 px-3 py-1.5 rounded-md text-sm font-bold transition-colors animate-pulse"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span className="hidden sm:inline">
                  Stop ({Math.floor(elapsed / 60).toString().padStart(2, '0')}:{(elapsed % 60).toString().padStart(2, '0')})
                </span>
              </button>
            )}
            
            <div className="w-8 h-8 rounded-full bg-[#1A1F26] border border-[#2D333E] ml-2"></div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-auto bg-[#0B0E14] relative">
          {currentTab === "dashboard" && (
            <Dashboard 
              entries={entries} 
              projects={projects} 
              categories={categories} 
              timezone={timezone}
              stats={dashboardStats}
              trend={trend}
            />
          )}

          {currentTab === "timeline" && (
            <Timeline 
              entries={entries} 
              projects={projects} 
              timezone={timezone}
              onEditEntry={handleOpenEditEntry}
            />
          )}

          {currentTab === "activities" && (
            <Activities 
              entries={entries}
              projects={projects}
              categories={categories}
              timezone={timezone}
              onEditEntry={handleOpenEditEntry}
            />
          )}

          {currentTab === "reports" && (
            <Reports
              entries={entries}
              projects={projects}
              categories={categories}
              timezone={timezone}
            />
          )}

          {currentTab === "settings" && (
            <Settings
              timezone={timezone}
              setTimezone={setTimezone}
              trackerStatus={trackerStatus}
            />
          )}
        </div>
      </main>

      {/* Timer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#151921] border border-[#252A34] rounded-xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-[#252A34]">
              <h3 className="font-bold text-[#E2E8F0]">Start New Timer</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-[#94A3B8] hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 flex flex-col gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">What are you working on?</label>
                <input 
                  autoFocus
                  type="text" 
                  value={timerTitle}
                  onChange={(e) => setTimerTitle(e.target.value)}
                  placeholder="e.g., Reading documentation..." 
                  className="w-full px-3 py-2 text-sm bg-[#0B0E14] border border-[#252A34] focus:border-blue-500/50 outline-none rounded-md text-[#E2E8F0] placeholder:text-slate-600 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Project</label>
                <select 
                  value={timerProjectId}
                  onChange={(e) => setTimerProjectId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[#0B0E14] border border-[#252A34] focus:border-blue-500/50 outline-none rounded-md text-[#E2E8F0] transition-colors"
                >
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="p-4 flex justify-end gap-3 bg-[#0B0E14] border-t border-[#252A34]">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-[#94A3B8] hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmStartTimer}
                disabled={!timerTitle.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 text-white rounded-md text-sm font-medium transition-colors"
              >
                Start Timer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Project Creation/Edit Modal */}
      {isProjectModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#151921] border border-[#252A34] rounded-xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-[#252A34]">
              <h3 className="font-bold text-[#E2E8F0]">{editingProjectId ? "Edit Project" : "Create New Project"}</h3>
              <button onClick={() => setIsProjectModalOpen(false)} className="text-[#94A3B8] hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 flex flex-col gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Project Name</label>
                <input 
                  autoFocus
                  type="text" 
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="e.g., Client Alpha..." 
                  className="w-full px-3 py-2 text-sm bg-[#0B0E14] border border-[#252A34] focus:border-blue-500/50 outline-none rounded-md text-[#E2E8F0] placeholder:text-slate-600 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Category</label>
                <select 
                  value={newProjectCategoryId}
                  onChange={(e) => setNewProjectCategoryId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[#0B0E14] border border-[#252A34] focus:border-blue-500/50 outline-none rounded-md text-[#E2E8F0] transition-colors"
                >
                  {categories.map(c => (
                     <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="mb-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Project Color</label>
                <div className="flex gap-2 flex-wrap items-center">
                  {["#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6", "#EC4899", "#64748B"].map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewProjectColor(color)}
                      className={`w-6 h-6 rounded-full transition-transform shrink-0 ${newProjectColor.toUpperCase() === color.toUpperCase() ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-[#151921]' : 'hover:scale-110'}`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                  <div className="w-px h-6 bg-[#252A34] mx-1"></div>
                  
                  <div className="relative flex items-center shrink-0">
                    <div 
                      className={`w-6 h-6 rounded-full border border-[#252A34] overflow-hidden relative cursor-pointer transition-transform ${!["#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6", "#EC4899", "#64748B"].includes(newProjectColor.toUpperCase()) ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-[#151921]' : 'hover:scale-110'}`}
                      style={{ backgroundColor: newProjectColor }}
                      title="Custom Color"
                    >
                      <input 
                        type="color"
                        value={newProjectColor}
                        onChange={(e) => setNewProjectColor(e.target.value)}
                        className="absolute inset-[-10px] w-10 h-10 cursor-pointer opacity-0"
                      />
                    </div>
                  </div>
                  <input
                    type="text"
                    value={newProjectColor}
                    onChange={(e) => setNewProjectColor(e.target.value)}
                    placeholder="#HEX"
                    className="ml-2 w-[72px] px-2 py-1 text-xs bg-[#0B0E14] border border-[#252A34] focus:border-blue-500/50 outline-none rounded text-[#E2E8F0] font-mono transition-colors uppercase"
                    maxLength={7}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Hourly Rate ($)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium">$</span>
                  <input 
                    type="number" 
                    min="0"
                    step="1"
                    value={newProjectRate === 0 ? "" : newProjectRate}
                    onChange={(e) => setNewProjectRate(Number(e.target.value))}
                    placeholder="0" 
                    className="w-full pl-7 pr-3 py-2 text-sm bg-[#0B0E14] border border-[#252A34] focus:border-blue-500/50 outline-none rounded-md text-[#E2E8F0] placeholder:text-slate-600 transition-colors"
                  />
                </div>
              </div>
            </div>
            <div className="p-4 flex justify-end gap-3 bg-[#0B0E14] border-t border-[#252A34]">
              <button 
                onClick={() => setIsProjectModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-[#94A3B8] hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveProject}
                disabled={!newProjectName.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 text-white rounded-md text-sm font-medium transition-colors"
              >
                {editingProjectId ? "Save Changes" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Entry Modal */}
      {isManualEntryModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#151921] border border-[#252A34] rounded-xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-[#252A34]">
              <h3 className="font-bold text-[#E2E8F0]">Add Manual Entry</h3>
              <button onClick={() => setIsManualEntryModalOpen(false)} className="text-[#94A3B8] hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 flex flex-col gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Activity Details</label>
                <input 
                  autoFocus
                  type="text" 
                  value={manualEntryTitle}
                  onChange={(e) => setManualEntryTitle(e.target.value)}
                  placeholder="e.g., Client sync meeting..." 
                  className="w-full px-3 py-2 text-sm bg-[#0B0E14] border border-[#252A34] focus:border-blue-500/50 outline-none rounded-md text-[#E2E8F0] placeholder:text-slate-600 transition-colors"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Assign Project</label>
                <select 
                  value={manualEntryProjectId}
                  onChange={(e) => setManualEntryProjectId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[#0B0E14] border border-[#252A34] focus:border-blue-500/50 outline-none rounded-md text-[#E2E8F0] transition-colors"
                >
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Start Time</label>
                    <input 
                      type="datetime-local" 
                      value={manualEntryStart}
                      onChange={(e) => setManualEntryStart(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-[#0B0E14] border border-[#252A34] focus:border-blue-500/50 outline-none rounded-md text-[#E2E8F0] transition-colors [color-scheme:dark]"
                    />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">End Time</label>
                    <input 
                      type="datetime-local" 
                      value={manualEntryEnd}
                      onChange={(e) => setManualEntryEnd(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-[#0B0E14] border border-[#252A34] focus:border-blue-500/50 outline-none rounded-md text-[#E2E8F0] transition-colors [color-scheme:dark]"
                    />
                 </div>
              </div>
            </div>
            <div className="p-4 flex justify-end gap-3 bg-[#0B0E14] border-t border-[#252A34]">
              <button 
                onClick={() => setIsManualEntryModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-[#94A3B8] hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmManualEntry}
                disabled={!manualEntryTitle.trim() || !manualEntryStart || !manualEntryEnd}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 text-white rounded-md text-sm font-medium transition-colors"
              >
                Save Entry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stop Timer Confirmation Modal */}
      {isConfirmStopModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#151921] border border-[#252A34] rounded-xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-[#252A34]">
              <h3 className="font-bold text-[#E2E8F0]">Confirm Stop Timer</h3>
              <button onClick={() => setIsConfirmStopModalOpen(false)} className="text-[#94A3B8] hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm text-[#94A3B8]">
                Are you sure you want to stop the timer? This will create a new time entry for <strong className="text-[#E2E8F0]">{activeTimer?.title}</strong>.
              </p>
            </div>
            <div className="p-4 flex justify-end gap-3 bg-[#0B0E14] border-t border-[#252A34]">
              <button 
                onClick={() => setIsConfirmStopModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-[#94A3B8] hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmStopTimer}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium transition-colors"
              >
                Confirm Stop
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Edit Entry Modal */}
      {editingEntryId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#151921] border border-[#252A34] rounded-xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-[#252A34]">
              <h3 className="font-bold text-[#E2E8F0]">Edit Time Entry</h3>
              <button onClick={() => setEditingEntryId(null)} className="text-[#94A3B8] hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 flex flex-col gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Activity Details</label>
                <input 
                  autoFocus
                  type="text" 
                  value={editEntryTitle}
                  onChange={(e) => setEditEntryTitle(e.target.value)}
                  placeholder="e.g., Client sync meeting..." 
                  className="w-full px-3 py-2 text-sm bg-[#0B0E14] border border-[#252A34] focus:border-blue-500/50 outline-none rounded-md text-[#E2E8F0] placeholder:text-slate-600 transition-colors"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Assign Project</label>
                <select 
                  value={editEntryProjectId}
                  onChange={(e) => setEditEntryProjectId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[#0B0E14] border border-[#252A34] focus:border-blue-500/50 outline-none rounded-md text-[#E2E8F0] transition-colors"
                >
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Start Time</label>
                    <input 
                      type="datetime-local" 
                      value={editEntryStart}
                      onChange={(e) => setEditEntryStart(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-[#0B0E14] border border-[#252A34] focus:border-blue-500/50 outline-none rounded-md text-[#E2E8F0] transition-colors [color-scheme:dark]"
                    />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">End Time</label>
                    <input 
                      type="datetime-local" 
                      value={editEntryEnd}
                      onChange={(e) => setEditEntryEnd(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-[#0B0E14] border border-[#252A34] focus:border-blue-500/50 outline-none rounded-md text-[#E2E8F0] transition-colors [color-scheme:dark]"
                    />
                 </div>
              </div>
            </div>
            <div className="p-4 flex justify-end gap-3 bg-[#0B0E14] border-t border-[#252A34]">
              <button 
                onClick={() => setEditingEntryId(null)}
                className="px-4 py-2 text-sm font-medium text-[#94A3B8] hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmEditEntry}
                disabled={!editEntryTitle.trim() || !editEntryStart || !editEntryEnd}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 text-white rounded-md text-sm font-medium transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Project Confirmation Modal */}
      {deletingProject && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#151921] border border-[#252A34] rounded-xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-[#252A34]">
              <h3 className="font-bold text-[#E2E8F0]">Delete Project</h3>
              <button onClick={() => setDeletingProject(null)} className="text-[#94A3B8] hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                    <line x1="10" y1="11" x2="10" y2="17" />
                    <line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm text-[#E2E8F0] font-medium">
                    Are you sure you want to delete <strong>{deletingProject.name}</strong>?
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    All time entries associated with this project will also be permanently deleted.
                  </p>
                </div>
              </div>
            </div>
            <div className="p-4 flex justify-end gap-3 bg-[#0B0E14] border-t border-[#252A34]">
              <button 
                onClick={() => setDeletingProject(null)}
                className="px-4 py-2 text-sm font-medium text-[#94A3B8] hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmDeleteProject}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium transition-colors"
              >
                Delete Project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
