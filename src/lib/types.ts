export interface ChronovaUser {
  id: string;
  username: string;
  email: string;
  avatar_url: string | null;
  subscription: {
    plan: string;
    status: string;
  };
  github_connected: boolean;
  organizations: Array<{
    id: string;
    name: string;
    role: string;
  }>;
  created_at: string;
  modified_at: string;
}

export interface ChronovaStatsRange {
  range: string;
  total_seconds: number;
  languages: Array<{
    name: string;
    total_seconds: number;
    percent: number;
  }>;
  projects: Array<{
    name: string;
    total_seconds: number;
    percent: number;
  }>;
  editors: Array<{
    name: string;
    total_seconds: number;
    percent: number;
  }>;
  operating_systems: Array<{
    name: string;
    total_seconds: number;
    percent: number;
  }>;
  daily_stats: Array<{
    date: string;
    total_seconds: number;
  }>;
  hourly_stats: Array<{
    hour: number;
    total_seconds: number;
  }>;
  best_day: {
    date: string;
    total_seconds: number;
  } | null;
  start: string;
  end: string;
}

export interface ChronovaHeartbeat {
  id: string;
  time: string;
  type: string;
  project: string | null;
  language: string | null;
  editor: string | null;
  operating_system: string | null;
  machine: string | null;
  branch: string | null;
  created_at: string;
}

export interface ChronovaHeartbeatResponse {
  heartbeats: ChronovaHeartbeat[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface ChronovaAiAnalytics {
  adoptionTimeline: Array<{
    date: string;
    aiSeconds: number;
    manualSeconds: number;
  }>;
  contributionShare: {
    aiPercent: number;
    manualPercent: number;
    aiHours: number;
    manualHours: number;
  };
  comparison: {
    withAi: {
      totalSeconds: number;
      avgDaily: number;
    };
    withoutAi: {
      totalSeconds: number;
      avgDaily: number;
    };
  };
  languageMatrix: Array<{
    language: string;
    aiPercent: number;
    manualPercent: number;
  }>;
  projectDependency: Array<{
    project: string;
    aiPercent: number;
    manualPercent: number;
  }>;
  efficiencyTrend: Array<{
    period: string;
    productivity: number;
  }>;
}