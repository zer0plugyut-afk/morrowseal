//! Morrowseal on NEAR.
//!
//! Public state per vault: owner, sha256 commitment of the sealed vault, the IPFS CID of that
//! ciphertext, heir COUNT (never names or emails), check-in interval and grace, last check-in,
//! status, and per-heir claim records. Readable content never touches NEAR.
//!
//! Flow: create_vault -> check_in ... (owner stops) -> release (anyone, after the deadline)
//!       -> notify (OutLayer TEE seals heir emails + claim tokens to the mail keeper)
//!       -> claim (heir proves link token [+ NEAR Auth email]; TEE re-seals the file key to the heir).

use near_sdk::store::{IterableMap, Vector};
use near_sdk::{env, ext_contract, log, near, require, serde_json::json, AccountId, Gas, NearToken, PanicOnDefault, Promise, PromiseError};

const CALLBACK_GAS: Gas = Gas::from_tgas(30);
const MIN_TEE_DEPOSIT: NearToken = NearToken::from_millinear(20);
const MIN_INTERVAL_S: u64 = 60;
const MAX_HEIRS: u8 = 8;
const SEC: u64 = 1_000_000_000;

#[near(serializers = [borsh, json])]
#[derive(Clone, PartialEq, Debug)]
pub enum Status { Active, Released, Cancelled }

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Claim {
    pub claimant: String,
    pub verified_email: bool,
    /// file key + manifest, ECIES-sealed by the enclave to the heir's one-time browser key
    pub key_ct: String,
    pub claimed_ns: u64,
}

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Vault {
    pub id: u64,
    pub owner: AccountId,
    pub commitment: String,
    pub cid: String,
    pub heirs: u8,
    pub interval_s: u64,
    pub grace_s: u64,
    pub created_ns: u64,
    pub last_checkin_ns: u64,
    pub checkins: u32,
    pub status: Status,
    pub released_ns: Option<u64>,
    /// heir names/emails/tokens sealed to the mail keeper's key (unreadable to everyone else)
    pub notice_ct: Option<String>,
    pub claims: Vec<Option<Claim>>,
    pub pending: bool,
    /// set by the mail keeper once heir emails went out (prevents duplicate mail)
    pub mailed: bool,
}

#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct Event {
    pub kind: String,
    pub vault_id: u64,
    pub actor: String,
    pub at_ns: u64,
    pub detail: String,
}

#[ext_contract(ext_outlayer)]
#[allow(dead_code)]
trait OutLayer {
    fn request_execution(&mut self, source: serde_json::Value, resource_limits: Option<serde_json::Value>, input_data: Option<String>,
        secrets_ref: Option<serde_json::Value>, response_format: Option<String>, payer_account_id: Option<AccountId>);
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Morrowseal {
    admin: AccountId,
    outlayer: AccountId,
    project_id: String,
    secrets_owner: AccountId,
    enclave_pubkey: String,
    vaults: IterableMap<u64, Vault>,
    events: Vector<Event>,
    next_id: u64,
}

fn now() -> u64 { env::block_timestamp() }
fn is_hex64(s: &str) -> bool { s.len() == 64 && hex::decode(s).is_ok() }

#[near]
impl Morrowseal {
    #[init]
    pub fn new(admin: AccountId, project_id: String, secrets_owner: AccountId, enclave_pubkey: String) -> Self {
        Self { admin, outlayer: "outlayer.testnet".parse().unwrap(), project_id, secrets_owner, enclave_pubkey,
            vaults: IterableMap::new(b"v"), events: Vector::new(b"e"), next_id: 1 }
    }

    pub fn set_config(&mut self, project_id: Option<String>, enclave_pubkey: Option<String>) {
        require!(env::predecessor_account_id() == self.admin, "admin only");
        if let Some(p) = project_id { self.project_id = p; }
        if let Some(k) = enclave_pubkey { self.enclave_pubkey = k; }
    }

    fn event(&mut self, kind: &str, vault_id: u64, detail: String) {
        let e = Event { kind: kind.into(), vault_id, actor: env::predecessor_account_id().to_string(), at_ns: now(), detail };
        log!("EVENT_JSON:{}", json!({"standard":"morrowseal","version":"1","event":kind,"data":{"vault_id":vault_id,"actor":e.actor,"detail":e.detail}}));
        self.events.push(e);
    }

    // ---------- owner ----------

    pub fn create_vault(&mut self, commitment: String, cid: String, heirs: u8, interval_s: u64, grace_s: u64) -> u64 {
        require!(is_hex64(&commitment), "commitment = sha256 hex");
        require!(!cid.is_empty() && cid.len() <= 100, "cid");
        require!(heirs > 0 && heirs <= MAX_HEIRS, "1..8 heirs");
        require!(interval_s >= MIN_INTERVAL_S && interval_s <= 3 * 365 * 86_400, "interval 60s..3y");
        require!(grace_s <= 365 * 86_400, "grace <= 1y");
        let id = self.next_id;
        self.next_id += 1;
        let v = Vault { id, owner: env::predecessor_account_id(), commitment, cid, heirs, interval_s, grace_s, created_ns: now(),
            last_checkin_ns: now(), checkins: 0, status: Status::Active, released_ns: None, notice_ct: None,
            claims: vec![None; heirs as usize], pending: false, mailed: false };
        self.vaults.insert(id, v);
        self.event("vault_created", id, format!("{heirs} heir(s), check in every {interval_s}s"));
        id
    }

    pub fn check_in(&mut self, vault_id: u64) -> u64 {
        let v = self.vaults.get_mut(&vault_id).expect("no vault");
        require!(v.owner == env::predecessor_account_id(), "owner only");
        require!(v.status == Status::Active, "vault not active");
        v.last_checkin_ns = now();
        v.checkins += 1;
        let next = v.last_checkin_ns + v.interval_s * SEC;
        self.event("checked_in", vault_id, String::new());
        next
    }

    /// Replace sealed contents (new files or heirs). Also counts as a check-in.
    pub fn update_vault(&mut self, vault_id: u64, commitment: String, cid: String, heirs: u8) {
        require!(is_hex64(&commitment), "commitment = sha256 hex");
        require!(heirs > 0 && heirs <= MAX_HEIRS, "1..8 heirs");
        let v = self.vaults.get_mut(&vault_id).expect("no vault");
        require!(v.owner == env::predecessor_account_id(), "owner only");
        require!(v.status == Status::Active, "vault not active");
        v.commitment = commitment;
        v.cid = cid;
        v.heirs = heirs;
        v.claims = vec![None; heirs as usize];
        v.last_checkin_ns = now();
        self.event("vault_updated", vault_id, format!("{heirs} heir(s)"));
    }

    pub fn set_schedule(&mut self, vault_id: u64, interval_s: u64, grace_s: u64) {
        require!(interval_s >= MIN_INTERVAL_S && grace_s <= 365 * 86_400, "bad schedule");
        let v = self.vaults.get_mut(&vault_id).expect("no vault");
        require!(v.owner == env::predecessor_account_id(), "owner only");
        require!(v.status == Status::Active, "vault not active");
        v.interval_s = interval_s;
        v.grace_s = grace_s;
        v.last_checkin_ns = now();
        self.event("schedule_changed", vault_id, format!("every {interval_s}s, grace {grace_s}s"));
    }

    pub fn cancel(&mut self, vault_id: u64) {
        let v = self.vaults.get_mut(&vault_id).expect("no vault");
        require!(v.owner == env::predecessor_account_id(), "owner only");
        require!(v.status == Status::Active, "vault not active");
        v.status = Status::Cancelled;
        self.event("vault_cancelled", vault_id, String::new());
    }

    // ---------- release ----------

    /// Anyone, once interval + grace has passed without a check-in.
    pub fn release(&mut self, vault_id: u64) {
        let v = self.vaults.get_mut(&vault_id).expect("no vault");
        require!(v.status == Status::Active, "vault not active");
        require!(now() >= v.last_checkin_ns + (v.interval_s + v.grace_s) * SEC, "owner is still checking in");
        v.status = Status::Released;
        v.released_ns = Some(now());
        self.event("vault_released", vault_id, String::new());
    }

    /// Ask the enclave to seal heir notices for the mail keeper. Anyone may pay; re-callable until it lands.
    #[payable]
    pub fn notify(&mut self, vault_id: u64, ciphertext_hex: String) -> Promise {
        require!(env::attached_deposit() >= MIN_TEE_DEPOSIT, "attach >= 0.02 NEAR for OutLayer");
        let digest = hex::encode(env::sha256(&hex::decode(ciphertext_hex.trim_start_matches("0x")).expect("hex")));
        let v = self.vaults.get_mut(&vault_id).expect("no vault");
        require!(v.status == Status::Released, "vault not released");
        require!(v.notice_ct.is_none(), "already notified");
        require!(!v.pending, "in flight");
        require!(digest == v.commitment, "ciphertext does not match commitment");
        v.pending = true;
        let input = json!({"action":"notify","vault_id":vault_id,"ciphertext_hex":ciphertext_hex.trim_start_matches("0x")});
        self.tee(input).then(Self::ext(env::current_account_id()).with_static_gas(CALLBACK_GAS).on_notify(vault_id, digest))
    }

    /// An heir claims. `claim_hex` is sealed to the enclave, so the link token never appears on chain.
    #[payable]
    pub fn claim(&mut self, vault_id: u64, heir_index: u32, ciphertext_hex: String, claim_hex: String) -> Promise {
        require!(env::attached_deposit() >= MIN_TEE_DEPOSIT, "attach >= 0.02 NEAR for OutLayer");
        let digest = hex::encode(env::sha256(&hex::decode(ciphertext_hex.trim_start_matches("0x")).expect("hex")));
        let v = self.vaults.get_mut(&vault_id).expect("no vault");
        require!(v.status == Status::Released, "vault not released");
        require!(digest == v.commitment, "ciphertext does not match commitment");
        require!((heir_index as usize) < v.claims.len(), "no such heir");
        require!(v.claims[heir_index as usize].is_none(), "already claimed");
        let input = json!({"action":"claim","vault_id":vault_id,"heir_index":heir_index,
            "ciphertext_hex":ciphertext_hex.trim_start_matches("0x"),"claim_hex":claim_hex.trim_start_matches("0x")});
        self.tee(input).then(Self::ext(env::current_account_id()).with_static_gas(CALLBACK_GAS).on_claim(vault_id, heir_index, digest))
    }

    fn tee(&self, input: serde_json::Value) -> Promise {
        ext_outlayer::ext(self.outlayer.clone())
            .with_attached_deposit(env::attached_deposit())
            .with_unused_gas_weight(1)
            .request_execution(
                json!({"Project": {"project_id": self.project_id, "version_key": null}}),
                Some(json!({"max_instructions": 20_000_000_000u64, "max_memory_mb": 128u32, "max_execution_seconds": 60u64})),
                Some(input.to_string()),
                Some(json!({"profile": "default", "account_id": self.secrets_owner})),
                Some("Json".into()),
                Some(env::predecessor_account_id()),
            )
    }

    fn tee_result(result: Result<Option<serde_json::Value>, PromiseError>) -> Result<serde_json::Value, String> {
        match result {
            Ok(Some(v)) if v["success"] == json!(true) => Ok(v["result"].clone()),
            Ok(Some(v)) => Err(v["error"].as_str().unwrap_or("enclave error").to_string()),
            _ => Err("no enclave result".into()),
        }
    }

    #[private]
    pub fn on_notify(&mut self, vault_id: u64, commitment: String,
        #[callback_result] result: Result<Option<serde_json::Value>, PromiseError>) -> serde_json::Value {
        let r = Self::tee_result(result);
        let v = self.vaults.get_mut(&vault_id).expect("no vault");
        v.pending = false;
        let r = match r { Ok(r) => r, Err(e) => { log!("notify failed: {}", e); return json!({"ok":false,"error":e}); } };
        if r["commitment"].as_str() != Some(commitment.as_str()) || v.commitment != commitment {
            return json!({"ok":false,"error":"stale result"});
        }
        v.notice_ct = r["notice_ct"].as_str().map(|s| s.to_string());
        self.event("heirs_notified", vault_id, String::new());
        json!({"ok":true})
    }

    #[private]
    pub fn on_claim(&mut self, vault_id: u64, heir_index: u32, commitment: String,
        #[callback_result] result: Result<Option<serde_json::Value>, PromiseError>) -> serde_json::Value {
        let r = match Self::tee_result(result) { Ok(r) => r, Err(e) => { log!("claim refused: {}", e); return json!({"ok":false,"error":e}); } };
        let v = self.vaults.get_mut(&vault_id).expect("no vault");
        if r["commitment"].as_str() != Some(commitment.as_str()) || r["heir_index"].as_u64() != Some(heir_index as u64) {
            return json!({"ok":false,"error":"stale result"});
        }
        let slot = &mut v.claims[heir_index as usize];
        if slot.is_some() { return json!({"ok":false,"error":"already claimed"}); }
        let c = Claim { claimant: r["claimant"].as_str().unwrap_or("").to_string(), verified_email: r["verified_email"] == json!(true),
            key_ct: r["key_ct"].as_str().unwrap_or("").to_string(), claimed_ns: now() };
        let detail = format!("heir #{} claimed{}", heir_index + 1, if c.verified_email { " (email verified)" } else { "" });
        *slot = Some(c);
        self.event("heir_claimed", vault_id, detail);
        json!({"ok":true})
    }

    /// Mail keeper (admin) records that heir emails were sent. Admin can also clear it to resend.
    pub fn set_mailed(&mut self, vault_id: u64, mailed: bool) {
        require!(env::predecessor_account_id() == self.admin, "admin only");
        let v = self.vaults.get_mut(&vault_id).expect("no vault");
        require!(v.notice_ct.is_some(), "not notified yet");
        v.mailed = mailed;
        let n = v.heirs;
        if mailed { self.event("heir_email_sent", vault_id, format!("{n} heir(s)")); }
    }

    // ---------- views ----------

    pub fn get_config(&self) -> serde_json::Value {
        json!({"admin":self.admin,"outlayer":self.outlayer,"project_id":self.project_id,"secrets_owner":self.secrets_owner,
            "enclave_pubkey":self.enclave_pubkey,"vaults":self.next_id - 1,"events":self.events.len()})
    }
    pub fn get_vault(&self, vault_id: u64) -> Option<Vault> { self.vaults.get(&vault_id).cloned() }
    pub fn vaults_of(&self, owner: AccountId) -> Vec<Vault> { self.vaults.values().filter(|v| v.owner == owner).cloned().collect() }
    pub fn list_vaults(&self, from: Option<u64>, limit: Option<u64>) -> Vec<Vault> {
        let from = from.unwrap_or(1);
        (from..from + limit.unwrap_or(50).min(100)).filter_map(|i| self.vaults.get(&i).cloned()).collect()
    }
    pub fn list_events(&self, from: Option<u32>, limit: Option<u32>) -> Vec<Event> {
        let n = self.events.len();
        let from = from.unwrap_or(0);
        (from..(from + limit.unwrap_or(50).min(100)).min(n)).filter_map(|i| self.events.get(i).cloned()).collect()
    }
    /// seconds until anyone may release (0 = releasable now)
    pub fn due_in(&self, vault_id: u64) -> i64 {
        let v = self.vaults.get(&vault_id).expect("no vault");
        let due = v.last_checkin_ns + (v.interval_s + v.grace_s) * SEC;
        (due as i128 - now() as i128).max(0) as i64 / SEC as i64
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::VMContextBuilder;
    use near_sdk::testing_env;

    fn ctx(who: &str, ts: u64) { testing_env!(VMContextBuilder::new().predecessor_account_id(who.parse().unwrap()).block_timestamp(ts).build()); }

    #[test]
    fn lifecycle() {
        ctx("admin.testnet", 1);
        let mut c = Morrowseal::new("admin.testnet".parse().unwrap(), "a/b".into(), "a.testnet".parse().unwrap(), "02aa".into());
        ctx("alice.testnet", SEC);
        let id = c.create_vault("ab".repeat(32), "bafy".into(), 2, 60, 30);
        ctx("bob.testnet", 80 * SEC);
        let r = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| { let mut c2 = Morrowseal::new("a.testnet".parse().unwrap(), "x".into(), "a.testnet".parse().unwrap(), "x".into()); c2.release(1) }));
        assert!(r.is_err());
        ctx("alice.testnet", 50 * SEC);
        c.check_in(id);
        ctx("bob.testnet", 200 * SEC);
        c.release(id);
        assert_eq!(c.get_vault(id).unwrap().status, Status::Released);
        assert_eq!(c.list_events(None, None).len(), 3);
    }

    #[test]
    #[should_panic(expected = "owner is still checking in")]
    fn early_release_refused() {
        ctx("admin.testnet", 1);
        let mut c = Morrowseal::new("admin.testnet".parse().unwrap(), "a/b".into(), "a.testnet".parse().unwrap(), "02aa".into());
        ctx("alice.testnet", SEC);
        let id = c.create_vault("ab".repeat(32), "bafy".into(), 1, 60, 0);
        ctx("bob.testnet", 30 * SEC);
        c.release(id);
    }
}
