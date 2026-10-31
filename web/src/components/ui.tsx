import { Tabs, TabsList, TabsTrigger } from "@/components/motion/tabs";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { LockKey, CircleNotch } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { ThemeToggle as BeThemeToggle } from "@/components/motion/theme-toggle";
import { Alert, AlertContent, AlertDescription, AlertIcon, type AlertVariant } from "@/components/motion/alert";
import { Card } from "@/components/motion/card";
import { Persona } from "./Persona";

export { Card };

export function Logo({ to = "/", className }: { to?: string; className?: string }) {
  return (
    <Link to={to} className={cn("inline-flex items-center gap-2 text-[15px] font-semibold tracking-tight", className)} aria-label="Morrowseal home">
      <span className="grid size-7 place-items-center rounded-full bg-primary text-primary-foreground"><LockKey size={15} weight="bold" /></span>
      morrowseal
    </Link>
  );
}

export function ThemeToggle({ className }: { className?: string }) {
  return <BeThemeToggle variant="circle" start="top-right" className={cn("size-9 rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground", className)} iconClassName="size-4" />;
}

/** Class names for a beUI-style pill on a router Link or plain anchor. */
export function btn(variant: "primary" | "secondary" | "ghost" | "outline" = "primary", size: "sm" | "md" | "lg" = "md", extra?: string) {
  const v = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90",
    secondary: "border border-border bg-card text-foreground hover:border-border-strong",
    ghost: "text-muted-foreground hover:text-foreground hover:bg-muted/60",
    outline: "border border-border bg-transparent text-foreground hover:bg-muted/60",
  }[variant];
  const s = { sm: "h-8 px-3 text-xs gap-1.5", md: "h-10 px-5 text-sm gap-2", lg: "h-12 px-6 text-base gap-2" }[size];
  return cn("inline-flex items-center justify-center rounded-full font-medium select-none whitespace-nowrap transition-[color,background-color,border-color,transform] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50", v, s, extra);
}

export function Spinner({ size = 14, className }: { size?: number; className?: string }) {
  return <CircleNotch size={size} className={cn("animate-spin", className)} />;
}

const BANNER: Record<string, AlertVariant> = { info: "info", warn: "warning", ok: "success", bad: "destructive", plain: "default" };
export function Banner({ tone = "info", icon, children, className }: { tone?: "info" | "warn" | "ok" | "bad" | "plain"; icon?: boolean; children: ReactNode; className?: string }) {
  return (
    <Alert variant={BANNER[tone]} className={className}>
      {icon === false ? null : <AlertIcon />}
      <AlertContent><AlertDescription className="text-foreground/80">{children}</AlertDescription></AlertContent>
    </Alert>
  );
}

export function PageHead({ title, sub, children }: { title: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {sub && <p className="mt-1.5 max-w-2xl text-pretty text-sm text-muted-foreground sm:text-base">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <Card className={cn("gap-0 p-5 sm:p-6", className)}>{children}</Card>;
}

export function IconChip({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("inline-grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary", className)}>{children}</span>;
}

export function Empty({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
      <IconChip className="size-12">{icon}</IconChip>
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      {children && <p className="max-w-md text-pretty text-sm text-muted-foreground">{children}</p>}
      {action}
    </div>
  );
}

/** Label / value list (replaces <dl class="kv">). */
export function Kv({ rows, className }: { rows: [ReactNode, ReactNode][]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-[11rem_1fr] sm:gap-y-3", className)}>
      {rows.map(([k, v], i) => (
        <div key={i} className="contents">
          <dt className="pt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:pt-0 sm:text-sm sm:normal-case sm:tracking-normal">{k}</dt>
          <dd className="min-w-0 break-words text-sm">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A divided list row. */
export function Row({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap items-center gap-3 border-b border-border py-3.5 first:pt-0 last:border-b-0 last:pb-0", className)}>{children}</div>;
}

export function Skeleton({ className }: { className?: string }) {
  return <span className={cn("block animate-pulse rounded-full bg-foreground/10", className)} />;
}

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("font-mono text-[0.92em] tracking-tight", className)}>{children}</span>;
}

export function useNow(ms = 1000) {
  const [now, set] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => set(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

export function HeirChip({ name, email }: { name: string; email: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-card py-0.5 pl-0.5 pr-2.5 text-xs font-medium" title={`${name} · ${email}`}>
      <Persona email={email} name={name} size="small" /><span className="truncate">{name}</span>
    </span>
  );
}

/** Fade-and-rise when scrolled into view. */
export function Rise({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 22, filter: "blur(6px)" }} whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.6, delay: delay / 1000, ease: [0.16, 1, 0.3, 1] }}>
      {children}
    </motion.div>
  );
}

/** Segmented control on top of beUI Tabs. Values may be numbers. */
export function Seg<T extends string | number>({ options, value, onChange, label }: { options: readonly (readonly [string, T])[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div className="max-w-full overflow-x-auto" role="group" aria-label={label}>
      <Tabs value={String(value)} onValueChange={(v) => { const o = options.find((x) => String(x[1]) === v); if (o) onChange(o[1]); }} variant="segment">
        <TabsList>{options.map(([l, v]) => <TabsTrigger key={String(v)} value={String(v)}>{l}</TabsTrigger>)}</TabsList>
      </Tabs>
    </div>
  );
}

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: ReactNode; children: ReactNode }) {
  return <div className="flex min-w-0 flex-col gap-1.5"><label htmlFor={htmlFor} className="text-sm font-medium">{label}</label>{children}{hint && <span className="text-xs text-muted-foreground">{hint}</span>}</div>;
}

export function Textarea({ className, ...p }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn("min-h-32 w-full resize-y rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-4 focus:ring-primary/15", className)} {...p} />;
}

/** Centered single-card page (claim / waiting / 404). */
export function CenterPage({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="relative grid min-h-dvh place-items-center overflow-x-clip px-4 pb-10 pt-24">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(60%_60%_at_50%_0%,color-mix(in_oklab,var(--primary)_14%,transparent),transparent)]" aria-hidden />
      <div className="fixed inset-x-0 top-0 z-20 flex items-center justify-between px-4 py-4 sm:px-6"><Logo /><ThemeToggle /></div>
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} className={cn("relative w-full", wide ? "max-w-2xl" : "max-w-lg")}>
        <Card className="items-center gap-4 px-6 py-10 text-center shadow-xl shadow-black/5 sm:px-10">{children}</Card>
      </motion.div>
    </div>
  );
}

export function Hero({ icon, tone = "primary" }: { icon: ReactNode; tone?: "primary" | "success" }) {
  return <span className={cn("grid size-16 place-items-center rounded-full", tone === "success" ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-primary/12 text-primary")}>{icon}</span>;
}
