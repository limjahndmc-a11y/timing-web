export type Category = {
  id: string;
  name: string;
  color: string;
  icon?: string;
};

export type Project = {
  id: string;
  name: string;
  categoryId: string;
  color: string;
  hourlyRate: number;
};

export type TimeEntry = {
  id: string;
  title: string;
  projectId: string;
  app?: string;
  windowTitle?: string;
  start: Date;
  end: Date;
  durationSeconds: number; // For easy calculations
  source?: string;
};

export type TrackerStatus = {
  state: "running" | "permission_required" | "error" | "stopped";
  detail?: string;
};
