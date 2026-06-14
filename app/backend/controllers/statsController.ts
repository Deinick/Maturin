import {Request, Response} from 'express';
import * as statsService from '../services/statsService';

export async function getProductivity(req: Request, res: Response) : Promise<void>
{
    const userId=req.headers['x-user-id'] as string;
    if(!userId)
    {
        res.status(400).json({ error: 'userId is required' });
        return;
    }
    const stats=await statsService.getProductivity(userId);
    res.json(stats);
}

export async function getCompletionRate(req: Request, res: Response): Promise<void> {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) { res.status(400).json({ error: 'userId is required' }); return; }
    const data = await statsService.getCompletionRate(userId);
    res.json(data);
}

export async function getWeeklySummary(req: Request, res: Response): Promise<void> {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) { res.status(400).json({ error: 'userId is required' }); return; }
    const data = await statsService.getWeeklySummary(userId);
    res.json(data);
}

export async function getYearlyStats(req: Request, res: Response): Promise<void> {
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
        res.status(400).json({ error: 'userId is required' });
        return;
    }
    const stats = await statsService.getYearlyStats(userId);
    res.json(stats);
}
