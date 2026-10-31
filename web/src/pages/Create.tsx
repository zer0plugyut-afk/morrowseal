import { currentUser } from "../lib/privy";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, UploadSimple, FileText, Trash, Plus, LockKey, CheckCircle, ArrowLeft, ArrowRight} from "@phosphor-icons/react";
import { useToast } from "../components/toast";
import { Banner, Card, Field, HeirChip, Seg, Spinner } from "../components/ui";
import { Button } from "@/components/motion/button/base";
import { Input } from "@/components/motion/input";
import { Textarea } from "../components/ui";
import { cn } from "@/lib/utils";
import { Persona } from "../components/Persona";
import { Top, NeedWallet } from "../app/Shell";
import { useApp } from "../app/state";
import { buildVault } from "@shared/morrowseal.mjs";
import { pinBytes, notifyNamed } from "../lib/api";
import { callVault } from "../lib/near";
import { saveLocal } from "../lib/local";
import { span } from "../lib/format";

const STEPS = [
  ["Name & message", "What it's for"],
  ["Files", "Encrypted here first"],
  ["Heirs", "Who receives it"],
  ["Check-in rule", "Your rhythm"],
  ["Review & seal", "One transaction"],
];
const RHYTHMS = [["2 min (demo)", 120], ["1 week", 604800], ["1 month", 2592000], ["3 months", 7776000], ["1 year", 31536000]] as const;
const GRACES = [["None", 0], ["1 min", 60], ["3 days", 259200], ["2 weeks", 1209600]] as const;
const MAX = 20 * 1024 * 1024;

export default function Create() {
  const { account, refresh } = useApp();
  const toast = useToast();
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [heirs, setHeirs] = useState([{ name: "", email: "" }]);
  const [interval, setInterval_] = useState<number>(120);
  const [grace, setGrace] = useState<number>(0);
  const [over, setOver] = useState(false);
  const [phase, setPhase] = useState(-1);
  const input = useRef<HTMLInputElement>(null);
  if (!account) return (<><Top title="Create a vault" /><NeedWallet what="The vault is registered to your NEAR account; only you can check in or change it." /></>);

  const okEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
  const valid = [title.trim().length > 0 && ownerName.trim().length > 0, files.length > 0 || message.trim().length > 0, heirs.length > 0 && heirs.every((h) => h.name.trim() && okEmail(h.email)), interval >= 60, true];
  const total = files.reduce((n, f) => n + f.size, 0);
  const addFiles = (list: FileList | null) => { if (!list) return; const next = [...files, ...Array.from(list)]; if (next.reduce((n, f) => n + f.size, 0) > MAX) return toast.show({ title: "That's over 20 MB", sub: "testnet demo limit", tone: "error" }); setFiles(next); };

  async function seal() {
    try {
      setPhase(0);
      const fileData = await Promise.all(files.map(async (f) => ({ name: f.name, type: f.type, bytes: new Uint8Array(await f.arrayBuffer()) })));
      setPhase(1);
      const v = await buildVault({ owner: account, ownerName: ownerName.trim(), ownerEmail: (await currentUser())?.email ?? undefined, message, heirs, files: fileData, upload: pinBytes });
      setPhase(2);
      const r = await callVault("create_vault", { commitment: v.commitment, cid: v.cid, heirs: v.heirs, interval_s: interval, grace_s: grace }, { tgas: 30 });
      let id = r.value;
      if (typeof id !== "number") { await new Promise((ok) => setTimeout(ok, 2500)); await refresh(); }
      if (typeof id === "number") notifyNamed(id, ownerName.trim(), heirs.map((h) => ({ name: h.name.trim(), email: h.email.trim() })));
      setPhase(3);
      if (typeof id === "number") saveLocal(id, { title: title.trim(), heirs: heirs.map((h) => ({ name: h.name.trim(), email: h.email.trim() })), files: files.map((f) => ({ name: f.name, size: f.size })), createdAt: Date.now() });
      toast.show({ title: "Vault sealed", sub: `tx ${r.hash.slice(0, 8)}…`, tone: "success" });
      await refresh();
      setTimeout(() => nav(typeof id === "number" ? `/app/vault/${id}` : "/app"), 900);
    } catch (e: any) {
      setPhase(-1);
      toast.show({ title: "Sealing failed", sub: String(e?.message || e).slice(0, 90), tone: "error" });
    }
  }

  const h2 = "text-2xl font-semibold tracking-tight";
  const lead = "mt-1.5 text-pretty text-sm text-muted-foreground";
  const setHeir = (i: number, k: "name" | "email", v: string) => setHeirs(heirs.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  return (
    <>
      <Top title="Create a vault" sub="Five short steps. Nothing readable leaves this browser." />
      <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <ol className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible" aria-label="Steps">
          {STEPS.map(([t, s], i) => {
            const st = i < step ? "done" : i === step ? "current" : "upcoming";
            return (
              <li key={t} onClick={() => i < step && phase < 0 && setStep(i)} aria-current={i === step ? "step" : undefined}
                className={cn("flex shrink-0 items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors", i < step && phase < 0 && "cursor-pointer hover:bg-muted", st === "current" && "bg-card ring-1 ring-border")}>
                <span className={cn("grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold transition-colors", st === "upcoming" ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground")}>{i < step ? <Check size={16} weight="bold" /> : i + 1}</span>
                <span className={cn("hidden min-w-0 flex-col leading-tight sm:flex", st === "upcoming" && "text-muted-foreground")}><b className="text-sm font-medium">{t}</b><span className="hidden text-xs text-muted-foreground lg:block">{s}</span></span>
              </li>
            );
          })}
        </ol>
        <Card className="gap-6 px-5 sm:px-8" key={step}>
          <div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="whitespace-nowrap">Step {step + 1} of {STEPS.length}</span><span className="h-1 flex-1 overflow-hidden rounded-full bg-foreground/10"><i className="block h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} /></span></div>
          <div className="flex flex-col gap-6">
            {step === 0 && (<>
              <div><h2 className={h2}>Name it, and say something</h2><p className={lead}>The title stays on this device. Your message is sealed with the files and shown to your heirs.</p></div>
              <div className="grid gap-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <Input id="t" label="Vault title" placeholder="For Ama" value={title} onChange={setTitle} maxLength={60} />
                  <Input id="o" label="Your name" placeholder="Kofi" value={ownerName} onChange={setOwnerName} maxLength={60} />
                </div>
                <span className="-mt-3 text-xs text-muted-foreground">Your name appears in the email: “Kofi left something for you”.</span>
                <Field label="A message (optional)" htmlFor="m"><Textarea id="m" placeholder="Everything you need is in here…" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={4000} /></Field>
              </div>
            </>)}
            {step === 1 && (<>
              <div><h2 className={h2}>Add files</h2><p className={lead}>Each file is encrypted with AES-256-GCM in your browser. IPFS only receives ciphertext. Up to 20 MB on testnet.</p></div>
              <div className="grid gap-3">
                <div role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && input.current?.click()} className={cn("flex cursor-pointer flex-col items-center rounded-3xl border-2 border-dashed border-border-strong px-6 py-10 text-center transition-colors hover:border-primary hover:bg-primary/5", over && "border-primary bg-primary/5")} onClick={() => input.current?.click()} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); addFiles(e.dataTransfer.files); }}>
                  <span className="mb-3 grid size-12 place-items-center rounded-full bg-primary/10 text-primary"><UploadSimple size={26} weight="duotone" /></span>
                  <div className="font-semibold">Drop files or click to choose</div>
                  <div className="mt-1 text-sm text-muted-foreground">Letters, PDFs, photos, a password list</div>
                  <input ref={input} type="file" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
                </div>
                {files.map((f, i) => (<div className="flex items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3" key={i}><FileText size={20} className="shrink-0 text-muted-foreground" /><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium" title={f.name}>{f.name}</div><div className="text-xs text-muted-foreground">{(f.size / 1024).toFixed(1)} KB</div></div><Button variant="ghost" size="icon" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label="Remove"><Trash size={16} /></Button></div>))}
                {files.length > 0 && <div className="text-xs text-muted-foreground">{files.length} file(s), {(total / 1024).toFixed(1)} KB total</div>}
              </div>
            </>)}
            {step === 2 && (<>
              <div><h2 className={h2}>Who should receive it?</h2><p className={lead}>Names and emails are sealed inside the vault. The chain only learns how many heirs there are. Each heir signs in with this email to open it.</p></div>
              <div className="grid gap-3">
                {heirs.map((h, i) => (<div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-2 rounded-2xl border border-border bg-background p-3 sm:grid-cols-[auto_1fr_1.3fr_auto]" key={i}>
                  <Persona email={h.email} name={h.name || "?"} />
                  <Input placeholder="Name" aria-label="Heir name" value={h.name} onChange={(v) => setHeir(i, "name", v)} />
                  <Button variant="ghost" size="icon" className="sm:order-last" disabled={heirs.length === 1} onClick={() => setHeirs(heirs.filter((_, j) => j !== i))} aria-label="Remove heir"><Trash size={16} /></Button>
                  <div className="col-span-3 sm:col-span-1"><Input placeholder="Email" aria-label="Heir email" type="email" inputMode="email" autoComplete="email" value={h.email} onChange={(v) => setHeir(i, "email", v)} /></div>
                </div>))}
                {heirs.length < 8 && <Button variant="outline" size="sm" className="justify-self-start" onClick={() => setHeirs([...heirs, { name: "", email: "" }])}><Plus size={16} /> Add another heir</Button>}
              </div>
            </>)}
            {step === 3 && (<>
              <div><h2 className={h2}>How often will you check in?</h2><p className={lead}>If a full interval plus the grace period passes with no check-in, the vault is released and your heirs are emailed.</p></div>
              <div className="grid gap-5">
                <Field label="Check in every"><Seg label="Check-in interval" options={RHYTHMS} value={interval} onChange={setInterval_} /></Field>
                <Field label="Grace period"><Seg label="Grace period" options={GRACES} value={grace} onChange={setGrace} /></Field>
                <Banner>If you don't check in, the vault releases {span(interval + grace)} after your last check-in. Any check-in or edit resets the clock.</Banner>
              </div>
            </>)}
            {step === 4 && (<>
              <div><h2 className={h2}>Review and seal</h2><p className={lead}>You'll sign one transaction. Sealing encrypts in this browser, pins ciphertext to IPFS and stores a hash on NEAR.</p></div>
              <dl className="grid divide-y divide-border rounded-2xl border border-border bg-background text-sm">
                {([
                  ["Title", <b key="a">{title}</b>],
                  ["From", <b key="b">{ownerName}</b>],
                  ["Files", <b key="c" className="break-words" title={files.map((f) => f.name).join(", ")}>{files.length ? files.map((f) => f.name).join(", ") : "Message only"}</b>],
                  ["Heirs", <span key="d" className="flex flex-wrap gap-1.5">{heirs.map((h, k) => <HeirChip key={k} name={h.name} email={h.email} />)}</span>],
                  ["Releases after", <b key="e">{span(interval + grace)} of silence</b>],
                  ["Stored on NEAR", <b key="f">hash · IPFS address · {heirs.length} {heirs.length === 1 ? "heir" : "heirs"} · times</b>],
                ] as [string, React.ReactNode][]).map(([k, v]) => <div key={k} className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4"><dt className="text-muted-foreground">{k}</dt><dd className="min-w-0 font-medium">{v}</dd></div>)}
              </dl>
              <Banner icon>Each heir gets a short note now saying they were named (nothing inside is shared). The email with the link to open it is sent only if you miss your check-in.</Banner>
              {phase >= 0 && <div className="grid gap-2.5 rounded-2xl border border-border bg-background p-4 text-sm">{["Reading files", "Encrypting and sealing to the enclave", "Recording the commitment on NEAR", "Done"].map((t, i) => <div key={t} className={cn("flex items-center gap-2.5", i > phase && "text-muted-foreground", i === phase && "font-medium")}>{i < phase ? <CheckCircle size={18} weight="fill" className="text-primary" /> : i === phase ? <Spinner size={18} /> : <span className="size-[18px]" />}{t}</div>)}</div>}
            </>)}
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-border pt-5">
            {step > 0 ? <Button variant="ghost" disabled={phase >= 0} onClick={() => setStep(step - 1)}><ArrowLeft size={16} /> Back</Button> : <span />}
            {step < 4 ? <Button disabled={!valid[step]} onClick={() => setStep(step + 1)}>Continue <ArrowRight size={16} weight="bold" /></Button>
              : <Button disabled={phase >= 0} onClick={seal}><LockKey size={17} weight="bold" /> Seal vault</Button>}
          </div>
        </Card>
      </div>
    </>
  );
}
