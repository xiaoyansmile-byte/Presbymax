"use client";

import { createTrainingRecord, trainingLabels } from "@prosbymax/core";
import type { AppUser, TrainingRecord } from "@prosbymax/types";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightIcon, LockIcon, SolidPauseIcon, SolidPlayIcon } from "@/components/app-icons";
import { loadCurrentUserFromApi } from "@/lib/auth";
import { loadDashboardSnapshot } from "@/lib/dashboard";
import { saveTrainingRecord } from "@/lib/training-records";

type DemoBridgeEventName = "session-started" | "session-finished" | "session-cancelled" | "pause-state" | "hud-update";

type DemoBridgePayload = {
  source: "optictrain-visual-neuro-navigation-demo";
  event: DemoBridgeEventName;
  startedAt: string | null;
  running: boolean;
  paused: boolean;
  mode: string;
  score: number;
  gaborScore: number;
  driveScore: number;
  collisions: number;
  mistakes: number;
  diamondsCollected: number;
  elapsedSec: number;
  remainingSec: number;
  percent: number;
  currentCpd: number;
  sessionFinished: boolean;
  finishReason: string | null;
  reason?: string;
  endedAt?: string;
};

type ControlAction = "start" | "pause" | "resume" | "cancel";

const DEMO_URL = "/api/legacy-demos/optictrain-navigation";
const CONTROL_SOURCE = "prosbymax-optictrain-navigation-control";

function formatSeconds(totalSeconds: number) {
  const safe = Math.max(0, Math.round(totalSeconds));
  const mm = Math.floor(safe / 60).toString().padStart(2, "0");
  const ss = (safe % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/6 px-3 py-2 text-center">
      <p className="text-xs text-white/56">{label}</p>
      <p className="mt-1 text-base font-semibold text-white">{value}</p>
    </div>
  );
}

export function OptictrainNavigationShell() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const savingRef = useRef(false);
  const pendingFinishRef = useRef<DemoBridgePayload | null>(null);
  const finishSavePromiseRef = useRef<Promise<void> | null>(null);
  const ignoreFinishRef = useRef(false);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [bridgeState, setBridgeState] = useState<DemoBridgePayload | null>(null);
  const [instructionsOpen, setInstructionsOpen] = useState(true);
  const [trainingStarted, setTrainingStarted] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void loadCurrentUserFromApi().then((nextUser) => {
      if (!cancelled) setCurrentUser(nextUser);
    });

    void loadDashboardSnapshot().then((snapshot) => {
      if (!cancelled) {
        setCurrentPlanId(snapshot?.currentPlan?.id ?? null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  async function persistFinishedSession(payload: DemoBridgePayload) {
    if (!currentUser || !currentPlanId) {
      pendingFinishRef.current = payload;
      return;
    }

    if (savingRef.current) {
      pendingFinishRef.current = payload;
      return;
    }

    savingRef.current = true;
    try {
      const startedAt = payload.startedAt ?? new Date().toISOString();
      const endedAt = payload.endedAt ?? new Date().toISOString();
      const durationSec = Math.max(1, Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000));
      const record = createTrainingRecord({
        userId: currentUser.id,
        planId: currentPlanId,
        trainingType: "optictrain-navigation",
        startedAt,
        endedAt,
        durationSec,
        score: payload.score ?? 0,
        total: null,
        accuracy: null,
        metrics: {
          source: payload.source,
          finishReason: payload.finishReason ?? payload.reason ?? "time",
          currentCpd: payload.currentCpd ?? 0,
          collisions: payload.collisions ?? 0,
          mistakes: payload.mistakes ?? 0,
          diamondsCollected: payload.diamondsCollected ?? 0,
          driveScore: payload.driveScore ?? 0,
          gaborScore: payload.gaborScore ?? 0,
          remainingSec: payload.remainingSec ?? 0,
          percent: payload.percent ?? 0,
          sessionFinished: payload.sessionFinished ?? false,
          sessionStartedAt: startedAt,
          sessionEndedAt: endedAt,
          trainingLabel: trainingLabels["optictrain-navigation"]
        }
      });
      const saved = await saveTrainingRecord(record);
    } finally {
      savingRef.current = false;
    }
  }

  useEffect(() => {
    const payload = pendingFinishRef.current;
    if (!payload || !currentUser || !currentPlanId || savingRef.current) return;
    pendingFinishRef.current = null;
    void persistFinishedSession(payload);
  }, [currentPlanId, currentUser]);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const payload = event.data as Partial<DemoBridgePayload> | null;
      if (!payload || payload.source !== "optictrain-visual-neuro-navigation-demo") return;

      setBridgeState(payload as DemoBridgePayload);

      if (payload.event === "session-started") {
        setTrainingStarted(true);
        setInstructionsOpen(false);
        return;
      }

      if (payload.event === "session-finished") {
        if (ignoreFinishRef.current) return;
        const savePromise = persistFinishedSession(payload as DemoBridgePayload);
        finishSavePromiseRef.current = savePromise;
        await savePromise.finally(() => {
          if (finishSavePromiseRef.current === savePromise) {
            finishSavePromiseRef.current = null;
          }
        });
        return;
      }
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [currentPlanId, currentUser]);

  async function enterFullscreen() {
    const target = containerRef.current;
    if (target?.requestFullscreen && !document.fullscreenElement) {
      await target.requestFullscreen();
    }
  }

  function sendControl(action: ControlAction) {
    iframeRef.current?.contentWindow?.postMessage(
      {
        source: CONTROL_SOURCE,
        event: "control",
        action
      },
      window.location.origin
    );
  }

  async function startGame() {
    await enterFullscreen();
    setInstructionsOpen(false);
    sendControl("start");
  }

  async function togglePause(nextPaused?: boolean) {
    const paused = nextPaused ?? !(bridgeState?.paused ?? false);
    sendControl(paused ? "pause" : "resume");
  }

  async function handleReturnPlan(options: { cancelSession?: boolean } = {}) {
    const { cancelSession = true } = options;

    if (cancelSession && !(bridgeState?.event === "session-finished")) {
      ignoreFinishRef.current = true;
      sendControl("cancel");
    }

    if (!cancelSession) {
      await finishSavePromiseRef.current?.catch(() => undefined);
    }

    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined);
    }

    router.push("/");
  }

  const latestScore = bridgeState?.score ?? 0;
  const latestGaborScore = bridgeState?.gaborScore ?? 0;
  const latestDriveScore = bridgeState?.driveScore ?? 0;
  const latestDiamonds = bridgeState?.diamondsCollected ?? 0;
  const latestRemaining = bridgeState?.remainingSec ?? 180;
  const latestPercent = bridgeState?.percent ?? 0;
  const latestCollisions = bridgeState?.collisions ?? 0;
  const latestMistakes = bridgeState?.mistakes ?? 0;
  const latestGaborShare = latestScore > 0 ? Math.round((latestGaborScore / Math.max(1, latestScore)) * 100) : 0;
  const sessionFinished = bridgeState?.event === "session-finished";
  const sessionRunning = trainingStarted && !sessionFinished;
  const pauseButtonLabel = bridgeState?.paused ? "继续" : "暂停";

  if (!currentUser) {
    return (
      <section className="flex min-h-[100dvh] items-center justify-center bg-black px-4 py-8">
        <div className="w-full max-w-2xl rounded-[24px] border border-white/10 bg-white p-6 text-slate-900 shadow-2xl shadow-black/30 sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
            <LockIcon className="h-4 w-4" aria-hidden="true" />
            需要登录
          </div>
          <h2 className="mt-5 text-[1.9rem] font-semibold tracking-tight text-slate-900 sm:text-[2.35rem]">请先登录后开始今日训练</h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-[15px]">
            这个训练页只对已登录账号开放。登录后系统会读取你的计划和训练配置，再允许开始这个驾驶式视觉训练。
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
    <section ref={containerRef} className="relative min-h-[100dvh] overflow-hidden bg-black text-white">
      <div className="absolute inset-0">
        <iframe
          ref={iframeRef}
          title="Visual Neuro-Navigation (OPTIcTRAIN) Demo"
          src={DEMO_URL}
          className="h-full w-full border-0 bg-black"
          allow="fullscreen"
        />
      </div>

      {instructionsOpen ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-[28px] border border-white/10 bg-black/88 px-5 py-6 text-white shadow-2xl shadow-black/45 sm:px-8 sm:py-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-sm font-semibold text-cyan-200">
              游戏规则
            </div>
            <h2 className="mt-5 text-[1.95rem] font-semibold tracking-tight sm:text-[2.4rem]">开始前请先确认规则</h2>
            <p className="mt-4 text-sm leading-7 text-white/75 sm:text-[15px]">
              左右方向键/触控滑动屏幕控制车辆避障。Gabor 挑战出现后，可直接点击弹出方框四周的 8 个方向区域辨识条纹方向。Space 可暂停/继续训练。为了更接近临床环境，界面保持全黑高对比显示。
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={() => void startGame()} className="app-btn-primary h-12 flex-1 px-6">
                开始训练
              </button>
              <Link href="/" onClick={() => { ignoreFinishRef.current = true; }} className="app-btn-secondary h-12 flex-1 px-6">
                返回今日训练
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {sessionRunning ? (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-4 z-20 flex justify-center px-3 sm:top-5">
            <div className="pointer-events-auto flex items-center gap-4 rounded-[26px] bg-white/6 px-4 py-3.5 shadow-[0_18px_42px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
              <div className="min-w-[7.5rem]">
                <p className="text-[2.05rem] font-semibold leading-none tracking-tight text-sky-300 sm:text-[2.35rem]">
                  {formatSeconds(latestRemaining)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void togglePause()}
                aria-label={pauseButtonLabel}
                title={pauseButtonLabel}
                className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-rose-200/30 bg-rose-500 text-white shadow-lg shadow-black/30 transition hover:bg-rose-400"
              >
                {bridgeState?.paused ? (
                  <SolidPlayIcon className="h-7 w-7" aria-hidden="true" />
                ) : (
                  <SolidPauseIcon className="h-7 w-7" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          <div className="pointer-events-none absolute left-4 top-24 z-20 w-[min(92vw,25rem)] sm:top-28 sm:w-[24rem]">
            <div className="pointer-events-auto rounded-[26px] border border-white/5 bg-white/4 p-4 shadow-[0_14px_30px_rgba(0,0,0,0.2)] backdrop-blur-2xl">
              <div className="mb-3 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => void handleReturnPlan({ cancelSession: true })}
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-white/12 px-4 text-sm font-semibold text-white/88 shadow-[0_10px_24px_rgba(0,0,0,0.24)] transition hover:bg-white/16"
                >
                  <ArrowRightIcon className="h-4 w-4 rotate-180" aria-hidden="true" />
                  返回今日训练
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div className="flex min-h-[4.8rem] flex-col items-center justify-center rounded-2xl border border-white/5 bg-white/4 px-3 py-3 text-center backdrop-blur-xl">
                  <p className="text-[13px] font-medium text-white/68">Gabor得分</p>
                  <p className="mt-1 text-[1.7rem] font-extrabold leading-none text-cyan-200">{latestGaborScore}</p>
                </div>
                <div className="flex min-h-[4.8rem] flex-col items-center justify-center rounded-2xl border border-white/5 bg-white/4 px-3 py-3 text-center backdrop-blur-xl">
                  <p className="text-[13px] font-medium text-white/68">驾驶得分</p>
                  <p className="mt-1 text-[1.7rem] font-extrabold leading-none text-sky-200">{latestDriveScore}</p>
                </div>
                <div className="flex min-h-[4.8rem] flex-col items-center justify-center rounded-2xl border border-white/5 bg-white/4 px-3 py-3 text-center backdrop-blur-xl">
                  <p className="text-[13px] font-medium text-white/68">总得分</p>
                  <p className="mt-1 text-[1.7rem] font-extrabold leading-none text-white">{latestScore}</p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-2xl bg-white/12 px-3 py-2.5 shadow-[0_8px_20px_rgba(0,0,0,0.18)] backdrop-blur-xl">
                  <div className="text-[11px] text-white/60">吃钻石</div>
                  <div className="mt-1 text-base font-semibold text-white">{latestDiamonds}</div>
                </div>
                <div className="rounded-2xl bg-white/12 px-3 py-2.5 shadow-[0_8px_20px_rgba(0,0,0,0.18)] backdrop-blur-xl">
                  <div className="text-[11px] text-white/60">碰撞</div>
                  <div className="mt-1 text-base font-semibold text-rose-300">{latestCollisions}</div>
                </div>
                <div className="rounded-2xl bg-white/12 px-3 py-2.5 shadow-[0_8px_20px_rgba(0,0,0,0.18)] backdrop-blur-xl">
                  <div className="text-[11px] text-white/60">Gabor错误</div>
                  <div className="mt-1 text-base font-semibold text-amber-200">{latestMistakes}</div>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {sessionFinished ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/72 px-4 py-8 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-[28px] border border-white/10 bg-black/92 px-5 py-6 text-white shadow-2xl shadow-black/45 sm:px-8 sm:py-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">训练结束</p>
            <h3 className="mt-3 text-2xl font-semibold sm:text-[2.35rem]">本次训练已完成</h3>
            <p className="mt-3 text-sm leading-7 text-white/72 sm:text-[15px]">
              结果已回传到训练记录。你可以返回今日训练页继续下一项，也可以稍后再回来看详细数据。
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="总分" value={String(latestScore)} />
              <Stat label="Gabor分" value={String(latestGaborScore)} />
              <Stat label="驾驶分" value={String(latestDriveScore)} />
              <Stat label="完成度" value={`${latestPercent.toFixed(1)}%`} />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="剩余时间" value={formatSeconds(latestRemaining)} />
              <Stat label="Gabor占比" value={`${latestGaborShare}%`} />
              <Stat label="碰撞" value={String(latestCollisions)} />
              <Stat label="错误/超时" value={String(latestMistakes)} />
            </div>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={() => void handleReturnPlan({ cancelSession: false })} className="app-btn-primary h-12 flex-1 px-6">
                返回今日训练
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
