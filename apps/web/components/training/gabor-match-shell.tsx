"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import Link from "next/link";
import {
  createGaborImageData,
  createTrainingRecord,
  defaultGaborMatchConfig,
  generateGaborPuzzle,
  getGaborTriplesFromConfig,
  trainingLabels
} from "@prosbymax/core";
import type { GaborTriple } from "@prosbymax/core";
import type { AppUser, GaborMatchConfig, TrainingRecord } from "@prosbymax/types";
import { loadDashboardSnapshot } from "@/lib/dashboard";
import { loadCurrentUserFromApi } from "@/lib/auth";
import { loadGaborMatchConfigFromApi } from "@/lib/admin-config";
import { saveTrainingRecord } from "@/lib/training-records";
import { CheckIcon, CloseIcon, ClockIcon, StopIcon } from "@/components/app-icons";

const cellPixelSize = 112;

type TrialResult = {
  trialNumber: number;
  gridSize: number;
  seed: number;
  cueIndex: number;
  answerIndex: number;
  selectedIndex: number;
  correct: boolean;
  score: number;
  respondedAt: string;
};

type FinishReason = "time" | "max-trials" | "manual";
type TrialFeedback = { correct: boolean; score: number } | null;

const autoNextDelayMs = 850;

function GaborCanvas({
  triple,
  config,
  highlight
}: {
  triple: GaborTriple;
  config: GaborMatchConfig;
  highlight?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const image = createGaborImageData({
      triple,
      size: cellPixelSize,
      contrast: config.contrast,
      baselineLuminance: config.baselineLuminance,
      sigma: cellPixelSize * config.sigmaRatio,
      gamma: config.gamma
    });

    canvas.width = image.width;
    canvas.height = image.height;
    context.putImageData(new ImageData(image.data, image.width, image.height), 0, 0);
  }, [config.baselineLuminance, config.contrast, config.gamma, config.sigmaRatio, triple]);

  return (
    <canvas
      ref={canvasRef}
      className={[
        "block h-full w-full rounded-[6px]",
        highlight ? "outline outline-2 outline-warning outline-offset-2" : ""
      ].join(" ")}
      aria-hidden="true"
    />
  );
}

export function GaborMatchShell() {
  const [config, setConfig] = useState<GaborMatchConfig>(defaultGaborMatchConfig);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [trialCompleted, setTrialCompleted] = useState(false);
  const [feedback, setFeedback] = useState<TrialFeedback>(null);
  const [result, setResult] = useState<TrainingRecord | null>(null);
  const [sessionStartedAt, setSessionStartedAt] = useState(() => new Date().toISOString());
  const [remainingSec, setRemainingSec] = useState(defaultGaborMatchConfig.sessionDurationSec);
  const [currentGridSize, setCurrentGridSize] = useState(defaultGaborMatchConfig.initialGridSize);
  const [totalCorrect, setTotalCorrect] = useState(0);
  const [score, setScore] = useState(0);
  const [trials, setTrials] = useState<TrialResult[]>([]);
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionFinished, setSessionFinished] = useState(false);
  const [finishReason, setFinishReason] = useState<FinishReason | null>(null);
  const [seed, setSeed] = useState(20260421);
  const advanceTimerRef = useRef<number | null>(null);
  const questionRef = useRef<HTMLDivElement | null>(null);
  const previousSessionActiveRef = useRef(false);
  const finishSavePromiseRef = useRef<Promise<TrainingRecord> | null>(null);

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

    void loadGaborMatchConfigFromApi().then((loadedConfig) => {
      if (cancelled) return;
      setConfig(loadedConfig);
      setRemainingSec(loadedConfig.sessionDurationSec);
      setCurrentGridSize(loadedConfig.initialGridSize);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!sessionActive || sessionFinished) return;

    const timer = window.setInterval(() => {
      setRemainingSec((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [sessionActive, sessionFinished]);

  useEffect(() => {
    if (sessionActive && remainingSec === 0 && !sessionFinished) {
      finishSession("time");
    }
  }, [remainingSec, sessionActive, sessionFinished]);

  useEffect(() => {
    return () => clearAdvanceTimer();
  }, []);

  useEffect(() => {
    if (!sessionActive || previousSessionActiveRef.current) {
      previousSessionActiveRef.current = sessionActive;
      return;
    }

    previousSessionActiveRef.current = sessionActive;

    const scrollTarget = questionRef.current;
    if (!scrollTarget) return;

    const frame = window.requestAnimationFrame(() => {
      const isTablet = window.innerWidth >= 768 && window.innerWidth < 1280;
      scrollTarget.scrollIntoView({
        behavior: "smooth",
        block: isTablet ? "center" : "start",
        inline: "nearest"
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [sessionActive]);

  const puzzle = useMemo(
    () =>
      generateGaborPuzzle({
        size: currentGridSize,
        seed,
        difficulty: config.difficulty,
        triples: getGaborTriplesFromConfig(config)
      }),
    [config, currentGridSize, seed]
  );
  const cueIndex = puzzle.pairIndices[0];
  const answerIndex = puzzle.pairIndices[1];
  const trialNumber = trials.length + (sessionActive && !sessionFinished ? 1 : 0);
  const progressText = `${trials.length} / ${config.maxTrials}`;
  const formattedRemaining = sessionActive
    ? `${Math.floor(remainingSec / 60)}:${String(remainingSec % 60).padStart(2, "0")}`
    : "—";
  const FeedbackIcon = feedback?.correct ? CheckIcon : CloseIcon;
  const feedbackTone = feedback?.correct ? "from-red-500 to-red-600" : "from-slate-400 to-slate-500";
  const feedbackLabel = feedback?.correct ? "正确" : "错误";

  function clearAdvanceTimer() {
    if (advanceTimerRef.current !== null) {
      window.clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  }

  function buildSessionRecord(nextTrials: TrialResult[], nextScore: number, reason: FinishReason, finalGridSize = currentGridSize) {
    const endedAt = new Date().toISOString();
    const durationSec = Math.max(1, Math.round((new Date(endedAt).getTime() - new Date(sessionStartedAt).getTime()) / 1000));

      return createTrainingRecord({
      userId: currentUser?.id ?? null,
      planId: currentPlanId,
      trainingType: "gabor-match",
      startedAt: sessionStartedAt,
      endedAt,
      durationSec,
      score: nextScore,
      total: nextTrials.length,
      accuracy: nextTrials.length > 0 ? Math.round((nextTrials.filter((trial) => trial.correct).length / nextTrials.length) * 100) : null,
      metrics: {
        finishReason: reason,
        maxGridReached: Math.max(...nextTrials.map((trial) => trial.gridSize), config.initialGridSize),
        finalGridSize,
        correctCount: nextTrials.filter((trial) => trial.correct).length,
        sessionDurationSec: config.sessionDurationSec,
        maxTrials: config.maxTrials,
        levelUpEveryCorrect: config.levelUpEveryCorrect,
        scorePerCorrectBase: config.scorePerCorrectBase,
        contrast: config.contrast,
        baselineLuminance: config.baselineLuminance,
        sigmaRatio: config.sigmaRatio,
        gamma: config.gamma,
        trials: nextTrials,
        migratedCanvas: true
      }
    });
  }

  function finishSession(reason: FinishReason, finalTrials = trials, finalScore = score, finalGridSize = currentGridSize) {
    if (sessionFinished) return;

    clearAdvanceTimer();
    setSessionActive(false);

    if (finalTrials.length === 0) {
      setFinishReason(reason);
      setSessionFinished(true);
      return;
    }

    const record = buildSessionRecord(finalTrials, finalScore, reason, finalGridSize);
    const savePromise = saveTrainingRecord(record);
    finishSavePromiseRef.current = savePromise;
    savePromise.finally(() => {
      if (finishSavePromiseRef.current === savePromise) {
        finishSavePromiseRef.current = null;
      }
    });
    setResult(record);
    setFinishReason(reason);
    setSessionFinished(true);
  }

  async function handleReturnHome(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    await finishSavePromiseRef.current?.catch(() => undefined);
    window.location.assign("/");
  }

  function queueNextTrial(nextTrials: TrialResult[], nextScore: number, nextGridSize: number) {
    clearAdvanceTimer();
    advanceTimerRef.current = window.setTimeout(() => {
      advanceTimerRef.current = null;
      if (nextTrials.length >= config.maxTrials) {
        finishSession("max-trials", nextTrials, nextScore, nextGridSize);
        return;
      }

      setSelectedIndex(null);
      setTrialCompleted(false);
      setFeedback(null);
      setCurrentGridSize(nextGridSize);
      setSeed((current) => current + 1);
    }, autoNextDelayMs);
  }

  function startSession() {
    const now = new Date().toISOString();
    clearAdvanceTimer();
    setSelectedIndex(null);
    setTrialCompleted(false);
    setFeedback(null);
    setResult(null);
    setSessionStartedAt(now);
    setRemainingSec(config.sessionDurationSec);
    setCurrentGridSize(config.initialGridSize);
    setTotalCorrect(0);
    setScore(0);
    setTrials([]);
    setSessionActive(true);
    setSessionFinished(false);
    setFinishReason(null);
    setSeed((current) => current + 1);
  }

  function handleSelect(index: number) {
    if (!sessionActive || trialCompleted || sessionFinished || index === cueIndex) return;

    const correct = index === answerIndex;
    const trialScore = correct ? config.scorePerCorrectBase : 0;
    const nextScore = score + trialScore;
    const nextTotalCorrect = totalCorrect + (correct ? 1 : 0);
    const shouldLevelUp =
      correct &&
      nextTotalCorrect > 0 &&
      nextTotalCorrect % config.levelUpEveryCorrect === 0 &&
      currentGridSize < config.maxGridSize;
    const nextGridSize = shouldLevelUp ? Math.min(config.maxGridSize, currentGridSize + 1) : currentGridSize;
    const nextTrials = [
      ...trials,
      {
        trialNumber,
        gridSize: currentGridSize,
        seed,
        cueIndex,
        answerIndex,
        selectedIndex: index,
        correct,
        score: trialScore,
        respondedAt: new Date().toISOString()
      }
    ];

    setSelectedIndex(index);
    setTrials(nextTrials);
    setScore(nextScore);
    setTotalCorrect(nextTotalCorrect);
    setTrialCompleted(true);
    setFeedback({ correct, score: trialScore });
    queueNextTrial(nextTrials, nextScore, nextGridSize);
  }

  function restartSession() {
    startSession();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
      <aside className="rounded-app border border-border bg-white p-5 sm:p-6">
        <p className="text-sm font-medium text-muted">训练模块</p>
        <h2 className="mt-2 text-xl font-semibold sm:text-2xl">{trainingLabels["gabor-match"]}</h2>
        <p className="mt-3 text-sm leading-6 text-muted">
          根据管理员配置执行连续训练 session，系统会记录计时、题量、得分、网格升级和刺激参数。
        </p>

        {!sessionActive ? (
          <button
            className="mt-6 h-11 w-full rounded-app bg-primary px-5 text-sm font-semibold text-white"
            disabled={!currentPlanId}
            onClick={startSession}
          >
            {currentPlanId ? "开始训练" : "先选择计划"}
          </button>
        ) : null}

        <div className="mt-6 space-y-3 text-sm">
          <div className="flex justify-between border-b border-border pb-3">
            <span className="text-muted">网格</span>
            <span className="font-medium">
              {currentGridSize} × {currentGridSize}
            </span>
          </div>
          <div className="flex justify-between border-b border-border pb-3">
            <span className="text-muted">剩余时间</span>
            <span className="font-medium">{formattedRemaining}</span>
          </div>
          <div className="flex justify-between border-b border-border pb-3">
            <span className="text-muted">进度</span>
            <span className="font-medium">{progressText}</span>
          </div>
          <div className="flex justify-between border-b border-border pb-3">
            <span className="text-muted">当前得分</span>
            <span className="font-medium">{score}</span>
          </div>
          <div className="flex justify-between border-b border-border pb-3">
            <span className="text-muted">正确题数</span>
            <span className="font-medium">{totalCorrect}</span>
          </div>
          <div className="flex justify-between border-b border-border pb-3">
            <span className="text-muted">升级规则</span>
            <span className="font-medium">每 {config.levelUpEveryCorrect} 题</span>
          </div>
          <div className="flex justify-between border-b border-border pb-3">
            <span className="text-muted">提示格</span>
            <span className="font-medium">金色描边</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">目标</span>
            <span className="font-medium">找出相同图案</span>
          </div>
        </div>
      </aside>

      <section className="rounded-app border border-border bg-white p-5 sm:p-6">
        <div
          ref={questionRef}
          className="flex flex-col gap-4 scroll-mt-24 sm:flex-row sm:items-start sm:justify-between sm:scroll-mt-28 lg:scroll-mt-32"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted">训练题目</p>
            <h3 className="mt-1 text-[1.15rem] font-semibold leading-tight text-slate-900 sm:text-lg">
              {!sessionActive && !sessionFinished ? "请先开始训练" : sessionFinished ? "本次训练已结束" : `第 ${trialNumber} 题：选择与提示格相同的一格`}
            </h3>
            <p className="mt-1 text-sm leading-6 text-muted">
              {!sessionActive && !sessionFinished ? "点击左侧开始训练后，倒计时和题目会同时启动。" : "提示格不可作为答案，选择后会自动判定并进入下一题。"}
            </p>
          </div>

          <div className="grid gap-3 sm:justify-items-end">
            <div
              className={[
                "inline-flex w-full items-center gap-2 rounded-[18px] border px-4 py-3 shadow-[0_14px_26px_rgba(15,23,42,0.08)] sm:w-auto",
                sessionActive ? "border-sky-200 bg-gradient-to-r from-sky-50 via-cyan-50 to-white" : "border-slate-200 bg-slate-50"
              ].join(" ")}
            >
              <span className={[
                "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                sessionActive ? "bg-gradient-to-br from-sky-500 to-cyan-500 text-white" : "bg-slate-100 text-slate-500"
              ].join(" ")}>
                <ClockIcon className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="mt-0.5 text-[1.85rem] font-semibold leading-none tracking-tight text-sky-700 sm:text-[2.25rem]">
                  {formattedRemaining}
                </p>
              </div>
              {sessionActive ? (
                <button
                  type="button"
                  aria-label="结束训练"
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-danger text-white shadow-[0_12px_24px_rgba(239,68,68,0.18)] transition hover:bg-red-600"
                  onClick={() => finishSession("manual")}
                >
                  <StopIcon className="h-6 w-6" aria-hidden="true" />
                </button>
              ) : null}
            </div>
            <Link className="text-sm font-semibold text-primary sm:text-right" href="/">
              返回今日训练
            </Link>
          </div>
        </div>

        {sessionFinished ? (
          <div className="mt-6 rounded-[24px] border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-rose-50 p-6 shadow-[0_16px_36px_rgba(15,23,42,0.06)] sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-muted">训练已结束</p>
                <h4 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-[1.75rem]">
                  本次训练已结束
                </h4>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
                  结束原因：{finishReason === "time" ? "倒计时结束" : finishReason === "max-trials" ? "达到题目上限" : "手动结束"}。
                  {result ? "你可以先查看结果，再返回今日训练页继续下一次训练。" : "当前没有生成有效结果，可直接返回今日训练页重新开始。"}
                </p>
              </div>

              {result ? (
                <div className="flex flex-wrap gap-3">
                  <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">正确率</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900">{result.accuracy ?? 0}%</p>
                  </div>
                  <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">得分</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900">{result.score}</p>
                  </div>
                  <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">完成题数</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900">{result.total}</p>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                className="inline-flex h-11 items-center justify-center rounded-app bg-primary px-5 text-sm font-semibold text-white"
                href="/"
                onClick={(event) => {
                  void handleReturnHome(event);
                }}
              >
                返回今日训练
              </Link>
              <button
                className="h-11 rounded-app border border-border bg-white px-5 text-sm font-semibold text-slate-700"
                onClick={restartSession}
              >
                重新开始
              </button>
            </div>
          </div>
        ) : sessionActive ? (
          <div
            className="relative mt-6 mx-auto aspect-square w-full"
            style={{ maxWidth: "min(92vw, 32rem, calc(100dvh - 18rem))" }}
          >
            <div
              className="grid h-full w-full gap-1 sm:gap-2"
              style={{
                gridTemplateColumns: `repeat(${currentGridSize}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${currentGridSize}, minmax(0, 1fr))`
              }}
            >
              {puzzle.triples.map((triple, index) => {
                const isCue = index === cueIndex;
                const isSelected = selectedIndex === index;
                return (
                  <button
                    key={`${seed}-${index}`}
                    className={[
                      "min-h-0 min-w-0 overflow-hidden rounded-[10px] border border-border bg-slate-100 p-1 transition sm:p-1.5",
                      isCue ? "border-warning ring-2 ring-warning/40" : "border-border",
                      isSelected ? (feedback?.correct ? "ring-2 ring-success" : "ring-2 ring-danger") : "",
                      trialCompleted && index === answerIndex ? "border-success ring-2 ring-success/40" : ""
                    ].join(" ")}
                    disabled={isCue || trialCompleted || sessionFinished}
                    onClick={() => handleSelect(index)}
                    aria-label={isCue ? "提示格" : `候选格 ${index + 1}`}
                  >
                    <GaborCanvas triple={triple} config={config} highlight={isCue} />
                  </button>
                );
              })}
            </div>
            {trialCompleted && feedback ? (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                <div
                  className={[
                    "flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br text-white shadow-[0_18px_40px_rgba(15,23,42,0.18)] sm:h-28 sm:w-28",
                    feedbackTone,
                    "animate-[feedback-pop_850ms_ease-in-out]"
                  ].join(" ")}
                  aria-label={feedbackLabel}
                >
                  <FeedbackIcon className="h-12 w-12 sm:h-14 sm:w-14" aria-hidden="true" />
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-6 flex min-h-[360px] max-w-3xl items-center justify-center rounded-app border border-dashed border-border bg-slate-50 text-sm text-muted">
            训练未开始
          </div>
        )}

        {!currentPlanId && !sessionActive ? (
          <div className="mt-6 rounded-app border border-dashed border-border bg-slate-50 p-5 text-sm text-muted">
            当前没有激活的训练计划，请先到账户页加入一个计划。
          </div>
        ) : null}

        {trialCompleted && feedback && !sessionFinished ? (
          <div className="mt-6 rounded-app border border-border bg-slate-50 p-5">
            <p className={["font-semibold", feedback.correct ? "text-success" : "text-danger"].join(" ")}>
              {feedback.correct ? `配对成功（+${feedback.score}）` : "配对失败"}
            </p>
            <p className="mt-2 text-sm leading-6 text-muted">
              当前累计得分 {score}，已完成 {trials.length} 题，系统将自动进入下一题。
            </p>
          </div>
        ) : null}

      </section>
    </div>
  );
}
