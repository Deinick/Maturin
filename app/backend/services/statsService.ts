import prisma from '../lib/prisma';

export async function getProductivity(userId: string) {
  const thirtyDaysAgo=new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate()-30);

  const fromDate=thirtyDaysAgo.toISOString().split('T')[0];

  const totalTasks=await prisma.shortTask.count({
    where: { userId, dateAssigned: { gte: fromDate } },
  });

  const completedTasks=await prisma.shortTask.count({
    where: { userId, completed: true, dateAssigned: { gte: fromDate } },
  });

  const DIFFICULTY_WEIGHT: Record<string, number> = { easy: 0.5, medium: 1.0, hard: 1.5 };
  const habits = await prisma.habit.findMany({
    where: { userId },
    include: { logs: { where: { date: { gte: fromDate } } } },
  });

  let totalHabitLogs = 0;
  let completedHabitLogs = 0;
  let weightedTotal = 0;
  let weightedCompleted = 0;

  for (const habit of habits) {
    const w = DIFFICULTY_WEIGHT[habit.difficulty] ?? 1.0;
    for (const log of habit.logs) {
      totalHabitLogs++;
      weightedTotal += w;
      if (log.status === 'completed') {
        completedHabitLogs++;
        weightedCompleted += w;
      }
    }
  }

  const taskScore=totalTasks=== 0 ? 0 : completedTasks / totalTasks;
  const habitScore=weightedTotal === 0 ? 0 : weightedCompleted / weightedTotal;
  const productivity=0.6 * taskScore+0.4*habitScore;

  return { taskScore, habitScore, productivity, totalTasks, completedTasks, totalHabitLogs, completedHabitLogs };
}

export async function getCompletionRate(userId: string)
{
  const thirtyDaysAgo=new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate()-30);
  const fromDate=thirtyDaysAgo.toISOString().split('T')[0];
  const total=await prisma.shortTask.count({ where: { userId, dateAssigned: { gte: fromDate } } });
  const completed=await prisma.shortTask.count({ where: { userId, completed: true, dateAssigned: { gte: fromDate } } });
  return { rate: total === 0 ? 0.6 : completed / total };
}

export async function getWeeklySummary(userId: string)
{
  const today=new Date();
  const dayOfWeek=today.getDay(); // 0 Sunday, 1 Monday
  const diffToMonday=(dayOfWeek+6)%7;
  const monday=new Date(today);
  monday.setDate(today.getDate()-diffToMonday);
  const weekStart=monday.toISOString().split('T')[0];
  const weekEnd=today.toISOString().split('T')[0];
  const tasks=await prisma.shortTask.findMany({
    where: { userId, dateAssigned: { gte: weekStart, lte: weekEnd } },
  });

  const totalLogged=tasks.length;
  const completedCount=tasks.filter(t => t.completed).length;
  const pendingCount=tasks.filter(t => !t.completed).length;
  const rolledOver=tasks.filter(t => t.rolloverCount > 0).length;
  const byDay: Record<string,{ completed: number; total: number }>={};
  for(const t of tasks)
  {
    if (!byDay[t.dateAssigned]) byDay[t.dateAssigned]={ completed: 0, total: 0 };
    byDay[t.dateAssigned].total++;
    if (t.completed) byDay[t.dateAssigned].completed++;
  }
  const days=Object.entries(byDay).map(([date, s]) => ({ date, ...s }));
  const bestDay=days.sort((a, b) => b.completed - a.completed)[0] ?? null;
  const byCategory: Record<string, { completed: number; total: number }> = {};
  for (const t of tasks) {
    const cat=t.category ?? 'other';
    if (!byCategory[cat]) byCategory[cat] = { completed: 0, total: 0 };
    byCategory[cat].total++;
    if (t.completed) byCategory[cat].completed++;
  }
  const categoryStats=Object.entries(byCategory)
    .map(([category, s]) => ({ category, ...s, rate: s.total === 0 ? 0 : s.completed / s.total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 4);
  return { weekStart, weekEnd, totalLogged, completed: completedCount, pending: pendingCount, rolledOver, bestDay, categoryStats };
}

export async function exportUserData(userId: string) {
  const [tasks, habits, projects] = await Promise.all([
    prisma.shortTask.findMany({ where: { userId }, orderBy: { dateAssigned: 'desc' } }),
    prisma.habit.findMany({ where: { userId }, include: { logs: true } }),
    prisma.project.findMany({ where: { members: { some: { userId } } }, include: { phases: { include: { milestones: true } } } }),
  ]);
  return { exportedAt: new Date().toISOString(), tasks, habits, projects };
}

export async function getYearlyStats(userId: string) {
  const year = new Date().getFullYear();
  const startOfYear = `${year}-01-01`;
  const endOfYear = `${year}-12-31`;

  const tasksCompleted = await prisma.shortTask.count({
    where: { userId, completed: true, dateAssigned: { gte: startOfYear, lte: endOfYear } },
  });

  const habitsCompleted = await prisma.habitLog.count({
    where: { habit: { userId }, status: 'completed', date: { gte: startOfYear, lte: endOfYear } },
  });

  const projectsCompleted = await prisma.project.count({
    where: { userId, completed: true },
  });

  return { year, tasksCompleted, habitsCompleted, projectsCompleted };
}