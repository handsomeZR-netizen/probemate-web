const { chromium } = require("playwright");

const appBase = process.env.PLAYWRIGHT_APP_BASE ?? "http://localhost:3000";
const localeBase = `${appBase}/zh`;
const apiBase =
  process.env.PLAYWRIGHT_API_BASE ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

async function api(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {})
    }
  });
  if (!response.ok) {
    throw new Error(`${path} failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

async function main() {
  const provider = await api("/ai/provider-status");
  if (!provider.configured) {
    throw new Error(`AI provider is not configured: ${JSON.stringify(provider)}`);
  }

  const checkpoint = await api("/checkpoints", {
    method: "POST",
    body: JSON.stringify({
      question: "汽车向前运动，但速度越来越小，它的加速度方向是什么？",
      target_concept: "加速度方向",
      lesson_phase: "introduce",
      current_activity: "whole_class",
      visibility_policy: "teacher_only"
    })
  });
  const response = await api(`/checkpoints/${checkpoint.id}/responses`, {
    method: "POST",
    body: JSON.stringify({
      answer_text: "向前，因为车还在往前走。",
      anonymous_student_id: "PW01",
      confidence_level: "low"
    })
  });
  await api(`/responses/${response.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      is_representative: true,
      selection_reason: "playwright_flow",
      selected_by_role: "test"
    })
  });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });

  try {
    await page.goto(`${localeBase}/teacher/checkpoints/${checkpoint.id}`, { waitUntil: "networkidle" });
    await page.getByText("AI: mock").first().waitFor({ timeout: 10000 });
    await page.getByText("课堂入口").waitFor({ timeout: 10000 });
    await page.getByText("建议分析的代表回答").waitFor({ timeout: 10000 });
    await page.getByRole("button", { name: "展示学生入口" }).first().click();
    await page.getByText(`课堂码 ${checkpoint.code}`).waitFor({ timeout: 10000 });
    await page.getByRole("button", { name: "关闭", exact: true }).click();
    await page.getByRole("button", { name: "读取/生成卡片" }).click();
    await page.getByText("Ask for Evidence / 先追证据", { exact: true }).waitFor({ timeout: 10000 });
    await page.getByText("Provider:").waitFor({ timeout: 10000 });
    await page.getByText("Quote audit:").waitFor({ timeout: 10000 });
    await page.getByRole("button", { name: "清除该回答缓存" }).click();
    await page.getByText("已清除该回答缓存").waitFor({ timeout: 10000 });

    await page.getByRole("button", { name: "Over-committed" }).click();
    await page.getByText("已生成 Over-committed 条件材料").waitFor({ timeout: 10000 });
    await page.getByText("学生混淆了运动方向和加速度方向").waitFor({ timeout: 10000 });

    await page.goto(`${localeBase}/demo/phase-manipulation`, { waitUntil: "networkidle" });
    await page.getByText("Ask").waitFor({ timeout: 10000 });
    await page.getByText("Provider: mock").waitFor({ timeout: 10000 });
    await page.getByRole("button", { name: "练习后" }).click();
    await page.getByText("Probe").waitFor({ timeout: 10000 });
    await page.getByRole("button", { name: "小组互评中" }).click();
    await page.getByText("Hold").waitFor({ timeout: 10000 });

    await page.goto(`${localeBase}/study-builder`, { waitUntil: "networkidle" });
    await page.getByText("Study Builder").first().waitFor({ timeout: 10000 });
    await page.waitForFunction(() => {
      return Array.from(document.querySelectorAll("button")).some((button) => {
        return button.textContent?.includes("生成五条件材料") && !button.disabled;
      });
    });
    await page.getByRole("button", { name: "生成五条件材料" }).click();
    await page.getByText("已生成").waitFor({ timeout: 10000 });
    await page.getByText("Assistant A").first().waitFor({ timeout: 10000 });
    await page.getByRole("button", { name: "materials.csv" }).waitFor({ timeout: 10000 });
    await page.getByText("Study 3 next-turn", { exact: true }).waitFor({ timeout: 10000 });
    await page.getByRole("button", { name: "开始 30 秒" }).click();
    await page.getByPlaceholder("教师下一句话").fill("请先画出此刻和下一秒的速度箭头。");
    await page.getByRole("button", { name: "记录 next-turn" }).click();
    await page.getByText(/已记录 Assistant/).waitFor({ timeout: 10000 });
    await page.getByRole("button", { name: "next-turns.csv" }).waitFor({ timeout: 10000 });

    await page.goto(`${localeBase}/settings/ai`, { waitUntil: "networkidle" });
    await page.getByText("AI Provider Settings").waitFor({ timeout: 10000 });
    await page.getByRole("button", { name: "运行 provider 测试" }).click();
    await page.getByText("Smoke test 已返回").waitFor({ timeout: 10000 });
    await page.getByText("Quote audit").first().waitFor({ timeout: 10000 });
    await page.getByRole("button", { name: "research", exact: true }).click();
    await page.getByText("Mode 已切换为 research").waitFor({ timeout: 10000 });
    await page.getByRole("button", { name: "demo", exact: true }).click();
    await page.getByText("Mode 已切换为 demo").waitFor({ timeout: 10000 });

    await page.goto(`${localeBase}/research`, { waitUntil: "networkidle" });
    await page.getByText("Over-committed").first().waitFor({ timeout: 10000 });
    await page.getByText("Fallback", { exact: true }).first().waitFor({ timeout: 10000 });
    await page.getByText("真实 LLM").first().waitFor({ timeout: 10000 });
    await page.getByRole("button", { name: "标记 over" }).first().click();
    await page.getByText("over").first().waitFor({ timeout: 10000 });
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
