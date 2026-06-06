import prisma from '../lib/prisma';

export async function getProjects(userId: string)
{
    return prisma.project.findMany({
        where: {userId},
        include: { phases: {include: { milestones: true}}},
    });
}

export async function createProject(userId: string, data:{
    title: string;
    description?: string;
    targetEndDate?: string; // this is tricky since i put it as users
    // estimated end date but system will have a calculated end date
    // based on the phases and milestones.
})
{
    return prisma.project.create({
        data: {userId, ...data},
    });
}

export async function createPhase(projectId: string, title: string, description: string | undefined, order: number)
{
    return prisma.phase.create({
        data: {projectId, title, description, order},
    });
}

export async function createMilestone(phaseId: string,title: string, description: string | undefined, order: number, dueDate?: string)
{
    return prisma.milestone.create({
        data: {phaseId, title, description, order, dueDate},
    });
}

export async function updateProject(id: string, data:{
    title?: string;
    description?: string;
    targetEndDate?: string;
    completed?: boolean;
})
{
    return prisma.project.update({
        where: {id},
        data,
    });
}

export async function updatePhase(id: string, data:{
    title?: string;
    description?: string;
    order?: number;
    completed?: boolean;
})
{
    return prisma.phase.update({
        where: {id},
        data,
    });
}

export async function updateMilestone(id: string, data:{
    title?: string;
    description?: string;
    order?: number;
    dueDate?: string;
    completed?: boolean;
})
{
    return prisma.milestone.update({
        where: {id},
        data,
    });
}


export async function deleteProject(id: string)
{
    return prisma.project.delete({
        where: {id},
    });
}

export async function deletePhase(id: string)
{
    return prisma.phase.delete({
        where: {id},
    });
}

export async function deleteMilestone(id: string)
{
    return prisma.milestone.delete({
        where: {id},
    });
}

