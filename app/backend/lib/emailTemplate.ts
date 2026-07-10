import { Resend } from 'resend';

export const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';
export const FROM_EMAIL   = process.env.FROM_EMAIL   ?? 'invites@steadily.app';

export function getResend()
{
    return new Resend(process.env.RESEND_API_KEY ?? 'missing');
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
      <p style="font-size:20px;font-weight:700;color:#1c1917;margin:0 0 2px;">Steadily</p>
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
