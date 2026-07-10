import { Request, Response } from 'express';
import * as authService from '../services/authService';
import { AuthRequest } from '../middleware/auth';

export async function register(req: Request, res: Response): Promise<void>
{
    const { email, name, password } = req.body;

    if (!email || !name || !password)
    {
        res.status(400).json({ error: 'email, name and password are required' });
        return;
    }

    if (password.length < 8)
    {
        res.status(400).json({ error: 'Password must be at least 8 characters' });
        return;
    }

    try
    {
        const result = await authService.register(email.trim().toLowerCase(), name.trim(), password);
        res.status(201).json(result);
    }
    catch (err: any)
    {
        if (err.message === 'EMAIL_TAKEN')
        {
            res.status(409).json({ error: 'An account with this email already exists' });
            return;
        }
        console.error('[auth] register failed:', err);
        res.status(500).json({ error: 'Registration failed' });
    }
}

export async function login(req: Request, res: Response): Promise<void>
{
    const { email, password } = req.body;

    if (!email || !password)
    {
        res.status(400).json({ error: 'email and password are required' });
        return;
    }

    try
    {
        const result = await authService.login(email.trim().toLowerCase(), password);
        res.json(result);
    }
    catch (err: any)
    {
        if (err.message === 'INVALID_CREDENTIALS')
        {
            res.status(401).json({ error: 'Invalid email or password' });
            return;
        }
        console.error('[auth] login failed:', err);
        res.status(500).json({ error: 'Login failed' });
    }
}

export async function getMe(req: Request, res: Response): Promise<void>
{
    const userId = (req as AuthRequest).userId;
    try
    {
        const user = await authService.getMe(userId);
        res.json(user);
    }
    catch
    {
        res.status(404).json({ error: 'User not found' });
    }
}

export async function updateProfile(req: Request, res: Response): Promise<void>
{
    const userId = (req as AuthRequest).userId;
    const { name, email, avatarUrl } = req.body;

    if (name !== undefined && !String(name).trim())
    {
        res.status(400).json({ error: 'Name cannot be empty' });
        return;
    }

    if (email !== undefined && !String(email).trim())
    {
        res.status(400).json({ error: 'Email cannot be empty' });
        return;
    }

    if (avatarUrl !== undefined && avatarUrl !== null && !/^data:image\/(png|jpe?g|webp|gif);base64,/.test(avatarUrl))
    {
        res.status(400).json({ error: 'Invalid image format' });
        return;
    }

    try
    {
        const user = await authService.updateProfile(userId, {
            name:      name  !== undefined ? String(name).trim()               : undefined,
            email:     email !== undefined ? String(email).trim().toLowerCase(): undefined,
            avatarUrl: avatarUrl !== undefined ? avatarUrl                     : undefined,
        });
        res.json(user);
    }
    catch (err: any)
    {
        if (err.message === 'EMAIL_TAKEN')
        {
            res.status(409).json({ error: 'An account with this email already exists' });
            return;
        }
        console.error('[auth] updateProfile failed:', err);
        res.status(500).json({ error: 'Failed to update profile' });
    }
}

export async function changePassword(req: Request, res: Response): Promise<void>
{
    const userId = (req as AuthRequest).userId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword)
    {
        res.status(400).json({ error: 'currentPassword and newPassword are required' });
        return;
    }

    if (newPassword.length < 8)
    {
        res.status(400).json({ error: 'New password must be at least 8 characters' });
        return;
    }

    try
    {
        await authService.changePassword(userId, currentPassword, newPassword);
        res.status(204).send();
    }
    catch (err: any)
    {
        if (err.message === 'INVALID_CREDENTIALS')
        {
            // 400, not 401 — the frontend treats 401 as "session invalid" and force-logs-out,
            // but a mistyped current password shouldn't kill the user's session.
            res.status(400).json({ error: 'Current password is incorrect' });
            return;
        }
        console.error('[auth] changePassword failed:', err);
        res.status(500).json({ error: 'Failed to change password' });
    }
}

export async function deleteAccount(req: Request, res: Response): Promise<void>
{
    const userId = (req as AuthRequest).userId;
    const { password } = req.body;

    if (!password)
    {
        res.status(400).json({ error: 'password is required' });
        return;
    }

    try
    {
        await authService.deleteAccount(userId, password);
        res.status(204).send();
    }
    catch (err: any)
    {
        if (err.message === 'INVALID_CREDENTIALS')
        {
            // 400, not 401 — same reasoning as changePassword: a mistyped password
            // shouldn't trip the frontend's "session invalid" auto-logout.
            res.status(400).json({ error: 'Password is incorrect' });
            return;
        }
        console.error('[auth] deleteAccount failed:', err);
        res.status(500).json({ error: 'Failed to delete account' });
    }
}

export async function forgotPassword(req: Request, res: Response): Promise<void>
{
    const { email } = req.body;

    if (!email)
    {
        res.status(400).json({ error: 'email is required' });
        return;
    }

    // Always respond the same way whether or not the account exists —
    // prevents using this endpoint to enumerate registered emails.
    try { await authService.requestPasswordReset(String(email).trim().toLowerCase()); }
    catch (err) { console.error('[auth] requestPasswordReset failed:', err); }

    res.json({ message: 'If an account exists for that email, we sent password reset instructions.' });
}

export async function resetPassword(req: Request, res: Response): Promise<void>
{
    const { token, newPassword } = req.body;

    if (!token || !newPassword)
    {
        res.status(400).json({ error: 'token and newPassword are required' });
        return;
    }

    if (newPassword.length < 8)
    {
        res.status(400).json({ error: 'New password must be at least 8 characters' });
        return;
    }

    try
    {
        await authService.resetPassword(token, newPassword);
        res.status(204).send();
    }
    catch (err: any)
    {
        if (err.message === 'INVALID_TOKEN')
        {
            res.status(400).json({ error: 'This reset link is invalid or has expired' });
            return;
        }
        console.error('[auth] resetPassword failed:', err);
        res.status(500).json({ error: 'Failed to reset password' });
    }
}

export async function verifyEmail(req: Request, res: Response): Promise<void>
{
    const { token } = req.body;

    if (!token)
    {
        res.status(400).json({ error: 'token is required' });
        return;
    }

    try
    {
        await authService.verifyEmail(token);
        res.status(204).send();
    }
    catch (err: any)
    {
        if (err.message === 'INVALID_TOKEN')
        {
            res.status(400).json({ error: 'This verification link is invalid or has expired' });
            return;
        }
        console.error('[auth] verifyEmail failed:', err);
        res.status(500).json({ error: 'Failed to verify email' });
    }
}

export async function resendVerification(req: Request, res: Response): Promise<void>
{
    const userId = (req as AuthRequest).userId;
    try
    {
        await authService.sendVerificationEmail(userId);
        res.status(204).send();
    }
    catch (err)
    {
        console.error('[auth] resendVerification failed:', err);
        res.status(500).json({ error: 'Failed to send verification email' });
    }
}
