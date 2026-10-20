// A static, non-interactive picture of the workspace for the landing hero (no real data).
import { Vault, PlusCircle, UsersThree, Heartbeat, ClockCounterClockwise, ShieldCheck, GearSix, LockKey, EnvelopeSimple, CheckCircle } from "@phosphor-icons/react";

export function AppPreview() {
  const nav = [[Vault, "Vaults"], [PlusCircle, "Create"], [UsersThree, "Heirs"], [Heartbeat, "Check-ins"], [ClockCounterClockwise, "Activity"], [ShieldCheck, "Proof"], [GearSix, "Settings"]] as const;
  return (
    <div className="pv" aria-hidden>
      <div className="pv-side">
        <div className="pv-brand"><span className="logo-mark" style={{ width: 22, height: 22, borderRadius: 7 }}><LockKey size={12} weight="bold" /></span> morrowseal</div>
        {nav.map(([I, l], i) => <div key={l} className={`pv-link ${i === 0 ? "on" : ""}`}><I size={14} weight={i === 0 ? "fill" : "regular"} />{l}</div>)}
      </div>
      <div className="pv-main">
        <div className="pv-top"><div><b>Your vaults</b><span>Everything here is sealed. Only hashes live on NEAR.</span></div><div className="pv-btn">I'm here</div></div>
        <div className="pv-kpis">
          <div><span>Next check-in</span><b>29 days</b></div>
          <div><span>Heirs named</span><b>3</b></div>
          <div><span>Files sealed</span><b>12</b></div>
        </div>
        <div className="pv-grid">
          <div className="pv-card">
            <div className="pv-folder" style={{ ["--h" as any]: "#0953ff" }}><i /><em /></div>
            <b>For Ama</b><span>Releases in 29d 4h</span><div className="pv-ring"><i style={{ width: "82%" }} /></div>
          </div>
          <div className="pv-card">
            <div className="pv-folder" style={{ ["--h" as any]: "#cf8d13" }}><i /><em /></div>
            <b>House papers</b><span>Releases in 3d 2h</span><div className="pv-ring warn"><i style={{ width: "18%" }} /></div>
          </div>
          <div className="pv-card pv-feed">
            <b>Activity</b>
            <div><CheckCircle size={14} weight="fill" color="#0ea158" /> Checked in<span>Today</span></div>
            <div><LockKey size={14} /> Vault sealed<span>Oct 2</span></div>
            <div><EnvelopeSimple size={14} /> Heir added<span>Oct 2</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
