import prisma from '../lib/prisma';

export class PermissionError extends Error
{
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

async function canApproveFor(projectId: string, userId: string): Promise<boolean> {
    const member = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId } },
    });
    if (!member) return false;
    return member.role === 'owner' || (member.role === 'contributor' && member.canApprove);
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

async function createPendingChanges(
    projectId: string,
    authorId: string,
    entityType: string,
    entityId: string,
    oldData: Record<string, unknown>,
    newData: Record<string, unknown>,
) {
    return prisma.$transaction(
        Object.keys(newData).map(field =>
            prisma.pendingChange.create({
                data: {
                    projectId, authorId, entityType, entityId, status: 'pending',
                    oldData: { [field]: oldData[field] } as object,
                    newData: { [field]: newData[field] } as object,
                },
            })
        )
    );
}

export type ApplyResult<T> =
    | { applied: true; data: T }
    | { applied: false; pendingChangeId: string };

function norm(v: unknown): string {
    return (v === null || v === undefined || v === '') ? '' : String(v);
}

function filterChanged(
    planData: Record<string, unknown>,
    current: Record<string, unknown>,
): { changed: Record<string, unknown>; old: Record<string, unknown> } {
    const changed: Record<string, unknown> = {};
    const old:     Record<string, unknown> = {};
    for (const [key, newVal] of Object.entries(planData)) {
        const oldVal = current[key] ?? null;
        if (norm(oldVal) !== norm(newVal)) {
            changed[key] = newVal;
            old[key]     = oldVal;
        }
    }
    return { changed, old };
}

const PLAN_FIELDS_PROJECT   = new Set(['title', 'description', 'targetEndDate']);
const PLAN_FIELDS_PHASE     = new Set(['title', 'description']);
const PLAN_FIELDS_MILESTONE = new Set(['title', 'description', 'dueDate']);


export async function getProjects(userId: string) {
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

export async function getProjectMembers(projectId: string, userId: string) {
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
}) {
    return prisma.$transaction(async tx => {
        const project = await tx.project.create({ data: { userId, ...data } });
        await tx.projectMember.create({ data: { projectId: project.id, userId, role: 'owner' } });
        return project;
    });
}

export async function createPhase(projectId: string, userId: string, title: string, description: string | undefined, order: number) {
    await requireRole(projectId, userId, 'contributor');
    return prisma.phase.create({ data: { projectId, title, description, order } });
}

export async function createMilestone(phaseId: string, userId: string, title: string, description: string | undefined, order: number, dueDate?: string) {
    const projectId = await projectIdForPhase(phaseId);
    await requireRole(projectId, userId, 'contributor');
    return prisma.milestone.create({ data: { phaseId, title, description, order, dueDate } });
}

export async function updateProject(
    id: string,
    userId: string,
    data: { title?: string; description?: string; targetEndDate?: string; completed?: boolean },
): Promise<ApplyResult<object>> {
    await requireRole(id, userId, 'contributor');

    const planData: Record<string, unknown>      = {};
    const immediateData: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(data)) {
        if (val === undefined) continue;
        if (PLAN_FIELDS_PROJECT.has(key)) planData[key] = val;
        else immediateData[key] = val;
    }

    if (Object.keys(immediateData).length > 0) {
        await prisma.project.update({ where: { id }, data: immediateData });
    }

    const currentProject = await prisma.project.findUniqueOrThrow({ where: { id } });
    if (Object.keys(planData).length > 0) {
        const { changed, old } = filterChanged(planData, currentProject as Record<string, unknown>);
        if (Object.keys(changed).length > 0) {
            if (await canApproveFor(id, userId)) {
                const updated = await prisma.project.update({ where: { id }, data: changed });
                return { applied: true, data: updated };
            }
            const changes = await createPendingChanges(id, userId, 'project', id, old, changed);
            return { applied: false, pendingChangeId: changes[0].id };
        }
    }
    return { applied: true, data: currentProject };
}

export async function updatePhase(
    id: string,
    userId: string,
    data: { title?: string; description?: string; order?: number; completed?: boolean },
): Promise<ApplyResult<object>> {
    const projectId = await projectIdForPhase(id);
    await requireRole(projectId, userId, 'contributor');

    const planData: Record<string, unknown>      = {};
    const immediateData: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(data)) {
        if (val === undefined) continue;
        if (PLAN_FIELDS_PHASE.has(key)) planData[key] = val;
        else immediateData[key] = val;
    }

    if (Object.keys(immediateData).length > 0) {
        await prisma.phase.update({ where: { id }, data: immediateData });
    }

    const currentPhase = await prisma.phase.findUniqueOrThrow({ where: { id } });
    if (Object.keys(planData).length > 0) {
        const { changed, old } = filterChanged(planData, currentPhase as Record<string, unknown>);
        if (Object.keys(changed).length > 0) {
            if (await canApproveFor(projectId, userId)) {
                const updated = await prisma.phase.update({ where: { id }, data: changed });
                return { applied: true, data: updated };
            }
            const changes = await createPendingChanges(projectId, userId, 'phase', id, old, changed);
            return { applied: false, pendingChangeId: changes[0].id };
        }
    }
    return { applied: true, data: currentPhase };
}

export async function updateMilestone(
    id: string,
    userId: string,
    data: {
        title?: string; description?: string; order?: number; dueDate?: string;
        completed?: boolean; effortRating?: string; blockReason?: string;
    },
): Promise<ApplyResult<object>> {
    const projectId = await projectIdForMilestone(id);
    await requireRole(projectId, userId, 'contributor');

    const planData: Record<string, unknown>      = {};
    const immediateData: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(data)) {
        if (val === undefined) continue;
        if (PLAN_FIELDS_MILESTONE.has(key)) planData[key] = val;
        else immediateData[key] = val;
    }

    if (Object.keys(immediateData).length > 0) {
        const update: Record<string, unknown> = { ...immediateData };
        if (immediateData['completed'] === true)  update['completedAt'] = new Date();
        if (immediateData['completed'] === false) update['completedAt'] = null;
        await prisma.milestone.update({ where: { id }, data: update });
    }

    const currentMilestone = await prisma.milestone.findUniqueOrThrow({ where: { id } });
    if (Object.keys(planData).length > 0) {
        const { changed, old } = filterChanged(planData, currentMilestone as Record<string, unknown>);
        if (Object.keys(changed).length > 0) {
            if (await canApproveFor(projectId, userId)) {
                const updated = await prisma.milestone.update({ where: { id }, data: changed });
                return { applied: true, data: updated };
            }
            const changes = await createPendingChanges(projectId, userId, 'milestone', id, old, changed);
            return { applied: false, pendingChangeId: changes[0].id };
        }
    }
    return { applied: true, data: currentMilestone };
}

export async function deleteProject(id: string, userId: string) {
    await requireRole(id, userId, 'owner');
    return prisma.project.delete({ where: { id } });
}

export async function deletePhase(id: string, userId: string) {
    const projectId = await projectIdForPhase(id);
    await requireRole(projectId, userId, 'contributor');
    return prisma.phase.delete({ where: { id } });
}

export async function deleteMilestone(id: string, userId: string) {
    const projectId = await projectIdForMilestone(id);
    await requireRole(projectId, userId, 'contributor');
    return prisma.milestone.delete({ where: { id } });
}

export async function setMemberPermission(
    projectId: string,
    targetUserId: string,
    canApprove: boolean,
    requesterId: string,
) {
    await requireRole(projectId, requesterId, 'owner');
    const member = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId: targetUserId } },
    });
    if (!member) throw new Error('Member not found');
    if (member.role !== 'contributor') throw new Error('canApprove can only be set for contributors');
    return prisma.projectMember.update({
        where: { projectId_userId: { projectId, userId: targetUserId } },
        data: { canApprove },
        include: { user: { select: { id: true, name: true, email: true } } },
    });
}

export async function getProjectInsights(projectId: string, userId: string) {
    await requireRole(projectId, userId, 'viewer');

    const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { phases: { include: { milestones: true } } },
    });
    if (!project) return null;

    const allMilestones = project.phases.flatMap(ph => ph.milestones);
    const total = allMilestones.length;
    const today = new Date().toISOString().split('T')[0];

    const completedCount    = allMilestones.filter(m => m.completed).length;
    const dueableMilestones = allMilestones.filter(m => m.dueDate);
    const overdue           = dueableMilestones.filter(m => !m.completed && m.dueDate! < today).length;

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
            const targetMs          = new Date(project.targetEndDate + 'T00:00:00').getTime();
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
                available:        true,
                weeksElapsed:     Math.round(weeksElapsed * 10) / 10,
                completedCount:   completedWithTimestamp.length,
                actualPerWeek:    Math.round(actualPerWeek * 10) / 10,
                plannedPerWeek:   plannedPerWeek !== null ? Math.round(plannedPerWeek * 10) / 10 : null,
                remainingCount:   remaining,
                revisedFinishDate,
                targetFinishDate: project.targetEndDate ?? null,
            },
        };
    }

    return { healthScore, velocity: { available: false } };
}
