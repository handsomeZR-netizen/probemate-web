"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon, LockKeyIcon } from "@phosphor-icons/react";

import { Alert, AlertDescription } from "@/components/ui/alert";
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
      setMessage(session.auth_required ? "已登录" : "本地模式已启用");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "登录失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <Link href="/" className={cn(buttonVariants({ variant: "ghost" }), "mb-6 text-muted-foreground")}>
        <ArrowLeftIcon data-icon="inline-start" className="size-4" weight="bold" />
        返回首页
      </Link>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LockKeyIcon className="size-5 text-primary" weight="duotone" />
            访问登录
          </CardTitle>
          <CardDescription>部署时使用教师或研究者访问码保护后台。</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>角色</Label>
              <Select value={role} onValueChange={(value) => setRole(value as "teacher" | "researcher")}>
                <SelectTrigger className="w-full">
                  <span>{role === "teacher" ? "教师" : "研究者"}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="teacher">教师</SelectItem>
                  <SelectItem value="researcher">研究者</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="access_code">访问码</Label>
              <Input
                id="access_code"
                type="password"
                value={accessCode}
                onChange={(event) => setAccessCode(event.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "登录中..." : "登录"}
            </Button>
          </form>
          {message ? (
            <Alert className="mt-4">
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
