// Vault shelf: beUI-styled folder cards with an Animated Badge for status.
import { motion } from "motion/react";
import { FileText, LockKey, Envelope } from "@phosphor-icons/react";
import { AnimatedBadge, type AnimatedBadgeStatus } from "@/components/motion/animated-badge";
import { Card } from "@/components/motion/card";
import { cn } from "@/lib/utils";
import { deadline, type Vault } from "../lib/near";
import { countdown } from "../lib/format";
import { useNow } from "./ui";

export type ShelfVault = Vault & { title: string; files?: number };
type Tone = "blue" | "green" | "amber" | "red";

const TONE: Record<Tone, { back: string; front: string; bar: string }> = {
  blue: { back: "bg-primary/25", front: "bg-primary/15", bar: "bg-primary" },
  green: { back: "bg-emerald-500/25", front: "bg-emerald-500/15", bar: "bg-emerald-500" },
  amber: { back: "bg-amber-500/30", front: "bg-amber-500/15", bar: "bg-amber-500" },
  red: { back: "bg-destructive/25", front: "bg-destructive/12", bar: "bg-destructive" },
};

function tone(v: ShelfVault, left: number): Tone { if (v.status === "Cancelled") return "red"; if (v.status === "Released") return "green"; return left < v.interval_s * 250 ? "amber" : "blue"; }
function badge(v: ShelfVault, left: number): [AnimatedBadgeStatus, string] {
  if (v.status === "Cancelled") return ["neutral", "Cancelled"];
  if (v.status === "Released") return v.claims.every(Boolean) ? ["success", "Opened"] : ["info", "Released"];
  return left <= 0 ? ["danger", "Overdue"] : left < v.interval_s * 250 ? ["warning", "Sealed"] : ["success", "Sealed"];
}

function FolderArt({ t }: { t: Tone }) {
  const c = TONE[t];
  return (
    <div className="relative mx-auto h-28 w-full max-w-[13rem] [perspective:600px]" aria-hidden>
      <div className={cn("absolute bottom-0 left-0 h-24 w-full rounded-2xl", c.back)} />
      <div className={cn("absolute bottom-[5.9rem] left-0 h-4 w-20 rounded-t-xl", c.back)} />
      {[{ r: -7, x: -34, i: Envelope }, { r: 0, x: 0, i: FileText }, { r: 7, x: 34, i: LockKey }].map(({ r, x, i: I }, k) => (
        <motion.div key={k} className="absolute bottom-6 left-1/2 grid h-[4.5rem] w-14 -translate-x-1/2 place-items-center rounded-lg border border-border bg-background text-muted-foreground shadow-sm"
          style={{ rotate: r, x }} variants={{ rest: { y: 0 }, hover: { y: -12 - (k === 1 ? 4 : 0), rotate: r * 1.5 } }} transition={{ type: "spring", stiffness: 340, damping: 22 }}>
          <I size={18} weight="duotone" />
        </motion.div>
      ))}
      <div className={cn("absolute bottom-0 left-0 h-[4.6rem] w-full rounded-2xl border border-white/20 backdrop-blur-[2px]", c.front)} />
    </div>
  );
}

export function VaultShelf({ vaults, onOpen }: { vaults: ShelfVault[]; onOpen: (id: number) => void }) {
  const now = useNow();
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {vaults.map((v, idx) => {
        const left = deadline(v) - now;
        const total = (v.interval_s + v.grace_s) * 1000;
        const p = v.status === "Active" ? Math.min(1, Math.max(0, left / total)) : 1;
        const t = tone(v, left);
        const [st, word] = badge(v, left);
        return (
          <motion.div key={v.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(idx, 8) * 0.05, duration: 0.4, ease: [0.16, 1, 0.3, 1] }} whileHover="hover">
            <Card interactive size="compact" className="h-full gap-4 px-4 pt-5" onClick={() => onOpen(v.id)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onOpen(v.id)}>
              <FolderArt t={t} />
              <div className="flex min-w-0 flex-col gap-2">
                <AnimatedBadge status={st} size="sm" className="self-start">{word}</AnimatedBadge>
                <div className="truncate text-base font-semibold tracking-tight" title={v.title}>{v.title || "Untitled vault"}</div>
                <div className="text-pretty text-sm text-muted-foreground">{v.status === "Active" ? (left > 0 ? `Releases in ${countdown(left)} without a check-in` : "Releasing to heirs now") : v.status === "Released" ? `${v.claims.filter(Boolean).length} of ${v.heirs} heirs opened it` : "Cancelled by you"}</div>
              </div>
              <div className="mt-auto h-1 overflow-hidden rounded-full bg-foreground/10"><div className={cn("h-full rounded-full transition-[width] duration-700", TONE[t].bar)} style={{ width: `${Math.round(p * 100)}%` }} /></div>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
