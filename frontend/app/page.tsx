"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowSquareOutIcon,
  ClipboardTextIcon,
  FlaskIcon,
  GraduationCapIcon
} from "@phosphor-icons/react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const links: {
  href: string;
  title: string;
  description: string;
  meta: string;
  icon: ReactNode;
}[] = [
  {
    href: "/teacher",
    title: "教师端",
    description: "创建 checkpoint，查看短答，运行诊断闸门。",
    meta: "Live classroom",
    icon: <ClipboardTextIcon className="size-7 text-primary" weight="duotone" />
  },
  {
    href: "/research",
    title: "研究后台",
    description: "查看 episode log、教师操作记录和 CSV 导出。",
    meta: "Study logs",
    icon: <FlaskIcon className="size-7 text-primary" weight="duotone" />
  }
];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-10">
      <header className="flex items-center gap-4 border-b pb-6">
        <div className="flex size-12 items-center justify-center rounded-lg border bg-card shadow-sm">
          <GraduationCapIcon className="size-7 text-primary" weight="duotone" />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-normal text-foreground">ProbeMate</h1>
            <Badge variant="secondary">Diagnostic gate</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">教师下一句话之前的课堂诊断原型</p>
        </div>
      </header>

      <section className="grid flex-1 items-start gap-4 py-10 md:grid-cols-2">
        {links.map(({ href, title, description, meta, icon }) => (
          <Link key={href} href={href} className="group block">
            <Card className="h-full transition hover:border-primary/40 hover:shadow-md">
              <CardHeader>
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex size-11 items-center justify-center rounded-lg bg-muted">{icon}</div>
                  <ArrowSquareOutIcon
                    className="size-5 text-muted-foreground transition group-hover:text-primary"
                    weight="bold"
                  />
                </div>
                <CardTitle className="text-xl">{title}</CardTitle>
                <CardDescription>{meta}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6 text-muted-foreground">{description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>
    </main>
  );
}
