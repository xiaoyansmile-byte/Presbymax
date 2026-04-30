import { trainingLabels } from "@prosbymax/core";
import type {
  PlanTemplate,
  PlanTemplateSummary,
  ReportTemplateSummary,
  TodayTraining,
  TrainingRecord,
  UserPlan,
  SurgeryType,
  UserGender
} from "@prosbymax/types";

export const currentUser = {
  id: "demo-user",
  name: "测试用户",
  email: "demo@prosbymax.local",
  age: 54,
  gender: "male",
  surgeryType: "smile",
  surgeryAt: "2026-01-15T09:30:00.000Z"
} as const satisfies {
  id: string;
  name: string;
  email: string;
  age: number;
  gender: UserGender;
  surgeryType: SurgeryType;
  surgeryAt: string;
};

export const currentPlan: UserPlan = {
  id: "post-surgery",
  userId: currentUser.id,
  templateId: "post-surgery",
  nameSnapshot: "术后恢复计划",
  startDate: "2026-04-01T00:00:00.000Z",
  endDate: "2026-04-29T00:00:00.000Z",
  totalSessions: 60,
  completedSessions: 19,
  status: "active"
};

export const todayTrainings: TodayTraining[] = [
  { id: "gabor-match", duration: "3 分钟", status: "ready" },
  { id: "optictrain-navigation", duration: "3 分钟", status: "ready" },
  { id: "brightness", duration: "2 分钟", status: "done" },
  { id: "tunnel", duration: "3 分钟", status: "ready" }
];

export const planTemplates: PlanTemplateSummary[] = [
  {
    id: "post-surgery",
    name: "术后恢复计划",
    durationWeeks: 4,
    sessionsPerWeek: 15,
    sessionDurationText: "每日 8-10 分钟",
    description: "围绕 Gabor 配对、隧道识别和对比辨别建立温和恢复节奏。",
    status: "active",
    focus: "恢复节奏"
  },
  {
    id: "mcl-adaptation",
    name: "多焦点接触镜适应计划",
    durationWeeks: 6,
    sessionsPerWeek: 12,
    sessionDurationText: "每日 6-8 分钟",
    description: "强化焦点切换和阅读清晰度，帮助用户适应不同视觉场景。",
    status: "active",
    focus: "焦点切换"
  },
  {
    id: "contrast-boost",
    name: "对比敏感度提升计划",
    durationWeeks: 5,
    sessionsPerWeek: 10,
    sessionDurationText: "每日 5-7 分钟",
    description: "聚焦对比辨别、眩光场景和低清晰度阅读训练。",
    status: "active",
    focus: "对比敏感"
  }
];

export const planCatalog: PlanTemplate[] = [
  {
    id: "post-surgery",
    name: "术后恢复计划",
    durationWeeks: 4,
    sessionsPerWeek: 15,
    sessionDurationText: "每日 8-10 分钟",
    description: "围绕 Gabor 配对、隧道识别和对比辨别建立温和恢复节奏。",
    status: "active",
    trainings: [
      { id: "gabor-match", priority: "high", frequency: "每日 1 次" },
      { id: "optictrain-navigation", priority: "medium", frequency: "每周 2 次" },
      { id: "brightness", priority: "medium", frequency: "每周 3 次" },
      { id: "tunnel", priority: "medium", frequency: "每周 2 次" }
    ]
  },
  {
    id: "mcl-adaptation",
    name: "多焦点接触镜适应计划",
    durationWeeks: 6,
    sessionsPerWeek: 12,
    sessionDurationText: "每日 6-8 分钟",
    description: "强化焦点切换和阅读清晰度，帮助用户适应不同视觉场景。",
    status: "active",
    trainings: [
      { id: "reading", priority: "high", frequency: "每日 1 次" },
      { id: "gabor-match", priority: "medium", frequency: "每周 2 次" },
      { id: "brightness", priority: "medium", frequency: "每周 2 次" }
    ]
  },
  {
    id: "contrast-boost",
    name: "对比敏感度提升计划",
    durationWeeks: 5,
    sessionsPerWeek: 10,
    sessionDurationText: "每日 5-7 分钟",
    description: "聚焦对比辨别、眩光场景和低清晰度阅读训练。",
    status: "active",
    trainings: [
      { id: "glare", priority: "high", frequency: "每日 1 次" },
      { id: "brightness", priority: "high", frequency: "每日 1 次" },
      { id: "tunnel", priority: "low", frequency: "每周 1 次" }
    ]
  }
];

export const demoRecords: TrainingRecord[] = [
  {
    id: "demo-1",
    userId: currentUser.id,
    planId: currentPlan.id,
    trainingType: "gabor-match",
    trainingLabel: trainingLabels["gabor-match"],
    startedAt: "2026-04-21T09:00:00.000Z",
    endedAt: "2026-04-21T09:03:00.000Z",
    durationSec: 180,
    score: 12,
    total: null,
    accuracy: null,
    metrics: { maxK: 5 },
    createdAt: "2026-04-21T09:03:00.000Z"
  },
  {
    id: "demo-2",
    userId: currentUser.id,
    planId: currentPlan.id,
    trainingType: "brightness",
    trainingLabel: trainingLabels.brightness,
    startedAt: "2026-04-21T10:00:00.000Z",
    endedAt: "2026-04-21T10:02:00.000Z",
    durationSec: 120,
    score: 8,
    total: 10,
    accuracy: 80,
    metrics: {},
    createdAt: "2026-04-21T10:02:00.000Z"
  },
  {
    id: "demo-3",
    userId: currentUser.id,
    planId: currentPlan.id,
    trainingType: "optictrain-navigation",
    trainingLabel: trainingLabels["optictrain-navigation"],
    startedAt: "2026-04-21T10:20:00.000Z",
    endedAt: "2026-04-21T10:22:30.000Z",
    durationSec: 150,
    score: 9,
    total: 12,
    accuracy: 75,
    metrics: { routeErrors: 2, targetHits: 9 },
    createdAt: "2026-04-21T10:22:30.000Z"
  }
];

export const reportSummaries: ReportTemplateSummary[] = [
  {
    id: "weekly",
    name: "周摘要报告",
    range: "最近 7 天",
    status: "可生成"
  },
  {
    id: "progress",
    name: "计划进度报告",
    range: "当前计划周期",
    status: "可生成"
  },
  {
    id: "clinical",
    name: "详细训练记录",
    range: "全部时间",
    status: "待审核模板"
  }
];
