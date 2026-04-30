import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const legacyDemoFileName = "optictrain-visual-neuro-navigation-demo.html";
const controlSource = "prosbymax-optictrain-navigation-control";
const bridgeSource = "optictrain-visual-neuro-navigation-demo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resolveLegacyDemoPath() {
  const candidates = [
    path.resolve(process.cwd(), legacyDemoFileName),
    path.resolve(process.cwd(), "..", "..", legacyDemoFileName),
    path.resolve(process.cwd(), "..", "..", "..", legacyDemoFileName),
    path.resolve(process.cwd(), "..", "..", "..", "..", legacyDemoFileName)
  ];

  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

function injectBridgeScript(html: string) {
  let next = html
    .replace("running: true,", "running: false,")
    .replace("paused: false,", "paused: true,")
    .replace(
      "        spriteCache: new Map()\n      };",
      `        spriteCache: new Map(),
        sessionStartedAt: null,
        sessionFinished: false,
        lastFinishReason: null,
        lastBridgeSignature: ""
      };

      function resetSessionState() {
        state.sessionStartedAt = new Date().toISOString();
        state.sessionFinished = false;
        state.lastFinishReason = null;
        state.lastBridgeSignature = "";
        state.running = true;
        state.paused = false;
        state.mode = "roaming";
        state.elapsed = 0;
        state.score = 0;
        state.gaborScore = 0;
        state.driveScore = 0;
        state.diamondsCollected = 0;
        state.collisions = 0;
        state.mistakes = 0;
        state.currentCpd = CPD_LEVELS[0];
        state.roadPhase = 0;
        state.speed = 0.34;
        state.playerLane = 0;
        state.laneVelocity = 0;
        state.keys.left = false;
        state.keys.right = false;
        state.touchDrive.active = false;
        state.touchDrive.pointerId = null;
        state.touchDrive.startX = 0;
        state.touchDrive.startLane = 0;
        state.touchDrive.targetLane = 0;
        state.obstacles = [];
        state.rewards = [];
        state.scenery = [];
        state.obstacleSpawn = 0;
        state.rewardSpawn = 0;
        state.scenerySpawn = 0;
        state.gaborSpawn = 0;
        state.gaborSign = null;
        state.activeChallenge = null;
        state.challengeUi = null;
        state.feedbackTimer = 0;
        state.feedbackText = "";
        state.feedbackType = "";
        state.autoContrastPhase = 0;
        state.sessionFinished = false;
        state.lastFinishReason = null;
        state.lastTs = 0;
        state.manualContrast = 0.8;
        state.carEffect = {
          type: null,
          timer: 0,
          duration: 0,
          intensity: 0,
          particles: []
        };
      }

      function postBridge(event, extra = {}, force = false) {
        if (typeof window === "undefined" || window.parent === window) return;

        const payload = {
          source: "${bridgeSource}",
          event,
          startedAt: state.sessionStartedAt,
          running: state.running,
          paused: state.paused,
          mode: state.mode,
          score: state.score,
          gaborScore: state.gaborScore,
          driveScore: state.driveScore,
          diamondsCollected: state.diamondsCollected,
          collisions: state.collisions,
          mistakes: state.mistakes,
          elapsedSec: state.elapsed,
          remainingSec: Math.max(0, SESSION_SECONDS - state.elapsed),
          percent: Math.min(100, Math.max(0, (state.elapsed / SESSION_SECONDS) * 100)),
          currentCpd: state.currentCpd,
          sessionFinished: state.sessionFinished,
          finishReason: state.lastFinishReason,
          ...extra
        };

        const signature = force
          ? \`\${event}:\${Date.now()}\`
          : JSON.stringify([
              event,
              Math.floor(payload.elapsedSec),
              payload.score,
              payload.gaborScore,
              payload.driveScore,
              payload.diamondsCollected,
              payload.collisions,
              payload.mistakes,
              payload.mode,
              payload.paused,
              payload.remainingSec,
              payload.currentCpd,
              payload.sessionFinished,
              payload.finishReason
            ]);

        if (!force && signature === state.lastBridgeSignature) return;
        state.lastBridgeSignature = signature;
        window.parent.postMessage(payload, window.location.origin);
      }

      function startSession() {
        resetSessionState();
        setMode("roaming");
        postBridge("session-started", { startedAt: state.sessionStartedAt }, true);
        updateHud();
      }

      function finishSession(reason) {
        if (state.sessionFinished) return;
        state.sessionFinished = true;
        state.lastFinishReason = reason;
        state.running = false;
        state.paused = false;
        state.activeChallenge = null;
        state.gaborSign = null;
        setMode("feedback");
        showFeedback("3分钟训练完成", "ok");
        postBridge("session-finished", { reason, endedAt: new Date().toISOString() }, true);
      }

      function cancelSession(reason = "cancelled") {
        if (state.sessionFinished) return;
        state.sessionFinished = true;
        state.lastFinishReason = reason;
        state.running = false;
        state.paused = true;
        state.activeChallenge = null;
        state.gaborSign = null;
        hideFeedback();
        state.feedbackText = "";
        state.feedbackType = "";
        setMode("feedback");
        postBridge("session-cancelled", { reason, endedAt: new Date().toISOString() }, true);
      }

      function handleControlMessage(event) {
        if (event.origin !== window.location.origin) return;
        const data = event.data;
        if (!data || data.source !== "${controlSource}" || data.event !== "control") return;

        if (data.action === "start") {
          startSession();
          return;
        }

        if (data.action === "pause") {
          togglePause(true);
          return;
        }

        if (data.action === "resume") {
          togglePause(false);
          return;
        }

        if (data.action === "cancel") {
          cancelSession(data.reason || "cancelled");
        }
      }

      window.addEventListener("message", handleControlMessage);`
    )
    .replace(
      "        pauseBtn.classList.toggle(\"active\", state.paused);\n        if (state.paused) {\n          state.keys.left = false;\n          state.keys.right = false;\n          showFeedback(\"已暂停\", \"ok\");\n        } else {\n          hideFeedback();\n        }\n        updateDirectionButtonsState();",
      "        pauseBtn.classList.toggle(\"active\", state.paused);\n        if (state.paused) {\n          state.keys.left = false;\n          state.keys.right = false;\n          showFeedback(\"已暂停\", \"ok\");\n        } else {\n          hideFeedback();\n        }\n        postBridge(\"pause-state\", { paused: state.paused }, true);\n        updateDirectionButtonsState();"
    )
    .replace(
      `          if (state.elapsed >= SESSION_SECONDS) {
            state.elapsed = SESSION_SECONDS;
            state.running = false;
            setMode("feedback");
            showFeedback("3分钟训练完成", "ok");
          }`,
      `          if (state.elapsed >= SESSION_SECONDS) {
            state.elapsed = SESSION_SECONDS;
            finishSession("time");
            return;
          }`
    );

  next = next.replace(
    "</style>",
    `
    .hud,
    .controls,
    .hint,
    #pauseBtn {
      display: none !important;
    }

    .feedback {
      top: 26vh !important;
      max-width: calc(100vw - 32px);
      z-index: 24;
    }

    @media (max-width: 820px) {
      .feedback {
        top: 22vh !important;
      }
    }
  </style>`
  );

  return next;
}

export async function GET() {
  const htmlPath = resolveLegacyDemoPath();
  const html = await readFile(htmlPath, "utf8");
  const bridged = injectBridgeScript(html);

  return new NextResponse(bridged, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}
