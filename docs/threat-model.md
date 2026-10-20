# Threat model

| Actor | Can | Cannot |
| --- | --- | --- |
| Anyone reading NEAR | See vault owner, commitment, CID, heir count, check-in times, release time, claim labels, ciphertext of notices/keys | Read files, message, heir names or emails; release a vault early |
| IPFS / Pinata | Store and serve ciphertext | Decrypt (AES-256-GCM key is sealed to the enclave) |
| Keeper (Railway) | Trigger release after the deadline, read heir names/emails after release, relay claims, pay gas | Read files or the file key; release early (the enclave re-reads NEAR); forge an heir (needs the token and, with NEAR Auth, the heir's verified email) |
| OutLayer operator | Run or refuse to run the worker | Read `PROTECTED_MORROWSEAL_MASTER` (generated inside the keystore TEE) without breaking TDX |
| Someone with the email link | Claim with "link only" if NEAR Auth isn't used for that claim | Claim twice (set-once per heir); learn the token from chain (it's sealed to the enclave) |
| A forged OutLayer request | Run the public project with arbitrary input | Get anything useful: every action checks `get_vault` on NEAR (status Released + commitment) and notices are sealed to a key compiled into the wasm |

Residual risks: TEE compromise; keeper key theft (exposes heir emails of released vaults, not contents); RPC lying to the enclave (mitigate with multiple RPCs/light client); DMARC on the current sender; single-region keeper. Planned: k-of-n guardian Shamir backup of the file key, multiple RPC quorum inside the enclave, per-vault Auth0 requirement flag.
