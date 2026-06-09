import prisma from '../lib/prisma';

export async function getSuggestions(userId: string)
{
    const suggestions: {type: string, message: string; id?: string}[]=[];

    const today=new Date().toISOString().split('T')[0];

    
    const stalledTasks=await prisma.shortTask.findMany({
        where:{
            userId,
            completed: false,
            rolloverCount: {gte: 3}},
    });

    for(const task of stalledTasks)
    {
        suggestions.push({
            type: 'split_task',
            message: `"${task.text}" has been rolling over for ${task.rolloverCount} days — consider splitting it`,
            id: task.id,
        });
    }


    const totalTasks=await prisma.shortTask.count({
        where: {userId}
    });
    const completedTasks=await prisma.shortTask.count({
        where:{userId, completed:true} 
    });
    const productivity=totalTasks === 0 ? 1 : completedTasks / totalTasks;
    if(productivity < 0.4)
    {
        suggestions.push({
            type: 'reduce_tasks',
            message: 'You are completing less than 40% of your tasks — try setting fewer tasks per day',
        });
    }


    const overdueMilestones=await prisma.milestone.findMany({
        where:{completed: false, dueDate:{lt:today}, phase: {project: {userId}}},
    });

    for(const milestone of overdueMilestones)
    {
        suggestions.push({
            type: 'overdue_milestone',
            message: `Milestone "${milestone.title}" is overdue — consider recalibrating your project plan`,
            id: milestone.id,
        });
    }


    const habits=await prisma.habit.findMany({
        where:{userId, isActive: true},
        include:{logs:{orderBy:{date:'desc'}, take: 3}},
    });

    for(const habit of habits)
    {
        const lastThree=habit.logs.slice(0,3);
        if(lastThree.length ===3 && lastThree.every(l=>l.status==='skipped'))
        {
            suggestions.push({
                type: 'habit_streak_broken',
                message: `You have skipped "${habit.name}" for 3 days in a row — consider adjusting the goal`,
                id: habit.id,
            });
        }
    }
    return suggestions;
}