// Pinata (ciphertext only). JWT stays on the server.
export async function pin(bytes, name = "blob.bin") {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) throw new Error("PINATA_JWT not set");
  const fd = new FormData();
  fd.append("file", new Blob([bytes], { type: "application/octet-stream" }), name);
  fd.append("network", "public");
  const r = await fetch("https://uploads.pinata.cloud/v3/files", { method: "POST", headers: { Authorization: `Bearer ${jwt}` }, body: fd });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j?.data?.cid) throw new Error(`pinata ${r.status}: ${JSON.stringify(j).slice(0, 200)}`);
  return j.data.cid;
}
const cache = new Map();
export async function fetchCid(cid) {
  if (!/^[a-zA-Z0-9]{20,100}$/.test(cid)) throw new Error("bad cid");
  if (cache.has(cid)) return cache.get(cid);
  const gw = (process.env.PINATA_GATEWAY || "").replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const urls = [gw && `https://${gw}/ipfs/${cid}`, `https://gateway.pinata.cloud/ipfs/${cid}`, `https://ipfs.io/ipfs/${cid}`, `https://dweb.link/ipfs/${cid}`].filter(Boolean);
  let last;
  for (const u of urls) {
    try { const r = await fetch(u, { signal: AbortSignal.timeout(20000) }); if (r.ok) { const b = new Uint8Array(await r.arrayBuffer()); if (cache.size > 200) cache.clear(); cache.set(cid, b); return b; } last = `${u} ${r.status}`; } catch (e) { last = e.message; }
  }
  throw new Error(`ipfs fetch failed: ${last}`);
}
