// Morrowseal keeper: deadline watcher, heir mail, IPFS pinning for browsers, claim relay, and the web app.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { account } from "./chain.mjs";
import { pin, fetchCid } from "./ipfs.mjs";
import { tick, relayClaim, relayReopen, relayOwnerOpen } from "./lib.mjs";
import { fund, privyUser, privyEmails, privyNearAccounts } from "./fund.mjs";
import { getMeta, putMeta } from "./meta.mjs";
import { indexNamed, indexNotice, sharedWith, claimLink, record, keeperEvents } from "./heirs.mjs";
import { fresh, ownerIds } from "./index-cache.mjs";
import { namedEmail, sendMail } from "./email.mjs";
import { view } from "./chain.mjs";
import { VAULT_CONTRACT } from "../shared/morrowseal.mjs";
const namedSent = new Set();
const RPC_UPSTREAMS = (process.env.RPC_UPSTREAMS || "https://test.rpc.fastnear.com,https://neart.lava.build,https://rpc.testnet.pagoda.co").split(",");

const PORT = Number(process.env.PORT || 8790);
const HOST = process.env.PORT ? "0.0.0.0" : "127.0.0.1";
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;
const INTERVAL = Number(process.env.KEEPER_INTERVAL_MS || 20000);
const WEB = path.resolve(new URL("../web/dist", import.meta.url).pathname);
const ops = await account(process.env.NEAR_OPS_ID, process.env.NEAR_OPS_KEY);
let last = { at: null, vaults: 0, error: null };

async function loop() {
  try {
    last = { at: new Date().toISOString(), vaults: await tick(ops, { appUrl: APP_URL }), error: null };
    const st = await fresh(); for (const v of st.vaults.values()) indexNotice(v);
  }
  catch (e) { last = { ...last, at: new Date().toISOString(), error: e.message.slice(0, 200) }; }
  setTimeout(loop, INTERVAL);
}
if (process.env.KEEPER_LOOP !== "0") loop();

const hits = new Map();
// Per-endpoint buckets (one shared window used to make busy pages exhaust the strict limits).
// Railway terminates TLS at its proxy; the first x-forwarded-for entry is the client.
const clientIp = (req) => String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket.remoteAddress;
function limited(req, max = 30, bucket = new URL(req.url, "http://x").pathname, key = clientIp(req)) {
  const k = `${bucket}|${key}`, now = Date.now(), w = hits.get(k)?.filter((t) => now - t < 60000) || [];
  w.push(now); hits.set(k, w);
  return w.length > max;
}
setInterval(() => { const now = Date.now(); for (const [k, w] of hits) if (!w.some((t) => now - t < 60000)) hits.delete(k); }, 300000).unref();
const body = (req, max) => new Promise((res, rej) => { const c = []; let n = 0; req.on("data", (d) => { n += d.length; if (n > max) { rej(new Error("too large")); req.destroy(); } else c.push(d); }); req.on("end", () => res(Buffer.concat(c))); req.on("error", rej); });
const json = (res, code, obj) => { res.writeHead(code, { "content-type": "application/json", "access-control-allow-origin": "*" }); res.end(JSON.stringify(obj)); };
const TYPES = { ".js": "text/javascript", ".css": "text/css", ".html": "text/html; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".json": "application/json", ".webp": "image/webp", ".ico": "image/x-icon" };

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  try {
    if (req.method === "OPTIONS") { res.writeHead(204, { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type, authorization", "access-control-allow-methods": "GET,POST,PUT" }); return res.end(); }
    if (url.pathname === "/api/health") return json(res, 200, { ok: true, keeper: last, interval_ms: INTERVAL });
    if (url.pathname === "/api/ipfs" && req.method === "POST") {
      if (limited(req, 40)) return json(res, 429, { error: "slow down" });
      const b = await body(req, 25 * 1024 * 1024);
      return json(res, 200, { cid: await pin(b, url.searchParams.get("name") || "blob.bin") });
    }
    const m = url.pathname.match(/^\/api\/ipfs\/([a-zA-Z0-9]+)$/);
    if (m && req.method === "GET") { const b = await fetchCid(m[1]); res.writeHead(200, { "content-type": "application/octet-stream", "cache-control": "public, max-age=31536000, immutable", "access-control-allow-origin": "*" }); return res.end(b); }
    if (req.method === "GET" && url.pathname === "/api/config") { const st = await fresh(); return json(res, 200, st.config); }
    if (req.method === "GET" && url.pathname === "/api/vaults") {
      const st = await fresh(); const owner = url.searchParams.get("owner");
      return json(res, 200, [...st.vaults.values()].filter((v) => !owner || v.owner === owner));
    }
    const vm = url.pathname.match(/^\/api\/(?:vaults|claim)\/(\d+)$/);
    if (req.method === "GET" && vm) { const st = await fresh(); const v = st.vaults.get(Number(vm[1])); return v ? json(res, 200, v) : json(res, 404, { error: "not found" }); }
    if (req.method === "GET" && url.pathname === "/api/activity") {
      // Only the caller's own story: events on vaults they own, plus (when signed in) the vaults
      // where their verified email is a named heir: release and their own claims.
      const st = await fresh(); const owner = url.searchParams.get("owner"); const vid = url.searchParams.get("vault");
      const all = [...st.events, ...keeperEvents()];
      const out = [];
      if (owner) {
        const ids = ownerIds(st, owner);
        for (const e of all) if (ids.has(e.vault_id) || e.actor === owner) out.push({ ...e, role: "owner" });
      }
      const bearer = (req.headers.authorization || "").replace(/^Bearer /, "");
      if (bearer) {
        const emails = await privyEmails(bearer);
        for (const x of emails ? sharedWith(emails) : []) {
          if (owner && st.vaults.get(x.vault_id)?.owner === owner) continue;
          for (const e of st.events) if (e.vault_id === x.vault_id && (e.kind === "vault_released" || e.kind === "vault_cancelled" || (e.kind === "heir_claimed" && e.detail.startsWith(`heir #${x.heir_index + 1} `)))) out.push({ ...e, role: "heir", owner_name: x.owner_name });
        }
      }
      if (!owner && !bearer && !vid) return json(res, 200, []);
      const list = vid && !owner && !bearer ? st.events.filter((e) => e.vault_id === Number(vid)) : out.filter((e) => !vid || e.vault_id === Number(vid));
      list.sort((a, b) => (BigInt(String(a.at_ns)) < BigInt(String(b.at_ns)) ? -1 : 1));
      return json(res, 200, list);
    }
    if (req.method === "GET" && url.pathname === "/api/shared") {
      if (limited(req, 60)) return json(res, 429, { error: "slow down" });
      const emails = await privyEmails((req.headers.authorization || "").replace(/^Bearer /, ""));
      if (!emails) return json(res, 401, { error: "Please sign in again." });
      const st = await fresh();
      const out = [];
      for (const x of sharedWith(emails)) {
        const v = st.vaults.get(x.vault_id); if (!v) continue;
        const c = v.claims?.[x.heir_index];
        const status = v.status === "Cancelled" ? "cancelled" : c ? "opened" : v.status === "Released" ? "released" : "waiting";
        out.push({ vault_id: v.id, heir_index: x.heir_index, heir_name: x.name, owner_name: x.owner_name, owner: v.owner, status, verified: x.source === "notice",
          created_ns: String(v.created_ns), released_ns: v.released_ns ? String(v.released_ns) : null, claimed_ns: c ? String(c.claimed_ns) : null,
          link: v.status === "Released" ? claimLink(v, x.heir_index, APP_URL) : `/waiting/${v.id}` });
      }
      out.sort((a, b) => b.vault_id - a.vault_id);
      return json(res, 200, out);
    }
    if (url.pathname === "/api/rpc" && req.method === "POST") {
      if (limited(req, 240)) return json(res, 429, { error: "slow down" });
      const raw = (await body(req, 256 * 1024)).toString();
      let m; try { m = JSON.parse(raw).method; } catch { return json(res, 400, { error: "bad json" }); }
      if (!["query", "block", "send_tx", "broadcast_tx_commit", "broadcast_tx_async", "tx", "status", "gas_price"].includes(m)) return json(res, 400, { error: "method not allowed" });
      let lastErr = "no upstream";
      for (const up of RPC_UPSTREAMS) {
        try {
          const r = await fetch(up, { method: "POST", headers: { "content-type": "application/json" }, body: raw, signal: AbortSignal.timeout(m.startsWith("send") || m.startsWith("broadcast") ? 60000 : 12000) });
          if (r.status === 429 || r.status >= 500) { lastErr = `${up} ${r.status}`; continue; }
          const text = await r.text();
          if (/"code"\s*:\s*-429|DEPRECATED/.test(text.slice(0, 400))) { lastErr = `${up} deprecated/limited`; continue; }
          res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
          return res.end(text);
        } catch (e) { lastErr = `${up} ${e.message}`; }
      }
      return json(res, 502, { jsonrpc: "2.0", id: 1, error: { message: "NEAR RPC unavailable", cause: { name: lastErr.slice(0, 120) } } });
    }
    if (url.pathname === "/api/fund" && req.method === "POST") {
      if (limited(req, 5)) return json(res, 429, { error: "slow down" });
      const j = JSON.parse((await body(req, 4096)).toString());
      const { code, ...r } = await fund(ops, (req.headers.authorization || "").replace(/^Bearer /, ""), j.account);
      return json(res, code, r);
    }
    if (url.pathname === "/api/named" && req.method === "POST") {
      if (limited(req, 4)) return json(res, 429, { error: "slow down" });
      if (!(await privyUser((req.headers.authorization || "").replace(/^Bearer /, "")))) return json(res, 401, { error: "Please sign in again." });
      const j = JSON.parse((await body(req, 16 * 1024)).toString());
      if (!Number.isInteger(j.vault_id) || !Array.isArray(j.heirs)) return json(res, 400, { error: "bad request" });
      const v = await view(VAULT_CONTRACT, "get_vault", { vault_id: j.vault_id });
      const ageMs = Date.now() - Number(BigInt(v?.created_ns || 0) / 1_000_000n);
      if (!v || v.status !== "Active" || ageMs > 20 * 60_000 || j.heirs.length > v.heirs || namedSent.has(j.vault_id)) return json(res, 409, { error: "not eligible" });
      namedSent.add(j.vault_id);
      indexNamed(j.vault_id, j.heirs.slice(0, v.heirs), j.owner_name);
      const out = [];
      for (const h of j.heirs) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(h.email || ""))) continue;
        try { const id = await sendMail({ to: h.email.trim(), toName: String(h.name || "").slice(0, 60), ...namedEmail({ heirName: String(h.name || "").slice(0, 60), ownerName: String(j.owner_name || "").slice(0, 60), appUrl: APP_URL, vaultId: j.vault_id }) }); out.push("sent"); console.log(new Date().toISOString(), "named notice vault", j.vault_id, "->", id); }
        catch (e) { out.push("failed"); console.log(new Date().toISOString(), "named notice vault", j.vault_id, "FAILED", e.message.slice(0, 200)); }
      }
      const n = out.filter((x) => x === "sent").length;
      if (n) record("heirs_named", j.vault_id, n === 1 ? "1 heir told they were named" : `${n} heirs told they were named`);
      return json(res, 200, { results: out });
    }
    if (url.pathname === "/api/meta" && (req.method === "GET" || req.method === "PUT")) {
      const sub = await privyUser((req.headers.authorization || "").replace(/^Bearer /, ""));
      if (!sub) return json(res, 401, { error: "Please sign in again." });
      if (limited(req, 60, "meta", sub)) return json(res, 429, { error: "slow down" });
      if (req.method === "GET") return json(res, 200, getMeta(sub) || { blob: null, at: 0 });
      const j = JSON.parse((await body(req, 128 * 1024)).toString());
      try { return json(res, 200, { at: putMeta(sub, j.blob).at }); } catch { return json(res, 400, { error: "bad request" }); }
    }
    if (url.pathname === "/api/owner-open" && req.method === "POST") {
      // Keeper pays. Only the vault owner may ask; the enclave also checks the sealed owner email.
      const me = await privyNearAccounts((req.headers.authorization || "").replace(/^Bearer /, ""));
      if (!me) return json(res, 401, { error: "Please sign in again." });
      const sub = me.sub;
      const j = JSON.parse((await body(req, 64 * 1024)).toString());
      if (!Number.isInteger(j.vault_id) || !/^[0-9a-f]+$/i.test(j.request_hex || "")) return json(res, 400, { error: "bad request" });
      const st = await fresh(); const v = st.vaults.get(j.vault_id);
      if (!v || !me.accounts.includes(v.owner)) return json(res, 403, { error: "Only the owner can preview this vault." });
      if (limited(req, 10, "owner-open", sub)) return json(res, 429, { error: "Too many attempts, wait a minute." });
      const r = await relayOwnerOpen(ops, j);
      if (!r) return json(res, 409, { error: "Already opening, one moment." });
      return json(res, r.ok ? 200 : 422, r);
    }
    if (url.pathname === "/api/reopen" && req.method === "POST") {
      // Verify first; only verified requests count toward the limit, keyed on the Privy user.
      const sub = await privyUser((req.headers.authorization || "").replace(/^Bearer /, ""));
      if (!sub) return json(res, 401, { error: "Please sign in again." });
      const j = JSON.parse((await body(req, 64 * 1024)).toString());
      if (!Number.isInteger(j.vault_id) || !Number.isInteger(j.heir_index) || !/^[0-9a-f]+$/i.test(j.request_hex || "")) return json(res, 400, { error: "bad request" });
      if (limited(req, 10, "reopen", sub)) return json(res, 429, { error: "Too many attempts, wait a minute." });
      const r = await relayReopen(ops, j);
      if (!r) return json(res, 409, { error: "Already opening, one moment." });
      return json(res, r.ok ? 200 : 422, r);
    }
    if (url.pathname === "/api/claim" && req.method === "POST") {
      if (limited(req, 6)) return json(res, 429, { error: "Too many attempts, wait a minute." });
      const j = JSON.parse((await body(req, 64 * 1024)).toString());
      if (!Number.isInteger(j.vault_id) || !Number.isInteger(j.heir_index) || !/^[0-9a-f]+$/i.test(j.claim_hex || "")) return json(res, 400, { error: "bad request" });
      const r = await relayClaim(ops, j);
      if (!r) return json(res, 409, { error: "A claim for this share is already in progress." });
      return json(res, r.ok ? 200 : 422, r);
    }
    if (url.pathname.startsWith("/api/")) return json(res, 404, { error: "not found" });
    if (process.env.SERVE_WEB === "1") {
      let f = path.join(WEB, path.normalize(url.pathname).replace(/^(\.\.[/\\])+/, ""));
      if (!f.startsWith(WEB) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(WEB, "index.html");
      const ext = path.extname(f);
      res.writeHead(200, { "content-type": TYPES[ext] || "application/octet-stream", "cache-control": f.includes("/assets/") ? "public, max-age=31536000, immutable" : "no-cache" });
      return fs.createReadStream(f).pipe(res);
    }
    json(res, 404, { error: "not found" });
  } catch (e) { json(res, 500, { error: e.message.slice(0, 300) }); }
}).listen(PORT, HOST, () => console.log(`keeper on http://${HOST}:${PORT} app=${APP_URL}`));
