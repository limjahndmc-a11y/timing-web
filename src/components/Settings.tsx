import React from "react";
import { Settings as SettingsIcon } from "lucide-react";
import { TrackerStatus } from "../types";

export function Settings({ 
  timezone, 
  setTimezone,
  trackerStatus
}: { 
  timezone: string; 
  setTimezone: (tz: string) => void;
  trackerStatus: TrackerStatus;
}) {
  const timezones = Intl.supportedValuesOf('timeZone');

  return (
    <div className="flex flex-col h-full bg-[#0B0E14] p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full flex flex-col h-full">
        <div className="flex items-center gap-3 mb-8">
            <SettingsIcon className="w-7 h-7 text-white" />
            <h2 className="text-2xl font-light tracking-tight text-white">Settings</h2>
        </div>
        
        <div className="bg-[#151921] border border-[#252A34] rounded-xl p-8 shadow-sm flex flex-col gap-6">
          <div className="border-b border-[#252A34] pb-6">
            <h3 className="text-sm font-bold uppercase tracking-widest text-[#E2E8F0] mb-2">Localization</h3>
            <p className="text-sm text-slate-500 mb-6">Select the timezone you want to use for displaying all times in the application.</p>
            <div className="max-w-sm">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Display Timezone</label>
              <select 
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#0B0E14] border border-[#252A34] focus:border-blue-500/50 outline-none rounded-md text-[#E2E8F0] transition-colors"
              >
                {timezones.map(tz => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-[#E2E8F0] mb-2">Tracking Permissions</h3>
            <p className="text-sm text-slate-500">
              Status: <span className="text-[#E2E8F0]">{trackerStatus.state}</span>
              {trackerStatus.detail ? ` - ${trackerStatus.detail}` : ""}
            </p>
            <p className="text-sm text-slate-500 mt-2">
              On macOS, grant Accessibility permission to allow active-window detection. On Windows, run the desktop app normally for foreground tracking.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
