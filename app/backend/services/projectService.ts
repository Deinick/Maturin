import prisma from '../lib/prisma';

export class PermissionError extends Error {
    readonly status = 403;
    constructor() {
        super('Insufficient permissions');
        this.name = 'PermissionError';
    }
}

const ROLE_RANK: Record<string, number> = { viewer: 0, contributor: 1, owner: 2 };

async function requireRole(projectId: string, userId: string, min: 'viewer' | 'contributor' | 'owner') {
    const member = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId } },
    });
    if (!member || ROLE_RANK[member.role] < ROLE_RANK[min]) throw new PermissionError();
}

async function projectIdForPhase(phaseId: string): Promise<string> {
    const ph = await prisma.phase.findUniqueOrThrow({ where: { id: phaseId }, select: { projectId: true } });
    return ph.projectId;
}

async function projectIdForMilestone(milestoneId: string): Promise<string> {
    const m = await prisma.milestone.findUniqueOrThrow({
        where: { id: milestoneId },
        select: { phase: { select: { projectId: true } } },
    });
    if (!m.phase) throw new Error('Orphaned milestone');
    return m.phase.projectId;
}


export async function getProjects(userId: string)
{
    return prisma.project.findMany({
        where: { members: { some: { userId } } },
        include: {
            phases: { include: { milestones: true } },
            members: {
                include: { user: { select: { id: true, name: true, email: true } } },
                orderBy: { joinedAt: 'asc' },
            },
        },
    });
}

export async function getProjectMembers(projectId: string, userId: string)
{
    await requireRole(projectId, userId, 'viewer');
    return prisma.projectMember.findMany({
        where: { projectId },
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { joinedAt: 'asc' },
    });
}

export async function createProject(userId: string, data: {
    title: string;
    description?: string;
    targetEndDate?: string;
})
{
    return prisma.$transaction(async tx => {
        const project = await tx.project.create({ data: { userId, ...data } });
        await tx.projectMember.create({ data: { projectId: project.id, userId, role: 'owner' } });
        return project;
    });
}

export async function createPhase(projectId: string, userId: string, title: string, description: string | undefined, order: number)
{
    await requireRole(projectId, userId, 'contributor');
    return prisma.phase.create({ data: { projectId, title, description, order } });
}

export async function createMilestone(phaseId: string, userId: string, title: string, description: string | undefined, order: number, dueDate?: string)
{
    const projectId = await projectIdForPhase(phaseId);
    await requireRole(projectId, userId, 'contributor');
    return prisma.milestone.create({ data: { phaseId, title, description, order, dueDate } });
}

export async function updateProject(id: string, userId: string, data: {
    title?: string;
    description?: string;
    targetEndDate?: string;
    completed?: boolean;
})
{
    await requireRole(id, userId, 'contributor');
    return prisma.project.update({ where: { id }, data });
}

export async function updatePhase(id: string, userId: string, data: {
    title?: string;
    description?: string;
    order?: number;
    completed?: boolean;
})
{
    const projectId = await projectIdForPhase(id);
    await requireRole(projectId, userId, 'contributor');
    return prisma.phase.update({ where: { id }, data });
}

export async function updateMilestone(id: string, userId: string, data: {
    title?: string;
    description?: string;
    order?: number;
    dueDate?: string;
    completed?: boolean;
    effortRating?: string;
    blockReason?: string;
})
{
    const projectId = await projectIdForMilestone(id);
    await requireRole(projectId, userId, 'contributor');
    const updateData: Record<string, unknown> = { ...data };
    if (data.completed === true)  updateData.completedAt = new Date();
    if (data.completed === false) updateData.completedAt = null;
    return prisma.milestone.update({ where: { id }, data: updateData });
}

export async function deleteProject(id: string, userId: string)
{
    await requireRole(id, userId, 'owner');
    return prisma.project.delete({ where: { id } });
}

export async function deletePhase(id: string, userId: string)
{
    const projectId = await projectIdForPhase(id);
    await requireRole(projectId, userId, 'contributor');
    return prisma.phase.delete({ where: { id } });
}

export async function deleteMilestone(id: string, userId: string)
{
    const projectId = await projectIdForMilestone(id);
    await requireRole(projectId, userId, 'contributor');
    return prisma.milestone.delete({ where: { id } });
}

export async function getProjectInsights(projectId: string, userId: string)
{
    await requireRole(projectId, userId, 'viewer');

    const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { phases: { include: { milestones: true } } },
    });
    if (!project) return null;

    const allMilestones = project.phases.flatMap(ph => ph.milestones);
    const total = allMilestones.length;
    const today = new Date().toISOString().split('T')[0];

    const completedCount     = allMilestones.filter(m => m.completed).length;
    const dueableMilestones  = allMilestones.filter(m => m.dueDate);
    const overdue            = dueableMilestones.filter(m => !m.completed && m.dueDate! < today).length;

    const completionRate = total === 0 ? 0.5 : completedCount / total;
    const overdueScore   = dueableMilestones.length === 0 ? 0.8 : 1 - (overdue / dueableMilestones.length);

    const completedDates = allMilestones
        .filter(m => m.completed && m.completedAt)
        .map(m => m.completedAt!.getTime())
        .sort((a, b) => b - a);

    let recencyScore = 0.5;
    if (completedDates.length > 0) {
        const daysAgo = (Date.now() - completedDates[0]) / 86400000;
        recencyScore = daysAgo <= 1 ? 1.0 : daysAgo <= 3 ? 0.85 : daysAgo <= 7 ? 0.65 : daysAgo <= 14 ? 0.4 : daysAgo <= 30 ? 0.15 : 0;
    }

    const healthScore = Math.min(100, Math.max(0, Math.round(
        (0.5 * completionRate + 0.3 * overdueScore + 0.2 * recencyScore) * 100
    )));

    const projectStartMs         = new Date(project.createdAt).getTime();
    const weeksElapsed           = (Date.now() - projectStartMs) / (7 * 86400000);
    const completedWithTimestamp = allMilestones.filter(m => m.completed && m.completedAt);

    if (weeksElapsed >= 1 && completedWithTimestamp.length >= 2) {
        const actualPerWeek = completedWithTimestamp.length / weeksElapsed;
        const remaining     = total - completedCount;

        let plannedPerWeek: number | null = null;
        if (project.targetEndDate) {
            const targetMs        = new Date(project.targetEndDate + 'T00:00:00').getTime();
            const totalWeeksPlanned = (targetMs - projectStartMs) / (7 * 86400000);
            if (totalWeeksPlanned > 0) plannedPerWeek = total / totalWeeksPlanned;
        }

        let revisedFinishDate: string | null = null;
        if (remaining === 0) {
            revisedFinishDate = today;
        } else if (actualPerWeek > 0) {
            const finishMs    = Date.now() + (remaining / actualPerWeek) * 7 * 86400000;
            revisedFinishDate = new Date(finishMs).toISOString().split('T')[0];
        }

        return {
            healthScore,
            velocity: {
                available:          true,
                weeksElapsed:       Math.round(weeksElapsed * 10) / 10,
                completedCount:     completedWithTimestamp.length,
                actualPerWeek:      Math.round(actualPerWeek * 10) / 10,
                plannedPerWeek:     plannedPerWeek !== null ? Math.round(plannedPerWeek * 10) / 10 : null,
                remainingCount:     remaining,
                revisedFinishDate,
                targetFinishDate:   project.targetEndDate ?? null,
            },
        };
    }

    return { healthScore, velocity: { available: false } };
}
