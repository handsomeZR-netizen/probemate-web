const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const app = process.env.PM_APP_URL ?? "http://localhost:3000";
const api = process.env.PM_API_URL ?? "http://127.0.0.1:8001";
const repoRoot = path.resolve(__dirname, "..", "..", "..");
const outDir = path.join(repoRoot, "screenshots-probemate");
const reportPath = path.join(outDir, "devtools-flow-report.json");

const actionLabels = {
  use: "采用",
  edit: "编辑后采用",
  delay: "稍后处理",
  skip: "跳过"
};

const report = {
  startedAt: new Date().toISOString(),
  app,
  api,
  steps: [],
  consoleErrors: [],
  pageErrors: [],
  requestFailures: [],
  httpErrors: [],
  cdpExceptions: [],
  cdpNetworkFailures: [],
  screenshots: [],
  created: []
};

function writeReport(ok) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        ...report,
        finishedAt: new Date().toISOString(),
        ok
      },
      null,
      2
    )
  );
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isIgnoredHttpError(url) {
  return url.endsWith("/favicon.ico");
}

async function step(name, fn) {
  const startedAt = Date.now();
  try {
    const value = await fn();
    report.steps.push({
      name,
      ok: true,
      durationMs: Date.now() - startedAt,
      at: new Date().toISOString()
    });
    return value;
  } catch (error) {
    report.steps.push({
      name,
      ok: false,
      durationMs: Date.now() - startedAt,
      at: new Date().toISOString(),
      error: error instanceof Error ? error.stack ?? error.message : String(error)
    });
    throw error;
  }
}

async function apiJson(route, init = {}) {
  const response = await fetch(`${api}${route}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {})
    }
  });
  if (!response.ok) {
    throw new Error(`${init.method ?? "GET"} ${route} failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

async function apiText(route) {
  const response = await fetch(`${api}${route}`);
  if (!response.ok) {
    throw new Error(`GET ${route} failed: ${response.status} ${await response.text()}`);
  }
  return response.text();
}

async function screenshot(page, fileName) {
  const target = path.join(outDir, fileName);
  await page.screenshot({ path: target, fullPage: true });
  report.screenshots.push(target);
  return target;
}

async function selectByText(page, trigger, itemText) {
  await trigger.click();
  await page.locator('[data-slot="select-item"]').filter({ hasText: itemText }).first().click();
}

function postResponseMatcher(pathFragment) {
  return (response) => response.url().includes(pathFragment) && response.request().method() === "POST";
}

function patchResponseMatcher(pathFragment) {
  return (response) => response.url().includes(pathFragment) && response.request().method() === "PATCH";
}

async function createCheckpointViaApi(suffix) {
  const checkpoint = await apiJson("/checkpoints", {
    method: "POST",
    body: JSON.stringify({
      question: `DevTools ${suffix}: 小球离开手后还受到向上的力吗？请写一句理由。`,
      target_concept: `DevTools ${suffix}`,
      lesson_phase: "practice",
      current_activity: "whole_class",
      visibility_policy: "anonymous_representative"
    })
  });
  report.created.push({ type: "checkpoint", id: checkpoint.id, code: checkpoint.code, suffix });
  return checkpoint;
}

async function submitResponseViaApi(checkpoint, suffix, confidence = "medium") {
  const response = await apiJson(`/checkpoints/${checkpoint.id}/responses`, {
    method: "POST",
    body: JSON.stringify({
      anonymous_student_id: `DevTools-${suffix}`,
      answer_text: `DevTools ${suffix}: 物体离手后还会保留一个向上的力，所以先上升。`,
      response_source: "student_qr",
      confidence_level: confidence
    })
  });
  report.created.push({ type: "response", id: response.id, checkpointId: checkpoint.id, suffix });
  return response;
}

async function setRepresentativeViaApi(response) {
  return apiJson(`/responses/${response.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      is_representative: true,
      selection_reason: "devtools_flow",
      selected_by_role: "teacher"
    })
  });
}

async function exerciseTeacherAction(page, action) {
  const label = actionLabels[action];
  const checkpoint = await createCheckpointViaApi(`action-${action}`);
  const response = await submitResponseViaApi(checkpoint, `action-${action}`, "low");
  await setRepresentativeViaApi(response);

  await page.goto(`${app}/teacher/checkpoints/${checkpoint.id}`, { waitUntil: "domcontentloaded" });
  await page.getByText(response.answer_text).waitFor({ timeout: 10000 });

  await Promise.all([
    page.waitForResponse(postResponseMatcher(`/responses/${response.id}/analyze`)),
    page.getByRole("button", { name: /分析代表回答/ }).click()
  ]);
  await page.getByText(/已返回|已读取缓存卡片/).waitFor({ timeout: 10000 });

  await page.locator("#teacher-feedback").fill(`DevTools ${label} 反馈`);
  await page.locator("#queue-note").fill(action === "delay" ? "DevTools 稍后处理 队列备注" : `DevTools ${label} 备注`);
  if (action === "edit") {
    await page.locator("#final-turn").fill("DevTools 编辑后的教师话术：你能用受力分析说明离手后有哪些力吗？");
  }

  await Promise.all([
    page.waitForResponse(postResponseMatcher("/teacher-actions")),
    page.getByRole("button", { name: new RegExp(`^${escapeRegExp(label)}$`) }).click()
  ]);
  await page
    .getByText(action === "delay" ? /已加入待处理队列/ : new RegExp(`已记录 ${escapeRegExp(label)}`))
    .waitFor({ timeout: 10000 });

  if (action === "delay") {
    await page.getByText("备注：DevTools 稍后处理 队列备注", { exact: true }).waitFor({ timeout: 10000 });
  }

  await screenshot(page, `devtools-flow-action-${action}.png`);
  return { checkpoint, response };
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  let page;

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1050 },
      ignoreHTTPSErrors: true
    });
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: app });
    page = await context.newPage();

    page.on("console", (message) => {
      if (message.type() === "error") {
        report.consoleErrors.push({
          text: message.text(),
          location: message.location()
        });
      }
    });
    page.on("pageerror", (error) => {
      report.pageErrors.push(error.stack ?? error.message);
    });
    page.on("requestfailed", (request) => {
      report.requestFailures.push({
        url: request.url(),
        method: request.method(),
        failure: request.failure()?.errorText ?? "unknown"
      });
    });
    page.on("response", (response) => {
      const status = response.status();
      if (status >= 400 && !isIgnoredHttpError(response.url())) {
        report.httpErrors.push({
          url: response.url(),
          status,
          method: response.request().method()
        });
      }
    });

    const cdp = await context.newCDPSession(page);
    await cdp.send("Runtime.enable");
    await cdp.send("Network.enable");
    cdp.on("Runtime.exceptionThrown", (event) => {
      report.cdpExceptions.push(event.exceptionDetails);
    });
    cdp.on("Network.loadingFailed", (event) => {
      if (event.canceled) {
        return;
      }
      report.cdpNetworkFailures.push(event);
    });

    await step("API health and template contract", async () => {
      const [templates, dictionary] = await Promise.all([
        apiJson("/checkpoint-templates"),
        apiJson("/research/data-dictionary")
      ]);
      assert.ok(templates.length >= 3, "checkpoint templates should be available");
      assert.ok(dictionary.some((field) => field.name === "confidence_level"), "data dictionary lacks confidence_level");
      assert.ok(dictionary.some((field) => field.name === "queue_state"), "data dictionary lacks queue_state");
    });

    const uiCheckpoint = await step("Teacher creates checkpoint from template", async () => {
      const templates = await apiJson("/checkpoint-templates");
      const template = templates.find((item) => item.id === "free-fall-weight");
      assert.ok(template, "free-fall-weight template not found");

      await page.goto(`${app}/teacher`, { waitUntil: "domcontentloaded" });
      await page.getByText("新建 checkpoint").waitFor({ timeout: 10000 });
      await selectByText(page, page.locator("form [data-slot='select-trigger']").first(), template.title);
      assert.equal(await page.locator('textarea[name="question"]').inputValue(), template.question);
      assert.equal(await page.locator('input[name="target_concept"]').inputValue(), template.target_concept);

      const [createdResponse] = await Promise.all([
        page.waitForResponse(postResponseMatcher("/checkpoints")),
        page.getByRole("button", { name: /^创建$/ }).click()
      ]);
      const checkpoint = await createdResponse.json();
      report.created.push({ type: "checkpoint", id: checkpoint.id, code: checkpoint.code, source: "teacher-ui" });
      await page.getByText(`码 ${checkpoint.code}`).waitFor({ timeout: 10000 });
      await screenshot(page, "devtools-flow-01-template-create.png");
      return checkpoint;
    });

    await step("Teacher copies student link", async () => {
      await page.goto(`${app}/teacher/checkpoints/${uiCheckpoint.id}`, { waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: /复制链接/ }).click();
      await page.getByText(/已复制学生入口链接|学生入口：http/).waitFor({ timeout: 10000 });
      await screenshot(page, "devtools-flow-02-copy-link.png");
    });

    const updatedAnswer = await step("Student submits and revises response with confidence", async () => {
      const firstAnswer = "DevTools 学生初稿：铁球更重，所以应该先落地。";
      const nextAnswer = "DevTools 学生修订：如果忽略空气阻力，铁球和木球应同时落地，但我还不确定证据。";

      await page.goto(`${app}/s/${uiCheckpoint.code}`, { waitUntil: "domcontentloaded" });
      await page.locator('input[name="anonymous_student_id"]').fill("DevTools-main-student");
      await page.locator('textarea[name="answer_text"]').fill(firstAnswer);
      await selectByText(page, page.locator("form [data-slot='select-trigger']").first(), "很有把握");

      const [createdResponse] = await Promise.all([
        page.waitForResponse(postResponseMatcher(`/checkpoints/${uiCheckpoint.id}/responses`)),
        page.getByRole("button", { name: /^提交$/ }).click()
      ]);
      const created = await createdResponse.json();
      report.created.push({ type: "response", id: created.id, checkpointId: uiCheckpoint.id, source: "student-ui" });
      await page.getByText("已提交").waitFor({ timeout: 10000 });

      await page.getByRole("button", { name: "继续修改" }).click();
      await page.locator('textarea[name="answer_text"]').fill(nextAnswer);
      await selectByText(page, page.locator("form [data-slot='select-trigger']").first(), "有些把握");

      const [updatedResponse] = await Promise.all([
        page.waitForResponse(patchResponseMatcher(`/responses/${created.id}`)),
        page.getByRole("button", { name: /^更新回答$/ }).click()
      ]);
      const updated = await updatedResponse.json();
      assert.equal(updated.revision, 2);
      assert.equal(updated.confidence_level, "medium");
      await page.getByText("已更新").waitFor({ timeout: 10000 });
      await screenshot(page, "devtools-flow-03-student-submit-update.png");
      return nextAnswer;
    });

    await step("Teacher closes and reopens checkpoint; student sees closed state", async () => {
      await page.goto(`${app}/teacher/checkpoints/${uiCheckpoint.id}`, { waitUntil: "domcontentloaded" });
      await Promise.all([
        page.waitForResponse(patchResponseMatcher(`/checkpoints/${uiCheckpoint.id}`)),
        page.getByRole("button", { name: /^关闭提交$/ }).click()
      ]);
      await page.getByText("checkpoint 已关闭，学生端不能继续提交").waitFor({ timeout: 10000 });

      await page.goto(`${app}/s/${uiCheckpoint.code}`, { waitUntil: "domcontentloaded" });
      await page.getByText("本次 checkpoint 已关闭，请回到课堂讨论。").waitFor({ timeout: 10000 });
      await screenshot(page, "devtools-flow-04-student-closed.png");

      await page.goto(`${app}/teacher/checkpoints/${uiCheckpoint.id}`, { waitUntil: "domcontentloaded" });
      await Promise.all([
        page.waitForResponse(patchResponseMatcher(`/checkpoints/${uiCheckpoint.id}`)),
        page.getByRole("button", { name: /^重新开启$/ }).click()
      ]);
      await page.getByText("checkpoint 已重新开启").waitFor({ timeout: 10000 });
    });

    await step("Teacher selects representative and runs analysis", async () => {
      await page.goto(`${app}/teacher/checkpoints/${uiCheckpoint.id}`, { waitUntil: "domcontentloaded" });
      await page.getByText(updatedAnswer).waitFor({ timeout: 10000 });

      const responseCard = page.locator('[data-slot="card"]').filter({ hasText: updatedAnswer }).first();
      await responseCard.getByRole("button", { name: /^设为代表$/ }).click();
      await page.getByText("已设为代表回答").waitFor({ timeout: 10000 });

      await Promise.all([
        page.waitForResponse((response) => response.url().includes("/analyze") && response.request().method() === "POST"),
        page.getByRole("button", { name: /分析代表回答/ }).click()
      ]);
      await page.getByText(/已返回|已读取缓存卡片/).waitFor({ timeout: 10000 });
      await page.locator("#teacher-feedback").fill("DevTools 主流程反馈：先让学生说明忽略空气阻力的条件。");
      await page.locator("#queue-note").fill("DevTools 主流程备注");
      await screenshot(page, "devtools-flow-05-teacher-analysis.png");

      const logs = await apiJson(`/research/episode-logs?checkpoint_id=${uiCheckpoint.id}&limit=20`);
      assert.ok(logs.some((log) => log.response_revision === 2), "analysis log should keep response revision");
      assert.ok(logs.some((log) => log.confidence_level === "medium"), "analysis log should keep confidence level");
    });

    await step("Teacher action use", async () => {
      await exerciseTeacherAction(page, "use");
    });

    await step("Teacher action edit", async () => {
      await exerciseTeacherAction(page, "edit");
    });

    await step("Teacher action delay", async () => {
      await exerciseTeacherAction(page, "delay");
    });

    await step("Teacher action skip", async () => {
      await exerciseTeacherAction(page, "skip");
    });

    await step("Research filters, CSV de-identification, data dictionary", async () => {
      await page.goto(`${app}/research`, { waitUntil: "domcontentloaded" });
      await page.getByText("研究日志").waitFor({ timeout: 10000 });

      await Promise.all([
        page.waitForResponse((response) =>
          response.url().includes("/research/episode-logs") &&
          response.url().includes("queue_state=queued") &&
          response.request().method() === "GET"
        ),
        selectByText(page, page.locator('[data-slot="select-trigger"]').nth(3), "待处理")
      ]);
      await page.getByText("DevTools 稍后处理 队列备注").first().waitFor({ timeout: 10000 });
      await page.getByText("confidence_level").first().waitFor({ timeout: 10000 });
      await page.getByText("queue_state").first().waitFor({ timeout: 10000 });
      await screenshot(page, "devtools-flow-10-research-filter-dictionary.png");

      const queuedLogs = await apiJson("/research/episode-logs?queue_state=queued&limit=200");
      const targetQueuedLog = queuedLogs.find((log) => log.queue_note === "DevTools 稍后处理 队列备注");
      assert.ok(targetQueuedLog, "queued delay log not found");

      const csv = await apiText("/research/episode-logs.csv?queue_state=queued&deidentify=true");
      assert.ok(csv.includes("confidence_level"), "CSV should include confidence_level");
      assert.ok(csv.includes("queue_state"), "CSV should include queue_state");
      assert.ok(csv.includes("id_"), "CSV should include hashed identifiers");
      assert.ok(!csv.includes(targetQueuedLog.checkpoint_id), "CSV should not expose raw checkpoint_id");
      assert.ok(!csv.includes(targetQueuedLog.response_id), "CSV should not expose raw response_id");
      if (targetQueuedLog.card_id) {
        assert.ok(!csv.includes(targetQueuedLog.card_id), "CSV should not expose raw card_id");
      }
    });

    await step("DevTools diagnostics are clean", async () => {
      assert.deepEqual(report.consoleErrors, []);
      assert.deepEqual(report.pageErrors, []);
      assert.deepEqual(report.requestFailures, []);
      assert.deepEqual(report.httpErrors, []);
      assert.deepEqual(report.cdpExceptions, []);
      assert.deepEqual(report.cdpNetworkFailures, []);
    });

    writeReport(true);
    console.log(JSON.stringify({ ok: true, reportPath, screenshots: report.screenshots }, null, 2));
  } catch (error) {
    if (page) {
      try {
        await screenshot(page, "devtools-flow-failure.png");
      } catch {
        // Keep the original failure visible.
      }
    }
    writeReport(false);
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
