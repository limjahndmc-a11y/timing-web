import React, { useMemo, useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { subDays, subMonths, isWithinInterval, startOfDay, endOfDay, isAfter, isBefore } from "date-fns";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell 
} from "recharts";
import { Download, CalendarIcon } from "lucide-react";
import { TimeEntry, Project, Category } from "../types";

type DateRangeType = 'ALL_TIME' | 'TODAY' | 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'CUSTOM';

export function Reports({ entries, projects, categories, timezone }: { entries: TimeEntry[], projects: Project[], categories: Category[], timezone: string }) {
  const [dateRangeType, setDateRangeType] = useState<DateRangeType>('ALL_TIME');
  const [customStartDate, setCustomStartDate] = useState<string>(formatInTimeZone(subDays(new Date(), 7), timezone, "yyyy-MM-dd"));
  const [customEndDate, setCustomEndDate] = useState<string>(formatInTimeZone(new Date(), timezone, "yyyy-MM-dd"));

  const filteredEntries = useMemo(() => {
    if (dateRangeType === 'ALL_TIME') return entries;

    const today = new Date();
    let start: Date;
    let end: Date = endOfDay(today);

    switch (dateRangeType) {
      case 'TODAY':
        start = startOfDay(today);
        break;
      case 'LAST_7_DAYS':
        start = startOfDay(subDays(today, 6));
        break;
      case 'LAST_30_DAYS':
        start = startOfDay(subDays(today, 29));
        break;
      case 'CUSTOM':
        start = startOfDay(new Date(customStartDate));
        end = endOfDay(new Date(customEndDate));
        break;
      default:
        return entries;
    }

    return entries.filter(entry => 
      isAfter(entry.start, start) && isBefore(entry.end, end)
    );
  }, [entries, dateRangeType, customStartDate, customEndDate]);
  
  // Calculate total seconds using filteredEntries
  const totalSeconds = filteredEntries.reduce((acc, entry) => acc + entry.durationSeconds, 0);

  // Group by Category
  const categoryStats = useMemo(() => {
    const stats: Record<string, number> = {};
    filteredEntries.forEach(entry => {
       const project = projects.find(p => p.id === entry.projectId);
       if (project) {
          stats[project.categoryId] = (stats[project.categoryId] || 0) + entry.durationSeconds;
       }
    });

    return Object.entries(stats).map(([catId, dur]) => {
       const cat = categories.find(c => c.id === catId);
       return {
          id: catId,
          name: cat?.name || "Unknown Category",
          color: cat?.color || "#9CA3AF",
          duration: dur,
          percentage: totalSeconds > 0 ? Math.round((dur / totalSeconds) * 100) : 0
       }
    }).sort((a,b) => b.duration - a.duration);
  }, [filteredEntries, projects, categories, totalSeconds]);

  // Group by Project
  const projectStats = useMemo(() => {
    const stats: Record<string, number> = {};
    filteredEntries.forEach(entry => {
       stats[entry.projectId] = (stats[entry.projectId] || 0) + entry.durationSeconds;
    });
    
    return Object.entries(stats).map(([projId, dur]) => {
       const proj = projects.find(p => p.id === projId);
       return {
          id: projId,
          name: proj?.name || "Unknown Project",
          color: proj?.color || "#9CA3AF",
          duration: dur,
          percentage: totalSeconds > 0 ? Math.round((dur / totalSeconds) * 100) : 0
       }
    }).sort((a,b) => b.duration - a.duration);
  }, [filteredEntries, projects, totalSeconds]);

  // Bar Chart Data (Last 7 Days)
  const barData = useMemo(() => {
    const days = Array.from({ length: 7 }).map((_, i) => subDays(new Date(), 6 - i));
    
    return days.map(day => {
      const dayStr = formatInTimeZone(day, timezone, "yyyy-MM-dd");
      const daySeconds = filteredEntries.reduce((acc, entry) => {
        const entryDayStr = formatInTimeZone(entry.start, timezone, "yyyy-MM-dd");
        if (entryDayStr === dayStr) {
          return acc + entry.durationSeconds;
        }
        return acc;
      }, 0);
      
      return {
        date: formatInTimeZone(day, timezone, "MMM dd"),
        hours: Number((daySeconds / 3600).toFixed(2))
      };
    });
  }, [entries, timezone]);

  // Pie Chart Data (by Category)
  const pieData = useMemo(() => {
    return categoryStats.map(stat => ({
      name: stat.name,
      value: stat.duration,
      fill: stat.color
    }));
  }, [categoryStats]);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const handleExportCSV = () => {
    const headers = ["Activity", "Project", "Start Time", "End Time", "Duration (HH:MM:SS)"];
    
    const rows = filteredEntries.map(entry => {
      const project = projects.find(p => p.id === entry.projectId);
      const projectName = project ? project.name : "Unknown Project";
      
      const start = formatInTimeZone(entry.start, timezone, "yyyy-MM-dd HH:mm:ss");
      const end = formatInTimeZone(entry.end, timezone, "yyyy-MM-dd HH:mm:ss");
      
      const h = Math.floor(entry.durationSeconds / 3600).toString().padStart(2, '0');
      const m = Math.floor((entry.durationSeconds % 3600) / 60).toString().padStart(2, '0');
      const s = (entry.durationSeconds % 60).toString().padStart(2, '0');
      const durationStr = `${h}:${m}:${s}`;

      const escapeCSV = (str: string) => `"${str.replace(/"/g, '""')}"`;
      
      return [
        escapeCSV(entry.title),
        escapeCSV(projectName),
        escapeCSV(start),
        escapeCSV(end),
        escapeCSV(durationStr)
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `timing_export_${formatInTimeZone(new Date(), timezone, "yyyyMMdd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-full bg-[#0B0E14] p-8 overflow-y-auto w-full">
      <div className="max-w-6xl mx-auto w-full flex flex-col gap-8 pb-10">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <h2 className="text-2xl font-light tracking-tight text-white">Activity Report</h2>
          <div className="flex items-center gap-3">
             <div className="flex items-center gap-2 bg-[#151921] border border-[#252A34] rounded-md px-3 py-1.5 text-sm text-slate-400">
                <span className="font-medium text-[#E2E8F0]"><CalendarIcon className="w-4 h-4 inline-block mr-1" /> Timeframe:</span>
                <select 
                  value={dateRangeType}
                  onChange={(e) => setDateRangeType(e.target.value as DateRangeType)}
                  className="bg-transparent text-blue-400 font-medium cursor-pointer hover:text-blue-300 outline-none"
                >
                  <option value="ALL_TIME" className="bg-[#151921]">All Time</option>
                  <option value="TODAY" className="bg-[#151921]">Today</option>
                  <option value="LAST_7_DAYS" className="bg-[#151921]">Last 7 Days</option>
                  <option value="LAST_30_DAYS" className="bg-[#151921]">Last 30 Days</option>
                  <option value="CUSTOM" className="bg-[#151921]">Custom</option>
                </select>
             </div>
             
             {dateRangeType === 'CUSTOM' && (
               <div className="flex items-center gap-2 bg-[#151921] border border-[#252A34] rounded-md px-2 py-1.5 text-sm text-slate-400">
                  <input 
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="bg-transparent text-[#E2E8F0] outline-none"
                  />
                  <span>-</span>
                  <input 
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="bg-transparent text-[#E2E8F0] outline-none"
                  />
               </div>
             )}

             <button 
                onClick={handleExportCSV}
                className="flex items-center gap-2 bg-[#151921] hover:bg-[#1E2530] border border-[#252A34] text-[#E2E8F0] px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                title="Export CSV"
              >
                <Download className="w-4 h-4 text-slate-400" />
                <span className="hidden sm:inline">Export</span>
             </button>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-[#151921] border border-[#252A34] p-6 rounded-xl shadow-sm h-[360px] flex flex-col">
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4">Daily Trend (Last 7 Days)</h3>
            <div className="flex-1 w-full min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#252A34" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                  <RechartsTooltip 
                     formatter={(value: number) => [`${value.toFixed(1)} h`, "Time"]}
                     cursor={{ fill: '#1E2530' }}
                     contentStyle={{ backgroundColor: "#1E2530", border: "1px solid #252A34", borderRadius: "8px", color: "#E2E8F0" }}
                     itemStyle={{ color: "#E2E8F0" }}
                  />
                  <Bar dataKey="hours" radius={[4, 4, 0, 0]}>
                     {barData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === barData.length - 1 ? "#3B82F6" : "#2D333E"} />
                     ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-[#151921] border border-[#252A34] p-6 rounded-xl shadow-sm h-[360px] flex flex-col">
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4">Time by Category</h3>
            <div className="flex-1 w-full min-h-0 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    formatter={(value: number) => {
                      const h = Math.floor(value / 3600);
                      const m = Math.floor((value % 3600) / 60);
                      return h > 0 ? `${h}h ${m}m` : `${m}m`;
                    }}
                    contentStyle={{ backgroundColor: "#1E2530", border: "1px solid #252A34", borderRadius: "8px", color: "#E2E8F0" }}
                    itemStyle={{ color: "#E2E8F0" }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {pieData.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-slate-500 italic text-sm">
                  No data to display
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Existing Breakdown Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           {/* CATEGORY BREAKDOWN */}
           <div className="bg-[#151921] border border-[#252A34] rounded-xl p-6 flex flex-col shadow-sm">
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-6">Category Breakdown</h3>
              
              <div className="flex-1 flex flex-col gap-6">
                 {categoryStats.map(stat => (
                    <div key={stat.id} className="flex flex-col gap-2.5">
                       <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2.5">
                             <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: stat.color }} />
                             <span className="font-medium text-[#E2E8F0] tracking-wide">{stat.name}</span>
                          </div>
                          <div className="flex items-center gap-4">
                             <span className="text-[#94A3B8] font-medium">{formatDuration(stat.duration)}</span>
                             <span className="font-mono text-xs w-10 text-right text-slate-500">{stat.percentage}%</span>
                          </div>
                       </div>
                       <div className="w-full bg-[#0B0E14] h-2.5 rounded-full overflow-hidden shadow-inner flex">
                          <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ backgroundColor: stat.color, width: `${stat.percentage}%` }} />
                       </div>
                    </div>
                 ))}
                 {categoryStats.length === 0 && (
                    <div className="text-slate-500 text-sm italic">No data available.</div>
                 )}
              </div>
           </div>

           {/* PROJECT BREAKDOWN */}
           <div className="bg-[#151921] border border-[#252A34] rounded-xl p-6 flex flex-col shadow-sm">
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-6">Project Breakdown</h3>
              
              <div className="flex-1 flex flex-col gap-6">
                 {projectStats.map(stat => (
                    <div key={stat.id} className="flex flex-col gap-2.5">
                       <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2.5">
                             <div className="w-3.5 h-3.5 rounded-[4px] shadow-sm" style={{ backgroundColor: stat.color }} />
                             <span className="font-medium text-[#E2E8F0] tracking-wide">{stat.name}</span>
                          </div>
                          <div className="flex items-center gap-4">
                             <span className="text-[#94A3B8] font-medium">{formatDuration(stat.duration)}</span>
                             <span className="font-mono text-xs w-10 text-right text-slate-500">{stat.percentage}%</span>
                          </div>
                       </div>
                       <div className="w-full bg-[#0B0E14] h-2.5 rounded-full overflow-hidden shadow-inner flex">
                          <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ backgroundColor: stat.color, width: `${stat.percentage}%` }} />
                       </div>
                    </div>
                 ))}
                 {projectStats.length === 0 && (
                    <div className="text-slate-500 text-sm italic">No data available.</div>
                 )}
              </div>
           </div>
        </div>

      </div>
    </div>
  )
}
