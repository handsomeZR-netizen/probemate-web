"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import {
  ArrowLeftIcon,
  BoundingBoxIcon,
  BrainIcon,
  DatabaseIcon,
  GlobeIcon,
  LockKeyIcon,
  MoonIcon,
  PlugsConnectedIcon,
  PulseIcon,
  ShieldCheckIcon,
  SunIcon,
  TranslateIcon
} from "@phosphor-icons/react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { getSystemStatus } from "@/lib/api";
import { getStoredTheme, storeLanguage, storeTheme, type ThemePreference } from "@/lib/preferences";
import { cn } from "@/lib/utils";
import type { SystemStatus } from "@/lib/types";

type Language = "zh" | "en";

export default function SettingsPage() {
  const t = useTranslations("Settings");
  const common = useTranslations("Common");
  const shell = useTranslations("Shell");
  const locale = useLocale() as Language;
  const pathname = usePathname();
  const router = useRouter();
  const [theme, setTheme] = useState<ThemePreference>("system");
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setTheme(getStoredTheme());
    getSystemStatus()
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  const langLabels: Record<Language, string> = {
    zh: shell("languageZh"),
    en: shell("languageEn")
  };

  const themeLabels: Record<ThemePreference, string> = {
    light: shell("themeLight"),
    dark: shell("themeDark"),
    system: shell("themeSystem")
  };

  function handleThemeChange(next: ThemePreference) {
    setTheme(next);
    storeTheme(next);
    setMessage(t("themeChanged", { value: themeLabels[next] }));
  }

  function handleLanguageChange(next: Language) {
    storeLanguage(next);
    setMessage(t("languageChanged", { value: langLabels[next] }));
    router.replace(pathname, { locale: next });
  }

  async function refreshStatus() {
    try {
      setStatus(await getSystemStatus());
      setMessage(common("statusUpdated"));
    } catch {
      setMessage(common("statusFailed"));
    }
  }

  return (
    <AppShell
      breadcrumbs={[
        { label: common("home"), href: "/" },
        { label: common("settings") }
      ]}
      className="max-w-4xl"
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className={cn(buttonVariants({ variant: "ghost" }), "text-muted-foreground")}>
          <ArrowLeftIcon data-icon="inline-start" className="size-4" weight="bold" />
          {common("backHome")}
        </Link>
        <Button type="button" variant="outline" onClick={() => void refreshStatus()}>
          <PulseIcon data-icon="inline-start" className="size-4" weight="duotone" />
          {common("refreshStatus")}
        </Button>
      </div>

      <header className="mb-8">
        <div className="flex flex-wrap items-center gap-2">
          <BoundingBoxIcon className="size-6 text-primary" weight="duotone" />
          <h1 className="text-2xl font-semibold text-foreground">{t("title")}</h1>
        </div>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{t("description")}</p>
      </header>

      {message ? (
        <Alert className="mb-6">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-8">
        <section>
          <div className="mb-4 flex items-center gap-2">
            <SunIcon className="size-5 text-muted-foreground" weight="duotone" />
            <h2 className="text-lg font-semibold text-foreground">{t("appearance")}</h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <MoonIcon className="size-5 text-primary" weight="duotone" />
                  <CardTitle className="text-base">{t("themeMode")}</CardTitle>
                </div>
                <CardDescription>{t("themeDescription")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {(["light", "dark", "system"] as ThemePreference[]).map((themeOption) => (
                    <Button
                      key={themeOption}
                      type="button"
                      variant={theme === themeOption ? "secondary" : "outline"}
                      onClick={() => handleThemeChange(themeOption)}
                    >
                      {themeOption === "light" ? (
                        <SunIcon data-icon="inline-start" className="size-4" weight="duotone" />
                      ) : themeOption === "dark" ? (
                        <MoonIcon data-icon="inline-start" className="size-4" weight="duotone" />
                      ) : null}
                      {themeLabels[themeOption]}
                    </Button>
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  {t("current", { value: themeLabels[theme] })}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <TranslateIcon className="size-5 text-primary" weight="duotone" />
                  <CardTitle className="text-base">{t("languagePreference")}</CardTitle>
                </div>
                <CardDescription>{t("languageDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <Label>{t("interfaceLanguage")}</Label>
                  <Select
                    value={locale}
                    onValueChange={(value) => handleLanguageChange(value as Language)}
                  >
                    <SelectTrigger className="w-36">
                      <SelectValue>{langLabels[locale]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="zh">
                        <GlobeIcon className="size-4" weight="duotone" />
                        {langLabels.zh}
                      </SelectItem>
                      <SelectItem value="en">
                        <GlobeIcon className="size-4" weight="duotone" />
                        {langLabels.en}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("current", { value: langLabels[locale] })}
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        <Separator />

        <section>
          <div className="mb-4 flex items-center gap-2">
            <DatabaseIcon className="size-5 text-muted-foreground" weight="duotone" />
            <h2 className="text-lg font-semibold text-foreground">{t("storageAuth")}</h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <DatabaseIcon className="size-5 text-primary" weight="duotone" />
                  <CardTitle className="text-base">{t("storageBackend")}</CardTitle>
                </div>
                <CardDescription>{t("storageDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <StatusBadge
                    value={status?.storage_backend ?? "loading"}
                    variant={status?.storage_backend === "postgres" ? "secondary" : "outline"}
                  />
                  <span className="text-xs text-muted-foreground">
                    {status?.storage_backend === "json" ? t("jsonStorage") : t("postgresStorage")}
                  </span>
                </div>
                <Alert>
                  <AlertDescription className="text-xs leading-5">
                    {t("storageHelp")}
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  {status?.auth_required ? (
                    <LockKeyIcon className="size-5 text-primary" weight="duotone" />
                  ) : (
                    <ShieldCheckIcon className="size-5 text-primary" weight="duotone" />
                  )}
                  <CardTitle className="text-base">{t("authStatus")}</CardTitle>
                </div>
                <CardDescription>{t("authDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <StatusBadge
                    value={status?.auth_required ? "protected" : "open"}
                    variant={status?.auth_required ? "secondary" : "outline"}
                  />
                  <span className="text-xs text-muted-foreground">
                    {status?.auth_required ? t("authProtected") : t("authOpen")}
                  </span>
                </div>
                <Alert>
                  <AlertDescription className="text-xs leading-5">
                    {t("authHelp")}
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </div>
        </section>

        <Separator />

        <section>
          <div className="mb-4 flex items-center gap-2">
            <BrainIcon className="size-5 text-muted-foreground" weight="duotone" />
            <h2 className="text-lg font-semibold text-foreground">{t("moreSettings")}</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Link href="/settings/ai" className="group block">
              <Card className="h-full transition hover:border-primary/40 hover:shadow-md">
                <CardHeader>
                  <div className="mb-2 flex items-center gap-2">
                    <BrainIcon className="size-5 text-primary" weight="duotone" />
                    <CardTitle className="text-sm">{common("aiSettings")}</CardTitle>
                  </div>
                  <CardDescription className="text-xs leading-5">
                    {t("aiDescription")}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>

            <Link href="/" className="group block">
              <Card className="h-full transition hover:border-primary/40 hover:shadow-md">
                <CardHeader>
                  <div className="mb-2 flex items-center gap-2">
                    <PlugsConnectedIcon className="size-5 text-primary" weight="duotone" />
                    <CardTitle className="text-sm">{t("commandCenter")}</CardTitle>
                  </div>
                  <CardDescription className="text-xs leading-5">
                    {t("commandDescription")}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>

            <Link href="/teacher" className="group block">
              <Card className="h-full transition hover:border-primary/40 hover:shadow-md">
                <CardHeader>
                  <div className="mb-2 flex items-center gap-2">
                    <BoundingBoxIcon className="size-5 text-primary" weight="duotone" />
                    <CardTitle className="text-sm">{common("teacher")}</CardTitle>
                  </div>
                  <CardDescription className="text-xs leading-5">
                    {t("teacherDescription")}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function StatusBadge({ value, variant }: { value: string; variant: "secondary" | "outline" }) {
  return (
    <Badge variant={variant} className="gap-1">
      <PlugsConnectedIcon className="size-3.5" weight="duotone" />
      {value}
    </Badge>
  );
}
