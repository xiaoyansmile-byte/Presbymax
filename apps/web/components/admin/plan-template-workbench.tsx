"use client";

import { useEffect, useMemo, useState } from "react";
import { trainingLabels } from "@prosbymax/core";
import type { PlanTemplate, PlanTemplateVersion, TrainingType } from "@prosbymax/types";
import {
  loadAdminPlanTemplateHistory,
  loadAdminPlanTemplates,
  saveAdminPlanTemplates
} from "@/lib/admin-plan-templates";
import { StatCard } from "@/components/stat-card";

type TrainingItem = PlanTemplate["trainings"][number];

const trainingTypeOptions = Object.entries(trainingLabels) as Array<[TrainingType, string]>;

function createBlankTraining(): TrainingItem {
  return {
    id: "gabor-match",
    priority: "medium",
    frequency: "每周 1 次"
  };
}

function createBlankTemplate(): PlanTemplate {
  return {
    id: `plan-template-${Date.now()}`,
    name: "新计划模板",
    durationWeeks: 4,
    sessionsPerWeek: 10,
    sessionDurationText: "每日 8-10 分钟",
    description: "描述这个计划适合什么阶段和目标。",
    status: "active",
    trainings: [createBlankTraining()]
  };
}

export function PlanTemplateWorkbench() {
  const [templates, setTemplates] = useState<PlanTemplate[]>([]);
  const [versions, setVersions] = useState<PlanTemplateVersion[]>([]);
  const [activeTemplateIndex, setActiveTemplateIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([loadAdminPlanTemplates(), loadAdminPlanTemplateHistory()]).then(([nextTemplates, nextVersions]) => {
      if (cancelled) return;
      setTemplates(nextTemplates ?? []);
      setVersions(nextVersions ?? []);
      setActiveTemplateIndex(0);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setActiveTemplateIndex((current) => {
      if (templates.length === 0) return 0;
      return Math.min(current, templates.length - 1);
    });
  }, [templates.length]);

  const stats = useMemo(
    () => ({
      templates: templates.length,
      activeTemplates: templates.filter((template) => template.status === "active").length,
      trainings: templates.reduce((sum, template) => sum + template.trainings.length, 0),
      durationWeeks: templates.reduce((sum, template) => sum + template.durationWeeks, 0)
    }),
    [templates]
  );

  const activeTemplate = templates[activeTemplateIndex] ?? templates[0] ?? null;

  function updateTemplateField(
    index: number,
    field: keyof Pick<PlanTemplate, "id" | "name" | "sessionDurationText" | "description">,
    value: string
  ) {
    setMessage(null);
    setTemplates((current) => current.map((template, currentIndex) => (currentIndex === index ? { ...template, [field]: value } : template)));
  }

  function updateTemplateNumberField(index: number, field: keyof Pick<PlanTemplate, "durationWeeks" | "sessionsPerWeek">, value: string) {
    const nextValue = Number(value);
    setMessage(null);
    setTemplates((current) =>
      current.map((template, currentIndex) =>
        currentIndex === index ? { ...template, [field]: Number.isFinite(nextValue) ? nextValue : template[field] } : template
      )
    );
  }

  function updateTrainingField(templateIndex: number, trainingIndex: number, field: keyof TrainingItem, value: string) {
    setMessage(null);
    setTemplates((current) =>
      current.map((template, currentIndex) => {
        if (currentIndex !== templateIndex) return template;
        return {
          ...template,
          trainings: template.trainings.map((training, currentTrainingIndex) => {
            if (currentTrainingIndex !== trainingIndex) return training;
            if (field === "id") return { ...training, id: value as TrainingType };
            if (field === "priority") return { ...training, priority: value as TrainingItem["priority"] };
            return { ...training, frequency: value };
          })
        };
      })
    );
  }

  function addTemplate() {
    setMessage(null);
    setTemplates((current) => {
      const next = [...current, createBlankTemplate()];
      setActiveTemplateIndex(next.length - 1);
      return next;
    });
  }

  function removeTemplate(index: number) {
    setMessage(null);
    setTemplates((current) => {
      const next = current.filter((_, currentIndex) => currentIndex !== index);
      setActiveTemplateIndex((currentActive) => {
        if (next.length === 0) return 0;
        if (currentActive < index) return currentActive;
        if (currentActive > index) return currentActive - 1;
        return Math.max(0, Math.min(index, next.length - 1));
      });
      return next;
    });
  }

  function addTraining(templateIndex: number) {
    setMessage(null);
    setTemplates((current) =>
      current.map((template, currentIndex) =>
        currentIndex === templateIndex ? { ...template, trainings: [...template.trainings, createBlankTraining()] } : template
      )
    );
  }

  function removeTraining(templateIndex: number, trainingIndex: number) {
    setMessage(null);
    setTemplates((current) =>
      current.map((template, currentIndex) =>
        currentIndex === templateIndex
          ? {
              ...template,
              trainings: template.trainings.filter((_, currentTrainingIndex) => currentTrainingIndex !== trainingIndex)
            }
          : template
      )
    );
  }

  async function save() {
    setSaving(true);
    setMessage(null);

    const result = await saveAdminPlanTemplates(templates);
    setSaving(false);

    if (!result) {
      setMessage("保存失败：请确认你拥有管理员权限，或稍后重试。");
      return;
    }

    setTemplates(result);
    const history = await loadAdminPlanTemplateHistory();
    setVersions(history ?? []);
    setMessage("计划模板已保存。");
  }

  async function saveActiveTemplate() {
    await save();
  }

  if (templates.length === 0) {
    return <div className="rounded-app border border-border bg-white p-6 text-sm text-muted">正在加载计划模板...</div>;
  }

  return (
    <div className="space-y-8">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="模板数" value={stats.templates} tone="blue" />
        <StatCard label="启用模板" value={stats.activeTemplates} tone="green" />
        <StatCard label="训练项总数" value={stats.trainings} tone="violet" />
        <StatCard label="总周期周数" value={stats.durationWeeks} tone="amber" />
      </section>

      <section className="rounded-app border border-border bg-white">
        <div className="border-b border-border px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-semibold">计划模板目录</h3>
              <p className="mt-1 text-sm text-muted">这里定义用户注册时可选的训练计划，以及每个计划包含的训练项目和周期。</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button type="button" className="h-10 w-full rounded-app border border-border px-4 text-sm font-semibold sm:w-auto" onClick={addTemplate}>
                新建模板
              </button>
              <button
                type="button"
                className="h-10 w-full rounded-app bg-primary px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto"
                disabled={saving}
                onClick={() => void save()}
              >
                {saving ? "保存中..." : "保存全部模板"}
              </button>
            </div>
          </div>
          {message ? <p className="mt-4 text-sm text-muted">{message}</p> : null}
        </div>

        <div className="border-b border-border px-3 py-3 sm:px-4">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {templates.map((template, index) => {
              const active = index === activeTemplateIndex;
              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => setActiveTemplateIndex(index)}
                  className={[
                    "shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition",
                    active ? "bg-primary text-white shadow-[0_10px_18px_rgba(37,99,235,0.20)]" : "border border-border bg-slate-50 text-slate-600 hover:bg-slate-100"
                  ].join(" ")}
                >
                  {template.name || "未命名模板"}
                </button>
              );
            })}
          </div>
        </div>

        {activeTemplate ? (
          <div className="p-4 sm:p-6">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">{activeTemplate.name || "未命名模板"}</h3>
                <p className="mt-1 text-sm text-muted">编辑当前标签页的训练计划内容。</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 rounded-app border border-border px-3 py-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={activeTemplate.status === "active"}
                    onChange={(event) =>
                      setTemplates((current) =>
                        current.map((item, currentIndex) =>
                          currentIndex === activeTemplateIndex
                            ? { ...item, status: event.target.checked ? "active" : "archived" }
                            : item
                        )
                      )
                    }
                  />
                  启用
                </label>
                <button
                  type="button"
                  className="h-9 rounded-app border border-border px-3 text-sm font-semibold text-danger"
                  onClick={() => removeTemplate(activeTemplateIndex)}
                >
                  删除当前模板
                </button>
                <button
                  type="button"
                  className="h-9 rounded-app bg-primary px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
                  disabled={saving}
                  onClick={() => void saveActiveTemplate()}
                >
                  {saving ? "保存中..." : "保存当前模板"}
                </button>
              </div>
            </div>

            <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
              <div className="space-y-5">
                <label className="block">
                  <span className="text-sm font-semibold">模板 ID</span>
                  <input
                    className="mt-2 h-11 w-full rounded-app border border-border px-3"
                    value={activeTemplate.id}
                    onChange={(event) => updateTemplateField(activeTemplateIndex, "id", event.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold">模板名称</span>
                  <input
                    className="mt-2 h-11 w-full rounded-app border border-border px-3"
                    value={activeTemplate.name}
                    onChange={(event) => updateTemplateField(activeTemplateIndex, "name", event.target.value)}
                  />
                </label>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-semibold">训练周期（周）</span>
                    <input
                      className="mt-2 h-11 w-full rounded-app border border-border px-3"
                      type="number"
                      min={1}
                      value={activeTemplate.durationWeeks}
                      onChange={(event) => updateTemplateNumberField(activeTemplateIndex, "durationWeeks", event.target.value)}
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-semibold">每周训练次数</span>
                    <input
                      className="mt-2 h-11 w-full rounded-app border border-border px-3"
                      type="number"
                      min={1}
                      value={activeTemplate.sessionsPerWeek}
                      onChange={(event) => updateTemplateNumberField(activeTemplateIndex, "sessionsPerWeek", event.target.value)}
                    />
                  </label>
                </div>
                <label className="block">
                  <span className="text-sm font-semibold">单次训练时长文案</span>
                  <input
                    className="mt-2 h-11 w-full rounded-app border border-border px-3"
                    value={activeTemplate.sessionDurationText}
                    onChange={(event) => updateTemplateField(activeTemplateIndex, "sessionDurationText", event.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold">模板描述</span>
                  <textarea
                    className="mt-2 min-h-28 w-full rounded-app border border-border px-3 py-2"
                    value={activeTemplate.description}
                    onChange={(event) => updateTemplateField(activeTemplateIndex, "description", event.target.value)}
                  />
                </label>
                <div className="rounded-app border border-border bg-slate-50 p-4 text-sm text-muted">
                  当前状态：{activeTemplate.status === "active" ? "启用" : "停用"}。停用后该模板不会出现在用户注册选择中。
                </div>
              </div>

              <div className="space-y-5">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-sm font-semibold">包含的训练项目</h4>
                  <button
                    type="button"
                    className="h-9 w-full rounded-app border border-border px-3 text-sm font-semibold sm:w-auto"
                    onClick={() => addTraining(activeTemplateIndex)}
                  >
                    添加项目
                  </button>
                </div>

                <div className="space-y-4">
                  {activeTemplate.trainings.map((training, trainingIndex) => (
                    <div key={`${activeTemplate.id}-${trainingIndex}`} className="rounded-app border border-border bg-slate-50 p-4">
                      <div className="grid gap-3 md:grid-cols-[1.2fr_0.8fr_1fr_auto] md:items-end">
                        <label className="block">
                          <span className="text-xs font-semibold text-muted">训练项目</span>
                          <select
                            className="mt-2 h-10 w-full rounded-app border border-border px-3"
                            value={training.id}
                            onChange={(event) => updateTrainingField(activeTemplateIndex, trainingIndex, "id", event.target.value)}
                          >
                            {trainingTypeOptions.map(([id, label]) => (
                              <option key={id} value={id}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block">
                          <span className="text-xs font-semibold text-muted">优先级</span>
                          <select
                            className="mt-2 h-10 w-full rounded-app border border-border px-3"
                            value={training.priority}
                            onChange={(event) => updateTrainingField(activeTemplateIndex, trainingIndex, "priority", event.target.value)}
                          >
                            <option value="high">高</option>
                            <option value="medium">中</option>
                            <option value="low">低</option>
                          </select>
                        </label>
                        <label className="block">
                          <span className="text-xs font-semibold text-muted">频率文案</span>
                          <input
                            className="mt-2 h-10 w-full rounded-app border border-border px-3"
                            value={training.frequency}
                            onChange={(event) => updateTrainingField(activeTemplateIndex, trainingIndex, "frequency", event.target.value)}
                          />
                        </label>
                        <button
                          type="button"
                          className="h-10 rounded-app border border-border px-3 text-sm font-semibold text-danger md:w-auto"
                          onClick={() => removeTraining(activeTemplateIndex, trainingIndex)}
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {versions.length > 0 ? (
        <section className="rounded-app border border-border bg-white p-5 sm:p-6">
          <h3 className="text-lg font-semibold">最近版本</h3>
          <p className="mt-1 text-sm text-muted">最新保存的模板版本会按时间顺序保留，方便回看修改历史。</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {versions.slice(0, 3).map((version) => (
              <article key={version.id} className="rounded-app border border-border bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">v{version.version}</p>
                <p className="mt-1 text-sm text-muted">{new Date(version.changedAt).toLocaleString("zh-CN")}</p>
                <p className="mt-2 text-sm text-slate-600">{version.notes ?? "无备注"}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
