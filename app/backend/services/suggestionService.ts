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

        //NOT SURE IF I NEED IT STILL
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
    const productivity=totalTasks===0?1 : completedTasks/totalTasks;
    if(productivity<0.4)
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

    // Habit stacking: detect habits completed together >= 75% of the time
    if (habits.length >= 2) {
        for (let i = 0; i < habits.length; i++) {
            for (let j = i + 1; j < habits.length; j++) {
                const h1 = habits[i];
                const h2 = habits[j];
                const h1Completed = new Set(h1.logs.filter(l => l.status === 'completed').map(l => l.date));
                const h2Completed = new Set(h2.logs.filter(l => l.status === 'completed').map(l => l.date));
                const bothCompleted = [...h1Completed].filter(d => h2Completed.has(d));
                const eitherCompleted = new Set([...h1Completed, ...h2Completed]);
                if (eitherCompleted.size > 0 && bothCompleted.length >= 7 &&
                    bothCompleted.length / eitherCompleted.size >= 0.75) {
                    const pct = Math.round((bothCompleted.length / eitherCompleted.size) * 100);
                    suggestions.push({
                        type: 'habit_stack',
                        message: `"${h1.name}" and "${h2.name}" are completed together ${pct}% of the time — consider treating them as one routine block.`,
                    });
                }
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
            phase: { project: { userId } },
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

/*

TO BE CALIBRATED LATER ( MORE COMMON REASONS TO BE ADDED, THRESHOLDS TO BE TUNED BASED ON USER FEEDBACK)

*/
        const REASON_LABELS: Record<string, string>=
        {
            no_time:    'time management',
            unclear:    'unclear next steps',
            external:   'external dependencies',
            motivation: 'motivation',
        };
        for(const[reason,count] of Object.entries(byReason))
        {
            if(count>=2)
            {
                suggestions.push({
                    type: 'block_pattern',
                    message: `${count} milestones are stuck due to ${REASON_LABELS[reason] ?? reason} — this pattern may be worth addressing directly.`,
                });
            }
        }
    }

    // Calibration: if user consistently over/underestimates milestone effort
    const ratedMilestones=await prisma.milestone.findMany({
        where:
        {
            phase:{ project: { userId } },
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
                message: `You've rated ${easier} of your last ${total} milestones as easier than expected — your estimates may be running long.`,
            });
        }
    }

    return suggestions;
}
