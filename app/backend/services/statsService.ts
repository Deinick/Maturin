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

  const totalHabitLogs=await prisma.habitLog.count({
    where: { habit: { userId }, date: { gte: fromDate } },
  });

  const completedHabitLogs=await prisma.habitLog.count({
    where: { habit: { userId }, status: 'completed', date: { gte: fromDate } },
  });

  const taskScore=totalTasks=== 0 ? 0 : completedTasks / totalTasks;
  const habitScore=totalHabitLogs=== 0 ? 0 : completedHabitLogs / totalHabitLogs;
  const productivity=0.6 * taskScore+0.4*habitScore;

  return { taskScore, habitScore, productivity, totalTasks, completedTasks, totalHabitLogs, completedHabitLogs };
}