import {Request, Response} from 'express';
import * as rolloverService from '../services/rolloverService';

export async function runRollover(req: Request, res: Response): Promise<void>
{
    const userId=req.headers['x-user-id'] as string;
    if(!userId)
    {
        res.status(400).json({ error: 'userId is required' });
        return;
    }
    const result=await rolloverService.rolloverTasks(userId);
    res.json(result);
}