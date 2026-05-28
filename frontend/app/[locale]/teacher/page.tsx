"use client";

import { Link } from "@/i18n/navigation";
import { FormEvent, useEffect, useState } from "react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import {
  ArrowLeftIcon,
  ArrowSquareOutIcon,
  ArrowsClockwiseIcon,
  ChalkboardTeacherIcon,
  PlusCircleIcon
} from "@phosphor-icons/react";

import { AppShell } from "@/components/app-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createCheckpoint, listCheckpointTemplates, listCheckpoints } from "@/lib/api";
import type { Checkpoint, CheckpointTemplate, CurrentActivity, LessonPhase } from "@/lib/types";

const phases: LessonPhase[] = ["introduce", "practice", "review", "group_discussion", "experiment", "wrap_up"];
const activities: CurrentActivity[] = [
  "whole_class",
  "peer_discussion",
  "demo",
  "worksheet",
  "experiment_observation",
  "teacher_wrap_up"
];
const visibilityPolicies: Checkpoint["visibility_policy"][] = [
  "teacher_only",
  "anonymous_representative",
  "allow_public_display"
];

export default function TeacherPage() {
  const t = useTranslations("Teacher");
  const common = useTranslations("Common");
  const phaseLabel = useTranslations("Labels.phases");
  const activityLabel = useTranslations("Labels.activities");
  const visibilityLabel = useTranslations("Labels.visibility");
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [templates, setTemplates] = useState<CheckpointTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("custom");
  const [question, setQuestion] = useState("汽车向前运动，但速度越来越小，它的加速度方向是什么？");
  const [targetConcept, setTargetConcept] = useState("加速度方向");
  const [className, setClassName] = useState("研究课 A");
  const [lessonPhase, setLessonPhase] = useState<LessonPhase>("introduce");
  const [currentActivity, setCurrentActivity] = useState<CurrentActivity>("whole_class");
  const [visibilityPolicy, setVisibilityPolicy] = useState<Checkpoint["visibility_policy"]>("teacher_only");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const openCheckpoints = checkpoints.filter((checkpoint) => checkpoint.status === "open").length;
  const closedCheckpoints = checkpoints.length - openCheckpoints;
  const latestCheckpoint = checkpoints[0] ?? null;

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setCheckpoints(await listCheckpoints());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    listCheckpointTemplates()
      .then(setTemplates)
      .catch(() => setTemplates([]));
  }, []);

  function applyTemplate(templateId: string) {
    setSelectedTemplateId(templateId);
    const template = templates.find((item) => item.id === templateId);
    if (!template) {
      return;
    }
    setQuestion(template.question);
    setTargetConcept(template.target_concept);
    setLessonPhase(template.lesson_phase);
    setCurrentActivity(template.current_activity);
    setVisibilityPolicy(template.visibility_policy);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setCreating(true);
    setError(null);
    try {
      await createCheckpoint({
        question,
        target_concept: targetConcept,
        class_name: className,
        lesson_phase: lessonPhase,
        current_activity: currentActivity,
        visibility_policy: visibilityPolicy
      });
      formElement.reset();
      setSelectedTemplateId("custom");
      setQuestion("汽车向前运动，但速度越来越小，它的加速度方向是什么？");
      setTargetConcept("加速度方向");
      setClassName("研究课 A");
      setLessonPhase("introduce");
      setCurrentActivity("whole_class");
      setVisibilityPolicy("teacher_only");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("createFailed"));
    } finally {
      setCreating(false);
    }
  }

  return (
    <AppShell
      breadcrumbs={[
        { label: common("home"), href: "/" },
        { label: common("teacher") }
      ]}
      className="max-w-6xl"
      rightActions={
        <Link href="/" className={buttonVariants({ variant: "ghost" })}>
          <ArrowLeftIcon data-icon="inline-start" className="size-4" weight="bold" />
          {common("backHome")}
        </Link>
      }
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: "linear" }}
        className="mb-8 flex flex-wrap items-center justify-between gap-4"
      >
        <div>
          <div className="flex items-center gap-2">
            <ChalkboardTeacherIcon className="size-6 text-primary" weight="duotone" />
            <h1 className="text-2xl font-semibold text-foreground">{t("liveTitle")}</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <Button onClick={() => void load()} variant="outline">
          <ArrowsClockwiseIcon data-icon="inline-start" className="size-4" weight="bold" />
          {common("refresh")}
        </Button>
      </motion.div>

      <section className="mb-6 grid gap-3 md:grid-cols-4">
        <TeacherMetric label={t("collecting")} value={String(openCheckpoints)} detail={t("openDetail")} />
        <TeacherMetric label={t("closed")} value={String(closedCheckpoints)} detail={t("closedDetail")} />
        <TeacherMetric label={t("templates")} value={String(templates.length)} detail={t("templateDetail")} />
        <TeacherMetric
          label={t("recentClass")}
          value={latestCheckpoint?.target_concept ?? "-"}
          detail={latestCheckpoint ? `${phaseLabel(latestCheckpoint.lesson_phase)} / ${latestCheckpoint.code}` : t("noCheckpoint")}
        />
      </section>

      <section className="grid items-start gap-6 lg:grid-cols-[420px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PlusCircleIcon className="size-5 text-primary" weight="duotone" />
              {t("create")}
            </CardTitle>
            <CardDescription>{t("description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>{t("template")}</Label>
                <Select value={selectedTemplateId} onValueChange={(value) => value !== null && applyTemplate(value)}>
                  <SelectTrigger className="w-full">
                    <span>
                      {templates.find((template) => template.id === selectedTemplateId)?.title ?? t("customCheckpoint")}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">{t("customCheckpoint")}</SelectItem>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="question">{t("question")}</Label>
                <Textarea
                  id="question"
                  name="question"
                  required
                  rows={4}
                  value={question}
                  onChange={(event) => {
                    setQuestion(event.target.value);
                    setSelectedTemplateId("custom");
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="target_concept">{t("targetConcept")}</Label>
                <Input
                  id="target_concept"
                  name="target_concept"
                  required
                  value={targetConcept}
                  onChange={(event) => {
                    setTargetConcept(event.target.value);
                    setSelectedTemplateId("custom");
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="class_name">{t("className")}</Label>
                <Input
                  id="class_name"
                  name="class_name"
                  value={className}
                  onChange={(event) => setClassName(event.target.value)}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("phase")}</Label>
                  <Select value={lessonPhase} onValueChange={(value) => setLessonPhase(value as LessonPhase)}>
                    <SelectTrigger className="w-full">
                      <span>{phaseLabel(lessonPhase)}</span>
                    </SelectTrigger>
                    <SelectContent>
                      {phases.map((phase) => (
                        <SelectItem key={phase} value={phase}>
                          {phaseLabel(phase)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("activity")}</Label>
                  <Select
                    value={currentActivity}
                    onValueChange={(value) => setCurrentActivity(value as CurrentActivity)}
                  >
                    <SelectTrigger className="w-full">
                      <span>{activityLabel(currentActivity)}</span>
                    </SelectTrigger>
                    <SelectContent>
                      {activities.map((activity) => (
                        <SelectItem key={activity} value={activity}>
                          {activityLabel(activity)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("visibility")}</Label>
                <Select
                  value={visibilityPolicy}
                  onValueChange={(value) => setVisibilityPolicy(value as Checkpoint["visibility_policy"])}
                >
                  <SelectTrigger className="w-full">
                    <span>{visibilityLabel(visibilityPolicy)}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {visibilityPolicies.map((value) => (
                      <SelectItem key={value} value={value}>
                        {visibilityLabel(value)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={creating}>
                {creating ? t("creating") : t("create")}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("recentTitle")}</CardTitle>
            <CardDescription>{t("checkpointCount", { count: checkpoints.length })}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <p className="text-sm text-muted-foreground">{common("loading")}...</p> : null}
            {error ? (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <div className="grid gap-3">
              {checkpoints.map((checkpoint) => (
                <Link key={checkpoint.id} href={`/teacher/checkpoints/${checkpoint.id}`} className="group block">
                  <Card size="sm" className="transition hover:border-primary/40 hover:shadow-sm">
                    <CardContent className="space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-medium text-foreground">{checkpoint.target_concept}</h3>
                        <div className="flex shrink-0 items-center gap-2">
                          <Badge variant={checkpoint.status === "open" ? "default" : "secondary"}>
                            {checkpoint.status === "open" ? t("collecting") : t("closed")}
                          </Badge>
                          <Badge variant="outline">{t("code", { code: checkpoint.code })}</Badge>
                          <ArrowSquareOutIcon
                            className="size-4 text-muted-foreground group-hover:text-primary"
                            weight="bold"
                          />
                        </div>
                      </div>
                      <p className="text-sm leading-6 text-muted-foreground">{checkpoint.question}</p>
                      <p className="text-xs text-muted-foreground">
                        {phaseLabel(checkpoint.lesson_phase)} / {activityLabel(checkpoint.current_activity)} /{" "}
                        {visibilityLabel(checkpoint.visibility_policy)}
                        {checkpoint.class_name ? ` / ${checkpoint.class_name}` : ""}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}

function TeacherMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">{label}</p>
      <p className="mt-2 truncate text-xl font-semibold text-foreground">{value}</p>
      <p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}
