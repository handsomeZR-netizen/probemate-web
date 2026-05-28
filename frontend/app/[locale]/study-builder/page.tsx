"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import { ArrowLeftIcon, DownloadSimpleIcon, GitBranchIcon, ShuffleIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";

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
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { episodeLogsCsvUrl, generateStudyMaterials, listEpisodeLogs, submitStudyNextTurn } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { EpisodeLog, ExperimentCondition, StudyMaterialRow } from "@/lib/types";

const allConditions: ExperimentCondition[] = [
  "no_ai",
  "standard_llm",
  "over_committed",
  "evidence_only",
  "probemate"
];

type Study3Row = {
  material_id: string;
  episode_log_id: string;
  assistant_label: string;
  condition: ExperimentCondition;
  teacher_next_turn: string;
  decision_time_ms: number;
  perceived_load: number;
};

export default function StudyBuilderPage() {
  const t = useTranslations("StudyBuilder");
  const common = useTranslations("Common");
  const conditionT = useTranslations("Labels.conditions");
  const moveT = useTranslations("Labels.moves");
  const [episodes, setEpisodes] = useState<EpisodeLog[]>([]);
  const [selectedResponseId, setSelectedResponseId] = useState("");
  const [conditions, setConditions] = useState<ExperimentCondition[]>(allConditions);
  const [randomizeOrder, setRandomizeOrder] = useState(true);
  const [rows, setRows] = useState<StudyMaterialRow[]>([]);
  const [activeMaterialId, setActiveMaterialId] = useState("");
  const [timerStartedAt, setTimerStartedAt] = useState<number | null>(null);
  const [nextTurnText, setNextTurnText] = useState("");
  const [perceivedLoad, setPerceivedLoad] = useState(3);
  const [study3Rows, setStudy3Rows] = useState<Study3Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [recordingNextTurn, setRecordingNextTurn] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selectedEpisode = useMemo(
    () => episodes.find((episode) => episode.response_id === selectedResponseId) ?? null,
    [episodes, selectedResponseId]
  );
  const activeMaterial = useMemo(
    () => rows.find((row) => row.material_id === activeMaterialId) ?? rows[0] ?? null,
    [activeMaterialId, rows]
  );

  const loadEpisodes = useCallback(async (silent = false) => {
    setLoading(true);
    if (!silent) {
      setMessage(null);
    }
    try {
      const logs = await listEpisodeLogs({ limit: 200 });
      const unique = uniqueEpisodes(logs);
      setEpisodes(unique);
      setSelectedResponseId((current) => current || unique[0]?.response_id || "");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t("loadEpisodesFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadEpisodes();
  }, [loadEpisodes]);

  useEffect(() => {
    if (rows.length > 0 && !rows.some((row) => row.material_id === activeMaterialId)) {
      setActiveMaterialId(rows[0].material_id);
    }
  }, [activeMaterialId, rows]);

  function toggleCondition(condition: ExperimentCondition) {
    setConditions((current) =>
      current.includes(condition)
        ? current.filter((item) => item !== condition)
        : [...current, condition].sort((a, b) => allConditions.indexOf(a) - allConditions.indexOf(b))
    );
  }

  async function generate() {
    if (!selectedResponseId) {
      setMessage(t("chooseEpisode"));
      return;
    }
    if (conditions.length === 0) {
      setMessage(t("chooseCondition"));
      return;
    }
    setGenerating(true);
    setMessage(null);
    try {
      const result = await generateStudyMaterials({
        response_id: selectedResponseId,
        conditions,
        blind_labels: true,
        randomize_order: randomizeOrder
      });
      setRows(result.rows);
      setActiveMaterialId(result.rows[0]?.material_id ?? "");
      setStudy3Rows([]);
      setNextTurnText("");
      setTimerStartedAt(null);
      setMessage(t("materialsReady", { count: result.rows.length }));
      await loadEpisodes(true);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t("materialFailed"));
    } finally {
      setGenerating(false);
    }
  }

  function startTimedTurn() {
    if (!activeMaterial) {
      setMessage(t("selectFirst"));
      return;
    }
    setTimerStartedAt(Date.now());
    setMessage(t("timerStarted"));
  }

  async function recordTimedTurn() {
    if (!activeMaterial) {
      setMessage(t("selectMaterial"));
      return;
    }
    if (!activeMaterial.episode_log_id) {
      setMessage(t("missingLog"));
      return;
    }
    const finalTurn = nextTurnText.trim();
    if (!finalTurn) {
      setMessage(t("needNextTurn"));
      return;
    }
    const decisionTimeMs = timerStartedAt ? Math.max(0, Date.now() - timerStartedAt) : 0;
    setRecordingNextTurn(true);
    setMessage(null);
    try {
      await submitStudyNextTurn({
        episode_log_id: activeMaterial.episode_log_id,
        teacher_next_turn: finalTurn,
        decision_time_ms: decisionTimeMs,
        perceived_load: perceivedLoad,
        note: `Study 3 timed next-turn / ${activeMaterial.assistant_label}`
      });
      setStudy3Rows((current) => [
        ...current,
        {
          material_id: activeMaterial.material_id,
          episode_log_id: activeMaterial.episode_log_id ?? "",
          assistant_label: activeMaterial.assistant_label,
          condition: activeMaterial.condition,
          teacher_next_turn: finalTurn,
          decision_time_ms: decisionTimeMs,
          perceived_load: perceivedLoad
        }
      ]);
      setNextTurnText("");
      setTimerStartedAt(null);
      setMessage(t("nextTurnRecorded", { label: activeMaterial.assistant_label }));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t("nextTurnFailed"));
    } finally {
      setRecordingNextTurn(false);
    }
  }

  return (
    <AppShell
      breadcrumbs={[
        { label: common("home"), href: "/" },
        { label: common("studyBuilder") }
      ]}
      className="max-w-7xl"
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className={cn(buttonVariants({ variant: "ghost" }), "text-muted-foreground")}>
          <ArrowLeftIcon data-icon="inline-start" className="size-4" weight="bold" />
          {common("backHome")}
        </Link>
        <Link href="/demo/phase-manipulation" className={buttonVariants({ variant: "outline" })}>
          Phase manipulation
        </Link>
      </div>

      <header className="mb-5">
        <div className="flex items-center gap-2">
          <GitBranchIcon className="size-6 text-primary" weight="duotone" />
          <h1 className="text-2xl font-semibold text-foreground">{t("title")}</h1>
        </div>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{t("description")}</p>
      </header>

      {message ? (
        <Alert className="mb-5">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}

      <section className="grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>{t("materialGeneration")}</CardTitle>
            <CardDescription>{t("blindDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">{t("episode")}</p>
              <Select value={selectedResponseId} onValueChange={(value) => value !== null && setSelectedResponseId(value)}>
                <SelectTrigger className="w-full">
                  <span>{selectedEpisode ? episodeLabel(selectedEpisode) : loading ? `${common("loading")}...` : t("noEpisode")}</span>
                </SelectTrigger>
                <SelectContent>
                  {episodes.map((episode) => (
                    <SelectItem key={episode.response_id} value={episode.response_id}>
                      {episodeLabel(episode)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedEpisode ? (
              <div className="rounded-md border bg-muted/30 p-3 text-sm leading-6">
                <p className="font-medium text-foreground">{selectedEpisode.question}</p>
                <p className="mt-2 text-muted-foreground">{selectedEpisode.student_answer}</p>
              </div>
            ) : null}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">{t("conditions")}</p>
              <div className="grid grid-cols-2 gap-2">
                {allConditions.map((condition) => (
                  <Button
                    key={condition}
                    type="button"
                    size="sm"
                    variant={conditions.includes(condition) ? "secondary" : "outline"}
                    onClick={() => toggleCondition(condition)}
                  >
                    {conditionT(condition)}
                  </Button>
                ))}
              </div>
            </div>
            <Button
              type="button"
              variant={randomizeOrder ? "secondary" : "outline"}
              onClick={() => setRandomizeOrder((value) => !value)}
              className="w-full"
            >
              {randomizeOrder ? t("randomizeOn") : t("randomizeOff")}
            </Button>
            <Button type="button" disabled={generating || !selectedResponseId} onClick={() => void generate()} className="w-full">
              <ShuffleIcon data-icon="inline-start" className="size-4" weight="duotone" />
              {generating ? t("generating") : t("generate")}
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" disabled={rows.length === 0} onClick={() => downloadCsv("study-materials.csv", materialRowsToCsv(rows))}>
                <DownloadSimpleIcon data-icon="inline-start" className="size-4" weight="bold" />
                materials.csv
              </Button>
              <Button type="button" variant="outline" disabled={rows.length === 0} onClick={() => downloadCsv("ratings-template.csv", ratingsTemplateToCsv(rows))}>
                <DownloadSimpleIcon data-icon="inline-start" className="size-4" weight="bold" />
                ratings.csv
              </Button>
              <Button type="button" variant="outline" disabled={study3Rows.length === 0} onClick={() => downloadCsv("study3-next-turns.csv", study3RowsToCsv(study3Rows))}>
                <DownloadSimpleIcon data-icon="inline-start" className="size-4" weight="bold" />
                next-turns.csv
              </Button>
              <a
                href={episodeLogsCsvUrl({ deidentify: true })}
                className={cn(buttonVariants({ variant: "outline" }), rows.length === 0 ? "pointer-events-none opacity-50" : "")}
              >
                <DownloadSimpleIcon data-icon="inline-start" className="size-4" weight="bold" />
                episode_logs.csv
              </a>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle>{t("previewTitle")}</CardTitle>
                <CardDescription>{t("materialsDescription")}</CardDescription>
              </div>
              <Badge variant="outline">{common("rows", { count: rows.length })}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <div className="flex min-h-[420px] items-center justify-center rounded-md border bg-muted/20 p-6 text-center">
                <div className="max-w-md">
                  <GitBranchIcon className="mx-auto size-10 text-primary" weight="duotone" />
                  <h2 className="mt-4 text-lg font-semibold text-foreground">{t("previewEmptyTitle")}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("previewEmptyBody")}</p>
                  <div className="mt-5 grid gap-2 text-left text-sm">
                    {[t("previewEmptyStepOne"), t("previewEmptyStepTwo"), t("previewEmptyStepThree")].map((item, index) => (
                      <div key={item} className="flex items-center gap-2 rounded-md border bg-background px-3 py-2">
                        <Badge variant="outline">{index + 1}</Badge>
                        <span className="text-muted-foreground">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table className="min-w-[960px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Assistant</TableHead>
                      <TableHead>Condition</TableHead>
                      <TableHead>Move</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Teacher card</TableHead>
                      <TableHead>Audit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.material_id}>
                        <TableCell>
                          <Badge variant="secondary">{row.assistant_label}</Badge>
                        </TableCell>
                        <TableCell>{conditionT(row.condition)}</TableCell>
                        <TableCell>{row.move ? moveT(row.move) : common("none")}</TableCell>
                        <TableCell>{row.ai_provider}</TableCell>
                        <TableCell className="max-w-xl whitespace-normal leading-6">{row.teacher_card}</TableCell>
                        <TableCell className="max-w-xs whitespace-normal leading-6">
                          {row.fallback_used ? "fallback / " : ""}
                          {row.raw_llm_valid ? common("valid") : common("invalid")}
                          {row.downgrade_reason ? ` / ${row.downgrade_reason}` : ""}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("ratingTitle")}</CardTitle>
            <CardDescription>{t("ratingDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6">
            <RatingPrompt label="Best fit" text={t("ratingBestFit")} />
            <RatingPrompt label="Over" text={t("ratingOver")} />
            <RatingPrompt label="Under" text={t("ratingUnder")} />
            <RatingPrompt label="Self-correction" text={t("ratingSelfCorrection")} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("nextTurnTitle")}</CardTitle>
            <CardDescription>{t("nextTurnDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_130px]">
              <Select value={activeMaterial?.material_id ?? ""} onValueChange={(value) => value !== null && setActiveMaterialId(value)}>
                <SelectTrigger className="w-full">
                  <span>
                    {activeMaterial
                      ? `${activeMaterial.assistant_label} / ${conditionT(activeMaterial.condition)}`
                      : t("noMaterials")}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {rows.map((row) => (
                    <SelectItem key={row.material_id} value={row.material_id}>
                      {row.assistant_label} / {conditionT(row.condition)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" disabled={!activeMaterial} onClick={startTimedTurn}>
                {t("startTimer")}
              </Button>
            </div>
            {activeMaterial ? (
              <div className="rounded-md border bg-muted/30 p-3 text-sm leading-6">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{activeMaterial.assistant_label}</Badge>
                  <Badge variant="outline">{conditionT(activeMaterial.condition)}</Badge>
                  {timerStartedAt ? <Badge variant="outline">{t("timing")}</Badge> : null}
                </div>
                <p className="text-muted-foreground">{activeMaterial.teacher_card}</p>
              </div>
            ) : null}
            <Textarea
              value={nextTurnText}
              onChange={(event) => setNextTurnText(event.target.value)}
              placeholder={t("teacherNextTurn")}
              rows={4}
            />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Load</span>
              {[1, 2, 3, 4, 5, 6, 7].map((value) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={perceivedLoad === value ? "secondary" : "outline"}
                  onClick={() => setPerceivedLoad(value)}
                >
                  {value}
                </Button>
              ))}
              <Button
                type="button"
                className="ml-auto"
                disabled={!activeMaterial || recordingNextTurn}
                onClick={() => void recordTimedTurn()}
              >
                {recordingNextTurn ? t("recording") : t("recordNextTurn")}
              </Button>
            </div>
            <div className="rounded-md border bg-background p-3 text-sm text-muted-foreground">
              {t("recordedCount", { count: study3Rows.length })}
            </div>
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}

function uniqueEpisodes(logs: EpisodeLog[]): EpisodeLog[] {
  const seen = new Set<string>();
  const rows: EpisodeLog[] = [];
  logs.forEach((log) => {
    if (!seen.has(log.response_id)) {
      seen.add(log.response_id);
      rows.push(log);
    }
  });
  return rows;
}

function episodeLabel(log: EpisodeLog): string {
  const concept = log.target_concept ?? "episode";
  return `${concept} / ${log.response_id.slice(0, 12)} / ${log.condition}`;
}

function RatingPrompt({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-md border bg-background p-3">
      <Badge variant="outline" className="mb-2">
        {label}
      </Badge>
      <p className="text-foreground">{text}</p>
    </div>
  );
}

function escapeCsv(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function rowsToCsv<T extends Record<string, unknown>>(rows: T[], columns: string[]): string {
  return [columns.join(","), ...rows.map((row) => columns.map((column) => escapeCsv(row[column])).join(","))].join("\n");
}

function materialRowsToCsv(rows: StudyMaterialRow[]): string {
  return rowsToCsv(rows as unknown as Record<string, unknown>[], [
    "material_id",
    "episode_log_id",
    "assistant_label",
    "condition",
    "response_id",
    "question",
    "student_answer",
    "target_concept",
    "lesson_phase",
    "current_activity",
    "teacher_card",
    "move",
    "ai_provider",
    "model_name",
    "raw_llm_valid",
    "fallback_used",
    "downgrade_reason"
  ]);
}

function ratingsTemplateToCsv(rows: StudyMaterialRow[]): string {
  return rowsToCsv(
    rows.map((row) => ({
      material_id: row.material_id,
      episode_log_id: row.episode_log_id,
      assistant_label: row.assistant_label,
      best_fit_current_classroom: "",
      likely_overdiagnosis: "",
      too_weak_under_commitment: "",
      preserves_self_correction: "",
      expert_preferred_move: "",
      commitment_distance: "",
      harmful_over_commitment: "",
      harmful_under_commitment: "",
      answer_leakage: "",
      self_correction_support: "",
      notes: ""
    })),
    [
      "material_id",
      "episode_log_id",
      "assistant_label",
      "best_fit_current_classroom",
      "likely_overdiagnosis",
      "too_weak_under_commitment",
      "preserves_self_correction",
      "expert_preferred_move",
      "commitment_distance",
      "harmful_over_commitment",
      "harmful_under_commitment",
      "answer_leakage",
      "self_correction_support",
      "notes"
    ]
  );
}

function study3RowsToCsv(rows: Study3Row[]): string {
  return rowsToCsv(rows as unknown as Record<string, unknown>[], [
    "material_id",
    "episode_log_id",
    "assistant_label",
    "condition",
    "teacher_next_turn",
    "decision_time_ms",
    "perceived_load"
  ]);
}

function downloadCsv(filename: string, csvText: string) {
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
