"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import {
  ArrowRightIcon,
  ArrowSquareOutIcon,
  BrainIcon,
  CheckCircleIcon,
  ClipboardTextIcon,
  FlaskIcon,
  GearSixIcon,
  GitBranchIcon,
  GraduationCapIcon,
  ShieldCheckIcon,
  SparkleIcon,
  TimerIcon
} from "@phosphor-icons/react";

import { AppShell } from "@/components/app-shell";
import { LandingThreeScene } from "@/components/landing-three-scene";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSystemStatus } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { SystemStatus } from "@/lib/types";

const links: {
  href: string;
  titleKey: string;
  descriptionKey: string;
  metaKey: string;
  icon: ReactNode;
}[] = [
  {
    href: "/teacher",
    titleKey: "links.teacherTitle",
    descriptionKey: "links.teacherDescription",
    metaKey: "links.teacherMeta",
    icon: <ClipboardTextIcon className="size-6 text-primary" weight="duotone" />
  },
  {
    href: "/study-builder",
    titleKey: "links.studyTitle",
    descriptionKey: "links.studyDescription",
    metaKey: "links.studyMeta",
    icon: <GitBranchIcon className="size-6 text-primary" weight="duotone" />
  },
  {
    href: "/research",
    titleKey: "links.researchTitle",
    descriptionKey: "links.researchDescription",
    metaKey: "links.researchMeta",
    icon: <FlaskIcon className="size-6 text-primary" weight="duotone" />
  },
  {
    href: "/settings/ai",
    titleKey: "links.settingsTitle",
    descriptionKey: "links.settingsDescription",
    metaKey: "links.settingsMeta",
    icon: <GearSixIcon className="size-6 text-primary" weight="duotone" />
  }
];

const flowSteps = [
  "workflowSteps.checkpoint",
  "workflowSteps.answers",
  "workflowSteps.representative",
  "workflowSteps.llmCandidates",
  "workflowSteps.evidenceAudit",
  "workflowSteps.gate",
  "workflowSteps.action",
  "workflowSteps.episodeLog"
];

const valueItems = [
  { title: "values.evidenceTitle", body: "values.evidenceBody", icon: ShieldCheckIcon },
  { title: "values.commitmentTitle", body: "values.commitmentBody", icon: BrainIcon },
  { title: "values.researchTitle", body: "values.researchBody", icon: FlaskIcon }
];

const howItems = [
  { title: "how.oneTitle", body: "how.oneBody" },
  { title: "how.twoTitle", body: "how.twoBody" },
  { title: "how.threeTitle", body: "how.threeBody" }
];

const effectItems = [
  { key: "effects.fast", icon: TimerIcon },
  { key: "effects.safe", icon: ShieldCheckIcon },
  { key: "effects.export", icon: ClipboardTextIcon },
  { key: "effects.compare", icon: GitBranchIcon }
];

export default function HomePage() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const t = useTranslations("Home");
  const common = useTranslations("Common");

  useEffect(() => {
    getSystemStatus()
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  return (
    <AppShell breadcrumbs={[{ label: common("home") }]} className="max-w-none">
      <section className="relative mx-[-1.5rem] -mt-2 min-h-[calc(100vh-6rem)] overflow-hidden border-b bg-background">
        <LandingThreeScene />
        <div className="absolute inset-0 bg-background/58 backdrop-blur-[1.5px]" />
        <div className="relative mx-auto flex min-h-[calc(100vh-6rem)] max-w-7xl items-center px-6 py-10">
          <div className="grid w-full gap-10 lg:grid-cols-[minmax(0,0.9fr)_420px] lg:items-center">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.28, ease: "linear" }}
              className="max-w-3xl"
            >
              <Badge variant="secondary" className="mb-5 gap-1.5">
                <SparkleIcon className="size-3.5" weight="duotone" />
                {t("heroEyebrow")}
              </Badge>
              <h1 className="text-balance text-5xl font-semibold leading-[1.02] tracking-normal text-foreground sm:text-6xl lg:text-7xl">
                {t("heroTitle")}
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
                {t("heroLead")}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/teacher" className={cn(buttonVariants({ size: "lg" }), "gap-2")}>
                  {t("primaryCta")}
                  <ArrowRightIcon data-icon="inline-end" className="size-4" weight="bold" />
                </Link>
                <Link href="/study-builder" className={buttonVariants({ variant: "outline", size: "lg" })}>
                  {t("secondaryCta")}
                </Link>
                <Link href="/settings/ai" className={buttonVariants({ variant: "ghost", size: "lg" })}>
                  {t("tertiaryCta")}
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 24, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ duration: 0.3, ease: "linear", delay: 0.06 }}
              className="rounded-lg border bg-background/68 p-4 shadow-xl backdrop-blur-xl"
            >
              <div className="flex items-center gap-3 border-b pb-3">
                <div className="flex size-10 items-center justify-center rounded-md bg-primary/10">
                  <GraduationCapIcon className="size-6 text-primary" weight="duotone" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{t("statusTitle")}</p>
                  <p className="text-xs text-muted-foreground">{t("statusDescription")}</p>
                </div>
              </div>
              <div className="mt-4 grid gap-2">
                <StatusMetric label={t("metrics.aiProvider")} value={status?.ai_provider ?? common("loading")} detail={status?.model_name ?? t("metrics.noModel")} />
                <StatusMetric label={t("metrics.mode")} value={status?.app_mode ?? common("loading")} detail={t("metrics.modeDetail")} />
                <StatusMetric
                  label={t("metrics.configured")}
                  value={status ? (status.ai_configured ? common("yes") : common("no")) : common("loading")}
                  detail={status?.fallback_available ? t("metrics.fallbackAvailable") : t("metrics.fallbackUnavailable")}
                />
                <StatusMetric
                  label={t("metrics.researchRuns")}
                  value={String(status?.total_episodes ?? 0)}
                  detail={t("metrics.checkpoints", { count: status?.total_checkpoints ?? 0 })}
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-12">
        <div className="max-w-3xl">
          <h2 className="text-2xl font-semibold text-foreground">{t("valueTitle")}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("valueSubtitle")}</p>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {valueItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ delay: index * 0.04, duration: 0.2, ease: "linear" }}
              >
                <Card className="h-full">
                  <CardHeader>
                    <Icon className="mb-2 size-7 text-primary" weight="duotone" />
                    <CardTitle>{t(item.title)}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-6 text-muted-foreground">{t(item.body)}</p>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </section>

      <section className="border-y bg-muted/25">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-12 lg:grid-cols-[340px_minmax(0,1fr)]">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">{t("howTitle")}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("howSubtitle")}</p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {howItems.map((item, index) => (
              <div key={item.title} className="rounded-md border bg-background p-4">
                <Badge variant="outline" className="mb-4">{index + 1}</Badge>
                <h3 className="font-semibold text-foreground">{t(item.title)}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{t(item.body)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-6 py-12 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">{t("effectTitle")}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{t("effectSubtitle")}</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {effectItems.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.key} className="flex gap-3 rounded-md border bg-card p-4">
                  <Icon className="mt-0.5 size-5 shrink-0 text-primary" weight="duotone" />
                  <p className="text-sm leading-6 text-foreground">{t(item.key)}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border bg-background/80 p-4 backdrop-blur-md">
          <p className="mb-3 text-sm font-semibold text-foreground">{t("workflowTitle")}</p>
          <div className="grid gap-2">
            {flowSteps.map((step, index) => (
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 8 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.025, duration: 0.16, ease: "linear" }}
                className="flex items-center gap-3 rounded-md border bg-muted/30 p-3"
              >
                <Badge variant="outline">{index + 1}</Badge>
                <p className="text-sm font-medium text-foreground">{t(step)}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-14">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Command Center</h2>
            <p className="mt-2 text-sm text-muted-foreground">{t("subtitle")}</p>
          </div>
          {status?.ai_provider === "mock" ? (
            <Badge variant="outline">{t("mockMode")}</Badge>
          ) : status ? (
            <Badge variant={status.ai_configured ? "secondary" : "outline"}>
              {status.ai_configured ? t("realProviderReady") : t("providerMissing")}
            </Badge>
          ) : null}
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {links.map(({ href, titleKey, descriptionKey, metaKey, icon }, index) => (
            <motion.div
              key={href}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              whileHover={{ y: -3 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.03, duration: 0.18, ease: "linear" }}
            >
              <Link href={href} className="group block">
                <Card className="h-full transition hover:border-primary/40 hover:shadow-md">
                  <CardHeader>
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex size-10 items-center justify-center rounded-md bg-muted">{icon}</div>
                      <ArrowSquareOutIcon className="size-5 text-muted-foreground transition group-hover:text-primary" weight="bold" />
                    </div>
                    <CardTitle className="text-lg">{t(titleKey)}</CardTitle>
                    <CardDescription>{t(metaKey)}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-6 text-muted-foreground">{t(descriptionKey)}</p>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}

function StatusMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-md border bg-background/70 p-3 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">{label}</p>
        <CheckCircleIcon className="size-3.5 text-primary" weight="duotone" />
      </div>
      <p className="mt-2 truncate text-lg font-semibold text-foreground">{value}</p>
      <p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}
