// Metal UI Folder shelf, reused from the earlier vault project and adapted to Morrowseal vaults.
import { Folder, StatusBadge, type FolderHue, type FolderPeek, type LedKind } from "@unlocalhosted/metalui";
import { deadline, type Vault } from "../lib/near";
import { countdown } from "../lib/format";
import { useNow } from "./ui";

export type ShelfVault = Vault & { title: string; files?: number };

function flapName(title: string) { const t = title.trim() || "Untitled vault"; return t.length > 22 ? `${t.slice(0, 21)}…` : t; }
function hue(v: ShelfVault, left: number): FolderHue { if (v.status === "Cancelled") return "red"; if (v.status === "Released") return "green"; return left < v.interval_s * 250 ? "amber" : "blue"; }
function led(v: ShelfVault): LedKind { if (v.status === "Cancelled") return "off"; if (v.status === "Released") return "live"; return "waiting"; }
function words(v: ShelfVault, left: number) { if (v.status === "Cancelled") return "CANCELLED"; if (v.status === "Released") return v.claims.every(Boolean) ? "OPENED" : "RELEASED"; return left <= 0 ? "OVERDUE" : "SEALED"; }
function peeks(v: ShelfVault): FolderPeek[] {
  return [
    { id: `${v.id}-letter`, thumb: "linear-gradient(135deg,#cfe8ff,#84b9ef 60%,#0953ff)" },
    { id: `${v.id}-files`, thumb: "radial-gradient(60% 60% at 30% 30%,#e2ecf5,#9cc1e7)" },
    { id: `${v.id}-seal`, thumb: "linear-gradient(160deg,#1a1615,#453f3d),radial-gradient(40% 40% at 70% 30%,#84b9ef,transparent)" },
  ];
}

export function VaultShelf({ vaults, onOpen }: { vaults: ShelfVault[]; onOpen: (id: number) => void }) {
  const now = useNow();
  return (
    <div className="vault-shelf">
      {vaults.map((v) => {
        const left = deadline(v) - now;
        const total = (v.interval_s + v.grace_s) * 1000;
        const p = v.status === "Active" ? Math.min(1, Math.max(0, left / total)) : 1;
        return (
          <div key={v.id} className="card shelf-item fade-up" onClick={() => onOpen(v.id)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onOpen(v.id)}>
            <Folder name={flapName(v.title)} count={3} hue={hue(v, left)} peeks={peeks(v)} onUnfold={() => onOpen(v.id)} />
            <div className="shelf-meta">
              <StatusBadge led={led(v)}>{words(v, left)}</StatusBadge>
              <div className="t">{v.title}</div>
              <div className="s">{v.status === "Active" ? (left > 0 ? `Releases in ${countdown(left)} without a check-in` : "Releasing to heirs now") : v.status === "Released" ? `${v.claims.filter(Boolean).length} of ${v.heirs} heirs opened it` : "Cancelled by you"}</div>
              <div className={`ring ${v.status === "Released" ? "done" : p < 0.25 ? "warn" : ""}`} style={{ ["--p" as any]: p }}><i /></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
