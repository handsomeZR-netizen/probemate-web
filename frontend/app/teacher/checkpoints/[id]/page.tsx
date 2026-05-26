"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeftIcon,
  ArrowSquareOutIcon,
  ArrowsClockwiseIcon,
  BrainIcon,
  ClockCounterClockwiseIcon,
  CopyIcon,
  MagnifyingGlassIcon,
  PencilSimpleIcon,
  PlayCircleIcon,
  ProhibitIcon,
  StudentIcon
} from "@phosphor-icons/react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  ApiError,
  analyzeResponse,
  createTeacherAction,
  generateExperimentalCondition,
  getAIProviderStatus,
  getCheckpoint,
  listEpisodeLogs,
  listResponses,
  rerunAnalysis,
  submitResponse,
  updateCheckpoint,
  updateResponse
} from "@/lib/api";
import { cn } from "@/lib/utils";
import type {
  AIProviderStatus,
  AnalyzeResponseResult,
  Checkpoint,
  EpisodeLog,
  ExperimentCondition,
  ExperimentalConditionResult,
  ResponseSource,
  StudentResponse,
  TeacherAction,
  TeacherCard
} from "@/lib/types";

const moveLabels: Record<string, string> = {
  hold: "Hold / 暂不进入",
  ask_for_evidence: "Ask for Evidence / 先追证据",
  diagnostic_probe: "Diagnostic Probe / 诊断探针"
};

const responseSourceLabels: Record<ResponseSource, string> = {
  student_qr: "学生扫码",
  teacher_representative: "教师代表",
  imported_episode: "导入 episode"
};
const confidenceLabels = {
  unsure: "不确定",
  low: "把握较低",
  medium: "有些把握",
  high: "很有把握"
} as const;

const phaseLabels: Record<Checkpoint["lesson_phase"], string> = {
  introduce: "刚引入",
  practice: "练习中",
  review: "复习",
  group_discussion: "小组讨论",
  experiment: "实验观察",
  wrap_up: "教师收束",
  after_class: "课后"
};

const activityLabels: Record<Checkpoint["current_activity"], string> = {
  whole_class: "全班讨论",
  peer_discussion: "同伴讨论",
  demo: "演示",
  worksheet: "练习单",
  experiment_observation: "实验观察",
  teacher_wrap_up: "教师收束"
};

const statusLabels: Record<Checkpoint["status"], string> = {
  open: "收集中",
  closed: "已关闭"
};

const actionLabels: Record<TeacherAction, { label: string; icon: ReactNode }> = {
  use: { label: "采用", icon: <PlayCircleIcon data-icon="inline-start" className="size-4" weight="duotone" /> },
  edit: { label: "编辑后采用", icon: <PencilSimpleIcon data-icon="inline-start" className="size-4" weight="duotone" /> },
  delay: {
    label: "稍后处理",
    icon: <ClockCounterClockwiseIcon data-icon="inline-start" className="size-4" weight="duotone" />
  },
  skip: { label: "跳过", icon: <ProhibitIcon data-icon="inline-start" className="size-4" weight="duotone" /> }
};
const conditionLabels: Record<ExperimentCondition, string> = {
  no_ai: "No AI",
  standard_llm: "Standard LLM",
  over_committed: "Over-committed",
  evidence_only: "Evidence-only",
  probemate: "ProbeMate"
};
const experimentalConditions: ExperimentCondition[] = [
  "no_ai",
  "standard_llm",
  "over_committed",
  "evidence_only",
  "probemate"
];

export default function TeacherCheckpointPage() {
  const params = useParams<{ id: string }>();
  const checkpointId = String(params.id ?? "");
  const [checkpoint, setCheckpoint] = useState<Checkpoint | null>(null);
  const [providerStatus, setProviderStatus] = useState<AIProviderStatus | null>(null);
  const [responses, setResponses] = useState<StudentResponse[]>([]);
  const [queueLogs, setQueueLogs] = useState<EpisodeLog[]>([]);
  const [analysis, setAnalysis] = useState<AnalyzeResponseResult | null>(null);
  const [selectedResponseId, setSelectedResponseId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [submittingRepresentative, setSubmittingRepresentative] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [savingAction, setSavingAction] = useState<TeacherAction | null>(null);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [markingResponseId, setMarkingResponseId] = useState<string | null>(null);
  const [conditionResults, setConditionResults] = useState<ExperimentalConditionResult[]>([]);
  const [generatingCondition, setGeneratingCondition] = useState<ExperimentCondition | null>(null);

  const representativeResponse = useMemo(
    () => responses.find((response) => response.is_representative) ?? null,
    [responses]
  );
  const selectedResponse = useMemo(
    () => responses.find((response) => response.id === selectedResponseId) ?? representativeResponse,
    [representativeResponse, responses, selectedResponseId]
  );
  const studentLink =
    typeof window === "undefined" || checkpoint === null ? "" : `${window.location.origin}/s/${checkpoint.code}`;

  const load = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }
    try {
      const [nextCheckpoint, nextResponses, nextQueueLogs, nextProviderStatus] = await Promise.all([
        getCheckpoint(checkpointId),
        listResponses(checkpointId),
        listEpisodeLogs({ checkpoint_id: checkpointId, queue_state: "queued", limit: 20 }),
        getAIProviderStatus()
      ]);
      setCheckpoint(nextCheckpoint);
      setResponses(nextResponses);
      setQueueLogs(nextQueueLogs);
      setProviderStatus(nextProviderStatus);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "加载失败");
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [checkpointId]);

  useEffect(() => {
    if (checkpointId) {
      void load();
      const timer = window.setInterval(() => {
        void load(true);
      }, 5000);
      return () => window.clearInterval(timer);
    }
    return undefined;
  }, [checkpointId, load]);

  useEffect(() => {
    if (analysis && selectedResponse && analysis.card.response_id !== selectedResponse.id) {
      setAnalysis(null);
    }
  }, [analysis, selectedResponse]);

  async function onRepresentativeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setMessage(null);
    setSubmittingRepresentative(true);
    try {
      const response = await submitResponse(checkpointId, {
        anonymous_student_id: String(form.get("anonymous_student_id") || "T-rep"),
        answer_text: String(form.get("answer_text")),
        response_source: "teacher_representative"
      });
      setSelectedResponseId(response.id);
      setAnalysis(null);
      formElement.reset();
      await load(true);
      setMessage("已加入教师代表回答");
    } catch (err) {
      setMessage(
        err instanceof ApiError && err.status === 409
          ? "checkpoint 已关闭，不能继续加入回答。"
          : "加入回答失败，请重试。"
      );
    } finally {
      setSubmittingRepresentative(false);
    }
  }

  async function runAnalysis(forceRerun = false) {
    if (!selectedResponse) {
      setMessage("请先选择并设定一条代表回答。");
      return;
    }
    if (!selectedResponse.is_representative) {
      setMessage("请先把当前短答设为代表回答，再运行诊断闸门。");
      return;
    }
    setMessage("分析中...");
    setAnalyzing(true);
    try {
      const result = forceRerun
        ? await rerunAnalysis(selectedResponse.id)
        : await analyzeResponse(selectedResponse.id);
      setAnalysis(result);
      setMessage(
        result.cached
          ? `已读取缓存卡片：${moveLabels[result.card.gate_decision.move]}`
          : `已返回 ${moveLabels[result.card.gate_decision.move]}，耗时 ${result.latency_ms}ms`
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "分析失败，请重试。");
    } finally {
      setAnalyzing(false);
    }
  }

  async function generateCondition(condition: ExperimentCondition) {
    if (!selectedResponse) {
      setMessage("请先选择一条回答。");
      return;
    }
    setGeneratingCondition(condition);
    setMessage(null);
    try {
      const result = await generateExperimentalCondition({
        response_id: selectedResponse.id,
        condition
      });
      setConditionResults((items) => [result, ...items.filter((item) => item.condition !== condition)]);
      await load(true);
      setMessage(`已生成 ${conditionLabels[condition]} 条件材料`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "生成实验条件失败。");
    } finally {
      setGeneratingCondition(null);
    }
  }

  async function markRepresentative(response: StudentResponse) {
    setMessage(null);
    setMarkingResponseId(response.id);
    const nextValue = !response.is_representative;
    try {
      const updated = await updateResponse(response.id, {
        is_representative: nextValue,
        selection_reason: nextValue ? "teacher_selected" : undefined,
        selected_by_role: "teacher"
      });
      setResponses((items) => items.map((item) => (item.id === updated.id ? updated : item)));
      if (nextValue) {
        setSelectedResponseId(updated.id);
        setAnalysis(null);
      }
      setMessage(nextValue ? "已设为代表回答" : "已取消代表回答");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "更新代表回答失败。");
    } finally {
      setMarkingResponseId(null);
    }
  }

  async function submitAction(
    action: TeacherAction,
    card: TeacherCard,
    finalTurn: string,
    decisionTimeMs: number,
    teacherFeedback: string,
    queueNote: string
  ) {
    const resolvedFinalTurn = action === "skip" ? "教师跳过本条建议。" : finalTurn || card.gate_decision.teacher_move;
    setSavingAction(action);
    setMessage(null);
    try {
      await createTeacherAction({
        card_id: card.id,
        action,
        final_turn: resolvedFinalTurn,
        edited_text: action === "edit" ? resolvedFinalTurn : undefined,
        decision_time_ms: decisionTimeMs,
        teacher_feedback: teacherFeedback || undefined,
        queue_note: queueNote || undefined
      });
      setMessage(
        action === "delay"
          ? `已加入待处理队列，决策用时 ${Math.round(decisionTimeMs / 1000)} 秒`
          : `已记录 ${actionLabels[action].label}，决策用时 ${Math.round(decisionTimeMs / 1000)} 秒`
      );
      await load(true);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "记录教师动作失败。");
    } finally {
      setSavingAction(null);
    }
  }

  async function toggleCheckpointStatus() {
    if (!checkpoint) {
      return;
    }
    const nextStatus = checkpoint.status === "open" ? "closed" : "open";
    setTogglingStatus(true);
    setMessage(null);
    try {
      const updated = await updateCheckpoint(checkpoint.id, { status: nextStatus });
      setCheckpoint(updated);
      setMessage(nextStatus === "open" ? "checkpoint 已重新开启" : "checkpoint 已关闭，学生端不能继续提交");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "更新 checkpoint 状态失败。");
    } finally {
      setTogglingStatus(false);
    }
  }

  async function copyStudentLink() {
    if (!studentLink) {
      return;
    }
    try {
      await navigator.clipboard.writeText(studentLink);
      setMessage("已复制学生入口链接");
    } catch {
      setMessage(`学生入口：${studentLink}`);
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/teacher"
          className={cn(buttonVariants({ variant: "ghost" }), "text-muted-foreground hover:text-foreground")}
        >
          <ArrowLeftIcon data-icon="inline-start" className="size-4" weight="bold" />
          返回教师端
        </Link>
        <Button onClick={() => void load()} variant="outline">
          <ArrowsClockwiseIcon data-icon="inline-start" className="size-4" weight="bold" />
          刷新
        </Button>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">加载中...</p> : null}
      {checkpoint ? (
        <>
          <Card className="mb-6">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <Badge variant="outline">{checkpoint.target_concept}</Badge>
                  {providerStatus ? (
                    <Badge variant={providerStatus.configured ? "secondary" : "outline"} className="ml-2">
                      AI {providerStatus.ai_provider}
                      {providerStatus.model_name ? ` / ${providerStatus.model_name}` : ""}
                      {providerStatus.configured ? "" : " / 未配置"}
                    </Badge>
                  ) : null}
                  <CardTitle className="mt-3 max-w-3xl text-2xl leading-9">{checkpoint.question}</CardTitle>
                  <CardDescription className="mt-2">
                    {phaseLabels[checkpoint.lesson_phase]} / {activityLabels[checkpoint.current_activity]}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/s/${checkpoint.code}`} className={buttonVariants({ variant: "default" })}>
                    学生入口 {checkpoint.code}
                    <ArrowSquareOutIcon data-icon="inline-end" className="size-4" weight="bold" />
                  </Link>
                  <Button onClick={() => void copyStudentLink()} variant="outline">
                    <CopyIcon data-icon="inline-start" className="size-4" weight="bold" />
                    复制链接
                  </Button>
                  <Button onClick={toggleCheckpointStatus} variant="outline" disabled={togglingStatus}>
                    {togglingStatus ? "更新中..." : checkpoint.status === "open" ? "关闭提交" : "重新开启"}
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>

          <section className="grid items-start gap-5 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_420px]">
            <Card>
              <CardHeader>
                <CardTitle>教师代表输入</CardTitle>
                <CardDescription>用于快速录入课堂中观察到的典型短答。</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={onRepresentativeSubmit} className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="anonymous_student_id">匿名编号</Label>
                    <Input id="anonymous_student_id" name="anonymous_student_id" placeholder="T-rep" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="answer_text">代表性学生短答</Label>
                    <Textarea id="answer_text" name="answer_text" required rows={5} placeholder="输入 1 条短答" />
                  </div>
                  <Button
                    type="submit"
                    disabled={checkpoint.status === "closed" || submittingRepresentative}
                    className="w-full"
                  >
                    {checkpoint.status === "closed"
                      ? "checkpoint 已关闭"
                      : submittingRepresentative
                        ? "加入中..."
                        : "加入回答列表"}
                  </Button>
                </form>
                {message ? (
                  <Alert className="mt-4">
                    <AlertDescription>{message}</AlertDescription>
                  </Alert>
                ) : null}
                <QueuePanel logs={queueLogs} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle>学生短答</CardTitle>
                    <CardDescription>选择一条代表回答进入诊断闸门。</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={checkpoint.status === "open" ? "default" : "secondary"}>
                      {statusLabels[checkpoint.status]}
                    </Badge>
                    <Badge variant="outline">{responses.length} 条</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  {responses.length === 0 ? (
                    <Alert>
                      <StudentIcon className="size-4" weight="duotone" />
                      <AlertDescription>等待学生提交，或在左侧录入一条教师代表回答。</AlertDescription>
                    </Alert>
                  ) : null}
                  {responses.map((response) => (
                    <Card
                      key={response.id}
                      size="sm"
                      className={cn(
                        "transition hover:border-primary/40 hover:bg-muted/40",
                        selectedResponse?.id === response.id ? "border-primary/50 bg-muted/60" : ""
                      )}
                    >
                      <CardContent className="space-y-2">
                        <div className="mb-1 flex justify-between gap-3 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <StudentIcon className="size-3.5" weight="duotone" />
                            {response.anonymous_student_id}
                          </span>
                          <span>{new Date(response.submitted_at).toLocaleTimeString()}</span>
                        </div>
                        <p className="leading-6 text-foreground">{response.answer_text}</p>
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline">{responseSourceLabels[response.response_source]}</Badge>
                            {response.confidence_level ? (
                              <Badge variant="secondary">{confidenceLabels[response.confidence_level]}</Badge>
                            ) : null}
                            {response.is_representative ? <Badge>代表</Badge> : null}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant={selectedResponse?.id === response.id ? "secondary" : "outline"}
                              onClick={() => setSelectedResponseId(response.id)}
                            >
                              {selectedResponse?.id === response.id ? "已选择" : "选择"}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={response.is_representative ? "secondary" : "outline"}
                              disabled={markingResponseId === response.id}
                              onClick={() => void markRepresentative(response)}
                            >
                              {markingResponseId === response.id
                                ? "更新中..."
                                : response.is_representative
                                  ? "取消代表"
                                  : "设为代表"}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button onClick={() => void runAnalysis(false)} disabled={!selectedResponse || !selectedResponse.is_representative || analyzing}>
                    <BrainIcon data-icon="inline-start" className="size-4" weight="duotone" />
                    {analyzing ? "分析中..." : "分析代表回答"}
                  </Button>
                  <Button
                    onClick={() => void runAnalysis(true)}
                    disabled={!selectedResponse || !selectedResponse.is_representative || analyzing}
                    variant="outline"
                  >
                    <ArrowsClockwiseIcon data-icon="inline-start" className="size-4" weight="bold" />
                    重新分析
                  </Button>
                </div>
                {selectedResponse && !selectedResponse.is_representative ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    当前选中的是普通回答。先设为代表，系统才会进入诊断闸门并写入选择记录。
                  </p>
                ) : null}
                {selectedResponse ? (
                  <ExperimentalConditionPanel
                    results={conditionResults}
                    generatingCondition={generatingCondition}
                    onGenerate={generateCondition}
                  />
                ) : null}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2 xl:col-span-1">
              <CardHeader>
                <CardTitle>ProbeMate 卡片</CardTitle>
                <CardDescription>Hold / Ask / Probe 的教师可执行建议。</CardDescription>
              </CardHeader>
              <CardContent>
                {analysis ? (
                  <TeacherCardPanel analysis={analysis} onAction={submitAction} savingAction={savingAction} />
                ) : (
                  <EmptyCard />
                )}
              </CardContent>
            </Card>
          </section>
        </>
      ) : null}
    </main>
  );
}

function ExperimentalConditionPanel({
  results,
  generatingCondition,
  onGenerate
}: {
  results: ExperimentalConditionResult[];
  generatingCondition: ExperimentCondition | null;
  onGenerate: (condition: ExperimentCondition) => Promise<void>;
}) {
  return (
    <div className="mt-5 space-y-3 border-t pt-4">
      <div className="flex flex-wrap gap-2">
        {experimentalConditions.map((condition) => (
          <Button
            key={condition}
            type="button"
            size="sm"
            variant="outline"
            disabled={generatingCondition !== null}
            onClick={() => void onGenerate(condition)}
          >
            {generatingCondition === condition ? "生成中..." : conditionLabels[condition]}
          </Button>
        ))}
      </div>
      {results.length > 0 ? (
        <div className="grid gap-2">
          {results.map((result) => (
            <Card key={result.condition} size="sm" className="bg-muted/30">
              <CardContent className="space-y-1 text-sm leading-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{conditionLabels[result.condition]}</Badge>
                  {result.move ? <Badge variant="outline">{moveLabels[result.move]}</Badge> : null}
                  <span className="text-xs text-muted-foreground">{result.ai_provider}</span>
                </div>
                <p className="text-muted-foreground">{result.teacher_card}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function EmptyCard() {
  return (
    <Alert>
      <MagnifyingGlassIcon className="size-4" weight="duotone" />
      <AlertDescription>选择一条代表回答并运行分析后，这里会显示下一步教师动作。</AlertDescription>
    </Alert>
  );
}

function QueuePanel({ logs }: { logs: EpisodeLog[] }) {
  return (
    <div className="mt-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">待处理队列</p>
        <Badge variant="outline">{logs.length} 条</Badge>
      </div>
      {logs.length === 0 ? (
        <p className="text-sm leading-6 text-muted-foreground">暂无 Hold 或 Delay 项。</p>
      ) : (
        <div className="space-y-2">
          {logs.slice(0, 3).map((log) => (
            <Card key={log.id} size="sm" className="bg-muted/30">
              <CardContent className="space-y-1 text-sm leading-6">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="secondary">{log.system_move ? moveLabels[log.system_move] : "待处理"}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {log.decision_time_ms === null ? "" : `${Math.round(log.decision_time_ms / 1000)}s`}
                  </span>
                </div>
                <p className="line-clamp-2 text-muted-foreground">{log.student_answer}</p>
                {log.queue_note ? <p className="text-xs text-muted-foreground">备注：{log.queue_note}</p> : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function TeacherCardPanel({
  analysis,
  onAction,
  savingAction
}: {
  analysis: AnalyzeResponseResult;
  onAction: (
    action: TeacherAction,
    card: TeacherCard,
    finalTurn: string,
    decisionTimeMs: number,
    teacherFeedback: string,
    queueNote: string
  ) => Promise<void>;
  savingAction: TeacherAction | null;
}) {
  const card = analysis.card;
  const decision = card.gate_decision;
  const [finalTurn, setFinalTurn] = useState(decision.teacher_move);
  const [teacherFeedback, setTeacherFeedback] = useState("");
  const [queueNote, setQueueNote] = useState("");
  const [viewedAt, setViewedAt] = useState(() => performance.now());

  useEffect(() => {
    setFinalTurn(decision.teacher_move);
    setTeacherFeedback("");
    setQueueNote("");
    setViewedAt(performance.now());
  }, [card.id, decision.teacher_move]);

  function handleAction(action: TeacherAction, eventTimeMs: number) {
    const decisionTimeMs = Math.max(0, Math.round(eventTimeMs - viewedAt));
    void onAction(action, card, finalTurn, decisionTimeMs, teacherFeedback, queueNote);
  }

  return (
    <div className="space-y-4">
      <Card size="sm" className="border-primary/30 bg-muted/40">
        <CardContent>
          <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Move</p>
          <p className="mt-1 text-lg font-semibold text-foreground">{moveLabels[decision.move]}</p>
        </CardContent>
      </Card>
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Why this move</p>
        <p className="text-sm leading-6 text-muted-foreground">{decision.why_this_move}</p>
      </div>
      <div className="grid gap-2 rounded-md border border-border bg-background p-3 text-xs text-muted-foreground sm:grid-cols-2">
        <MetaItem label="Provider" value={`${card.ai_provider}${card.model_name ? ` / ${card.model_name}` : ""}`} />
        <MetaItem label="Latency" value={`${analysis.latency_ms}ms${analysis.cached ? " / cached" : ""}`} />
        <MetaItem label="Validation" value={card.raw_llm_valid ? "valid" : "invalid"} />
        <MetaItem label="Fallback" value={card.fallback_used ? "used" : "not used"} />
        {card.downgrade_reason ?? decision.downgrade_reason ? (
          <MetaItem label="Downgrade" value={card.downgrade_reason ?? decision.downgrade_reason ?? "-"} />
        ) : null}
        <MetaItem label="Prompt" value={card.prompt_version} />
      </div>
      {card.validation_error || card.provider_error ? (
        <Alert>
          <AlertDescription>
            {card.validation_error ? `Validation: ${card.validation_error}` : `Provider: ${card.provider_error}`}
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="final-turn">Teacher move</Label>
        <Textarea
          id="final-turn"
          rows={4}
          value={finalTurn}
          onChange={(event) => setFinalTurn(event.target.value)}
          className="leading-6"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="teacher-feedback">教师反馈 / 研究备注</Label>
        <Textarea
          id="teacher-feedback"
          rows={3}
          value={teacherFeedback}
          onChange={(event) => setTeacherFeedback(event.target.value)}
          placeholder="可记录为什么采用、如何改写，或给学生的公开反馈。"
          className="leading-6"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="queue-note">Delay / Hold 队列备注</Label>
        <Textarea
          id="queue-note"
          rows={2}
          value={queueNote}
          onChange={(event) => setQueueNote(event.target.value)}
          placeholder="例如：等小组讨论结束后回看。"
          className="leading-6"
        />
      </div>
      <Separator />
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">内部依据</p>
        {card.candidate_output.candidate_explanations.map((candidate) => (
          <Card key={candidate.label} size="sm">
            <CardContent className="space-y-2 text-sm leading-6 text-muted-foreground">
              <p className="font-medium text-foreground">{candidate.label}</p>
              <p>学生原话：{candidate.student_quotes.join(" / ")}</p>
              <p>{candidate.interpretation}</p>
              <p>缺失证据：{candidate.missing_evidence}</p>
              <p>过度诊断风险：{candidate.risk_if_overdiagnosed}</p>
            </CardContent>
          </Card>
        ))}
        {card.candidate_output.safety_notes.length > 0 ? (
          <div className="rounded-md border border-border bg-background p-3 text-sm leading-6 text-muted-foreground">
            <p className="mb-1 font-medium text-foreground">Safety notes</p>
            <p>{card.candidate_output.safety_notes.join(" / ")}</p>
          </div>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(["use", "edit", "delay", "skip"] as TeacherAction[]).map((action) => (
          <Button
            key={action}
            onClick={(event) => handleAction(action, event.timeStamp)}
            variant="outline"
            disabled={savingAction !== null}
          >
            {actionLabels[action].icon}
            {savingAction === action ? "保存中..." : actionLabels[action].label}
          </Button>
        ))}
      </div>
    </div>
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
