// End-to-end on testnet, no browser: create a vault with a 60 s check-in, let it lapse,
// release + notify through the TEE, read the keeper notice, claim as the heir, decrypt the file.
// Usage: node scripts/e2e.mjs create | claim <vault_id>   (env from the private env file)
import { account, call, view, lastValue } from "../keeper/chain.mjs";
import { pin, fetchCid } from "../keeper/ipfs.mjs";
import { notify, relayClaim } from "../keeper/lib.mjs";
import { VAULT_CONTRACT, buildVault, buildClaim, openGift, unseal, fromHex, deadlineMs } from "../shared/morrowseal.mjs";

const [cmd, arg] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const HEIR = { name: process.env.E2E_HEIR_NAME || "Ama", email: process.env.E2E_HEIR_EMAIL || "vaultkeeper@agentmail.to" };

if (cmd === "create") {
  const owner = await account(process.env.NEAR_OWNER_ID, process.env.NEAR_OWNER_KEY);
  const note = new TextEncoder().encode("Dear Ama,\n\nThe house deed is in the blue folder. The pension login is below.\nWith love.\n");
  const v = await buildVault({ owner: owner.accountId, ownerName: "Kofi", message: "Everything you need is in here. Love, K.", heirs: [HEIR], files: [{ name: "letter.txt", type: "text/plain", bytes: note }], upload: pin });
  const o = await call(owner, VAULT_CONTRACT, "create_vault", { commitment: v.commitment, cid: v.cid, heirs: v.heirs, interval_s: Number(process.env.E2E_INTERVAL || 60), grace_s: 0 }, { tgas: 30 });
  console.log(JSON.stringify({ vault_id: lastValue(o), create_tx: o.transaction.hash, cid: v.cid, commitment: v.commitment }));
} else if (cmd === "token-claim") {
  // keeper-only path: release + notify + decrypt notice + claim with the link token (no email login)
  const ops = await account(process.env.NEAR_OPS_ID, process.env.NEAR_OPS_KEY);
  const id = Number(arg);
  let v = await view(VAULT_CONTRACT, "get_vault", { vault_id: id });
  while (Date.now() < deadlineMs(v) + 2000) { console.log("waiting", Math.round((deadlineMs(v) - Date.now()) / 1000), "s"); await sleep(10000); }
  if (v.status === "Active") { const r = await call(ops, VAULT_CONTRACT, "release", { vault_id: id }, { tgas: 30 }); console.log("release_tx", r.transaction.hash); }
  v = await view(VAULT_CONTRACT, "get_vault", { vault_id: id });
  if (!v.notice_ct) console.log("notify_tx", await notify(ops, v));
  v = await view(VAULT_CONTRACT, "get_vault", { vault_id: id });
  const notice = unseal(process.env.KEEPER_SK, fromHex(v.notice_ct));
  console.log("notice heirs", notice.heirs.map((h) => ({ i: h.i, name: h.name, email: h.email.replace(/(.).+@/, "$1…@") })));
  const c = buildClaim({ token: notice.heirs[0].token, claimant: "e2e-script" });
  const r = await relayClaim(ops, { vault_id: id, heir_index: 0, claim_hex: c.claimHex });
  console.log("claim", r);
  v = await view(VAULT_CONTRACT, "get_vault", { vault_id: id });
  const g = await openGift(c.ephSk, v.claims[0].key_ct, fetchCid);
  console.log("decrypted:", g.files.map((f) => `${f.name}: ${new TextDecoder().decode(f.bytes).slice(0, 40)}…`), "message:", g.message);
}
