import { Resend } from 'resend';

export const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';
// Resend's built-in sandbox sender — works without any domain verification,
// but only delivers to the email address your Resend account itself is signed
// up with. Swap FROM_EMAIL to a verified address on your own domain once
// maturin.app (or another domain you control) is verified in Resend.
export const FROM_EMAIL = process.env.FROM_EMAIL ?? 'onboarding@resend.dev';

export function getResend()
{
    return new Resend(process.env.RESEND_API_KEY ?? 'missing');
}

// Fire-and-forget send used by every notification email — never lets a send
// failure (or missing RESEND_API_KEY in local dev) break the calling flow.
//
// Resend's SDK does NOT throw for API-level errors (invalid from-address,
// unverified domain, restricted/invalid API key, etc.) — it resolves with
// `{ data, error }`. That `error` field must be checked explicitly, or a
// rejected send looks identical to a successful one.
export async function sendEmail(label: string, params: { to: string; subject: string; html: string })
{
    try
    {
        const result = await getResend().emails.send({ from: FROM_EMAIL, to: params.to, subject: params.subject, html: params.html });
        if (result.error)
        {
            console.warn(`[email] ${label} rejected by Resend:`, result.error.name, '-', result.error.message);
            return;
        }
        console.log(`[email] ${label} sent to ${params.to} (id: ${result.data.id})`);
    }
    catch (err)
    {
        console.warn(`[email] ${label} send failed (no key configured locally):`, (err as Error).message);
    }
}

// Shared header/footer chrome for every transactional email. Pass the
// purpose-specific body as `bodyHtml`; `footerHtml` is optional extra content
// (e.g. a "copy this link" fallback) rendered below the main card content.
export function emailShell(bodyHtml: string, footerHtml?: string)
{
    return `<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#F4F2EA;padding:40px 20px;margin:0;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;border:1px solid #DDD8CC;overflow:hidden;">
    <div style="padding:28px 32px 20px;border-bottom:1px solid #F0EDE4;">
      <p style="font-size:20px;font-weight:700;color:#1c1917;margin:0 0 2px;">Maturin</p>
      <p style="font-size:11px;color:#a8a29e;margin:0;letter-spacing:.05em;">SLOW &amp; CONSISTENT</p>
    </div>
    <div style="padding:32px;">
      ${bodyHtml}
    </div>
    ${footerHtml ? `<div style="padding:16px 32px;background:#FAFAF8;border-top:1px solid #F0EDE4;">${footerHtml}</div>` : ''}
  </div>
</body>
</html>`;
}
