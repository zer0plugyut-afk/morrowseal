// NEAR Auth (FastAuth) heir sign-in. Testnet uses the shared Auth0 client, which accepts
// http://localhost:3000 as its callback; other origins need their own client id (VITE_FASTAUTH_CLIENT_ID).
import { JavascriptProvider } from "@fast-auth-near/javascript-provider";
import { FASTAUTH } from "@shared/morrowseal.mjs";

const clientId = (import.meta.env.VITE_FASTAUTH_CLIENT_ID as string) || FASTAUTH.clientId;
export const fastAuthAvailable = () => clientId !== FASTAUTH.clientId || location.origin === "http://localhost:3000";

let provider: JavascriptProvider | null = null;
function p() { if (!provider) provider = new JavascriptProvider({ network: "testnet", clientId }); return provider; }

export type HeirSession = { email: string; idToken: string; path: string; label: string };

async function session(): Promise<HeirSession | null> {
  const prov: any = p();
  if (!(await prov.isLoggedIn())) return null;
  const claims = await prov.client.getIdTokenClaims();
  if (!claims?.__raw) return null;
  const path = await prov.getPath();
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(path)));
  const label = "near-auth:" + Array.from(digest.slice(0, 10), (b) => b.toString(16).padStart(2, "0")).join("");
  return { email: claims.email, idToken: claims.__raw, path, label };
}

export async function currentHeir() { try { return await session(); } catch { return null; } }

export async function loginHeir(): Promise<HeirSession | null> {
  await p().login({}, true);
  return session();
}
export async function logoutHeir() { try { await (p() as any).client.logout({ openUrl: false }); } catch {} }
