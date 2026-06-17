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
    targetEndDate?: string;
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

export async function createMilestone(phaseId: string, title: string, description: string | undefined, order: number, dueDate?: string)
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
    effortRating?: string;
    blockReason?: string;
})
{
    const updateData: Record<string, unknown> = { ...data };
    if (data.completed === true)  updateData.completedAt = new Date();
    if (data.completed === false) updateData.completedAt = null;
    return prisma.milestone.update({ where: {id}, data: updateData });
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

export async function getProjectInsights(projectId: string)
{
    const project=await prisma.project.findUnique({
        where: { id: projectId },
        include: { phases: { include: { milestones: true } } },
    });
    if (!project) return null;

    const allMilestones=project.phases.flatMap(ph => ph.milestones);
    const total=allMilestones.length;
    const today=new Date().toISOString().split('T')[0];

    const completedCount=allMilestones.filter(m => m.completed).length;
    const dueableMilestones=allMilestones.filter(m => m.dueDate);
    const overdue=dueableMilestones.filter(m =>!m.completed && m.dueDate!<today).length;

    const completionRate=total===0 ? 0.5 : completedCount / total; //0.5 by the deafult
    const overdueScore=dueableMilestones.length===0 ? 0.8 : 1-(overdue/dueableMilestones.length);

    const completedDates=allMilestones
        .filter(m => m.completed && m.completedAt)
        .map(m => m.completedAt!.getTime())
        .sort((a, b) => b - a);

    let recencyScore=0.5;
    if(completedDates.length>0)
    {
        const daysAgo=(Date.now()-completedDates[0])/86400000;
        recencyScore=daysAgo<=1 ? 1.0 : daysAgo<=3 ? 0.85 : daysAgo<=7 ? 0.65 : daysAgo<=14 ? 0.4 : daysAgo <= 30 ? 0.15 : 0;
    }
    /*
    
    multiplier based on how recently a user completed a task. 
    The more recent the activity, the higher the score (closer to 1.0). 
    As time passes, the score decays.
    
    */

    const healthScore=Math.min(100, Math.max(0, Math.round(
        (0.5 * completionRate + 0.3 * overdueScore + 0.2 * recencyScore) * 100
    )));
    /*
    this is a weighted, rounded health score 
    between 0 and 100 based on three distinct metrics

    */








    const projectStartMs=new Date(project.createdAt).getTime(); //project start date in milliseconds
    const weeksElapsed=(Date.now()-projectStartMs)/(7*86400000); //how many weeks have passed since project start
    const completedWithTimestamp=allMilestones.filter(m => m.completed && m.completedAt);


    /*
    next tthing only works if project is AT LEAST 1 WEEK OLD 
    and there are AT LEAST 2 complted milestones with timestamps (to calculate a velocity)
    */
    if(weeksElapsed>=1 && completedWithTimestamp.length>=2)
    {
        const actualPerWeek=completedWithTimestamp.length/weeksElapsed; //average number of milestones completed per week since project start
        const remaining=total-completedCount; 



        let plannedPerWeek: number | null = null; //average number of milestones that should be completed per week to meet the target end date
        if(project.targetEndDate)
//if there is a target end date, calculate how many milestones should be completed per week to meet that target
        {
            const targetMs=new Date(project.targetEndDate+'T00:00:00').getTime();
            const totalWeeksPlanned=(targetMs-projectStartMs)/(7*86400000);
            if(totalWeeksPlanned>0) plannedPerWeek=total/totalWeeksPlanned;
        }

        let revisedFinishDate: string | null = null;
        if(remaining===0)
        {
            revisedFinishDate=today;
        }
        else if(actualPerWeek>0)
        {
            const finishMs=Date.now()+(remaining/actualPerWeek)*7*86400000;
            revisedFinishDate=new Date(finishMs).toISOString().split('T')[0];
        }
        return {
            healthScore,
            velocity:
            {
                available: true,
                weeksElapsed: Math.round(weeksElapsed * 10) / 10,
                completedCount: completedWithTimestamp.length,
                actualPerWeek: Math.round(actualPerWeek * 10) / 10,
                plannedPerWeek: plannedPerWeek !== null ? Math.round(plannedPerWeek * 10) / 10 : null,
                remainingCount: remaining,
                revisedFinishDate,
                targetFinishDate: project.targetEndDate ?? null,
            },
        };
    }

    return { healthScore, velocity: { available: false } };
}
