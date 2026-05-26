"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import {
  ArrowSquareOutIcon,
  ArrowsClockwiseIcon,
  ChalkboardTeacherIcon,
  PlusCircleIcon
} from "@phosphor-icons/react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

const phases: { value: LessonPhase; label: string }[] = [
  { value: "introduce", label: "刚引入" },
  { value: "practice", label: "练习中" },
  { value: "review", label: "复习" },
  { value: "group_discussion", label: "小组讨论" },
  { value: "experiment", label: "实验观察" },
  { value: "wrap_up", label: "教师收束" }
];

const activities: { value: CurrentActivity; label: string }[] = [
  { value: "whole_class", label: "全班讨论" },
  { value: "peer_discussion", label: "同伴讨论" },
  { value: "demo", label: "演示" },
  { value: "worksheet", label: "练习单" },
  { value: "experiment_observation", label: "实验观察" },
  { value: "teacher_wrap_up", label: "教师收束" }
];

const phaseLabels = Object.fromEntries(phases.map((phase) => [phase.value, phase.label])) as Record<
  LessonPhase,
  string
>;
const activityLabels = Object.fromEntries(activities.map((activity) => [activity.value, activity.label])) as Record<
  CurrentActivity,
  string
>;
const statusLabels: Record<Checkpoint["status"], string> = {
  open: "收集中",
  closed: "已关闭"
};
const visibilityLabels: Record<Checkpoint["visibility_policy"], string> = {
  teacher_only: "仅教师可见",
  anonymous_representative: "匿名代表可展示",
  allow_public_display: "允许课堂展示"
};

export default function TeacherPage() {
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

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setCheckpoints(await listCheckpoints());
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
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
      setError(err instanceof Error ? err.message : "创建失败，请重试。");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ChalkboardTeacherIcon className="size-6 text-primary" weight="duotone" />
            <h1 className="text-2xl font-semibold text-foreground">教师端 checkpoint</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">先创建短答入口，再进入 dashboard 运行诊断闸门。</p>
        </div>
        <Button onClick={() => void load()} variant="outline">
          <ArrowsClockwiseIcon data-icon="inline-start" className="size-4" weight="bold" />
          刷新
        </Button>
      </div>

      <section className="grid items-start gap-6 lg:grid-cols-[420px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PlusCircleIcon className="size-5 text-primary" weight="duotone" />
              新建 checkpoint
            </CardTitle>
            <CardDescription>面向全班收集一个可追问的短答入口。</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>课堂模板</Label>
                <Select value={selectedTemplateId} onValueChange={(value) => value !== null && applyTemplate(value)}>
                  <SelectTrigger className="w-full">
                    <span>
                      {templates.find((template) => template.id === selectedTemplateId)?.title ?? "自定义 checkpoint"}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">自定义 checkpoint</SelectItem>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="question">课堂问题</Label>
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
                <Label htmlFor="target_concept">目标概念</Label>
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
                <Label htmlFor="class_name">班级 / 场次</Label>
                <Input
                  id="class_name"
                  name="class_name"
                  value={className}
                  onChange={(event) => setClassName(event.target.value)}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>教学阶段</Label>
                  <Select value={lessonPhase} onValueChange={(value) => setLessonPhase(value as LessonPhase)}>
                    <SelectTrigger className="w-full">
                      <span>{phaseLabels[lessonPhase]}</span>
                    </SelectTrigger>
                    <SelectContent>
                      {phases.map((phase) => (
                        <SelectItem key={phase.value} value={phase.value}>
                          {phase.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>当前活动</Label>
                  <Select
                    value={currentActivity}
                    onValueChange={(value) => setCurrentActivity(value as CurrentActivity)}
                  >
                    <SelectTrigger className="w-full">
                      <span>{activityLabels[currentActivity]}</span>
                    </SelectTrigger>
                    <SelectContent>
                      {activities.map((activity) => (
                        <SelectItem key={activity.value} value={activity.value}>
                          {activity.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>展示策略</Label>
                <Select
                  value={visibilityPolicy}
                  onValueChange={(value) => setVisibilityPolicy(value as Checkpoint["visibility_policy"])}
                >
                  <SelectTrigger className="w-full">
                    <span>{visibilityLabels[visibilityPolicy]}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(visibilityLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={creating}>
                {creating ? "创建中..." : "创建"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>课堂列表</CardTitle>
            <CardDescription>{checkpoints.length} 个 checkpoint</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <p className="text-sm text-muted-foreground">加载中...</p> : null}
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
                            {statusLabels[checkpoint.status]}
                          </Badge>
                          <Badge variant="outline">码 {checkpoint.code}</Badge>
                          <ArrowSquareOutIcon
                            className="size-4 text-muted-foreground group-hover:text-primary"
                            weight="bold"
                          />
                        </div>
                      </div>
                      <p className="text-sm leading-6 text-muted-foreground">{checkpoint.question}</p>
                      <p className="text-xs text-muted-foreground">
                        {phaseLabels[checkpoint.lesson_phase]} / {activityLabels[checkpoint.current_activity]} /{" "}
                        {visibilityLabels[checkpoint.visibility_policy]}
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
    </main>
  );
}
