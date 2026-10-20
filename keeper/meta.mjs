// Per-owner device notes (vault titles, heir names) synced across devices. The browser encrypts the
// blob with AES-256-GCM under a key derived from a signature by the user's own NEAR key (held by
// Privy, never sent here), so this store holds ciphertext only. Keyed by the verified Privy user id.
import fs from "node:fs";
import path from "node:path";
const DIR = process.env.DATA_DIR || "/tmp/morrowseal";
fs.mkdirSync(DIR, { recursive: true });
const FILE = path.join(DIR, "owner-meta.json");
const S = (() => { try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return {}; } })();
let t = null;
const save = () => { clearTimeout(t); t = setTimeout(() => { try { fs.writeFileSync(FILE + ".tmp", JSON.stringify(S)); fs.renameSync(FILE + ".tmp", FILE); } catch (e) { console.log("meta save failed", e.message); } }, 200); };
export const getMeta = (sub) => S[sub] || null;
export function putMeta(sub, blob) {
  if (typeof blob !== "string" || !/^[A-Za-z0-9+/=]{16,90000}$/.test(blob)) throw new Error("bad blob");
  S[sub] = { blob, at: Date.now() }; save(); return S[sub];
}
