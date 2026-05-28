"use client";

import { useEffect, useState } from "react";
import {
  ArrowSquareOutIcon,
  BrainIcon,
  GearSixIcon,
  GlobeIcon,
  MoonIcon,
  PlugsConnectedIcon,
  SunIcon,
  XIcon
} from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getStoredTheme, storeLanguage, storeTheme, type ThemePreference } from "@/lib/preferences";
import type { SystemStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SettingsQuickPopover({ status }: { status: SystemStatus | null }) {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const t = useTranslations("Shell");
  const common = useTranslations("Common");
  const shouldReduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<ThemePreference>("system");

  useEffect(() => {
    setTheme(getStoredTheme());
  }, []);

  function updateTheme(nextTheme: ThemePreference) {
    setTheme(nextTheme);
    storeTheme(nextTheme);
  }

  function switchLocale(nextLocale: Locale) {
    storeLanguage(nextLocale);
  }

  const itemMotion = shouldReduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 8, filter: "blur(2px)" },
        animate: { opacity: 1, y: 0, filter: "blur(0px)" }
      };

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label={t("settingsTitle")}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "relative text-muted-foreground")}
      >
        <motion.span animate={{ rotate: open ? 42 : 0, scale: open ? 1.04 : 1 }} transition={{ duration: 0.18 }}>
          <GearSixIcon className="size-5" weight="duotone" />
        </motion.span>
      </button>
      <AnimatePresence>
        {open ? (
          <>
            <motion.button
              type="button"
              aria-label={common("close")}
              className="settings-popover-backdrop fixed inset-0 z-40 bg-background/35"
              data-open
              initial={shouldReduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={shouldReduceMotion ? undefined : { opacity: 0 }}
              transition={{ duration: 0.12, ease: "linear" }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="settings-popover-title"
              aria-describedby="settings-popover-description"
              className="settings-popover fixed right-3 top-14 z-50 w-[min(92vw,360px)] rounded-xl border bg-popover/95 p-3 text-popover-foreground shadow-2xl outline-none ring-1 ring-foreground/5 backdrop-blur-xl sm:right-6"
              initial={shouldReduceMotion ? false : { opacity: 0, y: -8, scale: 0.96, filter: "blur(3px)" }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              exit={shouldReduceMotion ? undefined : { opacity: 0, y: -6, scale: 0.98, filter: "blur(2px)" }}
              transition={{ duration: 0.18, ease: "linear" }}
            >
            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.16, ease: "linear" }}
              className="flex items-start justify-between gap-3"
            >
              <div>
                <h2 id="settings-popover-title" className="text-sm font-semibold text-foreground">{t("settingsTitle")}</h2>
                <p id="settings-popover-description" className="mt-1 text-xs leading-5 text-muted-foreground">
                  {t("settingsDescription")}
                </p>
              </div>
              <button
                type="button"
                aria-label={common("close")}
                onClick={() => setOpen(false)}
                className={buttonVariants({ variant: "ghost", size: "icon-xs" })}
              >
                <XIcon className="size-3.5" weight="bold" />
              </button>
            </motion.div>

            <motion.div
              className="mt-4 space-y-4"
              transition={shouldReduceMotion ? undefined : { staggerChildren: 0.035 }}
            >
              <motion.section {...itemMotion}>
                <SectionLabel icon={<SunIcon className="size-4" weight="duotone" />} label={t("appearance")} />
                <div className="mt-2 grid grid-cols-3 gap-1.5">
                  {(["light", "dark", "system"] as ThemePreference[]).map((nextTheme) => (
                    <Button
                      key={nextTheme}
                      type="button"
                      size="sm"
                      variant={theme === nextTheme ? "secondary" : "outline"}
                      onClick={() => updateTheme(nextTheme)}
                      className="min-w-0"
                    >
                      {nextTheme === "light" ? (
                        <SunIcon className="size-3.5" weight="duotone" />
                      ) : nextTheme === "dark" ? (
                        <MoonIcon className="size-3.5" weight="duotone" />
                      ) : null}
                      <span className="truncate">{t(`theme${capitalize(nextTheme)}`)}</span>
                    </Button>
                  ))}
                </div>
              </motion.section>

              <Separator />

              <motion.section {...itemMotion}>
                <SectionLabel icon={<GlobeIcon className="size-4" weight="duotone" />} label={t("language")} />
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  {routing.locales.map((nextLocale) => (
                    <Link
                      key={nextLocale}
                      href={pathname}
                      locale={nextLocale}
                      onClick={() => switchLocale(nextLocale)}
                      className={cn(
                        buttonVariants({ variant: locale === nextLocale ? "secondary" : "outline", size: "sm" }),
                        "min-w-0"
                      )}
                    >
                      {nextLocale === "zh" ? t("languageZh") : t("languageEn")}
                    </Link>
                  ))}
                </div>
              </motion.section>

              <Separator />

              <motion.section {...itemMotion}>
                <SectionLabel
                  icon={<PlugsConnectedIcon className="size-4" weight="duotone" />}
                  label={t("system")}
                />
                <div className="mt-2 grid gap-2 text-xs">
                  {status ? (
                    <>
                      <StatusLine label={t("ai")} value={`${status.ai_provider}${status.model_name ? ` / ${status.model_name}` : ""}`} />
                      <StatusLine label={t("mode")} value={status.app_mode} />
                      <StatusLine label={t("storage")} value={status.storage_backend} />
                      <StatusLine label={t("auth")} value={status.auth_required ? common("protected") : common("open")} />
                    </>
                  ) : (
                    <Badge variant="outline">{t("statusLoading")}</Badge>
                  )}
                </div>
              </motion.section>

              <motion.div {...itemMotion} className="grid grid-cols-2 gap-2 pt-1">
                <Link href="/settings" onClick={() => setOpen(false)} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  <ArrowSquareOutIcon className="size-4" weight="duotone" />
                  {t("fullSettings")}
                </Link>
                <Link href="/settings/ai" onClick={() => setOpen(false)} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  <BrainIcon className="size-4" weight="duotone" />
                  {t("aiProviderSettings")}
                </Link>
              </motion.div>
            </motion.div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}

function SectionLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-normal text-muted-foreground">
      {icon}
      {label}
    </p>
  );
}

function StatusLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/35 px-2.5 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate text-right font-medium text-foreground">{value}</span>
    </div>
  );
}

function capitalize(value: string) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
