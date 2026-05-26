"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon, ArrowsClockwiseIcon, GitBranchIcon } from "@phosphor-icons/react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { runPhaseManipulation } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { CurrentActivity, LessonPhase, PhaseManipulationResult } from "@/lib/types";

const scenarios: {
  id: string;
  label: string;
  lesson_phase: LessonPhase;
  current_activity: CurrentActivity;
}[] = [
  { id: "intro", label: "刚引入", lesson_phase: "introduce", current_activity: "whole_class" },
  { id: "practice", label: "练习后", lesson_phase: "practice", current_activity: "whole_class" },
  { id: "discussion", label: "小组互评中", lesson_phase: "practice", current_activity: "peer_discussion" }
];

const moveLabels = {
  hold: "Hold",
  ask_for_evidence: "Ask",
  diagnostic_probe: "Probe"
} as const;

export default function PhaseManipulationPage() {
  const [activeId, setActiveId] = useState("intro");
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
      current_activity: activeScenario.current_activity
    })
      .then(setResult)
      .catch((err) => setError(err instanceof Error ? err.message : "加载失败"))
      .finally(() => setLoading(false));
  }, [activeScenario, refreshKey]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className={cn(buttonVariants({ variant: "ghost" }), "text-muted-foreground")}>
          <ArrowLeftIcon data-icon="inline-start" className="size-4" weight="bold" />
          返回首页
        </Link>
      </div>

      <header className="mb-5">
        <div className="flex items-center gap-2">
          <GitBranchIcon className="size-6 text-primary" weight="duotone" />
          <h1 className="text-2xl font-semibold text-foreground">Phase manipulation</h1>
        </div>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
          同一句短答：向前，因为车还在往前走。
        </p>
      </header>

      <section className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>教学语境</CardTitle>
            <CardDescription>阶段和活动共同决定介入承诺。</CardDescription>
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
                {scenario.label}
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>Gate output</CardTitle>
                <CardDescription>{activeScenario.label}</CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRefreshKey((value) => value + 1)}
                disabled={loading}
              >
                <ArrowsClockwiseIcon data-icon="inline-start" className="size-4" weight="bold" />
                刷新
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
                <div className="rounded-md border border-primary/30 bg-muted/40 p-4">
                  <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Move</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <p className="text-2xl font-semibold text-foreground">{moveLabels[result.move]}</p>
                    {result.downgrade_reason ? <Badge variant="outline">{result.downgrade_reason}</Badge> : null}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
                    Teacher move
                  </p>
                  <p className="text-sm leading-6 text-foreground">{result.teacher_move}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
                    Why this move
                  </p>
                  <p className="text-sm leading-6 text-muted-foreground">{result.why_this_move}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">加载中...</p>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
