import type {
  AdminUserSummary,
  AppUser,
  DashboardSnapshot,
  CreateTrainingRecordInput,
  GaborMatchConfig,
  PlanInstanceEvent,
  PlanTemplateVersion,
  ReportSnapshot,
  PlanTemplate,
  TrainingConfigVersion,
  TrainingRecord,
  TrainingRecordQuery
} from "@prosbymax/types";

export type TrainingRecordRepository = {
  list(query?: TrainingRecordQuery): Promise<TrainingRecord[]>;
  create(input: CreateTrainingRecordInput): Promise<TrainingRecord>;
};

export type TrainingConfigRepository = {
  getActiveGaborMatchConfig(): Promise<TrainingConfigVersion<GaborMatchConfig> | null>;
  saveGaborMatchDraft(config: GaborMatchConfig, options?: { createdBy?: string | null; notes?: string | null }): Promise<TrainingConfigVersion<GaborMatchConfig>>;
  activateGaborMatchConfig(versionId: string, options?: { activatedBy?: string | null }): Promise<TrainingConfigVersion<GaborMatchConfig>>;
};

export type UserRepository = {
  getCurrentUser(): Promise<AppUser | null>;
};

export type AdminUserRepository = {
  listSummaries(): Promise<AdminUserSummary[]>;
};

export type PlanTemplateRepository = {
  list(): Promise<PlanTemplate[]>;
};

export type PlanTemplateVersionRepository = {
  listHistory(): Promise<PlanTemplateVersion[]>;
};

export type PlanInstanceEventRepository = {
  listByUser(userId?: string | null): Promise<PlanInstanceEvent[]>;
};

export type AuthRepository = {
  login(input: { email: string; password: string }): Promise<AppUser | null>;
  register(input: { displayName: string; email: string; password: string }): Promise<AppUser | null>;
  logout(): Promise<void>;
};

export type DashboardRepository = {
  getDashboardSnapshot(): Promise<DashboardSnapshot>;
};

export type ReportRepository = {
  getReportSnapshot(): Promise<ReportSnapshot>;
};

export type ProsbymaxDataGateway = {
  users: UserRepository;
  adminUsers: AdminUserRepository;
  planTemplates: PlanTemplateRepository;
  planTemplateVersions: PlanTemplateVersionRepository;
  planInstanceEvents: PlanInstanceEventRepository;
  auth: AuthRepository;
  trainingRecords: TrainingRecordRepository;
  trainingConfigs: TrainingConfigRepository;
  dashboard: DashboardRepository;
  reports: ReportRepository;
};

export const apiRoutes = {
  currentUser: "/api/me",
  authLogin: "/api/auth/login",
  authRegister: "/api/auth/register",
  authLogout: "/api/auth/logout",
  account: "/api/account",
  accountPlans: "/api/account/plans",
  accountPlanEvents: "/api/account/plan-events",
  adminUsers: "/api/admin/users",
  adminPlanTemplates: "/api/admin/plan-templates",
  adminPlanTemplateHistory: "/api/admin/plan-templates/history",
  planTemplates: "/api/plan-templates",
  dashboard: "/api/dashboard",
  reports: "/api/reports/summary",
  trainingRecords: "/api/training-records",
  activeGaborConfig: "/api/training-configs/gabor-match/active",
  gaborConfigDrafts: "/api/training-configs/gabor-match/drafts"
} as const;
