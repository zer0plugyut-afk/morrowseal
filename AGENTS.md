# Morrowseal: guide for AI agents and reviewers

Machine-readable summary of what this repository is, what it claims, and where each claim lives in code. Everything below is NEAR **testnet**.

## Problem

When the only person who holds a seed phrase, password or private document dies or becomes incapacitated, that access is usually lost for good: there is no recovery desk for a self-custodied key. The common workarounds each leak or centralize the secret: writing it down for a relative (exposed early), giving it to a lawyer or custodian (trust a third party with plaintext), or a hosted dead-man's switch (the operator can read it). Putting it on a public chain is worse: everything there is readable forever.

## Solution

Morrowseal is an inheritance vault with a dead-man timer. The owner's browser encrypts files and a letter, then seals the decryption key and the heir list to a key that exists only inside an OutLayer TEE enclave. NEAR stores only a commitment (SHA-256 of the sealed blob), an IPFS CID of ciphertext, an heir count and timestamps. While the owner keeps checking in nothing can be opened. If a full interval plus grace passes without a check-in, anyone can release the vault on chain; the enclave then verifies each heir's sign-in email (Privy) against the sealed heir email and re-seals the key to that heir's browser, where the files are decrypted locally.

## Hackathon tracks

- `privacy` (Privacy & Private AI; hint "TEE"): confidential compute over sensitive data. Files and heir identities never go on chain in plaintext, and release decisions run in an OutLayer TEE. Limits: the keeper sees heir emails after release (to send mail) and an HMAC of them at seal time; Privy holds users' NEAR keys; testnet only.

## Features (each is implemented; see the map below)

1. Privy sign-in (email one-time code or Google) that gives every user a NEAR testnet implicit account (Privy embedded wallet, `chainType: near`); the keeper tops up new accounts once with 0.25 NEAR.
2. 5-step sealing flow (name & message / files / heirs / check-in rule / review & seal), all encryption in the browser.
3. Heirs are emailed twice: once at seal time ("you've been named", no link to contents) and once on release (a private claim link).
4. Check-in dead-man timer: `interval + grace` of silence makes the vault releasable by anyone; the keeper releases automatically.
5. OutLayer TEE enclave verifies the heir's Privy-verified email against the email sealed inside the vault before releasing the key.
6. NEAR yield/resume: the contract calls `outlayer.testnet.request_execution` and resumes in a callback with the enclave result.
7. Commitment-only on-chain storage: no names, emails, titles or contents on NEAR.
8. "Shared with me": a signed-in heir sees every vault naming their email (waiting / released / opened).
9. Reopen on any device: after the first recorded claim, the heir can open the vault again anywhere by signing in with the same email (`heir_open`).
10. Keeper-paid gas: release, notify, heir claims, heir reopens and owner preview are paid by the keeper account; heirs need no NEAR at all.
11. Owner preview: the owner can decrypt their own vault (enclave checks the owner's sign-in email against the sealed owner email; vaults #7 and later).
12. Activity: per-user event history (own vaults, plus releases and own claims for vaults shared with you).

## Architecture

```
Owner browser --AES-256-GCM files, ECIES-sealed manifest--> IPFS (ciphertext only)
Owner browser --create_vault / check_in (signed via Privy)--> morrowseal-vault.testnet
Keeper (Node, Railway) --release / notify / claim / heir_open / owner_open--> contract
contract --request_execution (yield)--> outlayer.testnet --> TDX enclave (morrowseal-ops.testnet/morrowseal)
enclave --re-reads vault over NEAR RPC, checks status + commitment, checks Privy email--> result
contract callback (resume) --> heir notice sealed to keeper key / file key sealed to heir's one-time browser key
Keeper --one email per heir--> heir inbox --> heir browser decrypts locally
Web app --reads only /api/* (keeper read model + /api/rpc proxy)--> keeper
```

## Deployed ids (testnet)

| Piece | Id | Explorer |
| --- | --- | --- |
| Vault contract | `morrowseal-vault.testnet` | https://testnet.nearblocks.io/address/morrowseal-vault.testnet |
| Keeper / admin account | `morrowseal-ops.testnet` | https://testnet.nearblocks.io/address/morrowseal-ops.testnet |
| OutLayer contract | `outlayer.testnet` | https://testnet.nearblocks.io/address/outlayer.testnet |
| OutLayer project | `morrowseal-ops.testnet/morrowseal` | — |
| Enclave wasm (sha256) | `2eefb0e9302e312d8e56bd43663cd602f8b2daa82eb2cd82c193b4c006b1a71b` | https://test.fastfs.io/morrowseal-ops.testnet/outlayer.testnet/2eefb0e9302e312d8e56bd43663cd602f8b2daa82eb2cd82c193b4c006b1a71b.wasm |
| Enclave public key | `02c2a3119b44700420af138a0918682a074a162e7a10200c4234b5da8383cd6977` | `get_config` on the contract |
| App | https://morrowseal-production.up.railway.app or `http://localhost:3000` locally | `/api/health` |

Transaction hashes for verified runs: `deployments/morrowseal.json`.

## Claim -> code path

| Claim | Where to look |
| --- | --- |
| Files encrypted in the browser (AES-256-GCM) | `shared/morrowseal.mjs` `aesEncrypt`, `buildVault` |
| Key + heirs sealed to the enclave (ECIES secp256k1) | `shared/morrowseal.mjs` `seal`, `buildVault` |
| Only commitment, CID, heir count, times on chain | `contracts/vault/src/lib.rs` `struct Vault`, `create_vault` |
| Dead-man timer and permissionless release | `contracts/vault/src/lib.rs` `check_in`, `release`, `due_in`; keeper `keeper/lib.mjs` `tick` |
| Yield/resume into the TEE | `contracts/vault/src/lib.rs` `tee`, `notify`/`on_notify`, `claim`/`on_claim`, `heir_open`/`on_heir_open`, `owner_open`/`on_owner_open` |
| Enclave re-reads the vault and checks the commitment | `enclave/src/main.rs` `open_vault` |
| Enclave verifies heir email via Privy | `enclave/src/jwt.rs` `verified_email`; `enclave/src/main.rs` `"claim"`, `"heir_open"` |
| One-time claim tokens never on chain | `enclave/src/main.rs` `token_for`; `shared/morrowseal.mjs` `buildClaim` |
| Heirs emailed at seal and on release | `keeper/email.mjs` `namedEmail`, `heirEmail`; `keeper/index.mjs` `/api/named`; `keeper/lib.mjs` `mailHeirs` |
| Shared with me (HMAC heir-email index) | `keeper/heirs.mjs`; `keeper/index.mjs` `/api/shared`; `web/src/pages/Misc.tsx` `SharedWithMe` |
| Reopen on any device | `contracts/vault/src/lib.rs` `heir_open`; `keeper/lib.mjs` `relayReopen`; `web/src/pages/Claim.tsx` `reopen` |
| Keeper-paid gas | `keeper/lib.mjs` `relayClaim`, `relayReopen`, `relayOwnerOpen`; `keeper/fund.mjs` `fund` |
| Owner preview | `enclave/src/main.rs` `"owner_open"`; `keeper/index.mjs` `/api/owner-open`; `web/src/pages/Vaults.tsx` `OwnerOpen` |
| Privy NEAR accounts | `web/src/lib/privy.tsx` (`createWallet({ chainType: "near" })`, `signRawHash`) |
| Per-user Activity | `keeper/index.mjs` `/api/activity`; `web/src/pages/Misc.tsx` `Activity` |

## Honest limits

Testnet only; one enclave deployment and one keeper. The keeper sees heir emails after release (to send mail) and an HMAC of heir emails at seal time. Privy holds users' NEAR keys and attests emails. Details: `README.md` (Limitations) and `docs/threat-model.md`.

## Build

`npm ci && (cd web && npm ci && npm run build)`; contract `cd contracts/vault && cargo near build non-reproducible-wasm`; enclave `cd enclave && PRIVY_APP_ID=... cargo build --release --target wasm32-wasip2`.
