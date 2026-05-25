"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  ArrowsClockwiseIcon,
  ChartBarIcon,
  DownloadSimpleIcon,
  FileCsvIcon
} from "@phosphor-icons/react";

import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { episodeLogsCsvUrl, listDataDictionary, listEpisodeLogs } from "@/lib/api";
import { cn } from "@/lib/utils";
import type {
  DataDictionaryField,
  EpisodeLog,
  GateMove,
  QueueState,
  ResponseSource,
  StudentConfidence,
  TeacherAction
} from "@/lib/types";

const moveLabels: Record<string, string> = {
  hold: "Hold",
  ask_for_evidence: "Ask",
  diagnostic_probe: "Probe"
};

const responseSourceLabels: Record<ResponseSource, string> = {
  student_qr: "学生扫码",
  teacher_representative: "教师代表",
  imported_episode: "导入"
};

const teacherActionLabels: Record<TeacherAction, string> = {
  use: "采用",
  edit: "编辑后采用",
  delay: "稍后处理",
  skip: "跳过"
};

const queueStateLabels: Record<QueueState, string> = {
  none: "无队列",
  queued: "待处理",
  resolved: "已处理",
  dismissed: "已忽略"
};
const confidenceLabels: Record<StudentConfidence, string> = {
  unsure: "不确定",
  low: "把握较低",
  medium: "有些把握",
  high: "很有把握"
};

export default function ResearchPage() {
  const [logs, setLogs] = useState<EpisodeLog[]>([]);
  const [dictionary, setDictionary] = useState<DataDictionaryField[]>([]);
  const [systemMove, setSystemMove] = useState<GateMove | "all">("all");
  const [responseSource, setResponseSource] = useState<ResponseSource | "all">("all");
  const [teacherAction, setTeacherAction] = useState<TeacherAction | "all">("all");
  const [queueState, setQueueState] = useState<QueueState | "all">("all");
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const filters = useMemo(
    () => ({
      system_move: systemMove,
      response_source: responseSource,
      teacher_action: teacherAction,
      queue_state: queueState,
      limit: pageSize,
      offset: pageIndex * pageSize
    }),
    [pageIndex, pageSize, queueState, responseSource, systemMove, teacherAction]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setLogs(await listEpisodeLogs(filters));
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [filters]);

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
  }, [queueState, responseSource, systemMove, teacherAction]);

  const moveCounts = logs.reduce<Record<GateMove, number>>(
    (acc, log) => {
      if (log.system_move) {
        acc[log.system_move] += 1;
      }
      return acc;
    },
    { hold: 0, ask_for_evidence: 0, diagnostic_probe: 0 }
  );

  function downloadCsv() {
    window.location.href = episodeLogsCsvUrl({ ...filters, deidentify: true });
  }

  function resetFilters() {
    setSystemMove("all");
    setResponseSource("all");
    setTeacherAction("all");
    setQueueState("all");
    setPageIndex(0);
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className={cn(buttonVariants({ variant: "ghost" }), "text-muted-foreground")}>
          <ArrowLeftIcon data-icon="inline-start" className="size-4" weight="bold" />
          返回首页
        </Link>
        <Button onClick={() => void load()} variant="outline">
          <ArrowsClockwiseIcon data-icon="inline-start" className="size-4" weight="bold" />
          刷新
        </Button>
      </div>

      <header className="mb-5">
        <div className="flex items-center gap-2">
          <ChartBarIcon className="size-6 text-primary" weight="duotone" />
          <h1 className="text-2xl font-semibold text-foreground">研究日志</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">用于核对 Study 2/3/4 所需 episode 字段。</p>
      </header>

      <section className="mb-5 grid gap-3 md:grid-cols-4">
        <Metric label="总 episode" value={logs.length} />
        <Metric label="Hold" value={moveCounts.hold} />
        <Metric label="Ask" value={moveCounts.ask_for_evidence} />
        <Metric label="Probe" value={moveCounts.diagnostic_probe} />
      </section>

      <Card className="mb-4">
        <CardContent>
          <div className="grid gap-3 md:grid-cols-4">
            <FilterSelect
              label="Move"
              value={systemMove}
              onValueChange={(value) => setSystemMove(value as GateMove | "all")}
              options={[
                ["all", "全部 Move"],
                ["hold", "Hold"],
                ["ask_for_evidence", "Ask"],
                ["diagnostic_probe", "Probe"]
              ]}
            />
            <FilterSelect
              label="来源"
              value={responseSource}
              onValueChange={(value) => setResponseSource(value as ResponseSource | "all")}
              options={[
                ["all", "全部来源"],
                ["student_qr", "学生扫码"],
                ["teacher_representative", "教师代表"],
                ["imported_episode", "导入"]
              ]}
            />
            <FilterSelect
              label="教师动作"
              value={teacherAction}
              onValueChange={(value) => setTeacherAction(value as TeacherAction | "all")}
              options={[
                ["all", "全部动作"],
                ["use", "采用"],
                ["edit", "编辑后采用"],
                ["delay", "稍后处理"],
                ["skip", "跳过"]
              ]}
            />
            <FilterSelect
              label="队列"
              value={queueState}
              onValueChange={(value) => setQueueState(value as QueueState | "all")}
              options={[
                ["all", "全部队列状态"],
                ["queued", "待处理"],
                ["resolved", "已处理"],
                ["dismissed", "已忽略"],
                ["none", "无队列"]
              ]}
            />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button onClick={downloadCsv} disabled={logs.length === 0}>
              <DownloadSimpleIcon data-icon="inline-start" className="size-4" weight="bold" />
              导出当前 CSV
            </Button>
            <Button onClick={resetFilters} variant="outline">
              清除筛选
            </Button>
            <div className="ml-auto flex items-center gap-2">
              <Button variant="outline" disabled={pageIndex === 0} onClick={() => setPageIndex((value) => value - 1)}>
                上一页
              </Button>
              <Badge variant="outline">第 {pageIndex + 1} 页</Badge>
              <Button
                variant="outline"
                disabled={logs.length < pageSize}
                onClick={() => setPageIndex((value) => value + 1)}
              >
                下一页
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
                  <span>{pageSize} 条</span>
                </SelectTrigger>
                <SelectContent>
                  {[25, 50, 100].map((value) => (
                    <SelectItem key={value} value={String(value)}>
                      {value} 条
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? <p className="text-sm text-muted-foreground">加载中...</p> : null}
      {error ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCsvIcon className="size-5 text-primary" weight="duotone" />
            Episode table
          </CardTitle>
          <CardDescription>回答来源、证据状态、教师动作和 gate 审计字段。</CardDescription>
        </CardHeader>
        <CardContent>
          <Table className="min-w-[1240px]">
            <TableHeader>
              <TableRow>
                <TableHead>Condition</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Move</TableHead>
                <TableHead>Evidence</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Teacher Action</TableHead>
                <TableHead>Decision Time</TableHead>
                <TableHead>Student Answer</TableHead>
                <TableHead>Feedback / Queue</TableHead>
                <TableHead>Gate Reasons</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{log.condition}</TableCell>
                  <TableCell>
                    {log.response_source ? responseSourceLabels[log.response_source] : "-"}
                  </TableCell>
                  <TableCell>
                    {log.system_move ? <Badge variant="secondary">{moveLabels[log.system_move]}</Badge> : "-"}
                  </TableCell>
                  <TableCell>{log.evidence_state ?? "-"}</TableCell>
                  <TableCell>{log.confidence_level ? confidenceLabels[log.confidence_level] : "-"}</TableCell>
                  <TableCell>{log.teacher_action ? teacherActionLabels[log.teacher_action] : "-"}</TableCell>
                  <TableCell>
                    {log.decision_time_ms === null ? "-" : `${Math.round(log.decision_time_ms / 1000)}s`}
                  </TableCell>
                  <TableCell className="max-w-sm whitespace-normal leading-6">{log.student_answer}</TableCell>
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
                        队列：{queueStateLabels[log.queue_state]}
                      </span>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-28 text-center text-muted-foreground">
                    暂无 episode log。运行一次代表回答分析后，这里会出现研究记录。
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle>数据字典</CardTitle>
          <CardDescription>导出字段含义、来源和取值范围。</CardDescription>
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
    </main>
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
