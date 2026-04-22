"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
        "h-full w-full rounded-[6px]",
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
    void saveTrainingRecord(record);
    setResult(record);
    setFinishReason(reason);
    setSessionFinished(true);
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
      <aside className="rounded-app border border-border bg-white p-6">
        <p className="text-sm font-medium text-muted">训练模块</p>
        <h2 className="mt-2 text-2xl font-semibold">{trainingLabels["gabor-match"]}</h2>
        <p className="mt-3 text-sm leading-6 text-muted">
          根据管理员配置执行连续训练 session，系统会记录计时、题量、得分、网格升级和刺激参数。
        </p>

        <button
          className={[
            "mt-6 h-11 w-full rounded-app px-5 text-sm font-semibold text-white",
            sessionActive ? "bg-danger" : "bg-primary"
          ].join(" ")}
          disabled={!sessionActive && !currentPlanId}
          onClick={() => (sessionActive ? finishSession("manual") : startSession())}
        >
          {sessionActive ? "结束训练" : currentPlanId ? "开始训练" : "先选择计划"}
        </button>

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

      <section className="rounded-app border border-border bg-white p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">
              {!sessionActive && !sessionFinished ? "请先开始训练" : sessionFinished ? "本次训练已结束" : `第 ${trialNumber} 题：选择与提示格相同的一格`}
            </h3>
            <p className="mt-1 text-sm text-muted">
              {!sessionActive && !sessionFinished ? "点击左侧开始训练后，倒计时和题目会同时启动。" : "提示格不可作为答案，选择后会自动判定并进入下一题。"}
            </p>
          </div>
          <Link className="text-sm font-semibold text-primary" href="/">
            返回今日训练
          </Link>
        </div>

        {sessionActive ? (
          <div className="mt-6 grid max-w-3xl gap-3" style={{ gridTemplateColumns: `repeat(${currentGridSize}, minmax(0, 1fr))` }}>
            {puzzle.triples.map((triple, index) => {
              const isCue = index === cueIndex;
              const isSelected = selectedIndex === index;
              return (
                <button
                  key={`${seed}-${index}`}
                  className={[
                    "aspect-square rounded-app border bg-slate-100 p-2 transition",
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
        ) : (
          <div className="mt-6 flex min-h-[360px] max-w-3xl items-center justify-center rounded-app border border-dashed border-border bg-slate-50 text-sm text-muted">
            {sessionFinished ? "训练已结束，可再次开始" : "训练未开始"}
          </div>
        )}

        {!currentPlanId && !sessionActive ? (
          <div className="mt-6 rounded-app border border-dashed border-border bg-slate-50 p-5 text-sm text-muted">
            当前没有激活的训练计划，请先到账户页加入一个计划。
          </div>
        ) : null}

        <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center">
          {sessionFinished ? (
            <button className="h-11 rounded-app border border-border px-5 text-sm font-semibold" onClick={restartSession}>
              重新开始
            </button>
          ) : null}
        </div>

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

        {sessionFinished && result ? (
          <div className="mt-6 rounded-app border border-border bg-slate-50 p-5">
            <p className="font-semibold">Session 已保存</p>
            <p className="mt-2 text-sm leading-6 text-muted">
              结束原因：{finishReason === "time" ? "倒计时结束" : finishReason === "max-trials" ? "达到题目上限" : "手动结束"}。
              得分 {result.score}，完成 {result.total} 题，准确率 {result.accuracy ?? 0}%，用时 {result.durationSec} 秒。
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
