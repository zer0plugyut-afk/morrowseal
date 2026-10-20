// Read model for the web app: vaults, events and config cached from the contract views.
// The chain stays the source of truth; this just serves it fast, same-origin, without CORS.
import { view } from "./chain.mjs";
import { VAULT_CONTRACT } from "../shared/morrowseal.mjs";

const S = { config: null, vaults: new Map(), events: [], at: 0, refreshing: null };

async function pull() {
  const config = await view(VAULT_CONTRACT, "get_config");
  const vaults = [];
  for (let f = 1; f <= config.vaults; f += 100) vaults.push(...(await view(VAULT_CONTRACT, "list_vaults", { from: f, limit: 100 })));
  const events = [];
  for (let f = 0; f < config.events; f += 100) events.push(...(await view(VAULT_CONTRACT, "list_events", { from: f, limit: 100 })));
  S.config = config; S.vaults = new Map(vaults.map((v) => [v.id, v])); S.events = events; S.at = Date.now();
}
export async function fresh(maxAgeMs = 4000) {
  if (Date.now() - S.at < maxAgeMs && S.config) return S;
  if (!S.refreshing) S.refreshing = pull().finally(() => { S.refreshing = null; });
  try { await S.refreshing; } catch (e) { if (!S.config) throw e; }
  return S;
}
export const ownerIds = (s, owner) => new Set([...s.vaults.values()].filter((v) => v.owner === owner).map((v) => v.id));
