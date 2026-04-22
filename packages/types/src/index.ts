export type TrainingType =
  | "optictrain-navigation"
  | "gabor-match"
  | "flicker-gabor"
  | "brightness"
  | "reading"
  | "glare"
  | "tunnel";

export type UserRole = "user" | "admin" | "clinician";

export type AppUser = {
  id: string;
  role: UserRole;
  displayName: string;
  email?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminUserSummary = {
  user: AppUser;
  plan: UserPlan | null;
  trainingCount: number;
  recentTrainingAt: string | null;
  recentTrainingLabel: string | null;
};

export type TrainingRecord = {
  id: string;
  userId: string | null;
  planId: string | null;
  trainingType: TrainingType;
  trainingLabel: string;
  startedAt: string;
  endedAt: string;
  durationSec: number;
  score: number;
  total: number | null;
  accuracy: number | null;
  metrics: Record<string, unknown>;
  createdAt: string;
};

export type CreateTrainingRecordInput = Omit<TrainingRecord, "id" | "createdAt"> & {
  id?: string;
  createdAt?: string;
};

export type TrainingRecordQuery = {
  userId?: string;
  planId?: string;
  trainingType?: TrainingType;
  startedFrom?: string;
  startedTo?: string;
  limit?: number;
};

export type PlanTemplate = {
  id: string;
  name: string;
  durationWeeks: number;
  sessionsPerWeek: number;
  sessionDurationText: string;
  description: string;
  status: "active" | "archived";
  trainings: Array<{
    id: TrainingType;
    priority: "low" | "medium" | "high";
    frequency: string;
  }>;
};

export type PlanTemplateVersion = {
  id: string;
  version: number;
  templates: PlanTemplate[];
  changedBy: string | null;
  changedAt: string;
  notes?: string | null;
};

export type PlanInstanceEvent = {
  id: string;
  userId: string;
  planId: string | null;
  templateId: string | null;
  templateName: string | null;
  type: "joined" | "activated" | "left";
  createdAt: string;
  notes?: string | null;
};

export type UserPlan = {
  id: string;
  userId: string;
  templateId: string;
  nameSnapshot: string;
  startDate: string;
  endDate: string;
  totalSessions: number;
  completedSessions: number;
  status: "not_started" | "active" | "completed" | "cancelled" | "expired";
};

export type TrainingStatus = "ready" | "done" | "locked";

export type TodayTraining = {
  id: TrainingType;
  duration: string;
  status: TrainingStatus;
};

export type PlanTemplateSummary = {
  id: string;
  name: string;
  durationWeeks: number;
  sessionsPerWeek: number;
  sessionDurationText: string;
  description: string;
  status: "active" | "archived";
  focus: string;
};

export type GaborMatchConfig = {
  trainingType: "gabor-match";
  sessionDurationSec: number;
  maxTrials: number;
  initialGridSize: number;
  maxGridSize: number;
  levelUpEveryCorrect: number;
  scorePerCorrectBase: number;
  difficulty: "easy" | "medium" | "hard";
  orientationDegLevels: number[];
  spatialFrequencyLevels: number[];
  phaseLevels: number[];
  contrast: number;
  baselineLuminance: number;
  sigmaRatio: number;
  gamma: number;
};

export type TrainingModuleConfig = GaborMatchConfig;

export type TrainingConfigStatus = "draft" | "active" | "archived";

export type TrainingConfigVersion<TConfig extends TrainingModuleConfig = TrainingModuleConfig> = {
  id: string;
  trainingType: TConfig["trainingType"];
  version: number;
  status: TrainingConfigStatus;
  config: TConfig;
  createdBy: string | null;
  createdAt: string;
  activatedAt: string | null;
  notes?: string | null;
};

export type ApiResult<TData> =
  | {
      ok: true;
      data: TData;
    }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
      };
    };

export type DashboardSnapshot = {
  currentUser: AppUser | null;
  currentPlan: UserPlan | null;
  todayTrainings: TodayTraining[];
  planTemplates: PlanTemplateSummary[];
};

export type ReportTemplateSummary = {
  id: string;
  name: string;
  range: string;
  status: "可生成" | "已生成" | "待审核模板";
};

export type ReportSnapshot = {
  currentUser: AppUser | null;
  currentPlan: UserPlan | null;
  templates: ReportTemplateSummary[];
  recentRecords: TrainingRecord[];
  generatedAt: string;
};

export type AccountSnapshot = {
  currentUser: AppUser | null;
  currentPlan: UserPlan | null;
  availablePlanTemplates: PlanTemplate[];
  enrolledPlans: UserPlan[];
  planEvents: PlanInstanceEvent[];
  recentRecords: TrainingRecord[];
  generatedAt: string;
};
