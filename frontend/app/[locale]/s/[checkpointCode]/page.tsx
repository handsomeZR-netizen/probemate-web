"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { CheckCircleIcon, PaperPlaneTiltIcon, ShieldCheckIcon } from "@phosphor-icons/react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { AppShell } from "@/components/app-shell";
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
import { ApiError, getCheckpointByCode, getDataGovernancePolicy, submitResponse, updateResponse } from "@/lib/api";
import type { Checkpoint, DataGovernancePolicy, StudentConfidence } from "@/lib/types";

export default function StudentSubmitPage() {
  const t = useTranslations("Student");
  const common = useTranslations("Common");
  const confidenceT = useTranslations("Labels.confidence");
  const params = useParams<{ checkpointCode: string }>();
  const code = String(params.checkpointCode ?? "");
  const [checkpoint, setCheckpoint] = useState<Checkpoint | null>(null);
  const [governance, setGovernance] = useState<DataGovernancePolicy | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitMessage, setSubmitMessage] = useState(t("submitted"));
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
        setError(err instanceof Error ? err.message : t("notFound"));
      }
    }
    if (code) {
      void load();
    }
    getDataGovernancePolicy()
      .then(setGovernance)
      .catch(() => setGovernance(null));
  }, [code, t]);

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
          setSubmitMessage(t("updated"));
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
        setSubmitMessage(t("submitted"));
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
      setError(err instanceof ApiError && err.status === 409 ? t("closedError") : t("failed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell
      breadcrumbs={[
        { label: common("home"), href: "/" },
        { label: t("title") },
        { label: code }
      ]}
      className="max-w-2xl"
    >
      <Card>
        <CardHeader>
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="secondary">ProbeMate checkpoint</Badge>
            {checkpoint ? (
              <Badge variant={checkpoint.status === "open" ? "default" : "secondary"}>
                {checkpoint.status === "open" ? t("statusOpen") : t("statusClosed")}
              </Badge>
            ) : null}
          </div>
          {checkpoint ? <CardTitle className="text-xl leading-8">{checkpoint.question}</CardTitle> : null}
          <CardDescription>{t("shortDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {!checkpoint && !error ? <p className="text-sm text-muted-foreground">{common("loading")}...</p> : null}
          {checkpoint && checkpoint.status === "closed" ? (
            <Alert>
              <ShieldCheckIcon className="size-4" weight="duotone" />
              <AlertDescription>{t("closed")}</AlertDescription>
            </Alert>
          ) : null}
          {checkpoint && checkpoint.status === "open" && !submitted ? (
            <form onSubmit={onSubmit} className="space-y-4">
              <Alert>
                <ShieldCheckIcon className="size-4" weight="duotone" />
                <AlertDescription>
                  {governance?.student_notice ??
                    t("noticeFallback")}
                </AlertDescription>
              </Alert>
              <div className="space-y-2">
                <Label htmlFor="anonymous_student_id">{t("anonymousId")}</Label>
                <Input
                  id="anonymous_student_id"
                  name="anonymous_student_id"
                  value={anonymousStudentId}
                  onChange={(event) => setAnonymousStudentId(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="answer_text">{t("answer")}</Label>
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
                <Label>{t("confidence")}</Label>
                <Select
                  value={confidenceLevel}
                  onValueChange={(value) => value !== null && setConfidenceLevel(value as StudentConfidence)}
                >
                  <SelectTrigger className="w-full">
                    <span>{confidenceT(confidenceLevel)}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {(["unsure", "low", "medium", "high"] as StudentConfidence[]).map((value) => (
                      <SelectItem key={value} value={value}>
                        {confidenceT(value)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                <PaperPlaneTiltIcon data-icon="inline-start" className="size-4" weight="duotone" />
                {submitting ? t("submitting") : savedResponseId ? t("update") : t("submit")}
              </Button>
            </form>
          ) : null}
          {submitted ? (
            <div className="flex flex-col items-center py-10 text-center">
              <CheckCircleIcon className="size-11 text-primary" weight="duotone" />
              <h1 className="mt-4 text-xl font-semibold text-foreground">{submitMessage}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{t("returnClass")}</p>
              {checkpoint?.status === "open" ? (
                <Button className="mt-5" variant="outline" onClick={() => setSubmitted(false)}>
                  {t("editAgain")}
                </Button>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </AppShell>
  );
}

function localStorageKey(checkpointId: string): string {
  return `probemate-response:${checkpointId}`;
}
