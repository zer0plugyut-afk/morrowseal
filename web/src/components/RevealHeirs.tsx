import { useEffect, useState } from "react";
import { EyeSlash, CircleNotch } from "@phosphor-icons/react";
import { localVaults } from "../lib/local";
import { canOwnerOpen, friendly, ownerOpen } from "../lib/ownerOpen";

/** "Show heir details": owner-only, keeper-paid enclave open; saves heirs to this device. */
export function RevealHeirs({ v }: { v: { id: number; status: string } }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!canOwnerOpen(v)) return <span className="muted" style={{ fontSize: 13 }}>Heir names stay on the device that sealed this older vault.</span>;
  const go = async () => { setBusy(true); setErr(""); try { await ownerOpen(v); } catch (e) { setErr(friendly(e)); } finally { setBusy(false); } };
  return (
    <span>
      <button className="btn btn-sm btn-ghost" disabled={busy} onClick={go}>{busy ? <CircleNotch size={14} className="spin" /> : <EyeSlash size={14} />} {busy ? "Asking the enclave…" : "Show heir details"}</button>
      {err && <div style={{ color: "var(--danger)", fontSize: 13, marginTop: 6 }}>{err}</div>}
    </span>
  );
}

/** This device's notes, refreshed when heir details are saved. */
export function useLocalVaults() {
  const [v, set] = useState(localVaults);
  useEffect(() => { const f = () => set(localVaults()); window.addEventListener("ms-local", f); return () => window.removeEventListener("ms-local", f); }, []);
  return v;
}
