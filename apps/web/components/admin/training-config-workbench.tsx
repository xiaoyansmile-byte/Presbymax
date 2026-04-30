"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  createGaborImageData,
  getGaborTriplesFromConfig,
  normalizeGaborMatchConfig
} from "@prosbymax/core";
import type { GaborMatchConfig } from "@prosbymax/types";
import {
  loadGaborMatchConfigFromApi,
  saveGaborMatchConfigToApi
} from "@/lib/admin-config";
import { ChevronDownIcon, ChevronRightIcon } from "@/components/app-icons";

type ConfigSectionId = "flow" | "stimulus-space" | "rendering";
type ConfigModuleId = "gabor-match" | "flicker-gabor" | "brightness" | "reading" | "glare" | "tunnel";

const sections: Array<{
  id: ConfigSectionId;
  label: string;
  description: string;
}> = [
  { id: "flow", label: "训练流程", description: "倒计时、题量、得分、升级策略" },
  { id: "stimulus-space", label: "刺激空间", description: "方向、空间频率、相位集合" },
  { id: "rendering", label: "显示参数", description: "对比度、亮度、包络形态" }
];

const modules: Array<{
  id: ConfigModuleId;
  label: string;
  status: "active" | "planned";
  sections: ConfigSectionId[];
}> = [
  { id: "gabor-match", label: "Gabor 配对", status: "active", sections: ["flow", "stimulus-space", "rendering"] },
  { id: "flicker-gabor", label: "闪烁 Gabor", status: "planned", sections: [] },
  { id: "brightness", label: "对比辨别", status: "planned", sections: [] },
  { id: "reading", label: "阅读清晰度", status: "planned", sections: [] },
  { id: "glare", label: "眩光/散射", status: "planned", sections: [] },
  { id: "tunnel", label: "隧道识别", status: "planned", sections: [] }
];

const numberFields: Array<{
  key: keyof Pick<
    GaborMatchConfig,
    | "sessionDurationSec"
    | "maxTrials"
    | "initialGridSize"
    | "maxGridSize"
    | "levelUpEveryCorrect"
    | "scorePerCorrectBase"
  >;
  label: string;
  help: string;
}> = [
  { key: "sessionDurationSec", label: "倒计时时长（秒）", help: "单次训练 session 的最长时间。" },
  { key: "maxTrials", label: "连续题目上限", help: "达到题数后自动结束 session。" },
  { key: "initialGridSize", label: "初始网格 K", help: "训练开始时的 K×K 网格。" },
  { key: "maxGridSize", label: "最大网格 K", help: "动态升级时允许达到的最大网格。" },
  { key: "levelUpEveryCorrect", label: "每几道正确升级", help: "累计正确次数达到该值后提升网格。" },
  { key: "scorePerCorrectBase", label: "基础得分", help: "每道正确题的基础分值。" }
];

const stimulusNumberFields: Array<{
  key: keyof Pick<GaborMatchConfig, "contrast" | "baselineLuminance" | "sigmaRatio" | "gamma">;
  label: string;
  help: string;
  step: number;
}> = [
  { key: "contrast", label: "对比度", help: "Gabor 明暗振幅，范围 0.05-1。", step: 0.05 },
  { key: "baselineLuminance", label: "基线亮度", help: "中性灰亮度，范围 0.05-0.95。", step: 0.05 },
  { key: "sigmaRatio", label: "Sigma 比例", help: "高斯包络相对画布尺寸的比例。", step: 0.01 },
  { key: "gamma", label: "Gamma", help: "控制 Gabor 包络纵横比。", step: 0.1 }
];

const listFields: Array<{
  key: keyof Pick<GaborMatchConfig, "orientationDegLevels" | "spatialFrequencyLevels" | "phaseLevels">;
  label: string;
  help: string;
}> = [
  { key: "orientationDegLevels", label: "方向角度集合（度）", help: "例如：0,30,60,90,120,150" },
  { key: "spatialFrequencyLevels", label: "空间频率集合", help: "例如：2,2.5,3,4,5,6" },
  { key: "phaseLevels", label: "相位集合（弧度）", help: "例如：0,1.5708,3.1416,4.7124" }
];

function parseNumberList(value: string) {
  return value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item));
}

function formatNumberList(value: number[]) {
  return value.join(",");
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="border-b border-border px-6 py-5">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted">{description}</p>
    </div>
  );
}

function ConfigSummary({ config }: { config: GaborMatchConfig }) {
  const items = [
    { label: "时长", value: `${config.sessionDurationSec}s` },
    { label: "题量", value: `${config.maxTrials}` },
    { label: "网格", value: `${config.initialGridSize}-${config.maxGridSize}` },
    { label: "升级", value: `${config.levelUpEveryCorrect} 题` },
    { label: "方向", value: config.orientationDegLevels.length },
    { label: "频率", value: config.spatialFrequencyLevels.length },
    { label: "相位", value: config.phaseLevels.length },
    { label: "对比度", value: config.contrast }
  ];

  return (
    <div className="rounded-app border border-border bg-white p-5">
      <h3 className="text-sm font-semibold">当前配置摘要</h3>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="rounded-app border border-border bg-slate-50 p-3">
            <p className="text-xs text-muted">{item.label}</p>
            <p className="mt-1 text-lg font-semibold">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function GaborStimulusPreview({ config }: { config: GaborMatchConfig }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewTriple = useMemo(() => getGaborTriplesFromConfig(config)[0], [config]);
  const previewSize = 220;

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context || !previewTriple) return;

    const image = createGaborImageData({
      triple: previewTriple,
      size: previewSize,
      contrast: config.contrast,
      baselineLuminance: config.baselineLuminance,
      sigma: previewSize * config.sigmaRatio,
      gamma: config.gamma
    });

    canvas.width = image.width;
    canvas.height = image.height;
    context.putImageData(new ImageData(image.data, image.width, image.height), 0, 0);
  }, [config.baselineLuminance, config.contrast, config.gamma, config.sigmaRatio, previewTriple]);

  if (!previewTriple) {
    return (
      <div className="rounded-app border border-border bg-white p-5">
        <h3 className="text-sm font-semibold">Gabor 刺激预览</h3>
        <p className="mt-3 text-sm text-muted">当前刺激空间为空，请先配置方向、空间频率和相位集合。</p>
      </div>
    );
  }

  return (
    <div className="rounded-app border border-border bg-white p-5">
              <div className="flex flex-col gap-5 md:flex-row md:items-center">
        <div>
          <h3 className="text-sm font-semibold">Gabor 刺激预览</h3>
          <p className="mt-1 max-w-xl text-sm leading-6 text-muted">
            根据当前配置实时绘制。保存不是预览的前置条件，修改参数后这里会直接更新。
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted">
            <span>方向：{Math.round((previewTriple.theta * 180) / Math.PI)}°</span>
            <span>空间频率：{previewTriple.cycles}</span>
            <span>相位：{previewTriple.phase.toFixed(3)}</span>
            <span>对比度：{config.contrast}</span>
            <span>亮度：{config.baselineLuminance}</span>
            <span>Sigma：{config.sigmaRatio}</span>
          </div>
        </div>
        <div className="flex aspect-square w-full max-w-[240px] shrink-0 items-center justify-center rounded-app border border-border bg-slate-100 p-3">
          <canvas ref={canvasRef} className="h-full w-full rounded-[6px]" aria-label="Gabor 刺激预览" />
        </div>
      </div>
    </div>
  );
}

export function TrainingConfigWorkbench() {
  const [config, setConfig] = useState<GaborMatchConfig | null>(null);
  const [activeModule, setActiveModule] = useState<ConfigModuleId>("gabor-match");
  const [activeSection, setActiveSection] = useState<ConfigSectionId>("flow");
  const [expandedModule, setExpandedModule] = useState<ConfigModuleId | null>("gabor-match");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [numberDrafts, setNumberDrafts] = useState<Record<string, string>>({});
  const activeModuleConfig = modules.find((module) => module.id === activeModule) || modules[0];

  useEffect(() => {
    let cancelled = false;

    void loadGaborMatchConfigFromApi().then((nextConfig) => {
      if (!cancelled) setConfig(nextConfig);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!config) return;

    setNumberDrafts((current) => {
      const nextDrafts = { ...current };

      for (const field of numberFields) {
        if (!(field.key in nextDrafts) || nextDrafts[field.key] === "") {
          nextDrafts[field.key] = String(config[field.key]);
        }
      }

      for (const field of stimulusNumberFields) {
        if (!(field.key in nextDrafts) || nextDrafts[field.key] === "") {
          nextDrafts[field.key] = String(config[field.key]);
        }
      }

      return nextDrafts;
    });
  }, [config]);

  if (!config) {
    return <div className="rounded-app border border-border bg-white p-6 text-sm text-muted">正在加载配置...</div>;
  }

  function updateNumber(key: (typeof numberFields)[number]["key"], value: string) {
    setSaved(false);
    setNumberDrafts((current) => ({ ...current, [key]: value }));
    if (value === "") return;
    setConfig((current) => (current ? { ...current, [key]: Number(value) } : current));
  }

  function updateStimulusNumber(key: (typeof stimulusNumberFields)[number]["key"], value: string) {
    setSaved(false);
    setNumberDrafts((current) => ({ ...current, [key]: value }));
    if (value === "") return;
    setConfig((current) => (current ? { ...current, [key]: Number(value) } : current));
  }

  function updateNumberList(key: (typeof listFields)[number]["key"], value: string) {
    setSaved(false);
    setConfig((current) => (current ? { ...current, [key]: parseNumberList(value) } : current));
  }

  async function save() {
    const normalized = normalizeGaborMatchConfig(config);
    setSaving(true);
    setSaveError(null);

    const result = await saveGaborMatchConfigToApi(normalized);
    setSaving(false);

    if (!result) {
      setSaved(false);
      setSaveError("保存失败：当前身份可能没有管理员权限，或服务暂时不可用。");
      return;
    }

    setConfig(normalized);
    setNumberDrafts((current) => {
      const nextDrafts = { ...current };
      for (const field of numberFields) nextDrafts[field.key] = String(normalized[field.key]);
      for (const field of stimulusNumberFields) nextDrafts[field.key] = String(normalized[field.key]);
      return nextDrafts;
    });
    setSaved(true);
  }

  return (
    <div className="space-y-8">
      {activeModule === "gabor-match" ? (
        <div className="grid gap-8 xl:grid-cols-[1fr_420px]">
          <ConfigSummary config={config} />
          <GaborStimulusPreview config={config} />
        </div>
      ) : null}

      <section className="grid gap-8 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-5 rounded-app border border-border bg-white p-4">
          <div className="px-3 py-3">
            <p className="text-sm font-semibold">训练模块目录</p>
            <p className="mt-1 text-xs leading-5 text-muted">先选择模块，再配置该模块下的参数分组。</p>
          </div>

          <nav className="space-y-2">
            {modules.map((module) => (
              <div key={module.id} className="space-y-2">
                <button
                  className={[
                    "flex w-full items-center justify-between rounded-app px-3 py-3 text-left transition",
                    activeModule === module.id ? "bg-primary text-white" : "text-foreground hover:bg-slate-50"
                  ].join(" ")}
                  onClick={() => {
                    setActiveModule(module.id);
                    if (module.sections.length > 0) {
                      setExpandedModule((current) => (current === module.id ? null : module.id));
                      if (module.status === "active") setActiveSection(module.sections[0]);
                    } else {
                      setExpandedModule(null);
                    }
                  }}
                >
                  <span className="flex items-center gap-3">
                    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
                      {module.sections.length > 0 ? (
                        expandedModule === module.id ? (
                          <ChevronDownIcon className={["h-4 w-4", activeModule === module.id ? "text-white/90" : "text-muted"].join(" ")} />
                        ) : (
                          <ChevronRightIcon className={["h-4 w-4", activeModule === module.id ? "text-white/90" : "text-muted"].join(" ")} />
                        )
                      ) : (
                        <span className={["h-2.5 w-2.5 rounded-full", module.status === "active" ? "bg-emerald-500" : "bg-slate-300"].join(" ")} />
                      )}
                    </span>
                    <span className="text-sm font-semibold">{module.label}</span>
                  </span>
                  <span className={["text-xs font-medium", activeModule === module.id ? "text-white/80" : "text-muted"].join(" ")}>
                    {module.status === "active" ? "可配置" : "待接入"}
                  </span>
                </button>

                {module.sections.length > 0 && expandedModule === module.id ? (
                  <div className="ml-4 border-l border-slate-200 pl-4">
                    <div className="space-y-2 py-1">
                      {sections
                        .filter((section) => module.sections.includes(section.id))
                        .map((section) => (
                          <button
                            key={section.id}
                            className={[
                              "block w-full rounded-[16px] px-3 py-3 text-left transition",
                              activeSection === section.id ? "bg-slate-100 text-foreground" : "text-foreground hover:bg-slate-50"
                            ].join(" ")}
                            onClick={() => {
                              setActiveModule(module.id);
                              setExpandedModule(module.id);
                              setActiveSection(section.id);
                            }}
                          >
                            <span className="block text-sm font-semibold">{section.label}</span>
                            <span className="mt-1 block text-xs leading-5 text-muted">{section.description}</span>
                          </button>
                        ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </nav>

        </aside>

        <div className="rounded-app border border-border bg-white">
          {activeModuleConfig.status !== "active" ? (
            <div className="p-6">
              <p className="text-sm font-medium text-muted">待接入模块</p>
              <h3 className="mt-2 text-xl font-semibold">{activeModuleConfig.label}</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
                这个训练模块的参数结构还没有迁移。后续会按照同样的目录模式补充流程、刺激和显示配置。
              </p>
            </div>
          ) : null}

          {activeModuleConfig.status === "active" && activeSection === "flow" ? (
            <>
              <SectionHeader title="训练流程" description="控制 session 长度、连续题目、得分和升级策略。" />
              <div className="grid gap-6 p-6 md:grid-cols-2">
                {numberFields.map((field) => (
                  <label key={field.key} className="block">
                    <span className="text-sm font-semibold">{field.label}</span>
                    <input
                      className="mt-2 h-11 w-full rounded-app border border-border px-3"
                      min={1}
                      type="number"
                      value={numberDrafts[field.key] ?? String(config[field.key])}
                      onChange={(event) => updateNumber(field.key, event.target.value)}
                    />
                    <span className="mt-1 block text-xs leading-5 text-muted">{field.help}</span>
                  </label>
                ))}

                <label className="block">
                  <span className="text-sm font-semibold">Gabor 难度</span>
                  <select
                    className="mt-2 h-11 w-full rounded-app border border-border px-3"
                    value={config.difficulty}
                    onChange={(event) => {
                      setSaved(false);
                      setConfig({ ...config, difficulty: event.target.value as GaborMatchConfig["difficulty"] });
                    }}
                  >
                    <option value="easy">简单</option>
                    <option value="medium">中等</option>
                    <option value="hard">困难</option>
                  </select>
                  <span className="mt-1 block text-xs leading-5 text-muted">保留为预设难度标记，具体刺激空间可单独配置。</span>
                </label>
              </div>
            </>
          ) : null}

          {activeModuleConfig.status === "active" && activeSection === "stimulus-space" ? (
            <>
              <SectionHeader title="刺激空间" description="控制题库里可抽样的方向、空间频率和相位组合。" />
              <div className="grid gap-6 p-6">
                {listFields.map((field) => (
                  <label key={field.key} className="block">
                    <span className="text-sm font-semibold">{field.label}</span>
                    <input
                      className="mt-2 h-11 w-full rounded-app border border-border px-3"
                      value={formatNumberList(config[field.key])}
                      onChange={(event) => updateNumberList(field.key, event.target.value)}
                    />
                    <span className="mt-1 block text-xs leading-5 text-muted">{field.help}</span>
                  </label>
                ))}
              </div>
            </>
          ) : null}

          {activeModuleConfig.status === "active" && activeSection === "rendering" ? (
            <>
              <SectionHeader title="显示参数" description="控制 Canvas 绘制时的视觉强度和包络形态。" />
              <div className="grid gap-6 p-6 md:grid-cols-2">
                {stimulusNumberFields.map((field) => (
                  <label key={field.key} className="block">
                    <span className="text-sm font-semibold">{field.label}</span>
                    <input
                      className="mt-2 h-11 w-full rounded-app border border-border px-3"
                      step={field.step}
                      type="number"
                      value={numberDrafts[field.key] ?? String(config[field.key])}
                      onChange={(event) => updateStimulusNumber(field.key, event.target.value)}
                    />
                    <span className="mt-1 block text-xs leading-5 text-muted">{field.help}</span>
                  </label>
                ))}
              </div>
            </>
          ) : null}

          {activeModuleConfig.status === "active" ? (
            <div className="flex flex-col gap-3 border-t border-border px-4 py-5 sm:flex-row sm:items-center sm:px-6">
              <button
                className="h-11 w-full rounded-app bg-primary px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto"
                disabled={saving}
                onClick={() => void save()}
              >
                {saving ? "保存中..." : "保存配置"}
              </button>
              {saved ? <span className="text-sm font-medium text-success">已保存</span> : null}
              {saveError ? <span className="text-sm font-medium text-danger">{saveError}</span> : null}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
