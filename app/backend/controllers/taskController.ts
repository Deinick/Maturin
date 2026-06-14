import { Request, Response } from 'express';
import * as taskService from '../services/taskService';

export async function getTasks(req: Request, res: Response): Promise<void>
{
    const userId=req.headers['x-user-id'] as string;
    const date=req.query['date'] as string;

    if(!userId || !date)
    {
        res.status(400).json({ error: 'userId and date are required' });
        return;
    }

    const tasks=await taskService.getTasks(userId, date);
    res.json(tasks);
}

export async function createTask(req: Request, res: Response): Promise<void>
{
    const userId=req.headers['x-user-id'] as string;
    const { text, dateAssigned, priority, description, timeEstimate }=req.body;
    if(!userId || !text || !dateAssigned)
    {
        res.status(400).json({ error: 'userId, text and dateAssigned are required' });
        return;
    }
    const task=await taskService.createTask(userId, { text, dateAssigned, priority, description, timeEstimate });
    res.status(201).json(task);
}

export async function updateTask(req: Request, res: Response): Promise<void>
{
    const id=req.params['id'] as string;
    const { status, completed, text, priority, description, timeEstimate }=req.body;
    const task=await taskService.updateTask(id, { status, completed, text, priority, description, timeEstimate });
    res.json(task);
}

export async function rolloverTask(req: Request, res: Response): Promise<void>
{
    const id=req.params['id'] as string;
    const today=req.body?.targetDate || new Date().toISOString().split('T')[0];
    const task=await taskService.rolloverTask(id, today);
    res.json(task);
}

export async function deleteTask(req: Request, res: Response): Promise<void>
{
    const id=req.params['id'] as string;
    await taskService.deleteTask(id);
    res.status(204).send();
}