import React, { useState, useMemo } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale";
import { Calendar as BigCalendar, dateFnsLocalizer } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { TimeEntry, Project } from "../types";
import { ArrowUpDown, Calendar as CalendarIcon, List as ListIcon, Edit2 } from "lucide-react";

const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

type SortKey = "start" | "duration";
type SortDirection = "asc" | "desc";
type ViewMode = "list" | "calendar";

export function Timeline({
  entries,
  projects,
  timezone,
  onEditEntry
}: {
  entries: TimeEntry[];
  projects: Project[];
  timezone: string;
  onEditEntry: (entry: TimeEntry) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("start");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [viewMode, setViewMode] = useState<ViewMode>("calendar");

  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
      let comparison = 0;
      if (sortKey === "start") {
        comparison = a.start.getTime() - b.start.getTime();
      } else if (sortKey === "duration") {
        comparison = a.durationSeconds - b.durationSeconds;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [entries, sortKey, sortDirection]);

  // Transform entries into react-big-calendar events
  const calendarEvents = useMemo(() => {
    return entries.map((entry) => {
      const project = projects.find((p) => p.id === entry.projectId);
      return {
        id: entry.id,
        title: `${entry.title} ${entry.app ? `(${entry.app})` : ''}`,
        start: entry.start,
        end: entry.end,
        resource: project,
      };
    });
  }, [entries, projects]);

  const eventStyleGetter = (event: any) => {
    const project = event.resource as Project | undefined;
    return {
      style: {
        backgroundColor: project?.color || "#3B82F6",
      }
    };
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#0B0E14] p-8">
      <div className="flex-1 bg-transparent rounded-xl overflow-hidden flex flex-col max-w-6xl mx-auto w-full">
        <div className="flex flex-wrap items-center justify-between mb-4 gap-4">
          <div className="flex items-center gap-4">
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500">Timeline Activity</h3>
            
            <div className="flex bg-[#151921] border border-[#252A34] rounded-md p-1">
              <button 
                onClick={() => setViewMode("list")}
                className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-colors ${viewMode === "list" ? 'bg-[#252A34] text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
              >
                <ListIcon className="w-3.5 h-3.5" />
                List
              </button>
              <button 
                onClick={() => setViewMode("calendar")}
                className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-colors ${viewMode === "calendar" ? 'bg-[#252A34] text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
              >
                <CalendarIcon className="w-3.5 h-3.5" />
                Calendar
              </button>
            </div>

            {viewMode === "list" && (
              <div className="flex items-center gap-2 bg-[#151921] border border-[#252A34] rounded-md px-2 py-1 text-xs text-slate-400">
                <ArrowUpDown className="w-3 h-3 text-slate-500" />
                <select 
                  value={`${sortKey}-${sortDirection}`}
                  onChange={(e) => {
                    const [key, dir] = e.target.value.split("-") as [SortKey, SortDirection];
                    setSortKey(key);
                    setSortDirection(dir);
                  }}
                  className="bg-transparent border-none outline-none text-[#E2E8F0] cursor-pointer"
                >
                  <option value="start-desc" className="bg-[#151921]">Start Time (Newest)</option>
                  <option value="start-asc" className="bg-[#151921]">Start Time (Oldest)</option>
                  <option value="duration-desc" className="bg-[#151921]">Duration (Longest)</option>
                  <option value="duration-asc" className="bg-[#151921]">Duration (Shortest)</option>
                </select>
              </div>
            )}
          </div>
          <div className="text-xs text-slate-500">{formatInTimeZone(new Date(), timezone, "EEEE, MMM do")}</div>
        </div>
        
        {viewMode === "list" ? (
          <div className="flex-1 bg-[#151921] border border-[#252A34] rounded-xl p-2 min-h-0 overflow-y-auto">
            {sortedEntries.map((entry, index) => {
              const project = projects.find((p) => p.id === entry.projectId);
              const isLast = index === sortedEntries.length - 1;
              
              return (
                <div 
                  key={entry.id} 
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", entry.id);
                  }}
                  className={`h-12 flex items-center group cursor-grab active:cursor-grabbing hover:bg-[#1E2530]/50 transition-colors ${!isLast ? 'border-b border-[#1A1F26]' : ''} rounded`}
                  style={{ gridTemplateColumns: "80px 1fr 40px", display: "grid" }}
                >
                  <div className="flex flex-col text-[11px] text-[#475569] text-right pr-4 font-mono">
                    <span>{formatInTimeZone(entry.start, timezone, "HH:mm")}</span>
                    {sortKey === "duration" && (
                      <span className="text-[#3B82F6]">{Math.floor(entry.durationSeconds / 60)}m</span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <div 
                      className="h-7 rounded-md text-[11px] font-semibold flex items-center px-3 border shadow-sm truncate max-w-full"
                      style={{ 
                        backgroundColor: `${project?.color}33` || '#3B82F633',
                        borderColor: `${project?.color}4D` || '#3B82F64D',
                        color: project?.color || '#3B82F6'
                      }}
                    >
                      <span className="truncate">{entry.app ? `${entry.app} — ` : ''}{entry.title}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-end pr-2">
                    <button onClick={() => onEditEntry(entry)} className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-[#252A34] rounded text-slate-400 hover:text-white transition-all">
                       <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex-1 bg-[#151921] rounded-xl min-h-0">
            <BigCalendar
              localizer={localizer}
              events={calendarEvents}
              startAccessor="start"
              endAccessor="end"
              defaultView="week"
              views={['month', 'week', 'day', 'agenda']}
              eventPropGetter={eventStyleGetter}
              onSelectEvent={(event: any) => {
                 const originalEntry = entries.find(e => e.id === event.id);
                 if (originalEntry) {
                   onEditEntry(originalEntry);
                 }
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
