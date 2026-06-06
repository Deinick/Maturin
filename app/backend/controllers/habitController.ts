import { Request, Response} from 'express';
import * as habitService from '../services/habitService';

export async function getHabits(req: Request, res: Response): Promise<void>
{
    const userId=req.headers['x-user-id'] as string;
    if(!userId)
    {
        res.status(400).json({ error: 'userId is required' });
        return;
    }
    const habits=await habitService.getHabits(userId);
    res.json(habits);
}

export async function createHabit(req: Request, res: Response): Promise<void>
{
    const userId=req.headers['x-user-id'] as string;
    const { name }=req.body;
    if(!userId || !name)
    {
        res.status(400).json({ error: 'userId and name are required' });
        return;
    }
    const habit=await habitService.createHabit(userId, name);
    res.status(201).json(habit);
}

export async function logHabit(req: Request, res: Response): Promise<void>
{
    const habitId=req.params['id'] as string;
    const { date, status }=req.body;
    if(!date || !status)
    {
        res.status(400).json({ error: 'date and status are required' });
        return;
    }
    const log=await habitService.logHabit(habitId, date, status);
    res.status(201).json(log);
}

export async function updateHabit(req: Request, res: Response): Promise<void>
{
    const id=req.params['id'] as string;
    const { name }=req.body;
    const habit=await habitService.updateHabit(id, name);
    res.json(habit);
}

export async function updateHabitLog(req: Request, res: Response): Promise<void>
{
    const id=req.params['id'] as string;
    const { status }=req.body;
    const log=await habitService.updateHabitLog(id, status);
    res.json(log);
}

export async function deleteHabit(req: Request, res: Response): Promise<void>
{
    const id=req.params['id'] as string;
    await habitService.deleteHabit(id);
    res.status(204).send();
}

