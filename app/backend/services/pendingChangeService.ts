import prisma from '../lib/prisma';
import { PermissionError } from './projectService';

async function requireCanReview(projectId: string, userId: string): Promise<void> {
    const member = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId } },
    });
    if (!member) throw new PermissionError();
    if (member.role === 'owner') return;
    if (member.role === 'contributor' && member.canApprove) return;
    throw new PermissionError();
}

async function entityLabel(entityType: string, entityId: string): Promise<string> {
    try {
        if (entityType === 'project') {
            const p = await prisma.project.findUnique({ where: { id: entityId }, select: { title: true } });
            return `Project: ${p?.title ?? entityId}`;
        }
        if (entityType === 'phase') {
            const ph = await prisma.phase.findUnique({ where: { id: entityId }, select: { title: true } });
            return `Phase: ${ph?.title ?? entityId}`;
        }
        if (entityType === 'milestone') {
            const m = await prisma.milestone.findUnique({ where: { id: entityId }, select: { title: true } });
            return `Milestone: ${m?.title ?? entityId}`;
        }
    } catch { /* entity may be deleted */ }
    return entityId;
}

export async function getAllPendingChangeCounts(userId: string) {
    const memberships = await prisma.projectMember.findMany({
        where: {
            userId,
            OR: [{ role: 'owner' }, { role: 'contributor', canApprove: true }],
        },
        select: { projectId: true },
    });

    const projectIds = memberships.map(m => m.projectId);
    if (projectIds.length === 0) return [];

    const grouped = await prisma.pendingChange.groupBy({
        by: ['projectId'],
        where: { projectId: { in: projectIds }, status: 'pending' },
        _count: { id: true },
    });

    const withCounts = grouped.filter(g => g._count.id > 0);
    if (withCounts.length === 0) return [];

    const projects = await prisma.project.findMany({
        where: { id: { in: withCounts.map(g => g.projectId) } },
        select: { id: true, title: true },
    });
    const titleMap = Object.fromEntries(projects.map(p => [p.id, p.title]));

    return withCounts.map(g => ({
        projectId:    g.projectId,
        projectTitle: titleMap[g.projectId] ?? g.projectId,
        count:        g._count.id,
    }));
}

export async function getPendingChanges(projectId: string, userId: string) {
    await requireCanReview(projectId, userId);
    const changes = await prisma.pendingChange.findMany({
        where: { projectId, status: 'pending' },
        include: { author: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'asc' },
    });
    return Promise.all(changes.map(async c => ({
        ...c,
        entityLabel: await entityLabel(c.entityType, c.entityId),
    })));
}

export async function approvePendingChange(changeId: string, reviewerId: string) {
    const change = await prisma.pendingChange.findUniqueOrThrow({ where: { id: changeId } });
    await requireCanReview(change.projectId, reviewerId);
    if (change.status !== 'pending') throw new Error('Change is not pending');

    const newData = change.newData as Record<string, string | null>;
    if (change.entityType === 'project') {
        await prisma.project.update({ where: { id: change.entityId }, data: newData });
    } else if (change.entityType === 'phase') {
        await prisma.phase.update({ where: { id: change.entityId }, data: newData });
    } else if (change.entityType === 'milestone') {
        await prisma.milestone.update({ where: { id: change.entityId }, data: newData });
    }

    return prisma.pendingChange.update({
        where: { id: changeId },
        data: { status: 'approved', reviewedBy: reviewerId, reviewedAt: new Date() },
    });
}

export async function rejectPendingChange(changeId: string, reviewerId: string) {
    const change = await prisma.pendingChange.findUniqueOrThrow({ where: { id: changeId } });
    await requireCanReview(change.projectId, reviewerId);
    if (change.status !== 'pending') throw new Error('Change is not pending');
    return prisma.pendingChange.update({
        where: { id: changeId },
        data: { status: 'rejected', reviewedBy: reviewerId, reviewedAt: new Date() },
    });
}
