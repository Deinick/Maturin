import prisma from '../lib/prisma';

export async function rolloverTasks(userId: string) {
  const yesterday=new Date();
  yesterday.setDate(yesterday.getDate()-1);
  const yesterdayStr=yesterday.toISOString().split('T')[0];

  const today=new Date().toISOString().split('T')[0];

  const pendingTasks=await prisma.shortTask.findMany({
    where:
    {
      userId,
      status: 'pending',
      dateAssigned: yesterdayStr,
    },
  });

  const updated=await Promise.all(
    pendingTasks.map(task =>
      prisma.shortTask.update({
        where: { id: task.id },
        data: {
          dateAssigned: today,
          rolloverCount: task.rolloverCount + 1,
        },
      })
    )
  );

  const warnings=updated.filter(t => t.rolloverCount>=3);

  const overdueMilestones=await prisma.milestone.findMany({
    where:
    {
      completed: false,
      dueDate: {lt: today},
      phase: { project: {userId}},
    },
  });

  return { rolledOver: updated.length, warnings, overdueMilestones };
}