"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowLeftIcon,
  ArrowsClockwiseIcon,
  ChartBarIcon,
  DownloadSimpleIcon,
  FileCsvIcon
} from "@phosphor-icons/react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  episodeLogsCsvUrl,
  getResearchEvidenceSummary,
  listDataDictionary,
  listEpisodeLogs,
  updateEpisodeAnnotation
} from "@/lib/api";
import { cn } from "@/lib/utils";
import type {
  DataDictionaryField,
  EpisodeLog,
  ExperimentCondition,
  GateMove,
  QueueState,
  ResearchEvidenceSummary,
  ResponseSource,
  StudentConfidence,
  TeacherAction
} from "@/lib/types";

export default function ResearchPage() {
  const t = useTranslations("Research");
  const common = useTranslations("Common");
  const moveT = useTranslations("Labels.moves");
  const sourceT = useTranslations("Labels.sources");
  const actionT = useTranslations("Labels.actions");
  const queueT = useTranslations("Labels.queues");
  const confidenceT = useTranslations("Labels.confidence");
  const conditionT = useTranslations("Labels.conditions");
  const [logs, setLogs] = useState<EpisodeLog[]>([]);
  const [summary, setSummary] = useState<ResearchEvidenceSummary | null>(null);
  const [dictionary, setDictionary] = useState<DataDictionaryField[]>([]);
  const [systemMove, setSystemMove] = useState<GateMove | "all">("all");
  const [responseSource, setResponseSource] = useState<ResponseSource | "all">("all");
  const [teacherAction, setTeacherAction] = useState<TeacherAction | "all">("all");
  const [queueState, setQueueState] = useState<QueueState | "all">("all");
  const [condition, setCondition] = useState<ExperimentCondition | "all">("all");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [loading, setLoading] = useState(true);
  const [annotatingLogId, setAnnotatingLogId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filters = useMemo(
    () => ({
      system_move: systemMove,
      response_source: responseSource,
      teacher_action: teacherAction,
      queue_state: queueState,
      condition,
      limit: pageSize,
      offset: pageIndex * pageSize
    }),
    [condition, pageIndex, pageSize, queueState, responseSource, systemMove, teacherAction]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextLogs, nextSummary] = await Promise.all([
        listEpisodeLogs(filters),
        getResearchEvidenceSummary()
      ]);
      setLogs(nextLogs);
      setSummary(nextSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [filters, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    listDataDictionary()
      .then(setDictionary)
      .catch(() => setDictionary([]));
  }, []);

  useEffect(() => {
    setPageIndex(0);
  }, [condition, queueState, responseSource, systemMove, teacherAction]);

  const moveCounts = logs.reduce<Record<GateMove, number>>(
    (acc, log) => {
      if (log.system_move) {
        acc[log.system_move] += 1;
      }
      return acc;
    },
    { hold: 0, ask_for_evidence: 0, diagnostic_probe: 0 }
  );
  const fallbackCount = logs.filter((log) => log.fallback_used).length;
  const invalidOutputCount = logs.filter((log) => !log.raw_llm_valid).length;

  async function annotate(log: EpisodeLog, kind: "over" | "under" | "clear") {
    setAnnotatingLogId(log.id);
    setError(null);
    try {
      const updated = await updateEpisodeAnnotation(
        log.id,
        kind === "clear"
          ? {
              expert_preferred_move: null,
              commitment_distance: null,
              harmful_over_commitment: null,
              harmful_under_commitment: null,
              answer_leakage: null,
              self_correction_support: null,
              annotation_note: null
            }
          : {
              expert_preferred_move: kind === "over" ? "ask_for_evidence" : "diagnostic_probe",
              commitment_distance: kind === "over" ? 1 : -1,
              harmful_over_commitment: kind === "over",
              harmful_under_commitment: kind === "under",
              answer_leakage: kind === "over",
              self_correction_support: kind === "over" ? 2 : 3
            }
      );
      setLogs((items) => items.map((item) => (item.id === updated.id ? updated : item)));
      setSummary(await getResearchEvidenceSummary());
    } catch (err) {
      setError(err instanceof Error ? err.message : t("annotateFailed"));
    } finally {
      setAnnotatingLogId(null);
    }
  }

  function downloadCsv() {
    window.location.href = episodeLogsCsvUrl({ ...filters, deidentify: true });
  }

  function resetFilters() {
    setSystemMove("all");
    setResponseSource("all");
    setTeacherAction("all");
    setQueueState("all");
    setCondition("all");
    setPageIndex(0);
  }

  return (
    <AppShell
      breadcrumbs={[
        { label: common("home"), href: "/" },
        { label: common("research") }
      ]}
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className={cn(buttonVariants({ variant: "ghost" }), "text-muted-foreground")}>
          <ArrowLeftIcon data-icon="inline-start" className="size-4" weight="bold" />
          {common("backHome")}
        </Link>
        <Button onClick={() => void load()} variant="outline">
          <ArrowsClockwiseIcon data-icon="inline-start" className="size-4" weight="bold" />
          {common("refresh")}
        </Button>
      </div>

      <header className="mb-5">
        <div className="flex items-center gap-2">
          <ChartBarIcon className="size-6 text-primary" weight="duotone" />
          <h1 className="text-2xl font-semibold text-foreground">{t("title")}</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
      </header>

      <section className="mb-5 grid gap-3 md:grid-cols-6">
        <Metric label={t("totalEpisodes")} value={logs.length} />
        <Metric label="Hold" value={moveCounts.hold} />
        <Metric label="Ask" value={moveCounts.ask_for_evidence} />
        <Metric label="Probe" value={moveCounts.diagnostic_probe} />
        <Metric label="Fallback" value={fallbackCount} />
        <Metric label="Invalid LLM" value={invalidOutputCount} />
      </section>

      <section className="mb-5 grid gap-3 md:grid-cols-6">
        <Metric label={t("realRuns")} value={summary?.real_llm_runs ?? 0} />
        <Metric label={t("mockRuns")} value={summary?.mock_runs ?? 0} />
        <Metric label={t("baselineRuns")} value={summary?.baseline_runs ?? 0} />
        <Metric label={t("evidenceFirst")} value={summary?.evidence_first_actions ?? 0} />
        <Metric label="Over" value={summary?.harmful_over_commitment ?? 0} />
        <Metric label="Under" value={summary?.harmful_under_commitment ?? 0} />
      </section>

      <section className="mb-5 grid gap-4 lg:grid-cols-3">
        <DistributionPanel title={t("byProvider")} values={summary?.provider_counts ?? {}} noDataLabel={common("noData")} />
        <DistributionPanel title={t("byCondition")} values={summary?.condition_counts ?? {}} noDataLabel={common("noData")} />
        <DistributionPanel title={t("downgradeReasons")} values={summary?.downgrade_counts ?? {}} noDataLabel={common("noData")} />
      </section>

      <Card className="mb-4">
        <CardContent>
          <div className="grid gap-3 md:grid-cols-5">
            <FilterSelect
              label="Move"
              value={systemMove}
              onValueChange={(value) => setSystemMove(value as GateMove | "all")}
              options={[
                ["all", t("allMoves")],
                ["hold", moveT("hold")],
                ["ask_for_evidence", moveT("ask_for_evidence")],
                ["diagnostic_probe", moveT("diagnostic_probe")]
              ]}
            />
            <FilterSelect
              label={t("source")}
              value={responseSource}
              onValueChange={(value) => setResponseSource(value as ResponseSource | "all")}
              options={[
                ["all", t("allSources")],
                ["student_qr", sourceT("student_qr")],
                ["teacher_representative", sourceT("teacher_representative")],
                ["imported_episode", sourceT("imported_episode")]
              ]}
            />
            <FilterSelect
              label={t("teacherActionFilter")}
              value={teacherAction}
              onValueChange={(value) => setTeacherAction(value as TeacherAction | "all")}
              options={[
                ["all", t("allActions")],
                ["use", actionT("use")],
                ["edit", actionT("edit")],
                ["delay", actionT("delay")],
                ["skip", actionT("skip")]
              ]}
            />
            <FilterSelect
              label={t("queue")}
              value={queueState}
              onValueChange={(value) => setQueueState(value as QueueState | "all")}
              options={[
                ["all", t("allQueues")],
                ["queued", queueT("queued")],
                ["resolved", queueT("resolved")],
                ["dismissed", queueT("dismissed")],
                ["none", queueT("none")]
              ]}
            />
            <FilterSelect
              label="Condition"
              value={condition}
              onValueChange={(value) => setCondition(value as ExperimentCondition | "all")}
              options={[
                ["all", t("allConditions")],
                ["probemate", conditionT("probemate")],
                ["standard_llm", conditionT("standard_llm")],
                ["over_committed", conditionT("over_committed")],
                ["evidence_only", conditionT("evidence_only")],
                ["no_ai", conditionT("no_ai")]
              ]}
            />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button onClick={downloadCsv} disabled={logs.length === 0}>
              <DownloadSimpleIcon data-icon="inline-start" className="size-4" weight="bold" />
              {t("exportCsv")}
            </Button>
            <Button onClick={resetFilters} variant="outline">
              {t("clearFilters")}
            </Button>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="outline" disabled={pageIndex === 0} onClick={() => setPageIndex((value) => value - 1)}>
                {common("previous")}
              </Button>
              <Badge variant="outline">{common("page", { page: pageIndex + 1 })}</Badge>
              <Button
                variant="outline"
                disabled={logs.length < pageSize}
                onClick={() => setPageIndex((value) => value + 1)}
              >
                {common("next")}
              </Button>
              <Select
                value={String(pageSize)}
                onValueChange={(value) => {
                  if (value === null) {
                    return;
                  }
                  setPageSize(Number(value));
                  setPageIndex(0);
                }}
              >
                <SelectTrigger className="w-[110px]">
                  <span>{common("rows", { count: pageSize })}</span>
                </SelectTrigger>
                <SelectContent>
                  {[25, 50, 100].map((value) => (
                    <SelectItem key={value} value={String(value)}>
                      {common("rows", { count: value })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? <p className="text-sm text-muted-foreground">{common("loading")}...</p> : null}
      {error ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCsvIcon className="size-5 text-primary" weight="duotone" />
            {t("episodeTable")}
          </CardTitle>
          <CardDescription>{t("logDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table className="min-w-[1560px]">
            <TableHeader>
              <TableRow>
                <TableHead>Condition</TableHead>
                <TableHead>AI</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Move</TableHead>
                <TableHead>Evidence</TableHead>
                <TableHead>Validation</TableHead>
                <TableHead>Downgrade</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Teacher Action</TableHead>
                <TableHead>Decision Time</TableHead>
                <TableHead>Student Answer</TableHead>
                <TableHead>Over / Under</TableHead>
                <TableHead>Feedback / Queue</TableHead>
                <TableHead>Gate Reasons</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{conditionT(log.condition as ExperimentCondition) ?? log.condition}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Badge variant="outline">{log.ai_provider}</Badge>
                      {log.model_name ? (
                        <p className="text-xs text-muted-foreground">{log.model_name}</p>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    {log.response_source ? sourceT(log.response_source) : "-"}
                  </TableCell>
                  <TableCell>
                    {log.system_move ? <Badge variant="secondary">{moveT(log.system_move)}</Badge> : "-"}
                  </TableCell>
                  <TableCell>{log.evidence_state ?? "-"}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Badge variant={log.raw_llm_valid ? "secondary" : "outline"}>
                        {log.raw_llm_valid ? common("valid") : common("invalid")}
                      </Badge>
                      {log.fallback_used ? (
                        <p className="text-xs text-muted-foreground">fallback</p>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs whitespace-normal leading-6">
                    {log.downgrade_reason ?? "-"}
                    {log.validation_error || log.provider_error ? (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {log.validation_error ?? log.provider_error}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>{log.confidence_level ? confidenceT(log.confidence_level) : "-"}</TableCell>
                  <TableCell>{log.teacher_action ? actionT(log.teacher_action) : "-"}</TableCell>
                  <TableCell>
                    {log.decision_time_ms === null ? "-" : `${Math.round(log.decision_time_ms / 1000)}s`}
                    {log.study_perceived_load ? (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        Load {log.study_perceived_load}/7
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="max-w-sm whitespace-normal leading-6">{log.student_answer}</TableCell>
                  <TableCell className="max-w-xs whitespace-normal leading-6">
                    <div className="mb-2 flex flex-wrap gap-1">
                      {log.harmful_over_commitment ? <Badge variant="outline">over</Badge> : null}
                      {log.harmful_under_commitment ? <Badge variant="outline">under</Badge> : null}
                      {log.answer_leakage ? <Badge variant="outline">leakage</Badge> : null}
                      {log.self_correction_support ? <Badge variant="secondary">support {log.self_correction_support}</Badge> : null}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={annotatingLogId === log.id}
                        onClick={() => void annotate(log, "over")}
                      >
                        {t("markOver")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={annotatingLogId === log.id}
                        onClick={() => void annotate(log, "under")}
                      >
                        {t("markUnder")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={annotatingLogId === log.id}
                        onClick={() => void annotate(log, "clear")}
                      >
                        {t("clear")}
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-xs whitespace-normal leading-6">
                    {log.teacher_feedback ?? log.queue_note ?? "-"}
                    {log.teacher_feedback && log.queue_note ? (
                      <span className="mt-1 block text-xs text-muted-foreground">{log.queue_note}</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="max-w-sm whitespace-normal leading-6">
                    {log.gate_reasons.length > 0 ? log.gate_reasons.join(" / ") : "-"}
                    {log.queue_state !== "none" ? (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {t("queueState", { value: queueT(log.queue_state) })}
                      </span>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={14} className="h-28 text-center text-muted-foreground">
                    {t("empty")}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle>{t("dataDictionary")}</CardTitle>
          <CardDescription>{t("dataDictionaryDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table className="min-w-[920px]">
            <TableHeader>
              <TableRow>
                <TableHead>Field</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Values</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dictionary.map((field) => (
                <TableRow key={field.name}>
                  <TableCell className="font-medium">{field.name}</TableCell>
                  <TableCell>{field.type}</TableCell>
                  <TableCell className="max-w-md whitespace-normal leading-6">{field.description}</TableCell>
                  <TableCell>{field.source}</TableCell>
                  <TableCell className="max-w-xs whitespace-normal leading-6">
                    {field.allowed_values.length > 0 ? field.allowed_values.join(" / ") : "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card size="sm">
      <CardContent>
        <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">{label}</p>
        <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

function DistributionPanel({
  title,
  values,
  noDataLabel
}: {
  title: string;
  values: Record<string, number>;
  noDataLabel: string;
}) {
  const entries = Object.entries(values).sort((left, right) => right[1] - left[1]);
  return (
    <Card size="sm">
      <CardContent>
        <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">{title}</p>
        <div className="mt-3 space-y-2">
          {entries.length === 0 ? <p className="text-sm text-muted-foreground">{noDataLabel}</p> : null}
          {entries.slice(0, 5).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate text-muted-foreground">{key}</span>
              <Badge variant="outline">{value}</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function FilterSelect({
  label,
  value,
  onValueChange,
  options
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: [string, string][];
}) {
  const selected = options.find(([optionValue]) => optionValue === value)?.[1] ?? value;
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">{label}</p>
      <Select value={value} onValueChange={(nextValue) => nextValue !== null && onValueChange(nextValue)}>
        <SelectTrigger className="w-full">
          <span>{selected}</span>
        </SelectTrigger>
        <SelectContent>
          {options.map(([optionValue, optionLabel]) => (
            <SelectItem key={optionValue} value={optionValue}>
              {optionLabel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
