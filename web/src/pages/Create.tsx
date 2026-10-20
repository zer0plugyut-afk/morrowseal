import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, UploadSimple, FileText, Trash, Plus, LockKey, CircleNotch, CheckCircle } from "@phosphor-icons/react";
import { useToast } from "@unlocalhosted/metalui";
import { Top, NeedWallet } from "../app/Shell";
import { useApp } from "../app/state";
import { buildVault } from "@shared/morrowseal.mjs";
import { pinBytes } from "../lib/api";
import { callVault } from "../lib/near";
import { saveLocal } from "../lib/local";
import { span } from "../lib/format";

const STEPS = [
  ["Name & message", "What it's for"],
  ["Files", "Encrypted here first"],
  ["Heirs", "Who receives it"],
  ["Check-in rule", "How often you say hi"],
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
      const v = await buildVault({ owner: account, ownerName: ownerName.trim(), message, heirs, files: fileData, upload: pinBytes });
      setPhase(2);
      const r = await callVault("create_vault", { commitment: v.commitment, cid: v.cid, heirs: v.heirs, interval_s: interval, grace_s: grace }, { tgas: 30 });
      let id = r.value;
      if (typeof id !== "number") { await new Promise((ok) => setTimeout(ok, 2500)); await refresh(); }
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

  return (
    <>
      <Top title="Create a vault" sub="Five short steps. Nothing readable leaves this browser." />
      <div className="create">
        <ol className="card stepper" aria-label="Steps">
          {STEPS.map(([t, s], i) => (
            <li key={t} className={i < step ? "done" : i === step ? "current" : "upcoming"} onClick={() => i < step && phase < 0 && setStep(i)} aria-current={i === step ? "step" : undefined}>
              <span className="circ">{i < step ? <Check size={16} weight="bold" /> : i + 1}</span>
              <span className="lbl"><b>{t}</b><span>{s}</span></span>
            </li>
          ))}
        </ol>
        <section className="card panel" key={step}>
          <div className="fade-up">
            {step === 0 && (<>
              <h2>Name it, and say something</h2>
              <p className="muted">The title stays on this device. Your message is sealed with the files and shown to your heirs.</p>
              <div className="form">
                <div className="field"><label htmlFor="t">Vault title</label><input id="t" className="input" placeholder="For Ama" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} /></div>
                <div className="field"><label htmlFor="o">Your name, as your heirs know you</label><input id="o" className="input" placeholder="Kofi" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} maxLength={60} /><span className="hint">Used in the email: “Kofi left something for you”.</span></div>
                <div className="field"><label htmlFor="m">A message (optional)</label><textarea id="m" className="textarea" placeholder="Everything you need is in here…" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={4000} /></div>
              </div>
            </>)}
            {step === 1 && (<>
              <h2>Add files</h2>
              <p className="muted">Each file is encrypted with AES-256-GCM in your browser. IPFS only receives ciphertext. Up to 20 MB on testnet.</p>
              <div className="form">
                <div className={`drop ${over ? "over" : ""}`} onClick={() => input.current?.click()} onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); addFiles(e.dataTransfer.files); }}>
                  <UploadSimple size={30} weight="duotone" color="var(--brand)" />
                  <div style={{ fontWeight: 600, marginTop: 10 }}>Drop files or click to choose</div>
                  <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>Letters, PDFs, photos, a password list</div>
                  <input ref={input} type="file" multiple hidden onChange={(e) => addFiles(e.target.files)} />
                </div>
                {files.map((f, i) => (<div className="file-row" key={i}><FileText size={20} /><div className="grow" style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</div><div className="muted" style={{ fontSize: 13 }}>{(f.size / 1024).toFixed(1)} KB</div></div><button className="icon-btn" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label="Remove"><Trash size={16} /></button></div>))}
                {files.length > 0 && <div className="muted" style={{ fontSize: 13 }}>{files.length} file(s), {(total / 1024).toFixed(1)} KB total</div>}
              </div>
            </>)}
            {step === 2 && (<>
              <h2>Who should receive it?</h2>
              <p className="muted">Names and emails are sealed inside the vault. The chain only learns how many heirs there are. Each heir signs in with this email to open it.</p>
              <div className="form">
                {heirs.map((h, i) => (<div className="heir-row" key={i}>
                  <input className="input" placeholder="Name" value={h.name} onChange={(e) => setHeirs(heirs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                  <input className="input" placeholder="email@example.com" type="email" value={h.email} onChange={(e) => setHeirs(heirs.map((x, j) => (j === i ? { ...x, email: e.target.value } : x)))} />
                  <button className="icon-btn" style={{ height: 48, width: 40 }} disabled={heirs.length === 1} onClick={() => setHeirs(heirs.filter((_, j) => j !== i))} aria-label="Remove heir"><Trash size={16} /></button>
                </div>))}
                {heirs.length < 8 && <button className="btn btn-ghost btn-sm" style={{ justifySelf: "start" }} onClick={() => setHeirs([...heirs, { name: "", email: "" }])}><Plus size={16} /> Add another heir</button>}
              </div>
            </>)}
            {step === 3 && (<>
              <h2>How often will you check in?</h2>
              <p className="muted">If a full interval plus the grace period passes with no check-in, the vault is released and your heirs are emailed.</p>
              <div className="form">
                <div className="field"><label>Check in every</label><div className="seg">{RHYTHMS.map(([l, s]) => <button key={l} className={interval === s ? "on" : ""} onClick={() => setInterval_(s)}>{l}</button>)}</div></div>
                <div className="field"><label>Grace period</label><div className="seg">{GRACES.map(([l, s]) => <button key={l} className={grace === s ? "on" : ""} onClick={() => setGrace(s)}>{l}</button>)}</div></div>
                <div className="banner">If you don't check in, the vault releases {span(interval + grace)} after your last check-in. Any check-in or edit resets the clock.</div>
              </div>
            </>)}
            {step === 4 && (<>
              <h2>Review and seal</h2>
              <p className="muted">You'll sign one transaction. Sealing encrypts in this browser, pins ciphertext to IPFS and stores a hash on NEAR.</p>
              <div className="review" style={{ marginTop: 22 }}>
                <div><span>Title</span><b>{title}</b></div>
                <div><span>From</span><b>{ownerName}</b></div>
                <div><span>Files</span><b>{files.length ? files.map((f) => f.name).join(", ") : "Message only"}</b></div>
                <div><span>Heirs</span><b>{heirs.map((h) => h.name).join(", ")}</b></div>
                <div><span>Releases after</span><b>{span(interval + grace)} of silence</b></div>
                <div><span>Stored on NEAR</span><b>hash · IPFS address · {heirs.length} {heirs.length === 1 ? 'heir' : 'heirs'} · times</b></div>
              </div>
              {phase >= 0 && <div className="progress-list">{["Reading files", "Encrypting and sealing to the enclave", "Recording the commitment on NEAR", "Done"].map((t, i) => <div key={t} className={i < phase ? "ok" : i === phase ? "on" : ""}>{i < phase ? <CheckCircle size={18} weight="fill" /> : i === phase ? <CircleNotch size={18} className="spin" /> : <span style={{ width: 18 }} />}{t}</div>)}</div>}
            </>)}
          </div>
          <div className="panel-foot">
            <button className="btn btn-ghost" disabled={step === 0 || phase >= 0} onClick={() => setStep(step - 1)}>Back</button>
            {step < 4 ? <button className="btn btn-dark" disabled={!valid[step]} onClick={() => setStep(step + 1)}>Continue</button>
              : <button className="btn btn-brand" disabled={phase >= 0} onClick={seal}><LockKey size={18} weight="bold" /> Seal vault</button>}
          </div>
        </section>
      </div>
    </>
  );
}
