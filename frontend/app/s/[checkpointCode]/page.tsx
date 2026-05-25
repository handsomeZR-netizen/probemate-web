"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircleIcon, PaperPlaneTiltIcon, ShieldCheckIcon } from "@phosphor-icons/react";

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
import { ApiError, getCheckpointByCode, submitResponse, updateResponse } from "@/lib/api";
import type { Checkpoint, StudentConfidence } from "@/lib/types";

const statusLabels: Record<Checkpoint["status"], string> = {
  open: "收集中",
  closed: "已关闭"
};
const confidenceLabels: Record<StudentConfidence, string> = {
  unsure: "不确定",
  low: "把握较低",
  medium: "有些把握",
  high: "很有把握"
};

export default function StudentSubmitPage() {
  const params = useParams<{ checkpointCode: string }>();
  const code = String(params.checkpointCode ?? "");
  const [checkpoint, setCheckpoint] = useState<Checkpoint | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("已提交");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [savedResponseId, setSavedResponseId] = useState<string | null>(null);
  const [anonymousStudentId, setAnonymousStudentId] = useState("");
  const [answerText, setAnswerText] = useState("");
  const [confidenceLevel, setConfidenceLevel] = useState<StudentConfidence>("unsure");

  useEffect(() => {
    async function load() {
      try {
        setCheckpoint(await getCheckpointByCode(code));
      } catch (err) {
        setError(err instanceof Error ? err.message : "无法找到 checkpoint");
      }
    }
    if (code) {
      void load();
    }
  }, [code]);

  useEffect(() => {
    if (!checkpoint) {
      return;
    }
    const raw = window.localStorage.getItem(localStorageKey(checkpoint.id));
    if (!raw) {
      return;
    }
    try {
      const saved = JSON.parse(raw) as {
        responseId?: string;
        anonymousStudentId?: string;
        answerText?: string;
        confidenceLevel?: StudentConfidence;
      };
      setSavedResponseId(saved.responseId ?? null);
      setAnonymousStudentId(saved.anonymousStudentId ?? "");
      setAnswerText(saved.answerText ?? "");
      setConfidenceLevel(saved.confidenceLevel ?? "unsure");
    } catch {
      window.localStorage.removeItem(localStorageKey(checkpoint.id));
    }
  }, [checkpoint]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!checkpoint) {
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      let response;
      if (savedResponseId) {
        try {
          response = await updateResponse(savedResponseId, {
            anonymous_student_id: anonymousStudentId,
            answer_text: answerText,
            confidence_level: confidenceLevel
          });
          setSubmitMessage("已更新");
        } catch (err) {
          if (!(err instanceof ApiError) || err.status !== 404) {
            throw err;
          }
        }
      }
      if (!response) {
        response = await submitResponse(checkpoint.id, {
          anonymous_student_id: anonymousStudentId,
          answer_text: answerText,
          response_source: "student_qr",
          confidence_level: confidenceLevel
        });
        setSubmitMessage("已提交");
      }
      setSavedResponseId(response.id);
      window.localStorage.setItem(
        localStorageKey(checkpoint.id),
        JSON.stringify({
          responseId: response.id,
          anonymousStudentId: response.anonymous_student_id,
          answerText: response.answer_text,
          confidenceLevel: response.confidence_level ?? confidenceLevel
        })
      );
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 409 ? "本次提交已关闭，请回到课堂。" : "提交失败，请重试。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-20">
      <Card>
        <CardHeader>
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="secondary">ProbeMate checkpoint</Badge>
            {checkpoint ? (
              <Badge variant={checkpoint.status === "open" ? "default" : "secondary"}>
                {statusLabels[checkpoint.status]}
              </Badge>
            ) : null}
          </div>
          {checkpoint ? <CardTitle className="text-xl leading-8">{checkpoint.question}</CardTitle> : null}
          <CardDescription>短答只用于帮助老师选择下一步追问。</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {!checkpoint && !error ? <p className="text-sm text-muted-foreground">加载中...</p> : null}
          {checkpoint && checkpoint.status === "closed" ? (
            <Alert>
              <ShieldCheckIcon className="size-4" weight="duotone" />
              <AlertDescription>本次 checkpoint 已关闭，请回到课堂讨论。</AlertDescription>
            </Alert>
          ) : null}
          {checkpoint && checkpoint.status === "open" && !submitted ? (
            <form onSubmit={onSubmit} className="space-y-4">
              <Alert>
                <ShieldCheckIcon className="size-4" weight="duotone" />
                <AlertDescription>不会在学生端显示个人误概念标签。</AlertDescription>
              </Alert>
              <div className="space-y-2">
                <Label htmlFor="anonymous_student_id">匿名编号，可留空</Label>
                <Input
                  id="anonymous_student_id"
                  name="anonymous_student_id"
                  value={anonymousStudentId}
                  onChange={(event) => setAnonymousStudentId(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="answer_text">你的回答</Label>
                <Textarea
                  id="answer_text"
                  name="answer_text"
                  required
                  maxLength={200}
                  rows={5}
                  value={answerText}
                  onChange={(event) => setAnswerText(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>你的把握程度</Label>
                <Select
                  value={confidenceLevel}
                  onValueChange={(value) => value !== null && setConfidenceLevel(value as StudentConfidence)}
                >
                  <SelectTrigger className="w-full">
                    <span>{confidenceLabels[confidenceLevel]}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(confidenceLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                <PaperPlaneTiltIcon data-icon="inline-start" className="size-4" weight="duotone" />
                {submitting ? "提交中..." : savedResponseId ? "更新回答" : "提交"}
              </Button>
            </form>
          ) : null}
          {submitted ? (
            <div className="flex flex-col items-center py-10 text-center">
              <CheckCircleIcon className="size-11 text-primary" weight="duotone" />
              <h1 className="mt-4 text-xl font-semibold text-foreground">{submitMessage}</h1>
              <p className="mt-2 text-sm text-muted-foreground">请回到课堂讨论。</p>
              {checkpoint?.status === "open" ? (
                <Button className="mt-5" variant="outline" onClick={() => setSubmitted(false)}>
                  继续修改
                </Button>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}

function localStorageKey(checkpointId: string): string {
  return `probemate-response:${checkpointId}`;
}
