// Sync this device's notes (vault titles, heir names) across the owner's devices.
// The server stores only AES-256-GCM ciphertext; the key is HKDF(signature by the user's NEAR key).
import { getAccessToken } from "@privy-io/react-auth";
import { metaSecret } from "./privy";
import { localVaults, replaceLocal, type LocalVault } from "./local";

let keyP: Promise<CryptoKey | null> | null = null;
function key() {
  if (!keyP) keyP = (async () => {
    const sec = await metaSecret(); if (!sec) return null;
    const ikm = await crypto.subtle.importKey("raw", sec as BufferSource, "HKDF", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: new TextEncoder().encode("morrowseal-notes"), info: new TextEncoder().encode("aes-gcm-v1") }, ikm, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  })().catch(() => { keyP = null; return null; });
  return keyP;
}
export const resetMetaKey = () => { keyP = null; };
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

function merge(a: Record<string, LocalVault>, b: Record<string, LocalVault>) {
  const out = { ...a };
  for (const [id, r] of Object.entries(b)) {
    const l = out[id];
    if (!l) { out[id] = r; continue; }
    const newer = (r.at || 0) > (l.at || 0) ? r : l, older = newer === r ? l : r;
    out[id] = { ...older, ...newer, heirs: newer.heirs?.length ? newer.heirs : older.heirs, files: newer.files?.length ? newer.files : older.files };
  }
  return out;
}

async function remote(): Promise<Record<string, LocalVault> | null> {
  const k = await key(); if (!k) return null;
  const r = await fetch("/api/meta", { headers: { authorization: `Bearer ${await getAccessToken()}` }, cache: "no-store" });
  if (!r.ok) return null;
  const j = await r.json(); if (!j.blob) return {};
  const raw = unb64(j.blob);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: raw.slice(0, 12) }, k, raw.slice(12));
  return JSON.parse(new TextDecoder().decode(pt)).vaults || {};
}

/** Pull and merge (newest entry wins per vault). Returns true if anything changed locally. */
export async function pullMeta(): Promise<boolean> {
  try {
    const rem = await remote(); if (!rem) return false;
    const cur = localVaults(), m = merge(cur, rem);
    if (JSON.stringify(m) !== JSON.stringify(cur)) { replaceLocal(m); return true; }
  } catch {}
  return false;
}

let pushing: Promise<void> | null = null;
export function pushMeta() {
  const run = async () => {
    const k = await key(); if (!k) return;
    let all = localVaults();
    try { const rem = await remote(); if (rem) { all = merge(all, rem); replaceLocal(all); } } catch {}
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, k, new TextEncoder().encode(JSON.stringify({ v: 1, vaults: all }))));
    const blob = new Uint8Array(12 + ct.length); blob.set(iv); blob.set(ct, 12);
    await fetch("/api/meta", { method: "PUT", headers: { "content-type": "application/json", authorization: `Bearer ${await getAccessToken()}` }, body: JSON.stringify({ blob: b64(blob) }) });
  };
  pushing = (pushing || Promise.resolve()).then(run, run).catch(() => {});
  return pushing;
}
