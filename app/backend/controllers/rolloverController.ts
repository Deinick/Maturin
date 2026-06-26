import { Request, Response } from 'express';
import * as rolloverService from '../services/rolloverService';
import { AuthRequest } from '../middleware/auth';

export async function runRollover(req: Request, res: Response): Promise<void>
{
    const userId = (req as AuthRequest).userId;
    const result = await rolloverService.rolloverTasks(userId);
    res.json(result);
}
