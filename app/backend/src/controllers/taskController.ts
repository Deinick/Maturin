/*
Here logic deciding what to do with data happens here,
we parse and validate data (like check if date is in correct format,
or if status is one of allowed values) and then call functions from
taskService to actually interact with database.
In simple terms this file is just a validation checker and parser.
*/
import { Request, Response } from 'express';
import * as taskService from '../services/taskService';

export async function getTasks(req: Request, res: Response): Promise<void> {
  const userId = req.headers['x-user-id'] as string;
  const date = req.query['date'] as string;

  if (!userId) { res.status(400).json({ error: 'x-user-id header required' }); return; }
  if (!date)   { res.status(400).json({ error: 'date query param required' }); return; }

  try {
    const tasks = await taskService.getTasksByDate(userId, date);
    res.json(tasks);
  } catch {
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
}

export async function createTask(req: Request, res: Response): Promise<void> {
  const userId = req.headers['x-user-id'] as string;
  if (!userId) { res.status(400).json({ error: 'x-user-id header required' }); return; }

  const { text, dateAssigned, priority } = req.body as {
    text: string;
    dateAssigned: string;
    priority?: number;
  };

  if (!text || !dateAssigned) {
    res.status(400).json({ error: 'text and dateAssigned are required' });
    return;
  }

  try {
    const task = await taskService.createTask(userId, { text, dateAssigned, priority });
    res.status(201).json(task);
  } catch {
    res.status(500).json({ error: 'Failed to create task' });
  }
}

export async function updateTask(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const { status, text, priority } = req.body as {
    status?: string;
    text?: string;
    priority?: number;
  };

  try {
    const task = await taskService.updateTask(id, { status, text, priority });
    res.json(task);
  } catch {
    res.status(500).json({ error: 'Failed to update task' });
  }
}
