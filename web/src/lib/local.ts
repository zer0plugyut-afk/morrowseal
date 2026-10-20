// Names and notes the owner typed stay on this device only. The chain never sees them.
export type LocalVault = { title: string; heirs: { name: string; email: string }[]; files: { name: string; size: number }[]; createdAt: number; at?: number };
const KEY = "ms-vaults";
export function localVaults(): Record<string, LocalVault> { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } }
export function saveLocal(id: number, v: LocalVault, { sync = true } = {}) {
  const all = localVaults(); all[String(id)] = { ...v, at: v.at ?? Date.now() }; localStorage.setItem(KEY, JSON.stringify(all));
  window.dispatchEvent(new Event("ms-local"));
  if (sync) import("./meta").then((m) => m.pushMeta()).catch(() => {});
}
export function replaceLocal(all: Record<string, LocalVault>) { localStorage.setItem(KEY, JSON.stringify(all)); window.dispatchEvent(new Event("ms-local")); }
