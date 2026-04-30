"use client";

import { createTrainingRecord, trainingLabels } from "@prosbymax/core";
import type { AppUser, TrainingRecord } from "@prosbymax/types";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightIcon, CheckIcon, CloseIcon, LockIcon } from "@/components/app-icons";
import { loadCurrentUserFromApi } from "@/lib/auth";
import { loadDashboardSnapshot } from "@/lib/dashboard";
import { saveTrainingRecord } from "@/lib/training-records";

type TunnelDir = "up" | "down" | "left" | "right";

type TunnelTrial = {
  dir: TunnelDir;
  startMs: number;
  durationMs: number;
  answered: boolean;
};

type FeedbackKind = "correct" | "wrong" | "timeout";

type FeedbackState = {
  kind: FeedbackKind;
  label: string;
  x: number;
  y: number;
  expireAt: number;
};

type FinishReason = "time" | "manual";

const TUNNEL_CONFIG = {
  sessionDurationSec: 60,
  symbolTravelMs: 1700,
  spawnGapMs: 560,
  tunnelSpeed: 0.08,
  goodMs: 900,
  midMs: 1500
} as const;

const DIRS: TunnelDir[] = ["up", "down", "left", "right"];
const DIR_LABEL: Record<TunnelDir, string> = {
  up: "上",
  down: "下",
  left: "左",
  right: "右"
};
const DIR_DEBUG_LABEL: Record<TunnelDir, string> = {
  up: "Up",
  down: "Down",
  left: "Left",
  right: "Right"
};
const DIR_RAD: Record<TunnelDir, number> = {
  right: 0,
  down: Math.PI / 2,
  left: Math.PI,
  up: -Math.PI / 2
};

function formatClock(seconds: number) {
  const safe = Math.max(0, Math.ceil(seconds));
  const mm = Math.floor(safe / 60).toString().padStart(2, "0");
  const ss = (safe % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function getCanvasCssSize(canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect();
  return {
    w: rect.width,
    h: rect.height
  };
}

function normalizeAngle(angle: number) {
  let next = angle;
  while (next > Math.PI) next -= Math.PI * 2;
  while (next < -Math.PI) next += Math.PI * 2;
  return next;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function drawLandoltC(ctx: CanvasRenderingContext2D, unit: number, alpha: number) {
  const radius = unit * 0.5;
  const strokeW = unit * 0.22;
  const gapAngle = Math.PI / 3;
  const halfGap = gapAngle / 2;
  ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
  ctx.lineWidth = strokeW;
  ctx.lineCap = "round";
  ctx.shadowColor = "rgba(15,15,15,0.64)";
  ctx.shadowBlur = unit * 0.08;
  ctx.beginPath();
  ctx.arc(0, 0, radius, halfGap, Math.PI * 2 - halfGap);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function getTrialVisual(canvas: HTMLCanvasElement, trial: TunnelTrial, nowMs: number) {
  const { w, h } = getCanvasCssSize(canvas);
  const cx = w / 2;
  const cy = h / 2;
  const p = clamp((nowMs - trial.startMs) / trial.durationMs, 0, 1);
  const unit = 22 + p * 58;
  const stroke = unit * 0.22;
  const outerR = unit * 0.5;
  return {
    x: cx,
    y: cy,
    unit,
    stroke,
    outerR,
    maxInteractiveR: Math.min(w, h) * 0.46,
    progress: p
  };
}

function isCorrectOpening(trial: TunnelTrial, visual: ReturnType<typeof getTrialVisual>, clickX: number, clickY: number) {
  const dx = clickX - visual.x;
  const dy = clickY - visual.y;
  const radius = Math.hypot(dx, dy);
  const clickAngle = Math.atan2(dy, dx);
  const targetAngle = DIR_RAD[trial.dir];
  const delta = Math.abs(normalizeAngle(clickAngle - targetAngle));

  // Requirement: allow a 45° fan area around opening direction.
  const withinDir = delta <= Math.PI / 4;
  // Opening area should be generous from center out to ring edge vicinity.
  // We intentionally avoid a strict inner bound to reduce false negatives.
  const minRadius = 6;
  const maxRadius = Math.min(visual.maxInteractiveR, Math.max(180, visual.outerR + visual.stroke * 3.2));
  const withinRadius = radius >= minRadius && radius <= maxRadius;
  return withinDir && withinRadius;
}

export function TunnelTrainingShell() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef(0);
  const roundStartRef = useRef(0);
  const spawnCooldownRef = useRef(0);
  const currentTrialRef = useRef<TunnelTrial | null>(null);
  const savePromiseRef = useRef<Promise<TrainingRecord> | null>(null);
  const roundSavedRef = useRef(false);
  const runningRef = useRef(false);
  const remainingSecRef = useRef<number>(TUNNEL_CONFIG.sessionDurationSec);
  const feedbackTimerRef = useRef<number | null>(null);
  const totalCountRef = useRef(0);
  const excellentCountRef = useRef(0);
  const mediumCountRef = useRef(0);
  const poorCountRef = useRef(0);
  const scoreRef = useRef(0);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [instructionsOpen, setInstructionsOpen] = useState(true);
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionFinished, setSessionFinished] = useState(false);
  const [remainingSec, setRemainingSec] = useState<number>(TUNNEL_CONFIG.sessionDurationSec);
  const [totalCount, setTotalCount] = useState(0);
  const [excellentCount, setExcellentCount] = useState(0);
  const [mediumCount, setMediumCount] = useState(0);
  const [poorCount, setPoorCount] = useState(0);
  const [score, setScore] = useState(0);
  const [finishReason, setFinishReason] = useState<FinishReason | null>(null);
  const [result, setResult] = useState<TrainingRecord | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [debugDir, setDebugDir] = useState<TunnelDir | null>(null);
  const [startedAt, setStartedAt] = useState(() => new Date().toISOString());

  const summaryText = useMemo(() => {
    return `优 ${excellentCount} / 中 ${mediumCount} / 差 ${poorCount}`;
  }, [excellentCount, mediumCount, poorCount]);

  useEffect(() => {
    let cancelled = false;

    void loadCurrentUserFromApi().then((nextUser) => {
      if (!cancelled) setCurrentUser(nextUser);
    });

    void loadDashboardSnapshot().then((snapshot) => {
      if (!cancelled) setCurrentPlanId(snapshot?.currentPlan?.id ?? null);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const nextW = Math.max(1, Math.floor(rect.width * dpr));
      const nextH = Math.max(1, Math.floor(rect.height * dpr));
      if (canvas.width !== nextW) canvas.width = nextW;
      if (canvas.height !== nextH) canvas.height = nextH;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawScene(performance.now());
    };

    resize();
    const observer = new ResizeObserver(() => resize());
    observer.observe(canvas);
    window.addEventListener("resize", resize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", resize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!sessionActive) return;
    const timer = window.setInterval(() => {
      const now = performance.now();
      const elapsed = now - roundStartRef.current;
      const remainMs = Math.max(0, TUNNEL_CONFIG.sessionDurationSec * 1000 - elapsed);
      const next = Math.ceil(remainMs / 1000);
      remainingSecRef.current = next;
      setRemainingSec((current) => (current === next ? current : next));
      if (remainMs <= 0) {
        finishRound("time");
      }
    }, 200);

    return () => window.clearInterval(timer);
  }, [sessionActive]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
      if (feedbackTimerRef.current !== null) {
        window.clearTimeout(feedbackTimerRef.current);
      }
    };
  }, []);

  function clearFeedbackTimer() {
    if (feedbackTimerRef.current !== null) {
      window.clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = null;
    }
  }

  function startFeedback(nextFeedback: FeedbackState) {
    clearFeedbackTimer();
    setFeedback(nextFeedback);
    feedbackTimerRef.current = window.setTimeout(() => {
      setFeedback(null);
      feedbackTimerRef.current = null;
    }, 900);
  }

  function classifyReactionTime(rtMs: number) {
    if (rtMs <= TUNNEL_CONFIG.goodMs) return "excellent" as const;
    if (rtMs <= TUNNEL_CONFIG.midMs) return "medium" as const;
    return "poor" as const;
  }

  function buildTrainingRecord(nextStartedAt: string, nextFinishedAt: string) {
    const durationSec = Math.max(1, Math.round((new Date(nextFinishedAt).getTime() - new Date(nextStartedAt).getTime()) / 1000));
    return createTrainingRecord({
      userId: currentUser?.id ?? null,
      planId: currentPlanId,
      trainingType: "tunnel",
      startedAt: nextStartedAt,
      endedAt: nextFinishedAt,
      durationSec,
      score: scoreRef.current,
      total: totalCountRef.current,
      accuracy: totalCountRef.current > 0 ? Math.round(((excellentCountRef.current + mediumCountRef.current) / totalCountRef.current) * 100) : 0,
      metrics: {
        excellent: excellentCountRef.current,
        medium: mediumCountRef.current,
        poor: poorCountRef.current,
        sessionDurationSec: TUNNEL_CONFIG.sessionDurationSec,
        symbolTravelMs: TUNNEL_CONFIG.symbolTravelMs,
        spawnGapMs: TUNNEL_CONFIG.spawnGapMs,
        tunnelSpeed: TUNNEL_CONFIG.tunnelSpeed,
        trainingLabel: trainingLabels.tunnel
      }
    });
  }

  function saveSession(nextStartedAt: string, nextFinishedAt: string) {
    if (roundSavedRef.current) return;
    roundSavedRef.current = true;
    const record = buildTrainingRecord(nextStartedAt, nextFinishedAt);
    const promise = saveTrainingRecord(record);
    savePromiseRef.current = promise;
    void promise.finally(() => {
      if (savePromiseRef.current === promise) {
        savePromiseRef.current = null;
      }
    });
    setResult(record);
  }

  function finishRound(reason: FinishReason) {
    if (!runningRef.current) return;
    runningRef.current = false;
    setSessionActive(false);
    setSessionFinished(true);
    setFinishReason(reason);
    setDebugDir(null);
    currentTrialRef.current = null;
    const finishedAt = new Date().toISOString();
    saveSession(startedAt, finishedAt);
  }

  function spawnTrial(nowMs: number) {
    const dir = DIRS[(Math.random() * DIRS.length) | 0];
    const canvas = canvasRef.current;
    if (!canvas) return;
    setDebugDir(dir);
    currentTrialRef.current = {
      dir,
      startMs: nowMs,
      durationMs: TUNNEL_CONFIG.symbolTravelMs,
      answered: false
    };
  }

  function drawTunnel(ctx: CanvasRenderingContext2D, elapsedMs: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { w, h } = getCanvasCssSize(canvas);
    const cx = w / 2;
    const cy = h / 2;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#0f1218";
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(120,130,145,0.12)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 16; i += 1) {
      const t = (Math.PI * 2 * i) / 16;
      const x = cx + Math.cos(t) * w * 0.7;
      const y = cy + Math.sin(t) * h * 0.65;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(cx, cy);
      ctx.stroke();
    }

    const shift = (elapsedMs * TUNNEL_CONFIG.tunnelSpeed) % 46;
    for (let i = 0; i < 12; i += 1) {
      const r = 20 + i * 46 + shift;
      const alpha = Math.max(0.03, 0.24 - i * 0.017);
      ctx.strokeStyle = `rgba(170,180,195,${alpha.toFixed(3)})`;
      ctx.lineWidth = i % 3 === 0 ? 2 : 1;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r * 1.05, r * 0.8, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawTrial(ctx: CanvasRenderingContext2D, nowMs: number) {
    const trial = currentTrialRef.current;
    const canvas = canvasRef.current;
    if (!trial || !canvas) return;

    const visual = getTrialVisual(canvas, trial, nowMs);
    const alpha = 0.45 + visual.progress * 0.55;

    ctx.save();
    ctx.translate(visual.x, visual.y);
    ctx.rotate(DIR_RAD[trial.dir]);
    drawLandoltC(ctx, visual.unit, alpha);
    ctx.restore();

    if (feedback && feedback.kind !== "wrong") {
      const feedbackProgress = clamp(1 - (feedback.expireAt - nowMs) / 900, 0, 1);
      ctx.save();
      ctx.translate(feedback.x, feedback.y);
      ctx.globalAlpha = 0.95 * (1 - feedbackProgress * 0.18);
      ctx.strokeStyle = feedback.kind === "timeout" ? "rgba(255,56,56,0.95)" : feedback.kind === "correct" ? "rgba(52,199,89,0.95)" : "rgba(255,204,0,0.95)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(24, visual.unit * 0.46 + feedbackProgress * 12), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawScene(nowMs: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const elapsed = runningRef.current ? nowMs - roundStartRef.current : 0;

    drawTunnel(ctx, elapsed);
    drawTrial(ctx, nowMs);

    if (feedback) {
      const alpha = clamp((feedback.expireAt - nowMs) / 900, 0, 1);
      ctx.save();
      ctx.translate(feedback.x, feedback.y);
      if (feedback.kind === "wrong") {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "rgba(255,70,70,0.95)";
        ctx.shadowColor = "rgba(255,70,70,0.45)";
        ctx.shadowBlur = 12;
        ctx.font = "700 40px 'Segoe UI', 'PingFang SC', sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("✕", 0, 0);
      } else {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = feedback.kind === "timeout" ? "rgba(255,90,90,0.94)" : "rgba(52,199,89,0.94)";
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(0, 0, 28, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#ffffff";
        ctx.font = "700 18px 'Segoe UI', 'PingFang SC', sans-serif";
        ctx.fillText(feedback.label, 0, 1);
      }
      ctx.restore();
    }
  }

  function loop(nowMs: number) {
    if (!runningRef.current) {
      drawScene(nowMs);
      return;
    }

    if (!lastTsRef.current) lastTsRef.current = nowMs;
    const dt = nowMs - lastTsRef.current;
    lastTsRef.current = nowMs;

    const elapsed = nowMs - roundStartRef.current;
    const remainMs = Math.max(0, TUNNEL_CONFIG.sessionDurationSec * 1000 - elapsed);
    const nextRemaining = Math.ceil(remainMs / 1000);
    if (nextRemaining !== remainingSecRef.current) {
      remainingSecRef.current = nextRemaining;
      setRemainingSec(nextRemaining);
    }

    if (!currentTrialRef.current) {
      spawnCooldownRef.current -= dt;
      if (spawnCooldownRef.current <= 0) {
        spawnTrial(nowMs);
        spawnCooldownRef.current = TUNNEL_CONFIG.spawnGapMs;
      }
    } else {
      const trial = currentTrialRef.current;
      const progress = (nowMs - trial.startMs) / trial.durationMs;
      if (progress >= 1 && !trial.answered) {
        trial.answered = true;
        setPoorCount((current) => current + 1);
        setTotalCount((current) => current + 1);
        startFeedback({
          kind: "timeout",
          label: "差",
          x: canvasRef.current ? getCanvasCssSize(canvasRef.current).w / 2 : 0,
          y: canvasRef.current ? getCanvasCssSize(canvasRef.current).h / 2 : 0,
          expireAt: nowMs + 900
        });
        setDebugDir(null);
        currentTrialRef.current = null;
      }
    }

    drawScene(nowMs);

    if (remainMs <= 0) {
      finishRound("time");
      return;
    }

    rafRef.current = window.requestAnimationFrame(loop);
  }

  function classifyAndFinishClick(clickX: number, clickY: number, nowMs: number) {
    const trial = currentTrialRef.current;
    const canvas = canvasRef.current;
    if (!runningRef.current || !trial || trial.answered || !canvas) return;

    const visual = getTrialVisual(canvas, trial, nowMs);
    const correct = isCorrectOpening(trial, visual, clickX, clickY);
    const rtMs = Math.max(1, Math.round(nowMs - trial.startMs));

    totalCountRef.current += 1;
    setTotalCount(totalCountRef.current);
    if (correct) {
      const bucket = classifyReactionTime(rtMs);
      if (bucket === "excellent") {
        excellentCountRef.current += 1;
        scoreRef.current += 3;
        setExcellentCount(excellentCountRef.current);
        setScore(scoreRef.current);
      } else if (bucket === "medium") {
        mediumCountRef.current += 1;
        scoreRef.current += 2;
        setMediumCount(mediumCountRef.current);
        setScore(scoreRef.current);
      } else {
        poorCountRef.current += 1;
        setPoorCount(poorCountRef.current);
      }
      startFeedback({
        kind: "correct",
        label: bucket === "excellent" ? "优" : bucket === "medium" ? "中" : "差",
        x: clickX,
        y: clickY,
        expireAt: nowMs + 900
      });
    } else {
      poorCountRef.current += 1;
      setPoorCount(poorCountRef.current);
      startFeedback({
        kind: "wrong",
        label: "✕",
        x: clickX,
        y: clickY,
        expireAt: nowMs + 900
      });
    }

    trial.answered = true;
    setDebugDir(null);
    currentTrialRef.current = null;
    spawnCooldownRef.current = TUNNEL_CONFIG.spawnGapMs;
    drawScene(nowMs);
  }

  function handleCanvasClick(event: MouseEvent<HTMLCanvasElement>) {
    if (!runningRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const native = event.nativeEvent;
    const clickX = native.offsetX;
    const clickY = native.offsetY;
    classifyAndFinishClick(clickX, clickY, performance.now());
  }

  async function startRound() {
    clearFeedbackTimer();
    roundSavedRef.current = false;
    setInstructionsOpen(false);
    setSessionActive(true);
    setSessionFinished(false);
    setFinishReason(null);
    setResult(null);
    totalCountRef.current = 0;
    excellentCountRef.current = 0;
    mediumCountRef.current = 0;
    poorCountRef.current = 0;
    scoreRef.current = 0;
    setTotalCount(0);
    setExcellentCount(0);
    setMediumCount(0);
    setPoorCount(0);
    setScore(0);
    setDebugDir(null);
    setFeedback(null);
    setRemainingSec(TUNNEL_CONFIG.sessionDurationSec);
    remainingSecRef.current = TUNNEL_CONFIG.sessionDurationSec;
    roundStartRef.current = performance.now();
    lastTsRef.current = 0;
    spawnCooldownRef.current = 0;
    currentTrialRef.current = null;
    runningRef.current = true;
    setStartedAt(new Date().toISOString());
    rafRef.current = window.requestAnimationFrame(loop);
  }

  async function handleReturnHome() {
    await savePromiseRef.current?.catch(() => undefined);
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined);
    }
    router.push("/");
  }

  if (!currentUser) {
    return (
      <section className="flex min-h-[100dvh] items-center justify-center bg-slate-50 px-4 py-8">
        <div className="w-full max-w-2xl rounded-[24px] border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl shadow-slate-200/60 sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
            <LockIcon className="h-4 w-4" aria-hidden="true" />
            需要登录
          </div>
          <h2 className="mt-5 text-[1.9rem] font-semibold tracking-tight text-slate-900 sm:text-[2.35rem]">请先登录后开始今日训练</h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-[15px]">
            这个训练页只对已登录账号开放。登录后系统会读取你的计划和训练配置，再允许开始隧道远近切换识别训练。
          </p>
          <div className="mt-8">
            <Link className="app-btn-primary h-11 w-full px-5 sm:w-auto" href="/auth">
              <ArrowRightIcon className="mr-2 h-4 w-4" aria-hidden="true" />
              去登录
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative min-h-[100dvh] overflow-hidden bg-slate-50 text-slate-900">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[1200px] flex-col gap-4 px-4 py-4 sm:gap-6 sm:px-6 sm:py-6">
        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_42px_rgba(15,23,42,0.08)] sm:p-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
              隧道远近切换识别
            </div>
            <h1 className="mt-4 text-[1.7rem] font-semibold tracking-tight sm:text-[2.15rem]">Landolt C 隧道训练</h1>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              观察从隧道远端向近处移动的 C 字符号，点击其敞口方向对应的空白区域。正确点击会根据反应时间给出优 / 中 / 差反馈；错误点击会显示明显的叉号反馈。
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <Stat label="剩余时间" value={formatClock(remainingSec)} />
              <Stat label="总得分" value={String(score)} />
              <Stat label="总题数" value={String(totalCount)} />
              <Stat label="反馈统计" value={summaryText} />
            </div>

            <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-700">反馈规则</p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-600">
                <div className="rounded-2xl bg-white px-3 py-2 text-center shadow-sm">
                  优
                  <div className="mt-1 font-semibold text-slate-900">≤ {TUNNEL_CONFIG.goodMs / 1000}s</div>
                </div>
                <div className="rounded-2xl bg-white px-3 py-2 text-center shadow-sm">
                  中
                  <div className="mt-1 font-semibold text-slate-900">≤ {TUNNEL_CONFIG.midMs / 1000}s</div>
                </div>
                <div className="rounded-2xl bg-white px-3 py-2 text-center shadow-sm">
                  差
                  <div className="mt-1 font-semibold text-slate-900">其他 / 错误</div>
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={() => void startRound()} className="app-btn-primary h-12 flex-1 px-6">
                开始训练
              </button>
              <Link href="/" className="app-btn-secondary h-12 flex-1 px-6">
                返回今日训练
              </Link>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-white p-3 shadow-[0_18px_42px_rgba(15,23,42,0.08)] sm:p-4">
            <div className="flex items-center justify-between rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-sm text-slate-600">
                训练状态：<span className="font-semibold text-slate-900">{sessionFinished ? "已完成" : sessionActive ? "进行中" : "未开始"}</span>
              </div>
              <div className="text-sm text-slate-600">
                当前统计：<span className="font-semibold text-slate-900">{summaryText}</span>
              </div>
            </div>

            <div className="relative mt-3 aspect-[540/390] w-full overflow-hidden rounded-[22px] border border-slate-200 bg-slate-950">
              <canvas
                ref={canvasRef}
                onClick={handleCanvasClick}
                className="absolute inset-0 h-full w-full cursor-crosshair"
                aria-label="隧道训练画布"
              />

              {sessionActive && debugDir ? (
                <div className="pointer-events-none absolute left-4 top-4 z-30 rounded-full border border-cyan-300/20 bg-slate-950/72 px-3 py-1.5 text-xs font-semibold tracking-wide text-cyan-100 shadow-lg shadow-black/20">
                  程序答案：{DIR_DEBUG_LABEL[debugDir]}
                </div>
              ) : null}

              {instructionsOpen ? (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/72 px-4 py-6 backdrop-blur-sm">
                  <div className="w-full max-w-2xl rounded-[28px] border border-white/10 bg-slate-950/90 px-5 py-6 text-white shadow-2xl shadow-black/45 sm:px-8 sm:py-8">
                    <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-sm font-semibold text-cyan-200">
                      规则说明
                    </div>
                    <h2 className="mt-5 text-[1.9rem] font-semibold tracking-tight sm:text-[2.35rem]">开始前请先确认规则</h2>
                    <p className="mt-4 text-sm leading-7 text-white/78 sm:text-[15px]">
                      请观察隧道中由远及近出现的 C 字形视标，直接点击敞口方向对应的空白区域。点击正确后会根据反应时间显示“优 / 中 / 差”，点击错误会显示叉号反馈。完成后可返回今日训练页继续下一项。
                    </p>
                    <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                      <button type="button" onClick={() => void startRound()} className="app-btn-primary h-12 flex-1 px-6">
                        开始训练
                      </button>
                      <Link href="/" className="app-btn-secondary h-12 flex-1 px-6">
                        返回今日训练
                      </Link>
                    </div>
                  </div>
                </div>
              ) : null}

              {feedback ? (
                <div
                  className="pointer-events-none absolute z-30 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
                  style={{ left: feedback.x, top: feedback.y }}
                >
                  {feedback.kind === "wrong" ? (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/90 text-[2.1rem] font-black text-white shadow-[0_18px_40px_rgba(255,56,56,0.4)]">
                      <CloseIcon className="h-8 w-8" aria-hidden="true" />
                    </div>
                  ) : (
                    <div
                      className={[
                        "flex h-16 w-16 items-center justify-center rounded-full border-2 text-sm font-semibold shadow-[0_18px_40px_rgba(15,23,42,0.25)]",
                        feedback.kind === "timeout" ? "border-rose-300 bg-rose-500/90 text-white" : "border-emerald-200 bg-emerald-500/90 text-white"
                      ].join(" ")}
                    >
                      {feedback.label}
                    </div>
                  )}
                </div>
              ) : null}

              {sessionFinished ? (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/72 px-4 py-6 backdrop-blur-sm">
                  <div className="w-full max-w-2xl rounded-[28px] border border-white/10 bg-slate-950/92 px-5 py-6 text-white shadow-2xl shadow-black/45 sm:px-8 sm:py-8">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">训练结束</p>
                    <h3 className="mt-3 text-2xl font-semibold sm:text-[2.35rem]">本次训练已完成</h3>
                    <p className="mt-3 text-sm leading-7 text-white/72 sm:text-[15px]">
                      结果已回传到训练记录。你可以返回今日训练页继续下一项，也可以稍后再回来看详细数据。
                    </p>

                    <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <Stat label="总分" value={String(score)} />
                      <Stat label="总题数" value={String(totalCount)} />
                      <Stat label="优" value={String(excellentCount)} />
                      <Stat label="中/差" value={`${mediumCount}/${poorCount}`} />
                    </div>

                    <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                      <button type="button" onClick={() => void handleReturnHome()} className="app-btn-primary h-12 flex-1 px-6">
                        返回今日训练
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (document.fullscreenElement) {
                            void document.exitFullscreen().catch(() => undefined);
                          }
                          setInstructionsOpen(false);
                          setSessionFinished(false);
                          setSessionActive(true);
                          setTotalCount(0);
                          setExcellentCount(0);
                          setMediumCount(0);
                          setPoorCount(0);
                          setScore(0);
                          setRemainingSec(TUNNEL_CONFIG.sessionDurationSec);
                          remainingSecRef.current = TUNNEL_CONFIG.sessionDurationSec;
                          roundSavedRef.current = false;
                          roundStartRef.current = performance.now();
                          lastTsRef.current = 0;
                          spawnCooldownRef.current = 0;
                          currentTrialRef.current = null;
                          runningRef.current = true;
                          setStartedAt(new Date().toISOString());
                          rafRef.current = window.requestAnimationFrame(loop);
                        }}
                        className="h-12 rounded-app border border-white/10 bg-white/6 px-5 text-sm font-semibold text-white"
                      >
                        重新开始
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
