import React from "react";
import { 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from "recharts";
import { TimeEntry, Project, Category } from "../types";
import { DashboardStats, TrendPoint } from "../lib/tauriApi";

export function Dashboard({
  entries,
  projects,
  categories,
  timezone,
  stats,
  trend
}: {
  entries: TimeEntry[];
  projects: Project[];
  categories: Category[];
  timezone: string;
  stats: DashboardStats | null;
  trend: TrendPoint[];
}) {
  const totalSeconds = stats?.totalSeconds ?? entries.reduce((acc, entry) => acc + entry.durationSeconds, 0);
  const totalHours = Math.floor(totalSeconds / 3600);
  const totalMinutes = Math.floor((totalSeconds % 3600) / 60);

  const totalEarnings = stats?.totalEarnings ?? entries.reduce((acc, entry) => {
    const project = projects.find(p => p.id === entry.projectId);
    const hourlyRate = project?.hourlyRate || 0;
    const hours = entry.durationSeconds / 3600;
    return acc + (hours * hourlyRate);
  }, 0);

  // Group by project for the Pie Chart
  const projectTotals = entries.reduce((acc, entry) => {
    acc[entry.projectId] = (acc[entry.projectId] || 0) + entry.durationSeconds;
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.entries(projectTotals).map(([projectId, seconds]) => {
    const project = projects.find((p) => p.id === projectId);
    return {
      name: project?.name || "Unknown",
      value: seconds,
      fill: project?.color || "#9CA3AF",
    };
  }).sort((a, b) => b.value - a.value);

  const barData = trend;

  return (
    <div className="flex flex-col gap-8 p-8 overflow-y-auto w-full max-w-5xl mx-auto">
      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
        <div className="bg-[#151921] border border-[#252A34] p-5 rounded-xl">
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Total Time Tracked</p>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-[32px] font-light tracking-tight text-white">{totalHours}h {totalMinutes}m</span>
          </div>
          <div className="text-xs text-green-400 mt-2">Based on tracked desktop activity</div>
        </div>
        
        <div className="bg-[#151921] border border-[#252A34] p-5 rounded-xl">
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Total Earnings</p>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-[32px] font-light tracking-tight text-emerald-400">
               ${totalEarnings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className="text-xs text-emerald-400/70 mt-2">Based on project rates</div>
        </div>

        <div className="bg-[#151921] border border-[#252A34] p-5 rounded-xl">
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Productivity Score</p>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-[32px] font-light tracking-tight text-blue-500">{stats?.productivityScore ?? 0}<span className="text-lg">/100</span></span>
          </div>
          <div className="w-full bg-[#0B0E14] h-1.5 rounded-full mt-3">
            <div className="bg-blue-500 h-full rounded-full" style={{ width: `${stats?.productivityScore ?? 0}%` }}></div>
          </div>
        </div>

        <div className="bg-[#151921] border border-[#252A34] p-5 rounded-xl">
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Focus Time</p>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-[32px] font-light tracking-tight text-white">
              {Math.floor((stats?.focusSeconds ?? 0) / 3600).toString().padStart(2, "0")}h {Math.floor(((stats?.focusSeconds ?? 0) % 3600) / 60).toString().padStart(2, "0")}m
            </span>
          </div>
          <div className="text-xs text-slate-500 mt-2">
            {(stats?.distractions ?? 0)} idle periods detected
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-[#151921] border border-[#252A34] p-6 rounded-xl h-[360px] flex flex-col">
          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4">Time by Project</h3>
          <div className="flex-1 w-full min-h-0">
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
                <Tooltip 
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
          </div>
          <div className="flex flex-wrap gap-4 mt-4 justify-center">
             {pieData.map((d, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-[#94A3B8] font-medium">
                  <div className="w-2.5 h-2.5 rounded-[3px]" style={{ backgroundColor: d.fill }}></div>
                  {d.name}
                </div>
             ))}
          </div>
        </div>

        <div className="bg-[#151921] border border-[#252A34] p-6 rounded-xl h-[360px] flex flex-col">
          <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4">Activity Trend (Last 7 Days)</h3>
          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#252A34" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                <Tooltip 
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
      </div>
    </div>
  );
}
