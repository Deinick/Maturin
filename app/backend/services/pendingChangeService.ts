import prisma from '../lib/prisma';
import { PermissionError } from './projectService';
import { FRONTEND_URL, sendEmail, emailShell } from '../lib/emailTemplate';

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

async function notifyReviewOutcome(
    change: { projectId: string; authorId: string; entityType: string; entityId: string },
    status: 'approved' | 'rejected',
): Promise<void> {
    const [author, project, label] = await Promise.all([
        prisma.user.findUnique({ where: { id: change.authorId }, select: { email: true, name: true } }),
        prisma.project.findUnique({ where: { id: change.projectId }, select: { title: true } }),
        entityLabel(change.entityType, change.entityId),
    ]);
    if (!author) return;

    const projectTitle = project?.title ?? 'your project';
    const projectUrl = `${FRONTEND_URL}/projects/${change.projectId}`;

    await sendEmail(`change-${status}`, {
        to: author.email,
        subject: status === 'approved'
            ? `Your change to "${projectTitle}" was approved`
            : `Your change to "${projectTitle}" was rejected`,
        html: changeReviewedEmailHtml({ name: author.name, projectTitle, entityLabel: label, status, projectUrl }),
    });
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

    const updated = await prisma.pendingChange.update({
        where: { id: changeId },
        data: { status: 'approved', reviewedBy: reviewerId, reviewedAt: new Date() },
    });

    await notifyReviewOutcome(change, 'approved');

    return updated;
}

export async function rejectPendingChange(changeId: string, reviewerId: string) {
    const change = await prisma.pendingChange.findUniqueOrThrow({ where: { id: changeId } });
    await requireCanReview(change.projectId, reviewerId);
    if (change.status !== 'pending') throw new Error('Change is not pending');

    const updated = await prisma.pendingChange.update({
        where: { id: changeId },
        data: { status: 'rejected', reviewedBy: reviewerId, reviewedAt: new Date() },
    });

    await notifyReviewOutcome(change, 'rejected');

    return updated;
}

// ── Email template ───────────────────────────────────────────────────────────

function changeReviewedEmailHtml({ name, projectTitle, entityLabel, status, projectUrl }: {
    name: string; projectTitle: string; entityLabel: string; status: 'approved' | 'rejected'; projectUrl: string;
})
{
    const color = status === 'approved' ? '#4C8077' : '#C0392B';
    return emailShell(`
      <p style="color:#44403c;font-size:15px;line-height:1.6;margin:0 0 6px;">Hi ${name},</p>
      <p style="color:#44403c;font-size:15px;line-height:1.6;margin:0 0 6px;">
        Your proposed change to <strong>${entityLabel}</strong> in <strong>"${projectTitle}"</strong> was
        <strong style="color:${color};">${status}</strong>.
      </p>
      <a href="${projectUrl}"
        style="display:inline-block;background:${color};color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:600;margin-top:14px;">
        View project →
      </a>
    `);
}
