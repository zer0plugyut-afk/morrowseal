import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Vault, PlusCircle, UsersThree, Heartbeat, ClockCounterClockwise, ShieldCheck, GearSix, HandHeart, SignOut, EnvelopeSimple, Copy, ArrowSquareOut, CaretDown } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { Logo, ThemeToggle, PageHead, Card, Empty, Skeleton, btn, Mono } from "../components/ui";
import { Persona } from "../components/Persona";
import { Button } from "@/components/motion/button/base";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/motion/popover";
import { useApp } from "./state";
import { short } from "../lib/format";
import { useEffect, useState } from "react";
import { useToast } from "../components/toast";
import { balanceOf } from "../lib/privy";
import { cn } from "@/lib/utils";

export const NAV = [
  { to: "/app", icon: Vault, label: "Vaults", end: true },
  { to: "/app/create", icon: PlusCircle, label: "Create" },
  { to: "/app/heirs", icon: UsersThree, label: "Heirs" },
  { to: "/app/shared", icon: HandHeart, label: "Shared with me" },
  { to: "/app/check-ins", icon: Heartbeat, label: "Check-ins" },
  { to: "/app/activity", icon: ClockCounterClockwise, label: "Activity" },
  { to: "/app/proof", icon: ShieldCheck, label: "Proof" },
  { to: "/app/settings", icon: GearSix, label: "Settings" },
];

export default function Shell() {
  const { account, login, logout, vaults, watch, email, ready } = useApp();
  const loc = useLocation();
  const overdue = vaults.filter((v) => v.status === "Active").length;
  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[90rem] items-center gap-3 sm:gap-4 px-4 sm:px-6">
          <Logo to="/" />
          <nav className="ml-2 hidden min-w-0 flex-1 items-center gap-0.5 overflow-hidden lg:flex" aria-label="App">
            {NAV.map(({ to, icon: I, label, end }) => (
              <NavLink key={to} to={to} end={end} title={label} className={({ isActive }) => cn("relative flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3 text-sm font-medium transition-colors", isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground")}>
                {({ isActive }) => (<>
                  {isActive && <motion.span layoutId="topnav-pill" className="absolute inset-0 rounded-full bg-card ring-1 ring-border" transition={{ type: "spring", stiffness: 380, damping: 34 }} />}
                  <I size={17} weight={isActive ? "fill" : "regular"} className="relative" />
                  <span className={cn("relative whitespace-nowrap", !isActive && "hidden min-[1280px]:inline")}>{label}</span>
                  {label === "Check-ins" && overdue > 0 ? <span className="relative grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">{overdue}</span> : null}
                </>)}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex min-w-0 shrink-0 items-center gap-2">
            <ThemeToggle />
            {!ready ? <Skeleton className="h-9 w-32" /> : account ? (
              <AccountMenu account={account} email={watch ? null : email} watch={watch} onLogout={logout} />
            ) : (
              <Button size="sm" onClick={login}><EnvelopeSimple size={16} /> Sign in</Button>
            )}
          </div>
        </div>
      </header>
      <main key={loc.pathname} className="mx-auto w-full max-w-5xl px-4 pb-32 pt-8 sm:px-6 lg:pb-16 lg:pt-10">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}><Outlet /></motion.div>
      </main>
      <nav className="fixed inset-x-3 bottom-3 z-40 mx-auto flex max-w-md items-center justify-around rounded-full border border-border bg-background/80 p-1.5 shadow-2xl backdrop-blur-xl lg:hidden" style={{ paddingBottom: "max(0.375rem, env(safe-area-inset-bottom))" }} aria-label="App">
        {NAV.filter((n) => n.label !== "Settings" && n.label !== "Proof").map(({ to, icon: I, label, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => cn("relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-full px-1 py-1.5 text-[10px] font-medium transition-colors", isActive ? "text-primary" : "text-muted-foreground")}>
            {({ isActive }) => (<>
              {isActive && <motion.span layoutId="bottomnav-pill" className="absolute inset-0 rounded-full bg-primary/10" transition={{ type: "spring", stiffness: 380, damping: 34 }} />}
              <I size={21} weight={isActive ? "fill" : "regular"} className="relative" />
              <span className="relative max-w-full truncate">{label === "Shared with me" ? "Shared" : label}</span>
            </>)}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export function Top({ title, sub, children }: { title: string; sub?: React.ReactNode; children?: React.ReactNode }) {
  return <PageHead title={title} sub={sub}>{children}</PageHead>;
}

export function NeedWallet({ what }: { what: string }) {
  const { login, ready } = useApp();
  if (!ready) return <Card className="gap-3 p-6" aria-busy="true"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-4 w-1/3" /></Card>;
  return (
    <Card className="gap-0 py-4">
      <Empty icon={<EnvelopeSimple size={22} weight="duotone" />} title="Sign in with your email" action={<Button onClick={login} className="mt-1">Sign in with email</Button>}>
        {what} We send a one-time code. Your NEAR testnet account is created for you, no wallet or seed phrase.
      </Empty>
    </Card>
  );
}

function AccountMenu(props: { account: string; email: string | null; watch: boolean; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => { setOpen(false); }, [loc.pathname]);
  const { account, email } = props;
  return (
    <Popover open={open} onOpenChange={setOpen} side="bottom" align="end" sideOffset={10}>
      <PopoverTrigger>
        <Button variant="secondary" size="sm" className="h-9 w-auto min-w-0 max-w-[8.5rem] shrink-0 overflow-hidden pl-1.5 pr-3 sm:max-w-[11rem]" title={email || account} aria-haspopup="true">
          <Persona email={email} name={account} size={24} />
          <span className="min-w-0 flex-1 truncate whitespace-nowrap text-left">{email || short(account, 8, 4)}</span>
          <CaretDown size={13} className="shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[19rem] max-w-[calc(100vw-2rem)]">
        <AccountCard {...props} />
      </PopoverContent>
    </Popover>
  );
}

function AccountCard({ account, email, watch, onLogout }: { account: string; email: string | null; watch: boolean; onLogout: () => void }) {
  const toast = useToast();
  const [bal, setBal] = useState<bigint | null>(null);
  useEffect(() => {
    let live = true;
    const load = () => balanceOf(account).then((b) => live && setBal(b));
    load(); const t = setInterval(load, 20000);
    return () => { live = false; clearInterval(t); };
  }, [account]);
  const near = bal === null ? "…" : (Number(bal / 10n ** 20n) / 10000).toLocaleString(undefined, { maximumFractionDigits: 4 });
  const copy = async () => { try { await navigator.clipboard.writeText(account); toast.show({ title: "Address copied", sub: short(account, 10, 6), tone: "success" }); } catch { toast.show({ title: "Copy failed", tone: "error" }); } };
  const iconBtn = "grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";
  return (
    <div className="flex flex-col gap-3 p-4 text-sm">
      <div className="flex items-center gap-3">
        <Persona email={email} name={account} size={36} />
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="text-xs text-muted-foreground">{watch ? "Viewing read-only" : "Signed in · testnet"}</div>
          <div className="truncate whitespace-nowrap font-medium" title={email || account}>{email || short(account, 10, 6)}</div>
        </div>
        {!watch && <button className={iconBtn} onClick={onLogout} aria-label="Sign out" title="Sign out"><SignOut size={16} /></button>}
      </div>
      <div className="flex items-center gap-1 rounded-xl bg-muted/60 py-1 pl-3 pr-1">
        <Mono className="min-w-0 flex-1 truncate text-xs"><span title={account}>{short(account, 8, 6)}</span></Mono>
        <button className={iconBtn} onClick={copy} aria-label="Copy address" title="Copy address"><Copy size={14} /></button>
        <a className={iconBtn} href={`https://testnet.nearblocks.io/address/${account}`} target="_blank" rel="noreferrer" aria-label="View on NearBlocks" title="View on NearBlocks"><ArrowSquareOut size={14} /></a>
      </div>
      <div className="flex items-center justify-between px-1">
        <span className="text-muted-foreground">Balance</span><b className="font-mono">{near} NEAR</b>
      </div>
      {bal === 0n && !watch && <a className="rounded-xl bg-primary/10 px-3 py-2 text-xs text-primary" href="https://near-faucet.io/" target="_blank" rel="noreferrer">Balance is 0. Setting up your account; if it stays at 0, get test NEAR from the faucet ↗</a>}
      <div className="flex gap-2 border-t border-border pt-3">
        <Link to="/app/proof" className={btn("ghost", "sm", "flex-1")}><ShieldCheck size={15} /> Proof</Link>
        <Link to="/app/settings" className={btn("ghost", "sm", "flex-1")}><GearSix size={15} /> Settings</Link>
      </div>
    </div>
  );
}
