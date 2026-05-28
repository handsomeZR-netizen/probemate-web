"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { ArrowLeftIcon, BrainIcon, PulseIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  clearDemoData,
  getSystemStatus,
  resetDemoData,
  runAIProviderSmokeTest,
  updateSystemMode
} from "@/lib/api";
import { cn } from "@/lib/utils";
import type { AIProviderSmokeTestResult, AppMode, SystemStatus } from "@/lib/types";

const defaultSmoke = {
  question: "汽车向前运动，但速度越来越小，它的加速度方向是什么？",
  answer_text: "向前，因为车还在往前走。",
  target_concept: "加速度方向"
};

export default function AISettingsPage() {
  const t = useTranslations("AISettings");
  const common = useTranslations("Common");
  const labelT = useTranslations("Labels.moves");
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [smokeResult, setSmokeResult] = useState<AIProviderSmokeTestResult | null>(null);
  const [runningSmoke, setRunningSmoke] = useState(false);
  const [adminBusy, setAdminBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await getSystemStatus());
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t("statusLoadFailed"));
    }
  }, [t]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function submitSmoke(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setRunningSmoke(true);
    setMessage(null);
    try {
      const result = await runAIProviderSmokeTest({
        question: String(form.get("question") || defaultSmoke.question),
        answer_text: String(form.get("answer_text") || defaultSmoke.answer_text),
        target_concept: String(form.get("target_concept") || defaultSmoke.target_concept),
        lesson_phase: "practice",
        current_activity: "whole_class"
      });
      setSmokeResult(result);
      await loadStatus();
      setMessage(t("smokeReturned", { move: labelT(result.gate_decision.move), latency: result.latency_ms }));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t("smokeFailed"));
    } finally {
      setRunningSmoke(false);
    }
  }

  async function changeMode(appMode: AppMode) {
    setAdminBusy(true);
    setMessage(null);
    try {
      const nextStatus = await updateSystemMode(appMode);
      setStatus(nextStatus);
      setMessage(t("modeSwitched", { mode: nextStatus.app_mode }));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t("modeFailed"));
    } finally {
      setAdminBusy(false);
    }
  }

  async function resetDemo() {
    setAdminBusy(true);
    setMessage(null);
    try {
      const result = await resetDemoData();
      await loadStatus();
      setMessage(t("importedDemo", { checkpoints: result.checkpoints, responses: result.responses, logs: result.episode_logs }));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t("resetFailed"));
    } finally {
      setAdminBusy(false);
    }
  }

  async function clearDemo() {
    setAdminBusy(true);
    setMessage(null);
    try {
      const result = await clearDemoData();
      await loadStatus();
      setMessage(t("clearedData", { checkpoints: result.checkpoints, logs: result.episode_logs }));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t("clearFailed"));
    } finally {
      setAdminBusy(false);
    }
  }

  return (
    <AppShell
      breadcrumbs={[
        { label: common("home"), href: "/" },
        { label: common("systemSettings") },
        { label: "AI" }
      ]}
      className="max-w-6xl"
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className={cn(buttonVariants({ variant: "ghost" }), "text-muted-foreground")}>
          <ArrowLeftIcon data-icon="inline-start" className="size-4" weight="bold" />
          {common("backHome")}
        </Link>
        <Button type="button" variant="outline" onClick={() => void loadStatus()}>
          <PulseIcon data-icon="inline-start" className="size-4" weight="duotone" />
          {common("refreshStatus")}
        </Button>
      </div>

      <header className="mb-5">
        <div className="flex flex-wrap items-center gap-2">
          <BrainIcon className="size-6 text-primary" weight="duotone" />
          <h1 className="text-2xl font-semibold text-foreground">{t("title")}</h1>
          {status ? (
            <Badge variant={status.ai_provider === "mock" ? "outline" : status.ai_configured ? "secondary" : "outline"}>
              {status.ai_provider}
              {status.model_name ? ` / ${status.model_name}` : ""}
            </Badge>
          ) : null}
        </div>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
          {t("description")}
        </p>
      </header>

      {message ? (
        <Alert className="mb-5">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}

      <section className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>{t("runtimeStatus")}</CardTitle>
            <CardDescription>{t("runtimeDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <StatusRow label={t("provider")} value={status?.ai_provider ?? common("loading")} />
            <StatusRow label={t("mode")} value={status?.app_mode ?? common("loading")} />
            <StatusRow label={t("model")} value={status?.model_name ?? t("notSet")} />
            <StatusRow label={t("configured")} value={status ? (status.ai_configured ? common("yes") : common("no")) : common("loading")} />
            <StatusRow label={t("storage")} value={status?.storage_backend ?? common("loading")} />
            <StatusRow label={t("auth")} value={status ? (status.auth_required ? common("protected") : common("open")) : common("loading")} />
            <StatusRow
              label={t("lastRun")}
              value={
                status?.last_ai_run_at
                  ? `${status.last_ai_run_provider ?? "unknown"} @ ${new Date(status.last_ai_run_at).toLocaleString()}`
                  : common("none")
              }
            />
            {status?.ai_provider === "mock" ? (
              <Alert>
                <AlertDescription>{common("mockWarning")}</AlertDescription>
              </Alert>
            ) : null}
            {status && status.ai_provider !== "mock" && !status.ai_configured ? (
              <Alert>
                <AlertDescription>{t("providerIncomplete")}</AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("smokeTitle")}</CardTitle>
            <CardDescription>{t("smokeDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitSmoke} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="question">{t("question")}</Label>
                <Textarea id="question" name="question" rows={3} defaultValue={defaultSmoke.question} />
              </div>
              <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
                <div className="space-y-2">
                  <Label htmlFor="target_concept">{t("targetConcept")}</Label>
                  <Input id="target_concept" name="target_concept" defaultValue={defaultSmoke.target_concept} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="answer_text">{t("studentAnswer")}</Label>
                  <Input id="answer_text" name="answer_text" defaultValue={defaultSmoke.answer_text} />
                </div>
              </div>
              <Button type="submit" disabled={runningSmoke}>
                <PulseIcon data-icon="inline-start" className="size-4" weight="duotone" />
                {runningSmoke ? t("running") : t("runTest")}
              </Button>
            </form>

            {smokeResult ? (
              <div className="mt-5 space-y-4 border-t pt-4">
                <div className="grid gap-2 rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground md:grid-cols-3">
                  <StatusRow label={t("provider")} value={`${smokeResult.ai_provider}${smokeResult.model_name ? ` / ${smokeResult.model_name}` : ""}`} />
                  <StatusRow label={t("latency")} value={`${smokeResult.latency_ms}ms`} />
                  <StatusRow label={t("rawLlmValid")} value={smokeResult.raw_llm_valid ? common("yes") : common("no")} />
                  <StatusRow label={t("fallbackUsed")} value={smokeResult.fallback_used ? common("yes") : common("no")} />
                  <StatusRow label="Quote audit" value={smokeResult.quote_audit_passed ? common("passed") : common("blocked")} />
                  <StatusRow label={t("configured")} value={smokeResult.configured ? common("yes") : common("no")} />
                </div>
                <div className="rounded-md border p-4">
                  <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Gate decision</p>
                  <p className="mt-2 text-xl font-semibold text-foreground">
                    {labelT(smokeResult.gate_decision.move)}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {smokeResult.gate_decision.teacher_move}
                  </p>
                </div>
                {smokeResult.validation_error || smokeResult.provider_error ? (
                  <Alert>
                    <AlertDescription>
                      {smokeResult.validation_error
                        ? `${t("validation")}: ${smokeResult.validation_error}`
                        : `${t("provider")}: ${smokeResult.provider_error}`}
                    </AlertDescription>
                  </Alert>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("modeTitle")}</CardTitle>
            <CardDescription>{t("modeDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">{t("runMode")}</p>
              <div className="flex flex-wrap gap-2">
                {(["demo", "research", "classroom_pilot"] as AppMode[]).map((mode) => (
                  <Button
                    key={mode}
                    type="button"
                    variant={status?.app_mode === mode ? "secondary" : "outline"}
                    disabled={adminBusy}
                    onClick={() => void changeMode(mode)}
                  >
                    {mode}
                  </Button>
                ))}
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                {t("modeHelp")}
              </p>
            </div>
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">{t("demoStore")}</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" disabled={adminBusy} onClick={() => void resetDemo()}>
                  {t("resetDemo")}
                </Button>
                <Button type="button" variant="destructive" disabled={adminBusy} onClick={() => void clearDemo()}>
                  {t("clearDemo")}
                </Button>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                {t("demoHelp")}
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
