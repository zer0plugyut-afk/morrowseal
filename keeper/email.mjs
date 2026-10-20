// Heir mail through Brevo. Calm, short, one button. Sender: EMAIL_FROM_NAME <EMAIL_FROM>.
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function heirEmail({ heirName, ownerName, link }) {
  const who = ownerName ? esc(ownerName) : "Someone close to you";
  const subject = ownerName ? `${ownerName} left something for you` : "Something was left for you";
  const text = `Hi ${heirName || "there"},\n\n${ownerName || "Someone close to you"} set up a private vault and named you as someone to receive it. It is ready for you now.\n\nOpen it here: ${link}\n\nTake your time. The link is only for you, and nothing has been shared with anyone else.\n\nVault Keeper`;
  const html = `<!doctype html><html><body style="margin:0;background:#f9f8f8;font-family:'Open Runde',Inter,-apple-system,Segoe UI,Roboto,sans-serif;color:#1a1615">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9f8f8;padding:40px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid #e4e2e2;border-radius:24px;box-shadow:0 4px 50px rgba(97,74,68,.10)">
<tr><td style="padding:36px 36px 8px"><div style="width:40px;height:40px;border-radius:12px;background:#0953ff"></div></td></tr>
<tr><td style="padding:16px 36px 0;font-size:22px;line-height:1.3;font-weight:600;letter-spacing:-.02em">Hi ${esc(heirName) || "there"},</td></tr>
<tr><td style="padding:12px 36px 0;font-size:16px;line-height:1.6;color:#453f3d">${who} set up a private vault and named you as someone to receive it. It is ready for you now.</td></tr>
<tr><td style="padding:28px 36px"><a href="${esc(link)}" style="display:inline-block;background:#1a1615;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 26px;border-radius:50px">Open what was left</a></td></tr>
<tr><td style="padding:0 36px 32px;font-size:14px;line-height:1.6;color:#757170">Take your time. The link is only for you, and nothing has been shared with anyone else.</td></tr>
</table>
<div style="max-width:480px;padding:18px 8px;font-size:12px;line-height:1.5;color:#757170">You received this because you were named in a Morrowseal vault. If this is unexpected, you can simply ignore it.</div>
</td></tr></table></body></html>`;
  return { subject, text, html };
}

export async function sendMail({ to, toName, subject, html, text }) {
  const key = process.env.BREVO_API_KEY;
  if (!key) throw new Error("BREVO_API_KEY not set");
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ sender: { name: process.env.EMAIL_FROM_NAME || "Vault Keeper", email: process.env.EMAIL_FROM }, to: [{ email: to, name: toName || undefined }], subject, htmlContent: html, textContent: text }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`brevo ${r.status}: ${JSON.stringify(j).slice(0, 200)}`);
  return j.messageId;
}
