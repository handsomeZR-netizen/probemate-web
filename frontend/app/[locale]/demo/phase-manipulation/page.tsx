"use client";

import { useEffect, useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import { ArrowLeftIcon, ArrowsClockwiseIcon, GitBranchIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { runPhaseManipulation } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { CurrentActivity, LessonPhase, PhaseManipulationResult, ProviderRunMode } from "@/lib/types";

const scenarios: {
  id: string;
  labelKey: "scenarioIntro" | "scenarioPractice" | "scenarioDiscussion";
  lesson_phase: LessonPhase;
  current_activity: CurrentActivity;
}[] = [
  { id: "intro", labelKey: "scenarioIntro", lesson_phase: "introduce", current_activity: "whole_class" },
  { id: "practice", labelKey: "scenarioPractice", lesson_phase: "practice", current_activity: "whole_class" },
  { id: "discussion", labelKey: "scenarioDiscussion", lesson_phase: "practice", current_activity: "peer_discussion" }
];

export default function PhaseManipulationPage() {
  const t = useTranslations("PhaseDemo");
  const common = useTranslations("Common");
  const moveT = useTranslations("Labels.moves");
  const [activeId, setActiveId] = useState("intro");
  const [providerMode, setProviderMode] = useState<ProviderRunMode>("mock");
  const [refreshKey, setRefreshKey] = useState(0);
  const [result, setResult] = useState<PhaseManipulationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const activeScenario = useMemo(
    () => scenarios.find((scenario) => scenario.id === activeId) ?? scenarios[0],
    [activeId]
  );

  useEffect(() => {
    setLoading(true);
    setError(null);
    runPhaseManipulation({
      lesson_phase: activeScenario.lesson_phase,
      current_activity: activeScenario.current_activity,
      provider_mode: providerMode
    })
      .then(setResult)
      .catch((err) => setError(err instanceof Error ? err.message : t("loadFailed")))
      .finally(() => setLoading(false));
  }, [activeScenario, providerMode, refreshKey, t]);

  return (
    <AppShell
      breadcrumbs={[
        { label: common("home"), href: "/" },
        { label: common("phaseDemo") }
      ]}
      className="max-w-5xl"
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className={cn(buttonVariants({ variant: "ghost" }), "text-muted-foreground")}>
          <ArrowLeftIcon data-icon="inline-start" className="size-4" weight="bold" />
          {common("backHome")}
        </Link>
      </div>

      <header className="mb-5">
        <div className="flex items-center gap-2">
          <GitBranchIcon className="size-6 text-primary" weight="duotone" />
          <h1 className="text-2xl font-semibold text-foreground">{t("title")}</h1>
        </div>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{t("description")}</p>
      </header>

      <section className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>{t("provider")}</CardTitle>
              <CardDescription>{t("providerDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              {(["mock", "current"] as ProviderRunMode[]).map((mode) => (
                <Button
                  key={mode}
                  type="button"
                  variant={providerMode === mode ? "secondary" : "outline"}
                  onClick={() => setProviderMode(mode)}
                >
                  {mode === "mock" ? "Mock" : "Current"}
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("contextTitle")}</CardTitle>
              <CardDescription>{t("contextDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {scenarios.map((scenario) => (
                <Button
                  key={scenario.id}
                  type="button"
                  variant={activeId === scenario.id ? "secondary" : "outline"}
                  className="w-full justify-start"
                  onClick={() => setActiveId(scenario.id)}
                >
                  {t(scenario.labelKey)}
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>{t("gateOutput")}</CardTitle>
                <CardDescription>{t(activeScenario.labelKey)}</CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRefreshKey((value) => value + 1)}
                disabled={loading}
              >
                <ArrowsClockwiseIcon data-icon="inline-start" className="size-4" weight="bold" />
                {t("refresh")}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            {result ? (
              <div className="space-y-4">
                {result.ai_provider === "mock" ? (
                  <Alert>
                    <AlertDescription>{common("mockWarning")}</AlertDescription>
                  </Alert>
                ) : null}
                <div className="rounded-md border border-primary/30 bg-muted/40 p-4">
                  <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Move</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <p className="text-2xl font-semibold text-foreground">{moveT(result.move)}</p>
                    {result.downgrade_reason ? <Badge variant="outline">{result.downgrade_reason}</Badge> : null}
                  </div>
                </div>
                <div className="grid gap-2 rounded-md border bg-background p-3 text-xs text-muted-foreground sm:grid-cols-3">
                  <MetaItem label="Mode" value={result.provider_mode} />
                  <MetaItem label="Provider" value={`${result.ai_provider}${result.model_name ? ` / ${result.model_name}` : ""}`} />
                  <MetaItem label="Quote audit" value={result.quote_audit_passed ? common("passed") : common("blocked")} />
                  <MetaItem label="Raw LLM" value={result.raw_llm_valid ? common("valid") : common("invalid")} />
                  <MetaItem label="Fallback" value={result.fallback_used ? common("used") : common("notUsed")} />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
                    {t("teacherMove")}
                  </p>
                  <p className="text-sm leading-6 text-foreground">{result.teacher_move}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
                    {t("whyMove")}
                  </p>
                  <p className="text-sm leading-6 text-muted-foreground">{result.why_this_move}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{common("loading")}...</p>
            )}
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="font-semibold text-foreground">{label}: </span>
      <span>{value}</span>
    </div>
  );
}
