/* 
Here we retreive, create and update short task
This onlly knows about database itself and does not perform 
any validation or parsing, it just takes data and sends it to database
Next actual thing that happens is in taskController, where we 
parse and validate data, and then call these functions
*/
import prisma from '../lib/prisma';

export async function getTasksByDate(userId: string, date: string) {
  return prisma.shortTask.findMany({
    where: { userId, dateAssigned: date },
    orderBy: { createdAt: 'asc' },
  });
}

export async function createTask(userId: string, data: {
  text: string;
  dateAssigned: string;
  priority?: number;
}) {
  return prisma.shortTask.create({
    data: {
      userId,
      text: data.text,
      dateAssigned: data.dateAssigned,
      priority: data.priority ?? 1,
      status: 'pending',
    },
  });
}

export async function updateTask(id: string, data: {
  status?: string;
  text?: string;
  priority?: number;
}) {
  return prisma.shortTask.update({
    where: { id },
    data,
  });
}
