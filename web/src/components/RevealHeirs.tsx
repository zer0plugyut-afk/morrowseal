import { useEffect, useState } from "react";
import { EyeSlash } from "@phosphor-icons/react";
import { Button } from "@/components/motion/button/base";
import { Spinner } from "./ui";
import { localVaults } from "../lib/local";
import { canOwnerOpen, friendly, ownerOpen } from "../lib/ownerOpen";

/** "Show heir details": owner-only, keeper-paid enclave open; saves heirs to this device. */
export function RevealHeirs({ v }: { v: { id: number; status: string } }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!canOwnerOpen(v)) return <span className="text-xs text-muted-foreground">Heir names stay on the device that sealed this older vault.</span>;
  const go = async () => { setBusy(true); setErr(""); try { await ownerOpen(v); } catch (e) { setErr(friendly(e)); } finally { setBusy(false); } };
  return (
    <span>
      <Button variant="secondary" size="sm" disabled={busy} onClick={go}>{busy ? <Spinner /> : <EyeSlash size={14} />} {busy ? "Asking the enclave…" : "Show heir details"}</Button>
      {err && <div className="mt-1.5 text-sm text-destructive">{err}</div>}
    </span>
  );
}

/** This device's notes, refreshed when heir details are saved. */
export function useLocalVaults() {
  const [v, set] = useState(localVaults);
  useEffect(() => { const f = () => set(localVaults()); window.addEventListener("ms-local", f); return () => window.removeEventListener("ms-local", f); }, []);
  return v;
}
