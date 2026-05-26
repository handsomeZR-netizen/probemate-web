const { chromium } = require("playwright");

const appBase = process.env.PLAYWRIGHT_APP_BASE ?? "http://127.0.0.1:3000";
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
    await page.goto(`${appBase}/teacher/checkpoints/${checkpoint.id}`, { waitUntil: "networkidle" });
    await page.getByText("AI mock").waitFor({ timeout: 10000 });
    await page.getByRole("button", { name: "分析代表回答" }).click();
    await page.getByText("Ask for Evidence / 先追证据", { exact: true }).waitFor({ timeout: 10000 });
    await page.getByText("Provider:").waitFor({ timeout: 10000 });

    await page.getByRole("button", { name: "Over-committed" }).click();
    await page.getByText("已生成 Over-committed 条件材料").waitFor({ timeout: 10000 });
    await page.getByText("学生混淆了运动方向和加速度方向").waitFor({ timeout: 10000 });

    await page.goto(`${appBase}/demo/phase-manipulation`, { waitUntil: "networkidle" });
    await page.getByText("Ask").waitFor({ timeout: 10000 });
    await page.getByRole("button", { name: "练习后" }).click();
    await page.getByText("Probe").waitFor({ timeout: 10000 });
    await page.getByRole("button", { name: "小组互评中" }).click();
    await page.getByText("Hold").waitFor({ timeout: 10000 });

    await page.goto(`${appBase}/research`, { waitUntil: "networkidle" });
    await page.getByText("Over-committed").first().waitFor({ timeout: 10000 });
    await page.getByText("Fallback", { exact: true }).first().waitFor({ timeout: 10000 });
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
