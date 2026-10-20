import { fromHex } from "@shared/morrowseal.mjs";
export const API = (import.meta.env.VITE_API_URL as string) || "";

export async function pinBytes(bytes: Uint8Array, name: string): Promise<string> {
  const r = await fetch(`${API}/api/ipfs?name=${encodeURIComponent(name)}`, { method: "POST", body: bytes as any, headers: { "content-type": "application/octet-stream" } });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || "upload failed");
  return j.cid;
}
export async function fetchCid(cid: string): Promise<Uint8Array> {
  const r = await fetch(`${API}/api/ipfs/${cid}`);
  if (!r.ok) throw new Error("Could not fetch from IPFS");
  return new Uint8Array(await r.arrayBuffer());
}
export async function relayClaim(body: { vault_id: number; heir_index: number; claim_hex: string }) {
  const r = await fetch(`${API}/api/claim`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) throw Object.assign(new Error(j.error || "The claim was refused."), { tx: j.tx });
  return j as { tx: string };
}
export const hexToBytes = fromHex;
