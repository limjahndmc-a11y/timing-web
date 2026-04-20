import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { Category, Project, TimeEntry, TrackerStatus } from "../types";

type RawProject = {
  id: string;
  name: string;
  category_id: string;
  color: string;
  hourly_rate: number;
};

type RawEntry = {
  id: string;
  title: string;
  project_id: string;
  app?: string | null;
  window_title?: string | null;
  start: string;
  end: string;
  duration_seconds: number;
  source: string;
};

type RawBootstrap = {
  categories: Category[];
  projects: RawProject[];
  entries: RawEntry[];
  tracker_status: TrackerStatus;
};

export type DashboardStats = {
  totalSeconds: number;
  totalEarnings: number;
  productivityScore: number;
  focusSeconds: number;
  distractions: number;
};

export type TrendPoint = {
  date: string;
  hours: number;
};

const isTauriRuntime = () => "__TAURI_INTERNALS__" in window;

const mapProject = (project: RawProject): Project => ({
  id: project.id,
  name: project.name,
  categoryId: project.category_id,
  color: project.color,
  hourlyRate: project.hourly_rate,
});

const mapEntry = (entry: RawEntry): TimeEntry => ({
  id: entry.id,
  title: entry.title,
  projectId: entry.project_id,
  app: entry.app ?? undefined,
  windowTitle: entry.window_title ?? undefined,
  start: new Date(entry.start),
  end: new Date(entry.end),
  durationSeconds: entry.duration_seconds,
  source: entry.source,
});

export async function getBootstrapData(): Promise<{
  categories: Category[];
  projects: Project[];
  entries: TimeEntry[];
  trackerStatus: TrackerStatus;
}> {
  if (!isTauriRuntime()) {
    return {
      categories: [],
      projects: [],
      entries: [],
      trackerStatus: { state: "permission_required", detail: "Run through Tauri desktop app." },
    };
  }
  const raw = await invoke<RawBootstrap>("get_bootstrap_data");
  return {
    categories: raw.categories,
    projects: raw.projects.map(mapProject),
    entries: raw.entries.map(mapEntry),
    trackerStatus: raw.tracker_status,
  };
}

export async function createProject(input: Omit<Project, "id">): Promise<void> {
  await invoke("create_project", {
    input: {
      name: input.name,
      category_id: input.categoryId,
      color: input.color,
      hourly_rate: input.hourlyRate,
    },
  });
}

export async function updateProject(project: Project): Promise<void> {
  await invoke("update_project", {
    input: {
      id: project.id,
      name: project.name,
      category_id: project.categoryId,
      color: project.color,
      hourly_rate: project.hourlyRate,
    },
  });
}

export async function createEntry(input: {
  title: string;
  projectId: string;
  start: Date;
  end: Date;
}): Promise<void> {
  await invoke("create_entry", {
    input: {
      title: input.title,
      project_id: input.projectId,
      start: input.start.toISOString(),
      end: input.end.toISOString(),
    },
  });
}

export async function updateEntry(input: {
  id: string;
  title: string;
  projectId: string;
  start: Date;
  end: Date;
}): Promise<void> {
  await invoke("update_entry", {
    input: {
      id: input.id,
      title: input.title,
      project_id: input.projectId,
      start: input.start.toISOString(),
      end: input.end.toISOString(),
    },
  });
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const stats = await invoke<{
    total_seconds: number;
    total_earnings: number;
    productivity_score: number;
    focus_seconds: number;
    distractions: number;
  }>("get_dashboard_stats");
  return {
    totalSeconds: stats.total_seconds,
    totalEarnings: stats.total_earnings,
    productivityScore: stats.productivity_score,
    focusSeconds: stats.focus_seconds,
    distractions: stats.distractions,
  };
}

export async function getTrend7Days(): Promise<TrendPoint[]> {
  return invoke("get_trend_7_days");
}

export async function getTrackerStatus(): Promise<TrackerStatus> {
  return invoke("get_tracker_status");
}

export async function onTrackerActivityUpdated(handler: () => void): Promise<UnlistenFn> {
  return listen("tracker://activity-updated", () => handler());
}
