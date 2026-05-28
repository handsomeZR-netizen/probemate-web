"use client";

import { Link } from "@/i18n/navigation";
import Image from "next/image";
import type { ReactNode } from "react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import QRCode from "qrcode";
import {
  ArrowLeftIcon,
  ArrowSquareOutIcon,
  ArrowsClockwiseIcon,
  BrainIcon,
  ClockCounterClockwiseIcon,
  CopyIcon,
  ChalkboardTeacherIcon,
  MagnifyingGlassIcon,
  PencilSimpleIcon,
  PlayCircleIcon,
  ProhibitIcon,
  StudentIcon,
  TrashIcon
} from "@phosphor-icons/react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { AppShell } from "@/components/app-shell";
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
  clearAnalysisCache,
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
  StudentResponse,
  TeacherAction,
  TeacherCard
} from "@/lib/types";

const actionIcons: Record<TeacherAction, ReactNode> = {
  use: <PlayCircleIcon data-icon="inline-start" className="size-4" weight="duotone" />,
  edit: <PencilSimpleIcon data-icon="inline-start" className="size-4" weight="duotone" />,
  delay: <ClockCounterClockwiseIcon data-icon="inline-start" className="size-4" weight="duotone" />,
  skip: <ProhibitIcon data-icon="inline-start" className="size-4" weight="duotone" />
};
const experimentalConditions: ExperimentCondition[] = [
  "no_ai",
  "standard_llm",
  "over_committed",
  "evidence_only",
  "probemate"
];
const quickContexts: {
  id: string;
  lesson_phase: Checkpoint["lesson_phase"];
  current_activity: Checkpoint["current_activity"];
}[] = [
  { id: "collect", lesson_phase: "introduce", current_activity: "whole_class" },
  { id: "practice", lesson_phase: "practice", current_activity: "whole_class" },
  { id: "peer", lesson_phase: "practice", current_activity: "peer_discussion" },
  { id: "experiment", lesson_phase: "experiment", current_activity: "experiment_observation" },
  { id: "wrap", lesson_phase: "wrap_up", current_activity: "teacher_wrap_up" }
];
const responseFilters = [
  { id: "all" },
  { id: "representative" },
  { id: "unselected" },
  { id: "low_confidence" }
] as const;
type ResponseFilter = (typeof responseFilters)[number]["id"];
type ResponseCluster = {
  id: string;
  label: string;
  description: string;
  responses: StudentResponse[];
  representative: StudentResponse;
};

export default function TeacherCheckpointPage() {
  const locale = useLocale();
  const common = useTranslations("Common");
  const t = useTranslations("Checkpoint");
  const teacherT = useTranslations("Teacher");
  const moveT = useTranslations("Labels.moves");
  const sourceT = useTranslations("Labels.sources");
  const confidenceT = useTranslations("Labels.confidence");
  const phaseT = useTranslations("Labels.phases");
  const activityT = useTranslations("Labels.activities");
  const actionT = useTranslations("Labels.actions");
  const conditionT = useTranslations("Labels.conditions");
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
  const [clearingCache, setClearingCache] = useState(false);
  const [updatingContext, setUpdatingContext] = useState(false);
  const [savingAction, setSavingAction] = useState<TeacherAction | null>(null);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [markingResponseId, setMarkingResponseId] = useState<string | null>(null);
  const [conditionResults, setConditionResults] = useState<ExperimentalConditionResult[]>([]);
  const [generatingCondition, setGeneratingCondition] = useState<ExperimentCondition | null>(null);
  const [projectionOpen, setProjectionOpen] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [responseFilter, setResponseFilter] = useState<ResponseFilter>("all");
  const [responseSearch, setResponseSearch] = useState("");

  const representativeResponse = useMemo(
    () => responses.find((response) => response.is_representative) ?? null,
    [responses]
  );
  const selectedResponse = useMemo(
    () => responses.find((response) => response.id === selectedResponseId) ?? representativeResponse,
    [representativeResponse, responses, selectedResponseId]
  );
  const studentLink =
    typeof window === "undefined" || checkpoint === null ? "" : `${window.location.origin}/${locale}/s/${checkpoint.code}`;
  const responseClusters = useMemo(() => buildResponseClusters(responses), [responses]);
  const filteredResponses = useMemo(
    () =>
      responses.filter((response) => {
        const searchText = responseSearch.trim().toLowerCase();
        const matchesSearch =
          !searchText ||
          response.answer_text.toLowerCase().includes(searchText) ||
          response.anonymous_student_id.toLowerCase().includes(searchText);
        const matchesFilter =
          responseFilter === "all" ||
          (responseFilter === "representative" && response.is_representative) ||
          (responseFilter === "unselected" && !response.is_representative) ||
          (responseFilter === "low_confidence" &&
            (response.confidence_level === "low" || response.confidence_level === "unsure"));
        return matchesSearch && matchesFilter;
      }),
    [responseFilter, responseSearch, responses]
  );

  useEffect(() => {
    if (!projectionOpen || !studentLink) {
      setQrCodeDataUrl(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(studentLink, {
      width: 260,
      margin: 1,
      color: { dark: "#214e51", light: "#ffffff" }
    })
      .then((value) => {
        if (!cancelled) {
          setQrCodeDataUrl(value);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQrCodeDataUrl(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [projectionOpen, studentLink]);

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
      setMessage(err instanceof Error ? err.message : t("loadFailed"));
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [checkpointId, t]);

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
      setMessage(t("representativeAdded"));
    } catch (err) {
      setMessage(
        err instanceof ApiError && err.status === 409
          ? t("closedJoinError")
          : t("joinFailed")
      );
    } finally {
      setSubmittingRepresentative(false);
    }
  }

  async function runAnalysis(forceRerun = false) {
    if (!selectedResponse) {
      setMessage(t("selectRepresentativeFirst"));
      return;
    }
    if (!selectedResponse.is_representative) {
      setMessage(t("analysisNeedRep"));
      return;
    }
    setMessage(t("analysisRunning"));
    setAnalyzing(true);
    try {
      const result = forceRerun
        ? await rerunAnalysis(selectedResponse.id)
        : await analyzeResponse(selectedResponse.id);
      setAnalysis(result);
      setMessage(
        result.cached
          ? t("analysisCacheHit", { move: moveT(result.card.gate_decision.move) })
          : t("analysisReturned", { move: moveT(result.card.gate_decision.move), latency: result.latency_ms })
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t("analysisFailed"));
    } finally {
      setAnalyzing(false);
    }
  }

  async function clearSelectedAnalysisCache() {
    if (!selectedResponse) {
      setMessage(t("selectAnswerFirst"));
      return;
    }
    setClearingCache(true);
    setMessage(null);
    try {
      const result = await clearAnalysisCache(selectedResponse.id);
      setAnalysis(null);
      setMessage(
        result.cleared_cards > 0
          ? t("cacheCleared", { count: result.cleared_cards })
          : t("cacheEmpty")
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t("clearCacheFailed"));
    } finally {
      setClearingCache(false);
    }
  }

  async function generateCondition(condition: ExperimentCondition) {
    if (!selectedResponse) {
      setMessage(t("selectAnswerFirst"));
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
      setMessage(t("conditionGenerated", { condition: conditionT(condition) }));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t("conditionFailed"));
    } finally {
      setGeneratingCondition(null);
    }
  }

  async function markRepresentative(response: StudentResponse, forceValue?: boolean) {
    setMessage(null);
    setMarkingResponseId(response.id);
    const nextValue = forceValue ?? !response.is_representative;
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
      setMessage(nextValue ? t("representativeSet") : t("representativeUnset"));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t("representativeUpdateFailed"));
    } finally {
      setMarkingResponseId(null);
    }
  }

  async function chooseClusterRepresentative(response: StudentResponse) {
    setSelectedResponseId(response.id);
    if (!response.is_representative) {
      await markRepresentative(response, true);
    }
  }

  async function applyClassroomContext(
    lessonPhase: Checkpoint["lesson_phase"],
    currentActivity: Checkpoint["current_activity"]
  ) {
    if (!checkpoint) {
      return;
    }
    setUpdatingContext(true);
    setMessage(null);
    try {
      const updated = await updateCheckpoint(checkpoint.id, {
        lesson_phase: lessonPhase,
        current_activity: currentActivity
      });
      setCheckpoint(updated);
      setAnalysis(null);
      setMessage(t("contextSwitched", { phase: phaseT(lessonPhase), activity: activityT(currentActivity) }));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t("contextFailed"));
    } finally {
      setUpdatingContext(false);
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
    const resolvedFinalTurn = action === "skip" ? t("skipFinalTurn") : finalTurn || card.gate_decision.teacher_move;
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
          ? t("actionQueued", { seconds: Math.round(decisionTimeMs / 1000) })
          : t("actionRecorded", { action: actionT(action), seconds: Math.round(decisionTimeMs / 1000) })
      );
      await load(true);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t("actionFailed"));
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
      setMessage(nextStatus === "open" ? t("statusReopened") : t("statusClosed"));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t("statusUpdateFailed"));
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
      setMessage(t("copyDone"));
    } catch {
      setMessage(`${t("projectionTitle")}: ${studentLink}`);
    }
  }

  return (
    <AppShell
      breadcrumbs={[
        { label: common("home"), href: "/" },
        { label: common("teacher"), href: "/teacher" },
        { label: checkpoint?.target_concept ?? "Checkpoint" }
      ]}
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/teacher"
          className={cn(buttonVariants({ variant: "ghost" }), "text-muted-foreground hover:text-foreground")}
        >
          <ArrowLeftIcon data-icon="inline-start" className="size-4" weight="bold" />
          {common("backTeacher")}
        </Link>
        <Button onClick={() => void load()} variant="outline">
          <ArrowsClockwiseIcon data-icon="inline-start" className="size-4" weight="bold" />
          {common("refresh")}
        </Button>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">{common("loading")}...</p> : null}
      {checkpoint ? (
        <>
          <header className="mb-5 border-b pb-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <ChalkboardTeacherIcon className="size-6 text-primary" weight="duotone" />
                  <Badge variant="outline">{checkpoint.target_concept}</Badge>
                  <Badge variant={checkpoint.status === "open" ? "default" : "secondary"}>
                    {checkpoint.status === "open" ? teacherT("collecting") : teacherT("closed")}
                  </Badge>
                  {providerStatus ? (
                    <Badge variant={providerStatus.configured ? "secondary" : "outline"}>
                      AI {providerStatus.ai_provider}
                      {providerStatus.model_name ? ` / ${providerStatus.model_name}` : ""}
                      {providerStatus.configured ? "" : ` / ${common("unconfigured")}`}
                    </Badge>
                  ) : null}
                </div>
                <h1 className="mt-3 max-w-4xl text-2xl font-semibold leading-9 text-foreground">
                  {checkpoint.question}
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  {phaseT(checkpoint.lesson_phase)} / {activityT(checkpoint.current_activity)}
                  {checkpoint.class_name ? ` / ${checkpoint.class_name}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setProjectionOpen(true)}>
                  <StudentIcon data-icon="inline-start" className="size-4" weight="duotone" />
                  {t("showStudentEntry")}
                </Button>
                <Button onClick={toggleCheckpointStatus} variant="outline" disabled={togglingStatus}>
                  {togglingStatus ? t("updating") : checkpoint.status === "open" ? t("closeSubmit") : t("reopenSubmit")}
                </Button>
              </div>
            </div>
          </header>

          {message ? (
            <Alert className="mb-5">
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          ) : null}

          <section className="grid items-start gap-5 lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)_430px]">
            <div className="space-y-5">
              <Card>
                <CardHeader>
                  <CardTitle>{t("entry")}</CardTitle>
                  <CardDescription>{t("entryDescription")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-md border bg-muted/30 p-4 text-center">
                    <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">{t("classCode")}</p>
                    <p className="mt-1 text-4xl font-semibold tracking-normal text-foreground">{checkpoint.code}</p>
                    <p className="mt-2 break-all text-xs text-muted-foreground">{studentLink}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button type="button" variant="outline" onClick={() => setProjectionOpen(true)}>
                      <StudentIcon data-icon="inline-start" className="size-4" weight="duotone" />
                      {t("showStudentEntry")}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => void copyStudentLink()}>
                      <CopyIcon data-icon="inline-start" className="size-4" weight="bold" />
                      {t("copyLink")}
                    </Button>
                    <Link href={`/s/${checkpoint.code}`} className={cn(buttonVariants({ variant: "outline" }), "col-span-2")}>
                      {t("openStudent")}
                      <ArrowSquareOutIcon data-icon="inline-end" className="size-4" weight="bold" />
                    </Link>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">{t("context")}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {quickContexts.map((context) => {
                        const active =
                          checkpoint.lesson_phase === context.lesson_phase &&
                          checkpoint.current_activity === context.current_activity;
                        return (
                          <Button
                            key={context.id}
                            type="button"
                            size="sm"
                            variant={active ? "secondary" : "outline"}
                            disabled={updatingContext}
                            onClick={() => void applyClassroomContext(context.lesson_phase, context.current_activity)}
                          >
                            {phaseT(context.lesson_phase)} / {activityT(context.current_activity)}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="grid gap-2 rounded-md border bg-background p-3 text-xs text-muted-foreground">
                    <MetaItem label={t("responses")} value={String(responses.length)} />
                    <MetaItem label={t("representative")} value={representativeResponse ? representativeResponse.anonymous_student_id : t("notSet")} />
                    <MetaItem label={t("queued")} value={String(queueLogs.length)} />
                  </div>
                </CardContent>
              </Card>

              <Card>
              <CardHeader>
                <CardTitle>{t("teacherRepresentative")}</CardTitle>
                <CardDescription>{t("teacherRepresentativeDescription")}</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={onRepresentativeSubmit} className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="anonymous_student_id">{t("anonymousId")}</Label>
                    <Input id="anonymous_student_id" name="anonymous_student_id" placeholder="T-rep" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="answer_text">{t("representativeAnswer")}</Label>
                    <Textarea id="answer_text" name="answer_text" required rows={5} placeholder={t("representativePlaceholder")} />
                  </div>
                  <Button
                    type="submit"
                    disabled={checkpoint.status === "closed" || submittingRepresentative}
                    className="w-full"
                  >
                    {checkpoint.status === "closed"
                      ? t("closedCheckpoint")
                      : submittingRepresentative
                        ? t("joining")
                        : t("joinAnswerList")}
                  </Button>
                </form>
              </CardContent>
            </Card>

              <QueuePanel logs={queueLogs} />
            </div>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle>{t("studentAnswers")}</CardTitle>
                    <CardDescription>{t("studentAnswersDescription")}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={checkpoint.status === "open" ? "default" : "secondary"}>
                    {checkpoint.status === "open" ? teacherT("collecting") : teacherT("closed")}
                    </Badge>
                    <Badge variant="outline">{common("rows", { count: responses.length })}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_auto]">
                  <Input
                    value={responseSearch}
                    onChange={(event) => setResponseSearch(event.target.value)}
                    placeholder={t("searchPlaceholder")}
                  />
                  <div className="flex flex-wrap gap-2">
                    {responseFilters.map((filter) => (
                      <Button
                        key={filter.id}
                        type="button"
                        size="sm"
                        variant={responseFilter === filter.id ? "secondary" : "outline"}
                        onClick={() => setResponseFilter(filter.id)}
                      >
                        {filter.id === "all"
                          ? common("all")
                          : filter.id === "representative"
                            ? t("representativeBadge")
                            : filter.id === "unselected"
                              ? t("unselected")
                              : t("lowConfidence")}
                      </Button>
                    ))}
                  </div>
                </div>
                <ResponseRecommendationPanel
                  clusters={responseClusters}
                  markingResponseId={markingResponseId}
                  onChoose={chooseClusterRepresentative}
                />
                <div className="grid gap-3">
                  {responses.length === 0 ? (
                    <Alert>
                      <StudentIcon className="size-4" weight="duotone" />
                      <AlertDescription>{t("waitAnswers")}</AlertDescription>
                    </Alert>
                  ) : null}
                  {responses.length > 0 && filteredResponses.length === 0 ? (
                    <Alert>
                      <MagnifyingGlassIcon className="size-4" weight="duotone" />
                      <AlertDescription>{t("noFilteredAnswers")}</AlertDescription>
                    </Alert>
                  ) : null}
                  {filteredResponses.map((response) => (
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
                            <Badge variant="outline">{sourceT(response.response_source)}</Badge>
                            {response.confidence_level ? (
                              <Badge variant="secondary">{confidenceT(response.confidence_level)}</Badge>
                            ) : null}
                            {response.is_representative ? <Badge>{t("representativeBadge")}</Badge> : null}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant={selectedResponse?.id === response.id ? "secondary" : "outline"}
                              onClick={() => setSelectedResponseId(response.id)}
                            >
                              {selectedResponse?.id === response.id ? t("selected") : t("select")}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant={response.is_representative ? "secondary" : "outline"}
                              disabled={markingResponseId === response.id}
                              onClick={() => void markRepresentative(response)}
                            >
                              {markingResponseId === response.id
                                ? t("updating")
                                : response.is_representative
                                  ? t("unsetRepresentative")
                                  : t("setRepresentative")}
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
                    {analyzing ? t("generating") : t("readOrGenerate")}
                  </Button>
                  <Button
                    onClick={() => void runAnalysis(true)}
                    disabled={!selectedResponse || !selectedResponse.is_representative || analyzing}
                    variant="outline"
                  >
                    <ArrowsClockwiseIcon data-icon="inline-start" className="size-4" weight="bold" />
                    {t("rerunAi")}
                  </Button>
                  <Button
                    onClick={() => void clearSelectedAnalysisCache()}
                    disabled={!selectedResponse || clearingCache}
                    variant="outline"
                  >
                    <TrashIcon data-icon="inline-start" className="size-4" weight="duotone" />
                    {clearingCache ? t("clearing") : t("clearCache")}
                  </Button>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {t("cacheHelp")}
                </p>
                {selectedResponse && !selectedResponse.is_representative ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    {t("normalAnswerNotice")}
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
                <CardTitle>{t("cardTitle")}</CardTitle>
                <CardDescription>{t("cardDescription")}</CardDescription>
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

          {projectionOpen ? (
            <StudentEntranceProjection
              code={checkpoint.code}
              link={studentLink}
              qrCodeDataUrl={qrCodeDataUrl}
              onClose={() => setProjectionOpen(false)}
              onCopy={copyStudentLink}
            />
          ) : null}
        </>
      ) : null}
    </AppShell>
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
  const t = useTranslations("Checkpoint");
  const clusterT = useTranslations("Labels.clusters");
  const common = useTranslations("Common");
  const conditionT = useTranslations("Labels.conditions");
  const moveT = useTranslations("Labels.moves");
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
            {generatingCondition === condition ? t("generating") : conditionT(condition)}
          </Button>
        ))}
      </div>
      {results.length > 0 ? (
        <div className="grid gap-2">
          {results.map((result) => (
            <Card key={result.condition} size="sm" className="bg-muted/30">
              <CardContent className="space-y-1 text-sm leading-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{conditionT(result.condition)}</Badge>
                  {result.move ? <Badge variant="outline">{moveT(result.move)}</Badge> : null}
                  <span className="text-xs text-muted-foreground">{result.ai_provider}</span>
                </div>
                {result.ai_provider === "baseline" ? (
                  <p className="text-xs font-medium text-muted-foreground">
                    {common("baselineWarning")}
                  </p>
                ) : null}
                <p className="text-muted-foreground">{result.teacher_card}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ResponseRecommendationPanel({
  clusters,
  markingResponseId,
  onChoose
}: {
  clusters: ResponseCluster[];
  markingResponseId: string | null;
  onChoose: (response: StudentResponse) => Promise<void>;
}) {
  const t = useTranslations("Checkpoint");
  const clusterT = useTranslations("Labels.clusters");
  if (clusters.length === 0) {
    return null;
  }
  return (
    <div className="mb-4 space-y-3 rounded-md border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">{t("responseRecommendations")}</p>
          <p className="text-xs text-muted-foreground">{t("responseRecommendationHint")}</p>
        </div>
        <Badge variant="outline">{t("clusterCount", { count: clusters.length })}</Badge>
      </div>
      <div className="grid gap-2">
        {clusters.slice(0, 4).map((cluster) => (
          <Card key={cluster.id} size="sm" className="bg-background">
            <CardContent className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-foreground">{clusterT(`${cluster.id}.label`)}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("responseCountWithDescription", { count: cluster.responses.length, description: clusterT(`${cluster.id}.description`) })}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={cluster.representative.is_representative ? "secondary" : "outline"}
                  disabled={markingResponseId === cluster.representative.id}
                  onClick={() => void onChoose(cluster.representative)}
                >
                  {markingResponseId === cluster.representative.id
                    ? t("updating")
                    : cluster.representative.is_representative
                      ? t("alreadyRepresentative")
                      : t("setRepresentative")}
                </Button>
              </div>
              <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
                {cluster.representative.answer_text}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function StudentEntranceProjection({
  code,
  link,
  qrCodeDataUrl,
  onClose,
  onCopy
}: {
  code: string;
  link: string;
  qrCodeDataUrl: string | null;
  onClose: () => void;
  onCopy: () => Promise<void>;
}) {
  const t = useTranslations("Checkpoint");
  const common = useTranslations("Common");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/70 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-3xl rounded-lg bg-background p-6 shadow-xl">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{t("projectionTitle")}</p>
            <h2 className="mt-1 text-3xl font-semibold text-foreground">{t("classCode")} {code}</h2>
          </div>
          <Button type="button" variant="outline" onClick={onClose}>
            {common("close")}
          </Button>
        </div>
        <div className="grid items-center gap-6 md:grid-cols-[300px_minmax(0,1fr)]">
          <div className="flex aspect-square items-center justify-center rounded-md border bg-white p-5">
            {qrCodeDataUrl ? (
              <Image
                src={qrCodeDataUrl}
                alt={`${t("classCode")} ${code} QR code`}
                width={260}
                height={260}
                unoptimized
                className="size-full object-contain"
              />
            ) : (
              <p className="text-sm text-muted-foreground">{t("qrGenerating")}</p>
            )}
          </div>
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/30 p-4">
              <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Code</p>
              <p className="mt-2 text-6xl font-semibold tracking-normal text-foreground">{code}</p>
            </div>
            <div className="rounded-md border bg-background p-3">
              <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Link</p>
              <p className="mt-2 break-all text-sm text-foreground">{link}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => void onCopy()}>
                <CopyIcon data-icon="inline-start" className="size-4" weight="bold" />
                {t("copyLink")}
              </Button>
              <Link href={`/s/${code}`} className={buttonVariants({ variant: "outline" })}>
                {t("openStudent")}
                <ArrowSquareOutIcon data-icon="inline-end" className="size-4" weight="bold" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyCard() {
  const t = useTranslations("Checkpoint");
  return (
    <Alert>
      <MagnifyingGlassIcon className="size-4" weight="duotone" />
      <AlertDescription>{t("emptyCard")}</AlertDescription>
    </Alert>
  );
}

function buildResponseClusters(responses: StudentResponse[]): ResponseCluster[] {
  const buckets = new Map<string, Omit<ResponseCluster, "representative">>();
  responses.forEach((response) => {
    const cluster = classifyResponse(response.answer_text);
    const existing = buckets.get(cluster.id);
    if (existing) {
      existing.responses.push(response);
      return;
    }
    buckets.set(cluster.id, {
      id: cluster.id,
      label: cluster.label,
      description: cluster.description,
      responses: [response]
    });
  });
  return Array.from(buckets.values())
    .map((cluster) => {
      const sorted = [...cluster.responses].sort((left, right) => {
        if (left.is_representative !== right.is_representative) {
          return left.is_representative ? -1 : 1;
        }
        return right.answer_text.length - left.answer_text.length;
      });
      return { ...cluster, representative: sorted[0] };
    })
    .sort((left, right) => right.responses.length - left.responses.length || left.label.localeCompare(right.label));
}

function classifyResponse(answerText: string): { id: string; label: string; description: string } {
  const text = answerText.trim();
  if (!text || /不知道|不会|没想|不清楚|随便/.test(text)) {
    return { id: "insufficient", label: "证据不足类", description: "缺少可诊断理由" };
  }
  if (/速度变小|变化量|变短|向后|反方向/.test(text)) {
    return { id: "velocity_change", label: "速度变化类", description: "提到速度变化或反方向" };
  }
  if (/向前|往前|运动方向|还在往前走/.test(text)) {
    return { id: "motion_direction", label: "运动方向类", description: "可能把运动方向当作加速度方向" };
  }
  if (/摩擦|阻碍运动|相对运动/.test(text)) {
    return { id: "friction", label: "摩擦方向类", description: "涉及摩擦与相对运动趋势" };
  }
  if (/更重|重|先落|下落/.test(text)) {
    return { id: "weight_fall", label: "重物下落类", description: "涉及重量与下落快慢" };
  }
  return { id: "other", label: "其他表述类", description: "需要教师判断是否代表性" };
}

function QueuePanel({ logs }: { logs: EpisodeLog[] }) {
  const t = useTranslations("Checkpoint");
  const common = useTranslations("Common");
  const moveT = useTranslations("Labels.moves");
  return (
    <div className="mt-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">{t("queueTitle")}</p>
        <Badge variant="outline">{common("rows", { count: logs.length })}</Badge>
      </div>
      {logs.length === 0 ? (
        <p className="text-sm leading-6 text-muted-foreground">{t("queueEmpty")}</p>
      ) : (
        <div className="space-y-2">
          {logs.slice(0, 3).map((log) => (
            <Card key={log.id} size="sm" className="bg-muted/30">
              <CardContent className="space-y-1 text-sm leading-6">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="secondary">{log.system_move ? moveT(log.system_move) : t("queuePending")}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {log.decision_time_ms === null ? "" : `${Math.round(log.decision_time_ms / 1000)}s`}
                  </span>
                </div>
                <p className="line-clamp-2 text-muted-foreground">{log.student_answer}</p>
                {log.queue_note ? <p className="text-xs text-muted-foreground">{t("note", { value: log.queue_note })}</p> : null}
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
  const t = useTranslations("Checkpoint");
  const common = useTranslations("Common");
  const moveT = useTranslations("Labels.moves");
  const actionT = useTranslations("Labels.actions");
  const card = analysis.card;
  const decision = card.gate_decision;
  const [finalTurn, setFinalTurn] = useState(decision.teacher_move);
  const [teacherFeedback, setTeacherFeedback] = useState("");
  const [queueNote, setQueueNote] = useState("");
  const [viewedAt, setViewedAt] = useState(() => performance.now());
  const quoteAuditPassed =
    !decision.gate_reasons.includes("no_valid_quote") && decision.fallback_reason !== "no_quote";

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
      {card.ai_provider === "mock" ? (
        <Alert>
          <AlertDescription>{common("mockWarning")}</AlertDescription>
        </Alert>
      ) : null}
      {card.ai_provider === "baseline" ? (
        <Alert>
          <AlertDescription>{common("baselineWarning")}</AlertDescription>
        </Alert>
      ) : null}
      <Card size="sm" className="border-primary/30 bg-muted/40">
        <CardContent>
          <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Move</p>
          <p className="mt-1 text-lg font-semibold text-foreground">{moveT(decision.move)}</p>
        </CardContent>
      </Card>
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">{t("whyMove")}</p>
        <p className="text-sm leading-6 text-muted-foreground">{decision.why_this_move}</p>
      </div>
      <div className="grid gap-2 rounded-md border border-border bg-background p-3 text-xs text-muted-foreground sm:grid-cols-2">
        <MetaItem label={t("provider")} value={`${card.ai_provider}${card.model_name ? ` / ${card.model_name}` : ""}`} />
        <MetaItem label={t("model")} value={card.model_name ?? t("notSet")} />
        <MetaItem label={t("latency")} value={`${analysis.latency_ms}ms`} />
        <MetaItem label={t("cached")} value={analysis.cached ? common("yes") : common("no")} />
        <MetaItem label={t("created")} value={new Date(card.shown_at).toLocaleString()} />
        <MetaItem label={t("providerAtCreation")} value={card.ai_provider} />
        <MetaItem label={t("rawLlmValid")} value={card.raw_llm_valid ? common("yes") : common("no")} />
        <MetaItem label={t("fallbackUsed")} value={card.fallback_used ? common("yes") : common("no")} />
        <MetaItem label={t("quoteAudit")} value={quoteAuditPassed ? common("passed") : common("blocked")} />
        {card.downgrade_reason ?? decision.downgrade_reason ? (
          <MetaItem label={t("downgrade")} value={card.downgrade_reason ?? decision.downgrade_reason ?? "-"} />
        ) : null}
        <MetaItem label={t("prompt")} value={card.prompt_version} />
      </div>
      {card.validation_error || card.provider_error ? (
        <Alert>
          <AlertDescription>
            {card.validation_error ? `${t("validation")}: ${card.validation_error}` : `${t("provider")}: ${card.provider_error}`}
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="final-turn">{t("teacherMove")}</Label>
        <Textarea
          id="final-turn"
          rows={4}
          value={finalTurn}
          onChange={(event) => setFinalTurn(event.target.value)}
          className="leading-6"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="teacher-feedback">{t("teacherFeedback")}</Label>
        <Textarea
          id="teacher-feedback"
          rows={3}
          value={teacherFeedback}
          onChange={(event) => setTeacherFeedback(event.target.value)}
          placeholder={t("teacherFeedbackPlaceholder")}
          className="leading-6"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="queue-note">{t("queueNote")}</Label>
        <Textarea
          id="queue-note"
          rows={2}
          value={queueNote}
          onChange={(event) => setQueueNote(event.target.value)}
          placeholder={t("queueNotePlaceholder")}
          className="leading-6"
        />
      </div>
      <Separator />
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">{t("internalEvidence")}</p>
        {card.candidate_output.candidate_explanations.map((candidate) => (
          <Card key={candidate.label} size="sm">
            <CardContent className="space-y-2 text-sm leading-6 text-muted-foreground">
              <p className="font-medium text-foreground">{candidate.label}</p>
              <p>{t("studentQuotes", { value: candidate.student_quotes.join(" / ") })}</p>
              <p>{candidate.interpretation}</p>
              <p>{t("missingEvidence", { value: candidate.missing_evidence })}</p>
              <p>{t("riskIfOverdiagnosed", { value: candidate.risk_if_overdiagnosed })}</p>
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
            {actionIcons[action]}
            {savingAction === action ? t("saving") : actionT(action)}
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
