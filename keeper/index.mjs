// Morrowseal keeper: deadline watcher, heir mail, IPFS pinning for browsers, claim relay, and the web app.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { account } from "./chain.mjs";
import { pin, fetchCid } from "./ipfs.mjs";
import { tick, relayClaim } from "./lib.mjs";
import { fund, privyUser } from "./fund.mjs";
import { namedEmail, sendMail } from "./email.mjs";
import { view } from "./chain.mjs";
import { VAULT_CONTRACT } from "../shared/morrowseal.mjs";
const namedSent = new Set();

const PORT = Number(process.env.PORT || 8790);
const HOST = process.env.PORT ? "0.0.0.0" : "127.0.0.1";
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;
const INTERVAL = Number(process.env.KEEPER_INTERVAL_MS || 20000);
const WEB = path.resolve(new URL("../web/dist", import.meta.url).pathname);
const ops = await account(process.env.NEAR_OPS_ID, process.env.NEAR_OPS_KEY);
let last = { at: null, vaults: 0, error: null };

async function loop() {
  try { last = { at: new Date().toISOString(), vaults: await tick(ops, { appUrl: APP_URL }), error: null }; }
  catch (e) { last = { ...last, at: new Date().toISOString(), error: e.message.slice(0, 200) }; }
  setTimeout(loop, INTERVAL);
}
if (process.env.KEEPER_LOOP !== "0") loop();

const hits = new Map();
function limited(req, max = 30) {
  const ip = req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;
  const now = Date.now(), w = hits.get(ip)?.filter((t) => now - t < 60000) || [];
  w.push(now); hits.set(ip, w);
  return w.length > max;
}
const body = (req, max) => new Promise((res, rej) => { const c = []; let n = 0; req.on("data", (d) => { n += d.length; if (n > max) { rej(new Error("too large")); req.destroy(); } else c.push(d); }); req.on("end", () => res(Buffer.concat(c))); req.on("error", rej); });
const json = (res, code, obj) => { res.writeHead(code, { "content-type": "application/json", "access-control-allow-origin": "*" }); res.end(JSON.stringify(obj)); };
const TYPES = { ".js": "text/javascript", ".css": "text/css", ".html": "text/html; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".json": "application/json", ".webp": "image/webp", ".ico": "image/x-icon" };

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  try {
    if (req.method === "OPTIONS") { res.writeHead(204, { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type, authorization", "access-control-allow-methods": "GET,POST" }); return res.end(); }
    if (url.pathname === "/api/health") return json(res, 200, { ok: true, keeper: last, interval_ms: INTERVAL });
    if (url.pathname === "/api/ipfs" && req.method === "POST") {
      if (limited(req, 40)) return json(res, 429, { error: "slow down" });
      const b = await body(req, 25 * 1024 * 1024);
      return json(res, 200, { cid: await pin(b, url.searchParams.get("name") || "blob.bin") });
    }
    const m = url.pathname.match(/^\/api\/ipfs\/([a-zA-Z0-9]+)$/);
    if (m && req.method === "GET") { const b = await fetchCid(m[1]); res.writeHead(200, { "content-type": "application/octet-stream", "cache-control": "public, max-age=31536000, immutable", "access-control-allow-origin": "*" }); return res.end(b); }
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
      const out = [];
      for (const h of j.heirs) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(h.email || ""))) continue;
        try { const id = await sendMail({ to: h.email.trim(), toName: String(h.name || "").slice(0, 60), ...namedEmail({ heirName: String(h.name || "").slice(0, 60), ownerName: String(j.owner_name || "").slice(0, 60), appUrl: APP_URL, vaultId: j.vault_id }) }); out.push("sent"); console.log(new Date().toISOString(), "named notice vault", j.vault_id, "->", id); }
        catch (e) { out.push("failed"); console.log(new Date().toISOString(), "named notice vault", j.vault_id, "FAILED", e.message.slice(0, 200)); }
      }
      return json(res, 200, { results: out });
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
