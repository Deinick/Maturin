import prisma from '../lib/prisma';

function getISODayNum(d: Date): number //Remaps date to ISO standard
{
  return d.getDay()===0 ? 7 : d.getDay(); //start week on Monday as 1, Sunday is 7
}

function getActiveDatesInMonth(activeDayNums: number[], year: number, month: number): string[]
{
  const result: string[]=[];
  const daysInMonth=new Date(year,month,0).getDate();
  for(let day=1;day<=daysInMonth;day++)
    {
    const d=new Date(year,month-1,day);
    if(activeDayNums.includes(getISODayNum(d)))
    {
      result.push(
        `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      );
    }
  }
  return result;
}








export async function getSuggestions(userId: string)
{
    const suggestions:{type: string, message: string; id?: string}[]=[];
    const today=new Date().toISOString().split('T')[0];
    const stalledTasks=await prisma.shortTask.findMany({ //Detect tasks rolling over for 3+ days

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

    const fourteenDaysAgo=new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate()-14);
    const fromDateTasks=fourteenDaysAgo.toISOString().split('T')[0];
    const totalTasks=await prisma.shortTask.count({
        where: {userId, dateAssigned: {gte: fromDateTasks}}
    });
    const completedTasks=await prisma.shortTask.count({
        where:{userId, completed:true, dateAssigned: {gte: fromDateTasks}}
    });
    const productivity=totalTasks===0?1 : completedTasks/totalTasks;
    if(totalTasks>=5 && productivity<0.4)
    {
        suggestions.push({
            type: 'reduce_tasks',
            message: `You've completed ${Math.round(productivity*100)}% of your tasks in the last 14 days — try setting fewer tasks per day to build consistency.`,
        });
    }

    const overdueMilestones=await prisma.milestone.count({
        where:{ completed: false, dueDate:{ lt:today }, phase:{ project:{ members:{ some:{ userId } } } } },
    });

    if(overdueMilestones>0)
    {
        suggestions.push({
            type: 'overdue_milestone',
            message: overdueMilestones===1
                ? 'You have 1 overdue milestone — consider recalibrating your project plan.'
                : `You have ${overdueMilestones} overdue milestones — consider recalibrating your project plan.`,
        });
    }

    // Fetch habits with last 90 days of logs (covers recovery framing + stacking)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const fromDateHabits = ninetyDaysAgo.toISOString().split('T')[0];

    const habits = await prisma.habit.findMany({
        where: { userId, isActive: true },
        include: { logs: { where: { date: { gte: fromDateHabits } } } },
    });

    // Recovery framing: forward-looking prompt when habit is lagging this month
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;

    for (const habit of habits) {
        const activeDayNums = habit.activeDays.split(',').map(Number);
        const allActiveDates = getActiveDatesInMonth(activeDayNums, year, month);
        const passedActiveDates = allActiveDates.filter(d => d <= today);
        const remainingActiveDates = allActiveDates.filter(d => d > today);

        if (passedActiveDates.length < 3) continue;

        const completionsThisMonth = habit.logs.filter(l =>
            l.status === 'completed' && l.date >= monthStart && l.date <= today
        ).length;

        const rate = completionsThisMonth / passedActiveDates.length;

        if (rate < 0.65 && remainingActiveDates.length > 0) {
            const totalActiveDays = allActiveDates.length;
            const needed = Math.max(0, Math.ceil(0.7 * totalActiveDays) - completionsThisMonth);
            if (needed > 0 && needed <= remainingActiveDates.length) {
                suggestions.push({
                    type: 'habit_recovery',
                    message: `You're at ${Math.round(rate * 100)}% on "${habit.name}" this month. To reach 70%, complete it ${needed} of the next ${remainingActiveDates.length} active day${remainingActiveDates.length === 1 ? '' : 's'}.`,
                    id: habit.id,
                });
            }
        }
    }



    // Avoidance pattern: task categories with high rollover rate
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
    // Blocking pattern: 2+ active milestones share the same block reason
    const blockedMilestones=await prisma.milestone.findMany({
        where: {
            phase: { project: { members: { some: { userId } } } },
            blockReason: { not: null },
            completed: false,
        },
        select: { blockReason: true },
    });

    if (blockedMilestones.length>=2)
    {
        const byReason: Record<string, number>={};
        for(const m of blockedMilestones)
        {
            byReason[m.blockReason!]=(byReason[m.blockReason!] ?? 0)+1;
        }

        const REASON_MESSAGES: Record<string, (count: number) => string> =
        {
            no_time: (count) =>
                `${count} milestone${count===1?'':'s'} ${count===1?'is':'are'} blocked due to time constraints — try time-blocking dedicated work sessions or reducing how many projects run in parallel.`,

            unclear: (count) =>
                `${count} milestone${count===1?'':'s'} ${count===1?'is':'are'} stalled on unclear next steps — before your next session, define one immediate action for each to remove the ambiguity.`,

            external: (count) =>
                `${count} milestone${count===1?'':'s'} ${count===1?'is':'are'} waiting on external dependencies — consider escalating where possible, or use the blocked time to advance other work in parallel.`,

            motivation: (count) =>
                `${count} milestone${count===1?'':'s'} ${count===1?'is':'are'} stalled due to low motivation — try reordering them to put a quick win first, or break each into a smaller immediate task to rebuild momentum.`,

            resources: (count) =>
                `${count} milestone${count===1?'':'s'} ${count===1?'is':'are'} blocked by missing resources — identify exactly what is needed and treat acquiring it as the next milestone action.`,

            priority_conflict: (count) =>
                `${count} milestone${count===1?'':'s'} ${count===1?'is':'are'} blocked by conflicting priorities — consider a deliberate triage session to rank them and protect time for the top one.`,

            too_large: (count) =>
                `${count} milestone${count===1?'':'s'} ${count===1?'is':'are'} blocked because the scope feels too large — break each into sub-milestones so there is always a concrete next step to take.`,

            waiting_feedback: (count) =>
                `${count} milestone${count===1?'':'s'} ${count===1?'is':'are'} waiting on feedback — set a follow-up deadline and move on to other work rather than leaving them in an open loop.`,
        };

        for(const [reason, count] of Object.entries(byReason))
        {
            if(count>=2)
            {
                const buildMessage = REASON_MESSAGES[reason];
                const message = buildMessage
                    ? buildMessage(count)
                    : `${count} milestone${count===1?'':'s'} ${count===1?'is':'are'} blocked due to ${reason.replace(/_/g,' ')} — address this pattern directly to unblock your progress.`;

                suggestions.push({
                    type: 'block_pattern',
                    message,
                });
            }
        }
    }

    // Calibration: if user consistently over/underestimates milestone effort
    const ratedMilestones=await prisma.milestone.findMany({
        where:
        {
            phase:{ project:{ members:{ some:{ userId } } } },
            effortRating:{ not: null },
            completed: true,
        },
        select:{ effortRating: true},
    });

    if(ratedMilestones.length>=5)
    {
        const harder=ratedMilestones.filter(m => m.effortRating === 'harder').length;
        const easier=ratedMilestones.filter(m => m.effortRating === 'easier').length;
        const total=ratedMilestones.length;
        if(harder/total>=0.6)
        {
            suggestions.push({
                type: 'calibration',
                message: `You've rated ${harder} of your last ${total} milestones as harder than expected — consider building in more buffer when planning.`,
            });
        }
        else if(easier/total>=0.6)
        {
            suggestions.push({
                type: 'calibration',
                message: `You've rated ${easier} of your last ${total} milestones as easier than expected — your estimates are likely too conservative. Consider tightening your buffers or setting more ambitious milestones.`,
            });
        }
    }

    return suggestions;
}
