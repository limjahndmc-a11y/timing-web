import React, { useState, useMemo } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { TimeEntry, Project, Category } from "../types";
import { Search, Filter, ArrowUpDown, ArrowUp, ArrowDown, Edit2 } from "lucide-react";

type SortKey = "activity" | "project" | "time" | "duration";
type SortDir = "asc" | "desc";

export function Activities({ entries, projects, categories, timezone, onEditEntry }: { entries: TimeEntry[], projects: Project[], categories: Category[], timezone: string, onEditEntry: (entry: TimeEntry) => void }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("time");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sortedAndFilteredEntries = useMemo(() => {
    let result = entries.filter((entry) => 
      entry.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (entry.app && entry.app.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    result.sort((a, b) => {
      let comp = 0;
      if (sortKey === "time") {
        comp = a.start.getTime() - b.start.getTime();
      } else if (sortKey === "duration") {
        comp = a.durationSeconds - b.durationSeconds;
      } else if (sortKey === "project") {
        const pA = projects.find(p => p.id === a.projectId)?.name || "";
        const pB = projects.find(p => p.id === b.projectId)?.name || "";
        comp = pA.localeCompare(pB);
      } else if (sortKey === "activity") {
        comp = a.title.localeCompare(b.title);
      }
      return sortDir === "asc" ? comp : -comp;
    });

    return result;
  }, [entries, projects, searchTerm, sortKey, sortDir]);

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ArrowUpDown className="w-3 h-3 inline-block ml-1 opacity-0 group-hover:opacity-40 transition-opacity" />;
    return sortDir === "asc" ? 
      <ArrowUp className="w-3 h-3 inline-block ml-1 text-blue-500" /> : 
      <ArrowDown className="w-3 h-3 inline-block ml-1 text-blue-500" />;
  };

  return (
    <div className="flex flex-col h-full bg-[#0B0E14] p-8">
      <div className="max-w-6xl mx-auto w-full flex flex-col h-full">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-light tracking-tight text-white">All Activities</h2>
          <div className="flex items-center gap-3">
             <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input 
                  type="text" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search activities..." 
                  className="pl-9 pr-4 py-2 text-sm bg-[#151921] border border-[#252A34] focus:border-blue-500/50 outline-none rounded-md w-64 text-[#E2E8F0] transition-colors shadow-sm"
                />
             </div>
             <button className="flex items-center gap-2 px-4 py-2 bg-[#151921] border border-[#252A34] rounded-md text-sm font-medium hover:bg-[#1E2530] transition-colors text-[#E2E8F0] shadow-sm">
                <Filter className="w-4 h-4" />
                Filter
             </button>
          </div>
        </div>

        <div className="flex-1 bg-[#151921] border border-[#252A34] rounded-xl overflow-hidden flex flex-col shadow-sm">
          <div className="grid grid-cols-12 gap-4 border-b border-[#252A34] p-4 text-xs font-bold text-slate-500 uppercase tracking-widest bg-[#0B0E14]/50 select-none">
            <div className="col-span-5 flex items-center cursor-pointer group" onClick={() => toggleSort("activity")}>
               Activity <SortIcon column="activity" />
            </div>
            <div className="col-span-3 flex items-center cursor-pointer group" onClick={() => toggleSort("project")}>
               Project <SortIcon column="project" />
            </div>
            <div className="col-span-2 flex items-center cursor-pointer group" onClick={() => toggleSort("time")}>
               Time <SortIcon column="time" />
            </div>
            <div className="col-span-2 flex items-center justify-end cursor-pointer group" onClick={() => toggleSort("duration")}>
               Duration <SortIcon column="duration" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {sortedAndFilteredEntries.map((entry) => {
              const project = projects.find(p => p.id === entry.projectId);
              return (
                 <div 
                    key={entry.id} 
                    draggable
                    onDragStart={(e) => { e.dataTransfer.setData("text/plain", entry.id) }}
                    className="grid grid-cols-12 gap-4 border-b border-[#1A1F26] p-3 items-center hover:bg-[#1A1F26]/80 cursor-grab active:cursor-grabbing rounded-lg transition-colors group"
                 >
                    <div className="col-span-5 flex flex-col min-w-0 pr-4">
                       <span className="font-medium text-[#E2E8F0] truncate">{entry.title}</span>
                       {(entry.app || entry.windowTitle) && (
                          <span className="text-xs text-slate-500 truncate mt-0.5">
                             {entry.app}{entry.windowTitle ? ` — ${entry.windowTitle}` : ''}
                          </span>
                       )}
                    </div>
                    <div className="col-span-3 flex items-center gap-2">
                       {project && (
                         <>
                           <div className="w-2.5 h-2.5 rounded-[3px] flex-shrink-0 shadow-sm" style={{ backgroundColor: project.color }} />
                           <span className="text-sm text-[#94A3B8] truncate">{project.name}</span>
                         </>
                       )}
                    </div>
                    <div className="col-span-2 text-[13px] text-[#94A3B8] font-mono">
                       {formatInTimeZone(entry.start, timezone, "HH:mm")} - {formatInTimeZone(entry.end, timezone, "HH:mm")}
                    </div>
                    <div className="col-span-2 text-[13px] text-[#E2E8F0] font-mono flex items-center justify-between">
                       <span>{Math.floor(entry.durationSeconds / 3600).toString().padStart(2, '0')}:{(Math.floor((entry.durationSeconds % 3600) / 60)).toString().padStart(2, '0')}:{(entry.durationSeconds % 60).toString().padStart(2, '0')}</span>
                       <button onClick={() => onEditEntry(entry)} className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-[#252A34] rounded text-slate-400 hover:text-white transition-all">
                          <Edit2 className="w-3.5 h-3.5" />
                       </button>
                    </div>
                 </div>
              )
            })}
            {sortedAndFilteredEntries.length === 0 && (
               <div className="p-12 flex flex-col items-center justify-center text-center">
                  <Search className="w-10 h-10 text-[#252A34] mb-3" />
                  <p className="text-[#E2E8F0] font-medium">No activities found</p>
                  <p className="text-slate-500 text-sm mt-1">Try adjusting your search criteria</p>
               </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
