"use client";

import { FormEvent, useState } from "react";
import { Link } from "@/i18n/navigation";
import { ArrowLeftIcon, LockKeyIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { AppShell } from "@/components/app-shell";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger
} from "@/components/ui/select";
import { login, saveAuthSession } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const t = useTranslations("Login");
  const common = useTranslations("Common");
  const [role, setRole] = useState<"teacher" | "researcher">("teacher");
  const [accessCode, setAccessCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      const session = await login({ role, access_code: accessCode });
      saveAuthSession(session);
      setMessage(session.auth_required ? t("loggedIn") : t("localMode"));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t("failed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell
      breadcrumbs={[
        { label: common("home"), href: "/" },
        { label: t("title") }
      ]}
      className="max-w-md"
    >
      <Link href="/" className={cn(buttonVariants({ variant: "ghost" }), "mb-6 text-muted-foreground")}>
        <ArrowLeftIcon data-icon="inline-start" className="size-4" weight="bold" />
        {common("backHome")}
      </Link>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LockKeyIcon className="size-5 text-primary" weight="duotone" />
            {t("title")}
          </CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("role")}</Label>
              <Select value={role} onValueChange={(value) => setRole(value as "teacher" | "researcher")}>
                <SelectTrigger className="w-full">
                  <span>{role === "teacher" ? t("teacher") : t("researcher")}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="teacher">{t("teacher")}</SelectItem>
                  <SelectItem value="researcher">{t("researcher")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="access_code">{t("accessCode")}</Label>
              <Input
                id="access_code"
                type="password"
                value={accessCode}
                onChange={(event) => setAccessCode(event.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? t("loggingIn") : t("login")}
            </Button>
          </form>
          {message ? (
            <Alert className="mt-4">
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>
    </AppShell>
  );
}
