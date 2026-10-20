// Names and notes the owner typed stay on this device only. The chain never sees them.
export type LocalVault = { title: string; heirs: { name: string; email: string }[]; files: { name: string; size: number }[]; createdAt: number };
const KEY = "ms-vaults";
export function localVaults(): Record<string, LocalVault> { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } }
export function saveLocal(id: number, v: LocalVault) { const all = localVaults(); all[String(id)] = v; localStorage.setItem(KEY, JSON.stringify(all)); }
