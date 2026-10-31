// A static, non-interactive picture of the workspace for the landing hero (no real data).
import { Vault, PlusCircle, UsersThree, Heartbeat, ClockCounterClockwise, ShieldCheck, GearSix, LockKey, EnvelopeSimple, CheckCircle } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

function MiniFolder({ tone }: { tone: "blue" | "amber" }) {
  const back = tone === "blue" ? "bg-primary/30" : "bg-amber-500/35";
  const front = tone === "blue" ? "bg-primary/20" : "bg-amber-500/20";
  return (
    <div className="relative mx-auto my-1 h-14 w-20" aria-hidden>
      <div className={cn("absolute bottom-0 h-12 w-full rounded-xl", back)} />
      <div className={cn("absolute bottom-[2.9rem] h-2.5 w-9 rounded-t-lg", back)} />
      <div className="absolute bottom-3 left-4 h-9 w-10 -rotate-6 rounded border border-border bg-background" />
      <div className="absolute bottom-3 right-4 h-9 w-10 rotate-6 rounded border border-border bg-background" />
      <div className={cn("absolute bottom-0 h-9 w-full rounded-xl border border-white/20", front)} />
    </div>
  );
}

export function AppPreview() {
  const nav = [[Vault, "Vaults"], [PlusCircle, "Create"], [UsersThree, "Heirs"], [Heartbeat, "Check-ins"], [ClockCounterClockwise, "Activity"], [ShieldCheck, "Proof"], [GearSix, "Settings"]] as const;
  return (
    <div className="grid overflow-hidden rounded-3xl border border-border bg-card text-[11px] shadow-[0_40px_120px_-40px_rgb(0_0_0/0.35)] sm:grid-cols-[170px_1fr]" aria-hidden>
      <div className="hidden content-start gap-0.5 border-r border-border bg-background p-3 sm:grid">
        <div className="flex items-center gap-2 px-1.5 pb-3 text-[13px] font-semibold tracking-tight"><span className="grid size-5 place-items-center rounded-full bg-primary text-primary-foreground"><LockKey size={11} weight="bold" /></span> morrowseal</div>
        {nav.map(([I, l], i) => <div key={l} className={cn("flex items-center gap-2 rounded-full px-2.5 py-1.5", i === 0 ? "bg-card font-semibold text-foreground ring-1 ring-border" : "text-muted-foreground")}><I size={14} weight={i === 0 ? "fill" : "regular"} />{l}</div>)}
      </div>
      <div className="grid content-start gap-3.5 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3"><div><b className="block text-base font-semibold tracking-tight">Your vaults</b><span className="text-muted-foreground">Everything here is sealed. Only hashes live on NEAR.</span></div><div className="shrink-0 rounded-full bg-primary px-3.5 py-1.5 font-medium text-primary-foreground">I'm here</div></div>
        <div className="grid grid-cols-3 gap-2.5">
          {[["Next check-in", "29 days"], ["Heirs named", "3"], ["Files sealed", "12"]].map(([a, b]) => <div key={a} className="rounded-2xl border border-border bg-background px-3 py-2.5"><span className="text-muted-foreground">{a}</span><b className="mt-0.5 block text-lg font-semibold tracking-tight">{b}</b></div>)}
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-[1fr_1fr_1.2fr]">
          {[["For Ama", "Releases in 29d 4h", 82, "blue"], ["House papers", "Releases in 3d 2h", 18, "amber"]].map(([t, s, w, tone]: any) => (
            <div key={t} className="grid justify-items-center gap-1 rounded-2xl border border-border bg-background p-3 text-center">
              <MiniFolder tone={tone} /><b className="text-xs">{t}</b><span className="text-muted-foreground">{s}</span>
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-foreground/10"><i className={cn("block h-full rounded-full", tone === "blue" ? "bg-primary" : "bg-amber-500")} style={{ width: `${w}%` }} /></div>
            </div>
          ))}
          <div className="hidden content-start gap-2 rounded-2xl border border-border bg-background p-3 sm:grid">
            <b className="text-xs">Activity</b>
            {[[CheckCircle, "Checked in", "Today"], [LockKey, "Vault sealed", "Oct 2"], [EnvelopeSimple, "Heir added", "Oct 2"]].map(([I, l, d]: any) => <div key={l} className="flex items-center gap-1.5"><I size={13} weight={l === "Checked in" ? "fill" : "regular"} className={l === "Checked in" ? "text-emerald-500" : "text-muted-foreground"} />{l}<span className="ml-auto text-muted-foreground">{d}</span></div>)}
          </div>
        </div>
      </div>
    </div>
  );
}
