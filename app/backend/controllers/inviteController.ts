import { Request, Response, NextFunction } from 'express';
import * as inviteService from '../services/inviteService';
import { AuthRequest } from '../middleware/auth';

export async function createInvite(req: Request, res: Response, next: NextFunction): Promise<void>
{
    try {
        const userId    = (req as AuthRequest).userId;
        const projectId = req.params['id'] as string;
        const { email, role } = req.body;
        if (!email || !role) { res.status(400).json({ error: 'email and role are required' }); return; }
        if (role !== 'contributor' && role !== 'viewer') { res.status(400).json({ error: 'role must be contributor or viewer' }); return; }
        const invite = await inviteService.createInvite(projectId, userId, email, role);
        res.status(201).json(invite);
    } catch (err) { next(err); }
}

export async function getInvite(req: Request, res: Response, next: NextFunction): Promise<void>
{
    try {
        const token  = req.params['token'] as string;
        const invite = await inviteService.getInviteDetails(token);
        if (!invite) { res.status(404).json({ error: 'Invite not found' }); return; }
        res.json(invite);
    } catch (err) { next(err); }
}

export async function acceptInvite(req: Request, res: Response, next: NextFunction): Promise<void>
{
    try {
        const userId  = (req as AuthRequest).userId;
        const token   = req.params['token'] as string;
        const project = await inviteService.acceptInvite(token, userId);
        res.json({ projectId: project.id, projectTitle: project.title });
    } catch (err) { next(err); }
}
