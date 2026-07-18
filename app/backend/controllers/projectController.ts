import { Request, Response, NextFunction } from 'express';
import * as projectService from '../services/projectService';
import { AuthRequest } from '../middleware/auth';

export async function getProjects(req: Request, res: Response): Promise<void>
{
    const userId   = (req as AuthRequest).userId;
    const projects = await projectService.getProjects(userId);
    res.json(projects);
}

export async function getProjectMembers(req: Request, res: Response, next: NextFunction): Promise<void>
{
    try {
        const userId    = (req as AuthRequest).userId;
        const projectId = req.params['id'] as string;
        const members   = await projectService.getProjectMembers(projectId, userId);
        res.json(members);
    } catch (err) { next(err); }
}

export async function getProjectInsights(req: Request, res: Response, next: NextFunction): Promise<void>
{
    try {
        const userId   = (req as AuthRequest).userId;
        const id       = req.params['id'] as string;
        const insights = await projectService.getProjectInsights(id, userId);
        if (!insights) { res.status(404).json({ error: 'Project not found' }); return; }
        res.json(insights);
    } catch (err) { next(err); }
}

export async function createProject(req: Request, res: Response): Promise<void>
{
    const userId = (req as AuthRequest).userId;
    const { title, description, targetEndDate } = req.body;
    if (!title) { res.status(400).json({ error: 'title is required' }); return; }
    const project = await projectService.createProject(userId, { title, description, targetEndDate });
    res.status(201).json(project);
}

export async function createPhase(req: Request, res: Response, next: NextFunction): Promise<void>
{
    try {
        const userId    = (req as AuthRequest).userId;
        const projectId = req.params['projectId'] as string;
        const { title, description, dueDate, order } = req.body;
        if (!title || order === undefined) { res.status(400).json({ error: 'title and order are required' }); return; }
        const phase = await projectService.createPhase(projectId, userId, title, description, order, dueDate);
        res.status(201).json(phase);
    } catch (err) { next(err); }
}

export async function createMilestone(req: Request, res: Response, next: NextFunction): Promise<void>
{
    try {
        const userId  = (req as AuthRequest).userId;
        const phaseId = req.params['phaseId'] as string;
        const { title, description, order, dueDate, assigneeIds } = req.body;
        if (!title || order === undefined) { res.status(400).json({ error: 'title and order are required' }); return; }
        const milestone = await projectService.createMilestone(phaseId, userId, title, description, order, dueDate, assigneeIds);
        res.status(201).json(milestone);
    } catch (err) { next(err); }
}

export async function updateProject(req: Request, res: Response, next: NextFunction): Promise<void>
{
    try {
        const userId = (req as AuthRequest).userId;
        const id     = req.params['id'] as string;
        const { title, description, targetEndDate, completed } = req.body;
        const project = await projectService.updateProject(id, userId, { title, description, targetEndDate, completed });
        res.json(project);
    } catch (err) { next(err); }
}

export async function updatePhase(req: Request, res: Response, next: NextFunction): Promise<void>
{
    try {
        const userId = (req as AuthRequest).userId;
        const id     = req.params['id'] as string;
        const { title, description, dueDate, order, completed } = req.body;
        const phase = await projectService.updatePhase(id, userId, { title, description, dueDate, order, completed });
        res.json(phase);
    } catch (err) { next(err); }
}

export async function updateMilestone(req: Request, res: Response, next: NextFunction): Promise<void>
{
    try {
        const userId = (req as AuthRequest).userId;
        const id     = req.params['id'] as string;
        const { title, description, order, dueDate, completed, effortRating, blockReason, assigneeIds } = req.body;
        const milestone = await projectService.updateMilestone(id, userId, { title, description, order, dueDate, completed, effortRating, blockReason, assigneeIds });
        res.json(milestone);
    } catch (err) { next(err); }
}

export async function deleteProject(req: Request, res: Response, next: NextFunction): Promise<void>
{
    try {
        const userId = (req as AuthRequest).userId;
        const id     = req.params['id'] as string;
        await projectService.deleteProject(id, userId);
        res.status(204).send();
    } catch (err) { next(err); }
}

export async function removeMember(req: Request, res: Response, next: NextFunction): Promise<void>
{
    try {
        const userId    = (req as AuthRequest).userId;
        const projectId = req.params['id'] as string;
        const memberId  = req.params['memberId'] as string;
        await projectService.removeMember(projectId, memberId, userId);
        res.status(204).send();
    } catch (err) { next(err); }
}

export async function deletePhase(req: Request, res: Response, next: NextFunction): Promise<void>
{
    try {
        const userId = (req as AuthRequest).userId;
        const id     = req.params['id'] as string;
        await projectService.deletePhase(id, userId);
        res.status(204).send();
    } catch (err) { next(err); }
}

export async function deleteMilestone(req: Request, res: Response, next: NextFunction): Promise<void>
{
    try {
        const userId = (req as AuthRequest).userId;
        const id     = req.params['id'] as string;
        await projectService.deleteMilestone(id, userId);
        res.status(204).send();
    } catch (err) { next(err); }
}

export async function getMemberPerformance(req: Request, res: Response, next: NextFunction): Promise<void>
{
    try {
        const userId    = (req as AuthRequest).userId;
        const projectId = req.params['id'] as string;
        const data      = await projectService.getMemberPerformance(projectId, userId);
        res.json(data);
    } catch (err) { next(err); }
}

export async function getMyObjectives(req: Request, res: Response, next: NextFunction): Promise<void>
{
    try {
        const userId = (req as AuthRequest).userId;
        const data   = await projectService.getMyObjectives(userId);
        res.json(data);
    } catch (err) { next(err); }
}

export async function setDependencies(req: Request, res: Response, next: NextFunction): Promise<void>
{
    try {
        const userId      = (req as AuthRequest).userId;
        const phaseId     = req.params['phaseId'] as string;
        const { dependsOnIds } = req.body as { dependsOnIds: string[] };
        await projectService.setDependencies(phaseId, dependsOnIds ?? [], userId);
        res.json({ ok: true });
    } catch (err) { next(err); }
}
