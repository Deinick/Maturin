import { Request, Response } from 'express';
import * as taskService from '../services/taskService';
import { AuthRequest } from '../middleware/auth';

export async function getTasks(req: Request, res: Response): Promise<void>
{
    const userId = (req as AuthRequest).userId;
    const date   = req.query['date'] as string;
    if (!date)
    {
        res.status(400).json({ error: 'date is required' });
        return;
    }
    const tasks = await taskService.getTasks(userId, date);
    res.json(tasks);
}

export async function createTask(req: Request, res: Response): Promise<void>
{
    const userId = (req as AuthRequest).userId;
    const { text, dateAssigned, priority, description, timeEstimate } = req.body;
    if (!text || !dateAssigned)
    {
        res.status(400).json({ error: 'text and dateAssigned are required' });
        return;
    }
    const task = await taskService.createTask(userId, { text, dateAssigned, priority, description, timeEstimate });
    res.status(201).json(task);
}

export async function updateTask(req: Request, res: Response): Promise<void>
{
    const id = req.params['id'] as string;
    const { status, completed, text, priority, description, timeEstimate } = req.body;
    const task = await taskService.updateTask(id, { status, completed, text, priority, description, timeEstimate });
    res.json(task);
}

export async function rolloverTask(req: Request, res: Response): Promise<void>
{
    const id    = req.params['id'] as string;
    const today = req.body?.targetDate || new Date().toISOString().split('T')[0];
    const task  = await taskService.rolloverTask(id, today);
    res.json(task);
}

export async function deleteTask(req: Request, res: Response): Promise<void>
{
    const id = req.params['id'] as string;
    await taskService.deleteTask(id);
    res.status(204).send();
}
