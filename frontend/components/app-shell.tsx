"use client";

import { Link } from "@/i18n/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { CaretRightIcon, HouseIcon, PlugsConnectedIcon } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { SettingsQuickPopover } from "@/components/settings-quick-popover";
import { getSystemStatus } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { SystemStatus } from "@/lib/types";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function AppShell({
  breadcrumbs,
  rightActions,
  children,
  className
}: {
  breadcrumbs: BreadcrumbItem[];
  rightActions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const common = useTranslations("Common");

  useEffect(() => {
    let cancelled = false;
    getSystemStatus()
      .then((nextStatus) => {
        if (!cancelled) {
          setStatus(nextStatus);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const resolvedBreadcrumbs = breadcrumbs.length > 0 ? breadcrumbs : [{ label: common("home"), href: "/" }];

  return (
    <main className={cn("mx-auto min-h-screen w-full max-w-7xl px-6 py-6", className)}>
      <header className="mb-6 border-b pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav className="flex min-w-0 flex-wrap items-center gap-1 text-sm text-muted-foreground">
            {resolvedBreadcrumbs.map((item, index) => {
              const isLast = index === resolvedBreadcrumbs.length - 1;
              return (
                <span key={`${item.label}-${index}`} className="inline-flex min-w-0 items-center gap-1">
                  {index > 0 ? <CaretRightIcon className="size-3.5 shrink-0" weight="bold" /> : null}
                  {item.href && !isLast ? (
                    <Link href={item.href} className="inline-flex items-center gap-1 hover:text-foreground">
                      {index === 0 ? <HouseIcon className="size-4" weight="duotone" /> : null}
                      <span className="truncate">{item.label}</span>
                    </Link>
                  ) : (
                    <span className={cn("inline-flex items-center gap-1 truncate", isLast ? "text-foreground" : "")}>
                      {index === 0 ? <HouseIcon className="size-4" weight="duotone" /> : null}
                      {item.label}
                    </span>
                  )}
                </span>
              );
            })}
          </nav>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadges status={status} />
            <SettingsQuickPopover status={status} />
            {rightActions}
          </div>
        </div>
      </header>
      {children}
    </main>
  );
}

function StatusBadges({ status }: { status: SystemStatus | null }) {
  const shell = useTranslations("Shell");
  const common = useTranslations("Common");
  if (!status) {
    return (
      <Badge variant="outline" className="gap-1">
        <PlugsConnectedIcon className="size-3.5" weight="duotone" />
        {shell("statusLoading")}
      </Badge>
    );
  }
  return (
    <>
      <Badge variant={status.ai_configured ? "secondary" : "outline"}>
        {shell("ai")}: {status.ai_provider}
        {status.model_name ? ` / ${status.model_name}` : ""}
        {status.ai_configured ? "" : ` / ${common("unconfigured")}`}
      </Badge>
      <Badge variant="outline">{shell("mode")}: {status.app_mode}</Badge>
      <Badge variant="outline">{shell("storage")}: {status.storage_backend}</Badge>
      <Badge variant={status.auth_required ? "secondary" : "outline"}>
        {shell("auth")}: {status.auth_required ? common("protected") : common("open")}
      </Badge>
    </>
  );
}
