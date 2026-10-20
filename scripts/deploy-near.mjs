// Deploy (or upgrade) the vault contract. Keys come from the env file (never committed).
import fs from "node:fs";
import { account, call, view } from "../keeper/chain.mjs";
const id = process.env.NEAR_CONTRACT_ID;
const a = await account(id, process.env.NEAR_CONTRACT_KEY);
const wasm = fs.readFileSync(new URL("../contracts/vault/target/near/morrowseal_vault.wasm", import.meta.url));
const r = await a.deployContract(wasm);
console.log("deploy tx", r.transaction.hash);
let inited = true;
try { await view(id, "get_config"); } catch { inited = false; }
if (!inited) {
  const i = await call(a, id, "new", { admin: process.env.NEAR_OPS_ID, project_id: `${process.env.NEAR_OPS_ID}/morrowseal`, secrets_owner: process.env.NEAR_OPS_ID, enclave_pubkey: process.env.ENCLAVE_PUBKEY }, { tgas: 50 });
  console.log("init tx", i.transaction.hash);
}
console.log(await view(id, "get_config"));
