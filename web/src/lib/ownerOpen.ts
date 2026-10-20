// Owner-only: ask the enclave (keeper pays, owner verified) to re-seal this vault's manifest to a
// one-time key in this browser. The enclave's owner_open answer already includes the sealed heir list,
// so after a successful open the heirs are saved to this device only (never to the chain or server).
import { buildOwnerOpen, openGift, OWNER_PREVIEW_FROM } from "@shared/morrowseal.mjs";
import { fetchCid } from "./api";
import { identityToken } from "./privy";
import { localVaults, saveLocal } from "./local";

export const canOwnerOpen = (v: { id: number; status: string }) => v.id >= OWNER_PREVIEW_FROM && v.status !== "Cancelled";

export function friendly(e: any): string {
  const m = String(e?.message || e).replace(/^Error: /, "");
  if (/not the owner's email/i.test(m)) return "You're signed in with a different email than the one that sealed this vault.";
  if (/only the owner/i.test(m)) return "Only the account that created this vault can do this.";
  if (/sealed before this update|unavailable/i.test(m)) return "Not available for this older vault.";
  if (/expired|sign in again/i.test(m)) return "Your sign-in expired. Sign in again and retry.";
  if (/too many/i.test(m)) return "Too many tries. Wait a minute and try again.";
  if (/already opening/i.test(m)) return "Already working on it, one moment.";
  if (/NotEnoughBalance|balance/i.test(m)) return "The network fee couldn't be paid right now. Try again shortly.";
  if (/^[\[{]/.test(m.trim()) || m.length > 160) return "The enclave couldn't open it right now. Try again in a moment.";
  return m;
}

export async function ownerOpen(v: { id: number }) {
  const tok = await identityToken();
  if (!tok) throw new Error("Sign in again to open this vault.");
  const req = buildOwnerOpen({ idToken: tok });
  const r = await fetch("/api/owner-open", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${tok}` }, body: JSON.stringify({ vault_id: v.id, request_hex: req.requestHex }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok || !j.key_ct) throw new Error(j.error || "The enclave did not answer.");
  const gift = await openGift(req.ephSk, j.key_ct, fetchCid);
  rememberHeirs(v.id, gift);
  return gift;
}

function rememberHeirs(id: number, gift: any) {
  const heirs = Array.isArray(gift?.heirs) ? gift.heirs.map((h: any) => ({ name: String(h.name || ""), email: String(h.email || "") })) : [];
  if (!heirs.length && !gift?.title) return;
  const cur = localVaults()[id];
  saveLocal(id, { title: cur?.title || (typeof gift?.title === "string" && gift.title) || `Vault ${id}`, heirs, files: cur?.files?.length ? cur.files : (gift.files || []).map((f: any) => ({ name: f.name, size: f.size })), createdAt: cur?.createdAt || Date.now() });
}
