import { Request, Response } from 'express';
import * as projectService from '../services/projectService';
import { AuthRequest } from '../middleware/auth';

export async function getProjects(req: Request, res: Response): Promise<void>
{
    const userId   = (req as AuthRequest).userId;
    const projects = await projectService.getProjects(userId);
    res.json(projects);
}

export async function getProjectInsights(req: Request, res: Response): Promise<void>
{
    const id       = req.params['id'] as string;
    const insights = await projectService.getProjectInsights(id);
    if (!insights)
    {
        res.status(404).json({ error: 'Project not found' });
        return;
    }
    res.json(insights);
}

export async function createProject(req: Request, res: Response): Promise<void>
{
    const userId = (req as AuthRequest).userId;
    const { title, description, targetEndDate } = req.body;
    if (!title)
    {
        res.status(400).json({ error: 'title is required' });
        return;
    }
    const project = await projectService.createProject(userId, { title, description, targetEndDate });
    res.status(201).json(project);
}

export async function createPhase(req: Request, res: Response): Promise<void>
{
    const projectId              = req.params['projectId'] as string;
    const { title, description, order } = req.body;
    if (!title || order === undefined)
    {
        res.status(400).json({ error: 'title and order are required' });
        return;
    }
    const phase = await projectService.createPhase(projectId, title, description, order);
    res.status(201).json(phase);
}

export async function createMilestone(req: Request, res: Response): Promise<void>
{
    const phaseId                         = req.params['phaseId'] as string;
    const { title, description, order, dueDate } = req.body;
    if (!title || order === undefined)
    {
        res.status(400).json({ error: 'title and order are required' });
        return;
    }
    const milestone = await projectService.createMilestone(phaseId, title, description, order, dueDate);
    res.status(201).json(milestone);
}

export async function updateProject(req: Request, res: Response): Promise<void>
{
    const id = req.params['id'] as string;
    const { title, description, targetEndDate, completed } = req.body;
    const project = await projectService.updateProject(id, { title, description, targetEndDate, completed });
    res.json(project);
}

export async function updatePhase(req: Request, res: Response): Promise<void>
{
    const id = req.params['id'] as string;
    const { title, description, order, completed } = req.body;
    const phase = await projectService.updatePhase(id, { title, description, order, completed });
    res.json(phase);
}

export async function updateMilestone(req: Request, res: Response): Promise<void>
{
    const id = req.params['id'] as string;
    const { title, description, order, dueDate, completed, effortRating, blockReason } = req.body;
    const milestone = await projectService.updateMilestone(id, { title, description, order, dueDate, completed, effortRating, blockReason });
    res.json(milestone);
}

export async function deleteProject(req: Request, res: Response): Promise<void>
{
    const id = req.params['id'] as string;
    await projectService.deleteProject(id);
    res.status(204).send();
}

export async function deletePhase(req: Request, res: Response): Promise<void>
{
    const id = req.params['id'] as string;
    await projectService.deletePhase(id);
    res.status(204).send();
}

export async function deleteMilestone(req: Request, res: Response): Promise<void>
{
    const id = req.params['id'] as string;
    await projectService.deleteMilestone(id);
    res.status(204).send();
}
