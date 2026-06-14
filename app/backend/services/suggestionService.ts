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
    const thirtyDaysAgo=new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate()-30);
    const fromDate=thirtyDaysAgo.toISOString().split('T')[0];
    const recentTasks=await prisma.shortTask.findMany({
        where: { userId, dateAssigned: { gte: fromDate }, category: { not: null } },
    });

    if(recentTasks.length>=10)
    {
        const byCat: Record<string,{ total: number; rolledOver: number }> = {};
        for(const t of recentTasks)
        {
            const cat=t.category!;
            if(!byCat[cat]) byCat[cat] = { total: 0, rolledOver: 0 };
            byCat[cat].total++;
            if(t.rolloverCount>0) byCat[cat].rolledOver++;
        }
        const overallRolloverRate=recentTasks.filter(t => t.rolloverCount > 0).length / recentTasks.length;
        for (const [cat, s] of Object.entries(byCat)) {
            if (s.total<3) continue;
            const catRate=s.rolledOver / s.total;
            if (catRate >0.6 && catRate > overallRolloverRate + 0.2)
            {
                suggestions.push({
                    type: 'avoidance_pattern',
                    message: `You tend to delay ${cat} tasks — they roll over ${Math.round(catRate * 100)}% of the time. Consider breaking them down or scheduling a specific time.`,
                });
            }
        }
    }

    return suggestions;
}