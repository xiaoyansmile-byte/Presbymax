const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawn } = require("node:child_process");

const webDir = path.join(process.cwd());
const dataDir = path.join(webDir, "data");
const sqlitePath = path.join(dataDir, "persistent-store.sqlite");
const port = 3457;
const baseUrl = `http://127.0.0.1:${port}`;

let tempDir = null;
let serverProcess = null;
let serverLogs = "";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractCookie(setCookieHeader) {
  if (!setCookieHeader) return null;
  return String(setCookieHeader).split(";")[0] ?? null;
}

async function fetchJson(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.headers ?? {})
    }
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { response, body };
}

async function waitForServer() {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 60000) {
    try {
      const { response } = await fetchJson(`${baseUrl}/api/me`);
      if (response.ok) return;
    } catch {
      // keep waiting
    }
    await sleep(500);
  }
  throw new Error(`Timed out waiting for api server on ${baseUrl}\n${serverLogs}`);
}

test.before(async () => {
  assert.ok(fs.existsSync(sqlitePath), `Expected SQLite database at ${sqlitePath}. Run pnpm db:init first.`);
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "prosbymax-api-smoke-"));
  fs.copyFileSync(sqlitePath, path.join(tempDir, "persistent-store.sqlite"));

  serverProcess = spawn("pnpm", ["dev"], {
    cwd: webDir,
    env: {
      ...process.env,
      NODE_ENV: "test",
      NEXT_TELEMETRY_DISABLED: "1",
      PORT: String(port),
      PROSBYMAX_DATA_DIR: tempDir
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  serverProcess.stdout.on("data", (chunk) => {
    serverLogs += chunk.toString();
  });
  serverProcess.stderr.on("data", (chunk) => {
    serverLogs += chunk.toString();
  });
  serverProcess.on("exit", (code) => {
    if (code !== 0) {
      serverLogs += `\n[api-smoke] server exited with code ${code}\n`;
    }
  });

  await waitForServer();
});

test.after(async () => {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill("SIGTERM");
    await new Promise((resolve) => {
      serverProcess.once("exit", resolve);
    });
  }

  if (tempDir) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("api smoke: auth, account, plan flow, and admin guards", async () => {
  const anonymousMe = await fetchJson(`${baseUrl}/api/me`);
  assert.equal(anonymousMe.response.status, 200);
  assert.equal(anonymousMe.body.ok, true);
  assert.equal(anonymousMe.body.data, null);

  const planTemplatesResp = await fetchJson(`${baseUrl}/api/plan-templates`);
  assert.equal(planTemplatesResp.response.status, 200);
  assert.equal(planTemplatesResp.body.ok, true);
  assert.ok(Array.isArray(planTemplatesResp.body.data));
  assert.ok(planTemplatesResp.body.data.length >= 1);
  const templates = planTemplatesResp.body.data;
  const firstTemplate = templates.find((template) => template.status === "active") ?? templates[0];
  const secondTemplate = templates.find((template) => template.id !== firstTemplate.id && template.status === "active") ?? templates[0];

  const registerEmail = `api-smoke-${Date.now()}@prosbymax.local`;
  const registerResp = await fetchJson(`${baseUrl}/api/auth/register`, {
    method: "POST",
    body: JSON.stringify({
      displayName: "API Smoke User",
      email: registerEmail,
      password: "smoke-pass-123",
      templateId: firstTemplate.id
    })
  });

  assert.equal(registerResp.response.status, 201);
  assert.equal(registerResp.body.ok, true);
  assert.equal(registerResp.body.data.email, registerEmail);
  const userCookie = extractCookie(registerResp.response.headers.get("set-cookie"));
  assert.ok(userCookie);

  const userMe = await fetchJson(`${baseUrl}/api/me`, {
    headers: { cookie: userCookie }
  });
  assert.equal(userMe.response.status, 200);
  assert.equal(userMe.body.data.email, registerEmail);

  const userAccount = await fetchJson(`${baseUrl}/api/account`, {
    headers: { cookie: userCookie }
  });
  assert.equal(userAccount.response.status, 200);
  assert.equal(userAccount.body.data.currentUser.email, registerEmail);
  assert.equal(userAccount.body.data.currentPlan.templateId, firstTemplate.id);

  const addPlanResp = await fetchJson(`${baseUrl}/api/account/plans`, {
    method: "POST",
    headers: { cookie: userCookie },
    body: JSON.stringify({ templateId: secondTemplate.id })
  });
  assert.equal(addPlanResp.response.status, 201);
  assert.equal(addPlanResp.body.ok, true);
  assert.equal(addPlanResp.body.data.templateId, secondTemplate.id);

  const updatedAccount = await fetchJson(`${baseUrl}/api/account`, {
    headers: { cookie: userCookie }
  });
  assert.equal(updatedAccount.body.data.currentPlan.templateId, secondTemplate.id);
  assert.ok(updatedAccount.body.data.enrolledPlans.length >= 2);

  const forbiddenAdminUsers = await fetchJson(`${baseUrl}/api/admin/users`, {
    headers: { cookie: userCookie }
  });
  assert.equal(forbiddenAdminUsers.response.status, 403);
  assert.equal(forbiddenAdminUsers.body.error.code, "FORBIDDEN");

  const configResp = await fetchJson(`${baseUrl}/api/training-configs/gabor-match/active`, {
    headers: { cookie: userCookie }
  });
  assert.equal(configResp.response.status, 200);
  assert.equal(configResp.body.ok, true);
  assert.equal(configResp.body.data.trainingType, "gabor-match");

  const forbiddenConfigWrite = await fetchJson(`${baseUrl}/api/training-configs/gabor-match/active`, {
    method: "PUT",
    headers: { cookie: userCookie },
    body: JSON.stringify({ config: configResp.body.data.config, notes: "should-fail" })
  });
  assert.equal(forbiddenConfigWrite.response.status, 403);

  const adminLoginResp = await fetchJson(`${baseUrl}/api/auth/login`, {
    method: "POST",
    body: JSON.stringify({
      email: "admin@prosbymax.local",
      password: "admin1234"
    })
  });
  assert.equal(adminLoginResp.response.status, 200);
  assert.equal(adminLoginResp.body.ok, true);
  assert.equal(adminLoginResp.body.data.role, "admin");
  const adminCookie = extractCookie(adminLoginResp.response.headers.get("set-cookie"));
  assert.ok(adminCookie);

  const adminUsers = await fetchJson(`${baseUrl}/api/admin/users`, {
    headers: { cookie: adminCookie }
  });
  assert.equal(adminUsers.response.status, 200);
  assert.equal(adminUsers.body.ok, true);
  assert.ok(Array.isArray(adminUsers.body.data));
  assert.ok(adminUsers.body.data.length >= 3);

  const adminConfigWrite = await fetchJson(`${baseUrl}/api/training-configs/gabor-match/active`, {
    method: "PUT",
    headers: { cookie: adminCookie },
    body: JSON.stringify({
      config: configResp.body.data.config,
      notes: "api-smoke-admin"
    })
  });
  assert.equal(adminConfigWrite.response.status, 200);
  assert.equal(adminConfigWrite.body.ok, true);
  assert.equal(adminConfigWrite.body.data.trainingType, "gabor-match");
});
