import type { GaborMatchConfig, TrainingRecord, TrainingType } from "@prosbymax/types";

export const trainingLabels: Record<TrainingType, string> = {
  "optictrain-navigation": "Visual Neuro-Navigation",
  "gabor-match": "Gabor 配对",
  "flicker-gabor": "闪烁 Gabor",
  brightness: "对比辨别",
  reading: "阅读清晰度",
  glare: "眩光/散射可视性",
  tunnel: "隧道远近切换识别"
};

export const defaultGaborMatchConfig: GaborMatchConfig = {
  trainingType: "gabor-match",
  sessionDurationSec: 180,
  maxTrials: 20,
  initialGridSize: 3,
  maxGridSize: 6,
  levelUpEveryCorrect: 5,
  scorePerCorrectBase: 1,
  difficulty: "medium",
  orientationDegLevels: [0, 30, 60, 90, 120, 150],
  spatialFrequencyLevels: [2, 2.5, 3, 4, 5, 6],
  phaseLevels: [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2],
  contrast: 0.9,
  baselineLuminance: 0.5,
  sigmaRatio: 0.2,
  gamma: 1
};

export function normalizeGaborMatchConfig(input: Partial<GaborMatchConfig> | null | undefined): GaborMatchConfig {
  const merged = {
    ...defaultGaborMatchConfig,
    ...(input || {}),
    trainingType: "gabor-match" as const
  };

  return {
    ...merged,
    sessionDurationSec: clampInteger(merged.sessionDurationSec, 30, 1800),
    maxTrials: clampInteger(merged.maxTrials, 1, 200),
    initialGridSize: clampInteger(merged.initialGridSize, 2, 8),
    maxGridSize: clampInteger(merged.maxGridSize, Math.max(2, merged.initialGridSize), 8),
    levelUpEveryCorrect: clampInteger(merged.levelUpEveryCorrect, 1, 50),
    scorePerCorrectBase: clampInteger(merged.scorePerCorrectBase, 1, 100),
    difficulty: ["easy", "medium", "hard"].includes(merged.difficulty) ? merged.difficulty : "medium",
    orientationDegLevels: normalizeNumberList(merged.orientationDegLevels, defaultGaborMatchConfig.orientationDegLevels, 0, 359),
    spatialFrequencyLevels: normalizeNumberList(merged.spatialFrequencyLevels, defaultGaborMatchConfig.spatialFrequencyLevels, 0.5, 20),
    phaseLevels: normalizeNumberList(merged.phaseLevels, defaultGaborMatchConfig.phaseLevels, 0, Math.PI * 2),
    contrast: clampNumber(merged.contrast, 0.05, 1),
    baselineLuminance: clampNumber(merged.baselineLuminance, 0.05, 0.95),
    sigmaRatio: clampNumber(merged.sigmaRatio, 0.05, 0.5),
    gamma: clampNumber(merged.gamma, 0.2, 3)
  };
}

function clampInteger(value: number, min: number, max: number) {
  const safeValue = Number.isFinite(value) ? Math.round(value) : min;
  return Math.min(max, Math.max(min, safeValue));
}

function clampNumber(value: number, min: number, max: number) {
  const safeValue = Number.isFinite(value) ? value : min;
  return Math.min(max, Math.max(min, safeValue));
}

function normalizeNumberList(value: number[] | undefined, fallback: number[], min: number, max: number) {
  const list = Array.isArray(value) ? value : fallback;
  const normalized = Array.from(
    new Set(
      list
        .map((item) => Number(item))
        .filter((item) => Number.isFinite(item))
        .map((item) => Math.min(max, Math.max(min, item)))
    )
  );
  return normalized.length > 0 ? normalized : fallback;
}

export function calculateAccuracy(score: number, total: number | null): number | null {
  if (!total || total <= 0) return null;
  return Math.round((score / total) * 100);
}

export function createTrainingRecord(input: {
  userId: string | null;
  planId: string | null;
  trainingType: TrainingType;
  startedAt?: string;
  endedAt?: string;
  durationSec?: number;
  score: number;
  total?: number | null;
  accuracy?: number | null;
  metrics?: Record<string, unknown>;
}): TrainingRecord {
  const now = new Date().toISOString();
  const startedAt = input.startedAt ?? now;
  const endedAt = input.endedAt ?? now;
  const accuracy = input.accuracy ?? calculateAccuracy(input.score, input.total ?? null);

  return {
    id: [
      input.userId ?? "anonymous",
      input.planId ?? "no-plan",
      input.trainingType,
      startedAt,
      endedAt
    ].join("|"),
    userId: input.userId,
    planId: input.planId,
    trainingType: input.trainingType,
    trainingLabel: trainingLabels[input.trainingType],
    startedAt,
    endedAt,
    durationSec: input.durationSec ?? 0,
    score: input.score,
    total: input.total ?? null,
    accuracy,
    metrics: input.metrics ?? {},
    createdAt: now
  };
}

export function summarizeRecords(records: TrainingRecord[]) {
  const totalSessions = records.length;
  const totalDurationSec = records.reduce((sum, record) => sum + record.durationSec, 0);
  const highestScore = records.reduce((max, record) => Math.max(max, record.score), 0);
  const averageScore =
    totalSessions === 0
      ? 0
      : Math.round((records.reduce((sum, record) => sum + record.score, 0) / totalSessions) * 10) / 10;

  return {
    totalSessions,
    totalDurationSec,
    highestScore,
    averageScore
  };
}

export type GaborDifficulty = "easy" | "medium" | "hard";

export type GaborTriple = {
  theta: number;
  cycles: number;
  phase: number;
};

export type GaborPuzzle = {
  size: number;
  triples: GaborTriple[];
  pairIndices: [number, number];
};

type GaborDifficultyConfig = {
  thetaLevels: number[];
  cyclesLevels: number[];
  phaseLevels: number[];
};

const DEG = Math.PI / 180;

const gaborDifficultyConfigs: Record<GaborDifficulty, GaborDifficultyConfig> = {
  easy: {
    thetaLevels: [0, 90, 180, 270].map((degree) => degree * DEG),
    cyclesLevels: [2, 3, 4],
    phaseLevels: [0, 2, 4, 6].map((step) => (step * Math.PI) / 4)
  },
  medium: {
    thetaLevels: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((degree) => degree * DEG),
    cyclesLevels: [2, 2.5, 3, 4, 5, 6],
    phaseLevels: [0, 1, 2, 3, 4, 5, 6, 7].map((step) => (step * Math.PI) / 4)
  },
  hard: {
    thetaLevels: [0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240, 255, 270, 285, 300, 315, 330, 345].map((degree) => degree * DEG),
    cyclesLevels: [2, 2.5, 3, 4, 5, 6, 7],
    phaseLevels: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5].map((step) => (step * Math.PI) / 4)
  }
};

export function createSeededRandom(seed: number) {
  return function random() {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], random: () => number) {
  const copy = items.slice();
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = copy[index];
    copy[index] = copy[swapIndex];
    copy[swapIndex] = current;
  }
  return copy;
}

function gaborTripleKey(triple: GaborTriple) {
  return `${triple.theta}|${triple.cycles}|${triple.phase}`;
}

export function getGaborTriples(difficulty: GaborDifficulty = "medium") {
  const config = gaborDifficultyConfigs[difficulty];
  const triples: GaborTriple[] = [];

  config.thetaLevels.forEach((theta) => {
    config.cyclesLevels.forEach((cycles) => {
      config.phaseLevels.forEach((phase) => {
        triples.push({ theta, cycles, phase });
      });
    });
  });

  return triples;
}

export function getGaborTriplesFromConfig(config: Pick<GaborMatchConfig, "orientationDegLevels" | "spatialFrequencyLevels" | "phaseLevels">) {
  const triples: GaborTriple[] = [];

  config.orientationDegLevels.forEach((orientationDeg) => {
    config.spatialFrequencyLevels.forEach((cycles) => {
      config.phaseLevels.forEach((phase) => {
        triples.push({ theta: orientationDeg * DEG, cycles, phase });
      });
    });
  });

  return triples;
}

export function generateGaborPuzzle(options: {
  size: number;
  difficulty?: GaborDifficulty;
  seed?: number;
  triples?: GaborTriple[];
}): GaborPuzzle {
  const difficulty = options.difficulty ?? "medium";
  const random = createSeededRandom(options.seed ?? Date.now());
  const triples = options.triples ?? getGaborTriples(difficulty);
  const cellCount = options.size * options.size;
  const uniqueNeeded = cellCount - 1;

  if (uniqueNeeded > triples.length) {
    throw new Error("Not enough unique Gabor combinations for this grid size.");
  }

  const pool = shuffle(triples, random);
  const target = pool[0];
  const used = new Set([gaborTripleKey(target)]);
  const distractors: GaborTriple[] = [];

  for (let index = 1; index < pool.length && distractors.length < cellCount - 2; index += 1) {
    const key = gaborTripleKey(pool[index]);
    if (!used.has(key)) {
      used.add(key);
      distractors.push(pool[index]);
    }
  }

  if (distractors.length < cellCount - 2) {
    throw new Error("Not enough Gabor distractors for this grid size.");
  }

  const shuffled = shuffle([...distractors.slice(0, cellCount - 2), target, target], random);
  const pairIndices = shuffled
    .map((triple, index) => (gaborTripleKey(triple) === gaborTripleKey(target) ? index : -1))
    .filter((index) => index >= 0) as [number, number];

  if (pairIndices.length !== 2) {
    throw new Error("Gabor puzzle must contain exactly one target pair.");
  }

  return {
    size: options.size,
    triples: shuffled,
    pairIndices
  };
}

export function createGaborImageData(options: {
  triple: GaborTriple;
  size: number;
  sigma?: number;
  gamma?: number;
  contrast?: number;
  baselineLuminance?: number;
}) {
  const size = options.size;
  const data = new Uint8ClampedArray(size * size * 4);
  const sigma = options.sigma ?? size / 5;
  const gamma = options.gamma ?? 1;
  const contrast = options.contrast ?? 1;
  const baselineLuminance = options.baselineLuminance ?? 0.5;
  const cos = Math.cos(options.triple.theta);
  const sin = Math.sin(options.triple.theta);
  const lambda = size / options.triple.cycles;
  const twoPiOverLambda = (2 * Math.PI) / lambda;
  const center = (size - 1) / 2;
  const inv2SigmaSquared = 1 / (2 * sigma * sigma);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = x - center;
      const dy = y - center;
      const xp = dx * cos + dy * sin;
      const yp = -dx * sin + dy * cos;
      const envelope = Math.exp(-(xp * xp + gamma * gamma * yp * yp) * inv2SigmaSquared);
      const carrier = Math.cos(twoPiOverLambda * xp + options.triple.phase);
      const luminance = Math.min(1, Math.max(0, baselineLuminance + contrast * baselineLuminance * envelope * carrier));
      const gray = Math.round(luminance * 255);
      const dataIndex = (y * size + x) * 4;

      data[dataIndex] = gray;
      data[dataIndex + 1] = gray;
      data[dataIndex + 2] = gray;
      data[dataIndex + 3] = 255;
    }
  }

  return {
    width: size,
    height: size,
    data
  };
}
