import { Request, Response, NextFunction } from 'express';
import * as pendingChangeService from '../services/pendingChangeService';
import * as projectService from '../services/projectService';
import { AuthRequest } from '../middleware/auth';

export async function getAllPendingChangeCounts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId = (req as AuthRequest).userId;
        const counts = await pendingChangeService.getAllPendingChangeCounts(userId);
        res.json(counts);
    } catch (err) { next(err); }
}

export async function getPendingChanges(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId    = (req as AuthRequest).userId;
        const projectId = req.params['id'] as string;
        const changes   = await pendingChangeService.getPendingChanges(projectId, userId);
        res.json(changes);
    } catch (err) { next(err); }
}

export async function approvePendingChange(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId   = (req as AuthRequest).userId;
        const changeId = req.params['changeId'] as string;
        const change   = await pendingChangeService.approvePendingChange(changeId, userId);
        res.json(change);
    } catch (err) { next(err); }
}

export async function rejectPendingChange(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId   = (req as AuthRequest).userId;
        const changeId = req.params['changeId'] as string;
        const change   = await pendingChangeService.rejectPendingChange(changeId, userId);
        res.json(change);
    } catch (err) { next(err); }
}

export async function setMemberPermission(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const userId       = (req as AuthRequest).userId;
        const projectId    = req.params['id'] as string;
        const memberId     = req.params['memberId'] as string;
        const { canApprove } = req.body;
        if (typeof canApprove !== 'boolean') { res.status(400).json({ error: 'canApprove must be a boolean' }); return; }
        const updated = await projectService.setMemberPermission(projectId, memberId, canApprove, userId);
        res.json(updated);
    } catch (err) { next(err); }
}
