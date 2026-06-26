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
