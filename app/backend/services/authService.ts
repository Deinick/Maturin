import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../lib/prisma';
import { FRONTEND_URL, sendEmail, emailShell } from '../lib/emailTemplate';

const SECRET = process.env.JWT_SECRET!;

const RESET_TOKEN_TTL_MS  = 60 * 60 * 1000;      // 1 hour
const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const PUBLIC_USER_SELECT = { id: true, email: true, name: true, avatarUrl: true, emailVerified: true } as const;

export async function register(email: string, name: string, password: string)
{
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new Error('EMAIL_TAKEN');

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({ data: { email, name, passwordHash, emailVerified: false } });
    const token = jwt.sign({ userId: user.id }, SECRET, { expiresIn: '30d' });

    await sendEmail('welcome', { to: user.email, subject: 'Welcome to Steadily', html: welcomeEmailHtml({ name: user.name }) });
    await sendVerificationEmail(user.id);

    return { token, user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl, emailVerified: user.emailVerified } };
}

export async function login(email: string, password: string)
{
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) throw new Error('INVALID_CREDENTIALS');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new Error('INVALID_CREDENTIALS');

    const token = jwt.sign({ userId: user.id }, SECRET, { expiresIn: '30d' });
    return { token, user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl, emailVerified: user.emailVerified } };
}

export async function getMe(userId: string)
{
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { ...PUBLIC_USER_SELECT, createdAt: true },
    });
    if (!user) throw new Error('NOT_FOUND');
    return user;
}

export async function updateProfile(userId: string, data: { name?: string; email?: string; avatarUrl?: string | null })
{
    const { name, email, avatarUrl } = data;

    let emailChanged = false;
    if (email)
    {
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing && existing.id !== userId) throw new Error('EMAIL_TAKEN');

        const current = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
        emailChanged = current.email !== email;
    }

    const user = await prisma.user.update({
        where: { id: userId },
        data: {
            ...(name      !== undefined ? { name }      : {}),
            ...(email     !== undefined ? { email }     : {}),
            ...(avatarUrl !== undefined ? { avatarUrl } : {}),
            ...(emailChanged ? { emailVerified: false } : {}),
        },
        select: { ...PUBLIC_USER_SELECT, createdAt: true },
    });

    if (emailChanged) await sendVerificationEmail(userId);

    return user;
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string)
{
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('NOT_FOUND');

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new Error('INVALID_CREDENTIALS');

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

    await sendEmail('password-changed', { to: user.email, subject: 'Your Steadily password was changed', html: passwordChangedEmailHtml({ name: user.name }) });
}

export async function deleteAccount(userId: string, password: string)
{
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('NOT_FOUND');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new Error('INVALID_CREDENTIALS');

    // Send before deleting — nothing to notify afterwards once the row is gone.
    await sendEmail('account-deleted', { to: user.email, subject: 'Your Steadily account has been deleted', html: accountDeletedEmailHtml({ name: user.name }) });

    // All owned records (tasks, habits, projects, memberships, invites, etc.)
    // cascade via onDelete: Cascade on the User relations in schema.prisma.
    await prisma.user.delete({ where: { id: userId } });
}

// ── Password reset ──────────────────────────────────────────────────────────

export async function requestPasswordReset(email: string)
{
    const user = await prisma.user.findUnique({ where: { email } });
    // Deliberately do nothing (but don't reveal it) if no account matches —
    // prevents leaking which emails have accounts via response timing/content.
    if (!user) return;

    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });

    const token = crypto.randomBytes(32).toString('hex');
    await prisma.passwordResetToken.create({
        data: { userId: user.id, token, expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
    });

    const resetUrl = `${FRONTEND_URL}/reset-password/${token}`;
    await sendEmail('reset-password', { to: user.email, subject: 'Reset your Steadily password', html: resetPasswordEmailHtml({ name: user.name, resetUrl }) });
}

export async function resetPassword(token: string, newPassword: string)
{
    const record = await prisma.passwordResetToken.findUnique({ where: { token } });
    if (!record || record.usedAt || record.expiresAt < new Date()) throw new Error('INVALID_TOKEN');

    const passwordHash = await bcrypt.hash(newPassword, 12);
    const [user] = await prisma.$transaction([
        prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
        prisma.passwordResetToken.update({ where: { token }, data: { usedAt: new Date() } }),
    ]);

    await sendEmail('password-changed', { to: user.email, subject: 'Your Steadily password was changed', html: passwordChangedEmailHtml({ name: user.name }) });
}

// ── Email verification ──────────────────────────────────────────────────────

export async function sendVerificationEmail(userId: string)
{
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.emailVerified) return;

    await prisma.emailVerificationToken.deleteMany({ where: { userId, usedAt: null } });

    const token = crypto.randomBytes(32).toString('hex');
    await prisma.emailVerificationToken.create({
        data: { userId, token, expiresAt: new Date(Date.now() + VERIFY_TOKEN_TTL_MS) },
    });

    const verifyUrl = `${FRONTEND_URL}/verify-email/${token}`;
    await sendEmail('verify-email', { to: user.email, subject: 'Verify your Steadily email', html: verifyEmailHtml({ name: user.name, verifyUrl }) });
}

export async function verifyEmail(token: string)
{
    const record = await prisma.emailVerificationToken.findUnique({ where: { token } });
    if (!record || record.usedAt || record.expiresAt < new Date()) throw new Error('INVALID_TOKEN');

    await prisma.$transaction([
        prisma.user.update({ where: { id: record.userId }, data: { emailVerified: true } }),
        prisma.emailVerificationToken.update({ where: { token }, data: { usedAt: new Date() } }),
    ]);
}

// ── Email templates ──────────────────────────────────────────────────────────

function resetPasswordEmailHtml({ name, resetUrl }: { name: string; resetUrl: string })
{
    return emailShell(`
      <p style="color:#44403c;font-size:15px;line-height:1.6;margin:0 0 6px;">Hi ${name},</p>
      <p style="color:#44403c;font-size:15px;line-height:1.6;margin:0 0 20px;">
        We received a request to reset your Steadily password. This link expires in 1 hour.
      </p>
      <a href="${resetUrl}"
        style="display:inline-block;background:#C4601A;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:600;">
        Reset password →
      </a>
      <p style="color:#a8a29e;font-size:12px;margin:24px 0 0;">
        If you didn't request this, you can safely ignore this email.
      </p>
    `);
}

function verifyEmailHtml({ name, verifyUrl }: { name: string; verifyUrl: string })
{
    return emailShell(`
      <p style="color:#44403c;font-size:15px;line-height:1.6;margin:0 0 6px;">Hi ${name},</p>
      <p style="color:#44403c;font-size:15px;line-height:1.6;margin:0 0 20px;">
        Please confirm this is your email address. This link expires in 24 hours.
      </p>
      <a href="${verifyUrl}"
        style="display:inline-block;background:#4C8077;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:600;">
        Verify email →
      </a>
    `);
}

function welcomeEmailHtml({ name }: { name: string })
{
    return emailShell(`
      <p style="color:#44403c;font-size:15px;line-height:1.6;margin:0 0 6px;">Hi ${name},</p>
      <p style="color:#44403c;font-size:15px;line-height:1.6;margin:0 0 20px;">
        Welcome to Steadily — glad to have you. Small actions, done daily, add up to big change.
      </p>
      <a href="${FRONTEND_URL}"
        style="display:inline-block;background:#C4601A;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:600;">
        Open Steadily →
      </a>
    `);
}

function passwordChangedEmailHtml({ name }: { name: string })
{
    return emailShell(`
      <p style="color:#44403c;font-size:15px;line-height:1.6;margin:0 0 6px;">Hi ${name},</p>
      <p style="color:#44403c;font-size:15px;line-height:1.6;margin:0 0 20px;">
        Your Steadily password was just changed. If this was you, no action is needed.
      </p>
      <p style="color:#78716c;font-size:13px;margin:0;">
        If you didn't make this change, reset your password immediately and contact support.
      </p>
    `);
}

function accountDeletedEmailHtml({ name }: { name: string })
{
    return emailShell(`
      <p style="color:#44403c;font-size:15px;line-height:1.6;margin:0 0 6px;">Hi ${name},</p>
      <p style="color:#44403c;font-size:15px;line-height:1.6;margin:0 0 20px;">
        Your Steadily account and all associated data have been permanently deleted, as requested.
      </p>
      <p style="color:#78716c;font-size:13px;margin:0;">
        If you didn't request this, please contact support right away.
      </p>
    `);
}
